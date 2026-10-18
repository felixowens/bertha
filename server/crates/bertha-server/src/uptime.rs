//! Checking a URL the way a visitor would, and saying what went wrong in plain words.

use std::error::Error as _;
use std::sync::Arc;
use std::time::{Duration, Instant};

use bertha_core::time::{DAY, Millis, parse_millis};
use bertha_db::writes::monitors::CheckResult;

/// A check that takes longer than this has failed.
pub const TIMEOUT: Duration = Duration::from_secs(10);
/// Answers slower than this count as degraded.
pub const SLOW_MS: u32 = 2_000;
const MAX_REDIRECTS: usize = 5;
/// A certificate this close to expiring makes the site degraded, while there's still
/// time to renew it.
pub const CERT_WARNING: Millis = 14 * DAY;

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
        .tls_info(true)
        .build()?)
}

type CannedFn = dyn Fn(&str) -> (bool, Option<u16>, Option<String>) + Send + Sync;

#[derive(Clone)]
pub enum Checker {
    Http {
        client: reqwest::Client,
        region: String,
    },
    /// Answers without the network, for tests: `(ok, status, error)` per URL. An ok
    /// answer with an error is degraded, the error being why.
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
                    degraded: ok && error.is_some(),
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
                        let expires = r
                            .extensions()
                            .get::<reqwest::tls::TlsInfo>()
                            .and_then(|t| t.peer_certificate())
                            .and_then(cert_expiry);
                        let warning = if !ok {
                            Some(format!("Answered {status}"))
                        } else {
                            expires.and_then(|e| expiry_warning(e, at)).or_else(|| {
                                (ms > SLOW_MS).then(|| format!("Answered in {:.1}s", f64::from(ms) / 1000.0))
                            })
                        };
                        CheckResult {
                            at,
                            ok,
                            degraded: ok && warning.is_some(),
                            http_status: Some(status.as_u16()),
                            response_ms: Some(ms),
                            error: warning,
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

/// "TLS certificate expires in 5 days", when it's within [`CERT_WARNING`].
fn expiry_warning(expires: Millis, now: Millis) -> Option<String> {
    let left = expires - now;
    (left < CERT_WARNING).then(|| match left / DAY {
        0 => "TLS certificate expires today".to_owned(),
        1 => "TLS certificate expires tomorrow".to_owned(),
        n => format!("TLS certificate expires in {n} days"),
    })
}

/// When a DER certificate stops being valid: `tbsCertificate.validity.notAfter`.
fn cert_expiry(der: &[u8]) -> Option<Millis> {
    let (_, cert, _) = tlv(der)?;
    let (_, tbs, _) = tlv(cert)?;
    let mut rest = tbs;
    // [0] version is optional.
    if rest.first() == Some(&0xa0) {
        rest = tlv(rest)?.2;
    }
    let rest = tlv(rest)?.2; // serial number
    let rest = tlv(rest)?.2; // signature algorithm
    let rest = tlv(rest)?.2; // issuer
    let (_, validity, _) = tlv(rest)?;
    let (_, _, after) = tlv(validity)?; // not before
    let (tag, time, _) = tlv(after)?;
    let time = std::str::from_utf8(time).ok()?;
    let full = match tag {
        // UTCTime, YYMMDDHHMMSSZ: years 50–99 are the 1900s.
        0x17 if time.len() == 13 => {
            let yy: u32 = time[..2].parse().ok()?;
            format!("{}{time}", if yy >= 50 { "19" } else { "20" })
        }
        // GeneralizedTime, YYYYMMDDHHMMSSZ.
        0x18 if time.len() == 15 => time.to_owned(),
        _ => return None,
    };
    let b = full.as_bytes();
    if !b[..14].iter().all(u8::is_ascii_digit) || b[14] != b'Z' {
        return None;
    }
    parse_millis(&format!(
        "{}-{}-{}T{}:{}:{}Z",
        &full[..4],
        &full[4..6],
        &full[6..8],
        &full[8..10],
        &full[10..12],
        &full[12..14]
    ))
}

/// One DER element: its tag, its contents, and what follows it.
fn tlv(b: &[u8]) -> Option<(u8, &[u8], &[u8])> {
    let tag = *b.first()?;
    let first = *b.get(1)?;
    let (len, head) = if first < 0x80 {
        (usize::from(first), 2)
    } else {
        let n = usize::from(first & 0x7f);
        if n == 0 || n > 4 {
            return None;
        }
        let len = b.get(2..2 + n)?.iter().fold(0usize, |acc, &x| (acc << 8) | usize::from(x));
        (len, 2 + n)
    };
    let body = b.get(head..head.checked_add(len)?)?;
    Some((tag, body, &b[head + len..]))
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

    #[test]
    fn reads_when_a_certificate_expires() {
        let der = include_bytes!("../tests/data/cert.der");
        let at = cert_expiry(der).expect("parses");
        assert_eq!(at, parse_millis("2026-11-01T12:00:00Z").expect("date"));
        assert_eq!(cert_expiry(&der[..40]), None, "truncated");
        assert_eq!(cert_expiry(b"not a certificate"), None);

        assert_eq!(expiry_warning(at, at - 20 * DAY), None);
        assert_eq!(expiry_warning(at, at - 5 * DAY - 1).as_deref(), Some("TLS certificate expires in 5 days"));
        assert_eq!(expiry_warning(at, at - DAY - 1).as_deref(), Some("TLS certificate expires tomorrow"));
        assert_eq!(expiry_warning(at, at - 1).as_deref(), Some("TLS certificate expires today"));
    }

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
