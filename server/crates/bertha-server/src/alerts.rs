//! Delivering alerts: by email, or as a webhook shaped for Slack, Discord or anything else.

use bertha_core::domain::AlertDestination;
use serde_json::json;

use crate::mail::{Mail, Mailer};

/// An alert as people read it, whatever carries it.
#[derive(Debug, Clone, PartialEq)]
pub struct Notice {
    /// What kind of alert, for webhook consumers: `test`, `new_issue`, `monitor_down`…
    pub kind: String,
    pub title: String,
    pub body: String,
    /// Where to look in bertha.
    pub link: String,
}

impl Notice {
    pub fn test(public_url: &str) -> Notice {
        Notice {
            kind: "test".into(),
            title: "Test alert from bertha".into(),
            body: "This destination works. Real alerts will arrive here.".into(),
            link: format!("{public_url}/settings/alerts"),
        }
    }
}

/// Why a delivery failed, in words for the alerts page.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct Undelivered(pub String);

pub async fn deliver(
    to: &AlertDestination,
    notice: &Notice,
    mailer: &Mailer,
    http: &reqwest::Client,
) -> Result<(), Undelivered> {
    match to {
        AlertDestination::Email { address, .. } => {
            let mail = Mail {
                to: address.clone(),
                subject: notice.title.clone(),
                body: format!("{}\n\n{}", notice.body, notice.link),
            };
            mailer.send(mail).await.map_err(|e| {
                tracing::warn!(error = ?e, "alert email failed");
                Undelivered(format!("The mail server refused it: {e}"))
            })
        }
        AlertDestination::Webhook { url, .. } => post_webhook(http, url, notice).await,
    }
}

pub async fn post_webhook(http: &reqwest::Client, url: &str, notice: &Notice) -> Result<(), Undelivered> {
    let res = http.post(url).json(&webhook_body(url, notice)).send().await.map_err(|e| {
        let why = if e.is_timeout() { "It timed out after 10s" } else { "Couldn't connect to it" };
        Undelivered(format!("{why}."))
    })?;
    let status = res.status();
    if status.is_success() { Ok(()) } else { Err(Undelivered(format!("It answered {status}."))) }
}

/// Slack and Discord each want their own field; everyone else gets the parts.
fn webhook_body(url: &str, n: &Notice) -> serde_json::Value {
    let host = url.split("://").nth(1).and_then(|r| r.split(['/', ':']).next()).unwrap_or_default();
    let text = format!("*{}*\n{}\n{}", n.title, n.body, n.link);
    if host.ends_with("slack.com") {
        json!({ "text": text })
    } else if host.ends_with("discord.com") || host.ends_with("discordapp.com") {
        json!({ "content": text.replacen('*', "**", 2) })
    } else {
        json!({ "kind": n.kind, "title": n.title, "text": n.body, "url": n.link })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use axum::Json;
    use axum::http::StatusCode;

    use super::*;

    #[test]
    fn webhook_shapes() {
        let n = Notice::test("https://bertha.test");
        assert!(
            webhook_body("https://hooks.slack.com/services/x", &n)["text"].as_str().unwrap_or("").starts_with("*Test")
        );
        assert!(
            webhook_body("https://discord.com/api/webhooks/x", &n)["content"]
                .as_str()
                .unwrap_or("")
                .starts_with("**Test")
        );
        assert_eq!(webhook_body("https://ops.dev/hook", &n)["kind"], "test");
    }

    #[tokio::test]
    async fn webhooks_report_what_happened() {
        let got: Arc<Mutex<Vec<serde_json::Value>>> = Arc::default();
        let sink = got.clone();
        let app = axum::Router::new()
            .route(
                "/ok",
                axum::routing::post(move |Json(v): Json<serde_json::Value>| async move {
                    sink.lock().map(|mut g| g.push(v)).ok();
                    StatusCode::NO_CONTENT
                }),
            )
            .route("/broken", axum::routing::post(|| async { StatusCode::GONE }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        tokio::spawn(async move { axum::serve(listener, app).await });
        let http = crate::uptime::http_client().expect("client");
        let n = Notice::test("https://bertha.test");

        post_webhook(&http, &format!("http://{addr}/ok"), &n).await.expect("delivered");
        assert_eq!(got.lock().expect("lock")[0]["title"], "Test alert from bertha");
        let e = post_webhook(&http, &format!("http://{addr}/broken"), &n).await.expect_err("fails");
        assert_eq!(e.0, "It answered 410 Gone.");
        let e = post_webhook(&http, "http://127.0.0.1:9/", &n).await.expect_err("fails");
        assert_eq!(e.0, "Couldn't connect to it.");
    }
}
