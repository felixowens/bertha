//! Checking a URL the way a visitor would, and saying what went wrong in plain words.

use std::error::Error as _;
use std::sync::Arc;
use std::time::{Duration, Instant};

use bertha_core::time::Millis;
use bertha_db::writes::monitors::CheckResult;

/// A check that takes longer than this has failed.
pub const TIMEOUT: Duration = Duration::from_secs(10);
/// Answers slower than this count as degraded.
pub const SLOW_MS: u32 = 2_000;
const MAX_REDIRECTS: usize = 5;

/// The one HTTP client for outgoing requests: checks and webhooks.
pub fn http_client() -> anyhow::Result<reqwest::Client> {
    // lettre already uses ring; one crypto provider for the whole process. Installing
    // twice (tests) is harmless.
    let _ = rustls::crypto::ring::default_provider().install_default();
    Ok(reqwest::Client::builder()
        .user_agent(concat!("bertha/", env!("CARGO_PKG_VERSION")))
        .timeout(TIMEOUT)
        .connect_timeout(TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(MAX_REDIRECTS))
        .build()?)
}

type CannedFn = dyn Fn(&str) -> (bool, Option<u16>, Option<String>) + Send + Sync;

#[derive(Clone)]
pub enum Checker {
    Http {
        client: reqwest::Client,
        region: String,
    },
    /// Answers without the network, for tests: `(ok, status, error)` per URL.
    Canned(Arc<CannedFn>),
}

impl Checker {
    pub fn canned(f: impl Fn(&str) -> (bool, Option<u16>, Option<String>) + Send + Sync + 'static) -> Checker {
        Checker::Canned(Arc::new(f))
    }

    pub async fn check(&self, url: &str, at: Millis) -> CheckResult {
        match self {
            Checker::Canned(f) => {
                let (ok, http_status, error) = f(url);
                CheckResult {
                    at,
                    ok,
                    degraded: false,
                    http_status,
                    response_ms: Some(120),
                    error,
                    region: "test".into(),
                }
            }
            Checker::Http { client, region } => {
                let started = Instant::now();
                let res = client.get(url).header("cache-control", "no-cache").send().await;
                let ms = u32::try_from(started.elapsed().as_millis()).unwrap_or(u32::MAX);
                let region = region.clone();
                match res {
                    Ok(r) => {
                        let status = r.status();
                        let ok = status.is_success() || status.is_redirection();
                        CheckResult {
                            at,
                            ok,
                            degraded: ok && ms > SLOW_MS,
                            http_status: Some(status.as_u16()),
                            response_ms: Some(ms),
                            error: (!ok).then(|| format!("Answered {status}")),
                            region,
                        }
                    }
                    Err(e) => CheckResult {
                        at,
                        ok: false,
                        degraded: false,
                        http_status: None,
                        response_ms: None,
                        error: Some(plain_words(&e)),
                        region,
                    },
                }
            }
        }
    }
}

/// What a failed request means, for someone reading the monitor page.
fn plain_words(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        return format!("Timed out after {}s", TIMEOUT.as_secs());
    }
    if e.is_redirect() {
        return format!("More than {MAX_REDIRECTS} redirects");
    }
    let mut chain = String::new();
    let mut source = e.source();
    while let Some(s) = source {
        chain.push_str(&s.to_string().to_lowercase());
        chain.push(' ');
        source = s.source();
    }
    if chain.contains("dns") || chain.contains("lookup") || chain.contains("nodename") {
        "Couldn't find the host".into()
    } else if chain.contains("expired") && chain.contains("certificate") {
        "TLS certificate expired".into()
    } else if chain.contains("certificate") || chain.contains("tls") || chain.contains("handshake") {
        "TLS certificate isn't valid".into()
    } else if chain.contains("refused") {
        "Connection refused".into()
    } else if chain.contains("reset") || chain.contains("closed") {
        "The connection was closed".into()
    } else {
        "Couldn't connect".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_refused_connection_says_so() {
        // Port 9 on localhost: nothing listens there.
        let checker = Checker::Http { client: http_client().expect("client"), region: "here".into() };
        let r = checker.check("http://127.0.0.1:9/", 5).await;
        assert!(!r.ok);
        assert_eq!(r.at, 5);
        assert_eq!(r.error.as_deref(), Some("Connection refused"));
    }

    #[tokio::test]
    async fn status_codes_count() {
        let app = axum::Router::new()
            .route("/ok", axum::routing::get(|| async { "ok" }))
            .route("/down", axum::routing::get(|| async { (axum::http::StatusCode::SERVICE_UNAVAILABLE, "no") }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        tokio::spawn(async move { axum::serve(listener, app).await });
        let checker = Checker::Http { client: http_client().expect("client"), region: "here".into() };

        let up = checker.check(&format!("http://{addr}/ok"), 0).await;
        assert!(up.ok && !up.degraded);
        assert_eq!(up.http_status, Some(200));
        let down = checker.check(&format!("http://{addr}/down"), 0).await;
        assert!(!down.ok);
        assert_eq!(down.error.as_deref(), Some("Answered 503 Service Unavailable"));
    }
}
