//! Shared by the integration tests: a seeded temp database, the real router, and
//! sign-in through the emailed link (read from an in-memory mailer).

#![allow(clippy::unwrap_used, reason = "test helpers panic on purpose")]
#![allow(dead_code, reason = "each test file uses some of these")]

use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use bertha_core::time::parse_millis;
use bertha_db::seed::{FIXTURES, Fixtures, SeedOptions};
use bertha_db::{Clock, Db};
use bertha_server::config::Config;
use bertha_server::live::Live;
use bertha_server::mail::{Mail, Mailer};
use bertha_server::pipeline::Pipeline;
use bertha_server::uptime::Checker;
use bertha_server::{AppState, router};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

pub const OWNER: &str = "hello@sundial.dev";
pub const PRIYA: &str = "priya@natarajan.studio";

pub fn all_issues() -> Value {
    json!({
        "projectIds": [], "status": "all", "levels": [], "environment": "all",
        "assignee": "anyone", "query": "", "sort": "last_seen", "range": "7d"
    })
}

pub struct TestApp {
    pub app: Router,
    pub sent: Arc<Mutex<Vec<Mail>>>,
    pub db: Db,
    pub live: Live,
    _dir: tempfile::TempDir,
}

pub struct Reply {
    pub status: StatusCode,
    pub headers: header::HeaderMap,
    pub body: Value,
}

impl Reply {
    pub fn cookie(&self) -> Option<String> {
        let raw = self.headers.get(header::SET_COOKIE)?.to_str().ok()?;
        Some(raw.split(';').next()?.to_owned())
    }
}

pub async fn app() -> TestApp {
    let fx = Fixtures::parse(FIXTURES).expect("fixtures parse");
    let now = parse_millis(&fx.now.0).expect("now");
    let dir = tempfile::tempdir().expect("tempdir");
    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(now)).await.expect("open");
    db.seed(&fx, SeedOptions { dev_invite_tokens: true }).await.expect("seed");
    let config = Config::from_lookup(|k| match k {
        "BERTHA_URL" => Some("https://bertha.test".into()),
        _ => None,
    })
    .expect("config");
    let (mailer, sent) = Mailer::memory();
    // Monitors on `.invalid` hosts fail their first check; everything else answers 200.
    let checker = Checker::canned(|url| {
        if url.contains(".invalid") {
            (false, None, Some("Couldn't find the host".into()))
        } else {
            (true, Some(200), None)
        }
    });
    let http = bertha_server::uptime::http_client().expect("client");
    let live = Live::new();
    let (pipeline, _worker) = Pipeline::start(db.clone(), live.clone());
    let app = router(AppState {
        db: db.clone(),
        config: Arc::new(config),
        mailer,
        checker,
        http,
        pipeline,
        live: live.clone(),
    });
    TestApp { app, sent, db, live, _dir: dir }
}

impl TestApp {
    pub async fn send(&self, req: Request<Body>) -> Reply {
        let res = self.app.clone().oneshot(req).await.expect("infallible");
        let status = res.status();
        let headers = res.headers().clone();
        let bytes = res.into_body().collect().await.expect("body").to_bytes();
        let body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into()))
        };
        Reply { status, headers, body }
    }

    pub async fn get(&self, path: &str, cookie: Option<&str>) -> Reply {
        let mut req = Request::get(path);
        if let Some(c) = cookie {
            req = req.header(header::COOKIE, c);
        }
        self.send(req.body(Body::empty()).unwrap()).await
    }

    pub async fn post(&self, path: &str, cookie: Option<&str>, body: Value) -> Reply {
        let mut req = Request::post(path).header(header::CONTENT_TYPE, "application/json").header("x-bertha", "1");
        if let Some(c) = cookie {
            req = req.header(header::COOKIE, c);
        }
        self.send(req.body(Body::from(body.to_string())).unwrap()).await
    }

    /// The whole sign-in: ask for a link, open it from the email, keep the cookie.
    pub async fn sign_in(&self, email: &str) -> String {
        let r = self.post("/api/v1/sign-in", None, json!({ "email": email, "next": "/issues" })).await;
        assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
        assert_eq!(r.body["ok"], true, "{:?}", r.body);
        let link = self.last_link_to(email);
        let path = link.strip_prefix("https://bertha.test").expect("link uses the public URL");
        let r = self.get(path, None).await;
        assert_eq!(r.status, StatusCode::SEE_OTHER);
        assert_eq!(r.headers[header::LOCATION], "/issues");
        r.cookie().expect("the callback sets a session cookie")
    }

    pub fn last_link_to(&self, email: &str) -> String {
        let sent = self.sent.lock().unwrap();
        let mail = sent.iter().rev().find(|m| m.to == email).expect("an email was sent");
        mail.body
            .split_whitespace()
            .find(|w| w.contains("/auth/callback?token="))
            .expect("the email has a link")
            .to_owned()
    }
}
