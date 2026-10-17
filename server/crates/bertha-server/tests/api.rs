//! The HTTP API end to end: a seeded temp database, the real router, and sign-in through
//! the emailed link (read from an in-memory mailer).

#![allow(clippy::unwrap_used, reason = "test helpers panic on purpose")]

use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use bertha_core::time::parse_millis;
use bertha_db::seed::{FIXTURES, Fixtures, SeedOptions};
use bertha_db::{Clock, Db};
use bertha_server::config::Config;
use bertha_server::mail::{Mail, Mailer};
use bertha_server::{AppState, router};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const OWNER: &str = "hello@sundial.dev";
const PRIYA: &str = "priya@natarajan.studio";

fn all_issues() -> Value {
    json!({
        "projectIds": [], "status": "all", "levels": [], "environment": "all",
        "assignee": "anyone", "query": "", "sort": "last_seen", "range": "7d"
    })
}

struct TestApp {
    app: Router,
    sent: Arc<Mutex<Vec<Mail>>>,
    _dir: tempfile::TempDir,
}

struct Reply {
    status: StatusCode,
    headers: header::HeaderMap,
    body: Value,
}

impl Reply {
    fn cookie(&self) -> Option<String> {
        let raw = self.headers.get(header::SET_COOKIE)?.to_str().ok()?;
        Some(raw.split(';').next()?.to_owned())
    }
}

async fn app() -> TestApp {
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
    let app = router(AppState { db, config: Arc::new(config), mailer });
    TestApp { app, sent, _dir: dir }
}

impl TestApp {
    async fn send(&self, req: Request<Body>) -> Reply {
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

    async fn get(&self, path: &str, cookie: Option<&str>) -> Reply {
        let mut req = Request::get(path);
        if let Some(c) = cookie {
            req = req.header(header::COOKIE, c);
        }
        self.send(req.body(Body::empty()).unwrap()).await
    }

    async fn post(&self, path: &str, cookie: Option<&str>, body: Value) -> Reply {
        let mut req = Request::post(path).header(header::CONTENT_TYPE, "application/json").header("x-bertha", "1");
        if let Some(c) = cookie {
            req = req.header(header::COOKIE, c);
        }
        self.send(req.body(Body::from(body.to_string())).unwrap()).await
    }

    /// The whole sign-in: ask for a link, open it from the email, keep the cookie.
    async fn sign_in(&self, email: &str) -> String {
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

    fn last_link_to(&self, email: &str) -> String {
        let sent = self.sent.lock().unwrap();
        let mail = sent.iter().rev().find(|m| m.to == email).expect("an email was sent");
        mail.body
            .split_whitespace()
            .find(|w| w.contains("/auth/callback?token="))
            .expect("the email has a link")
            .to_owned()
    }
}

#[tokio::test]
async fn reads_need_a_session() {
    let t = app().await;
    let r = t.get("/api/v1/shell", None).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert!(r.body["error"].is_string());
    let r = t.get("/api/v1/shell", Some("bertha_session=nonsense")).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn signing_in_by_email_link() {
    let t = app().await;
    let cookie = t.sign_in(OWNER).await;
    assert!(cookie.starts_with("bertha_session="));

    let r = t.get("/api/v1/shell", Some(&cookie)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["viewer"]["email"], OWNER);
    // Every signed-in answer slides the session forward.
    let refreshed = r.headers.get(header::SET_COOKIE).expect("cookie refreshed").to_str().unwrap();
    assert!(refreshed.contains("HttpOnly") && refreshed.contains("Secure") && refreshed.contains("SameSite=Lax"));
    assert_eq!(r.headers[header::CACHE_CONTROL], "no-store");
}

#[tokio::test]
async fn a_link_works_once() {
    let t = app().await;
    t.sign_in(OWNER).await;
    let link = t.last_link_to(OWNER);
    let r = t.get(link.strip_prefix("https://bertha.test").unwrap(), None).await;
    assert_eq!(r.status, StatusCode::SEE_OTHER);
    assert_eq!(r.headers[header::LOCATION], "/sign-in?link=used");
    assert!(r.cookie().is_none());

    let r = t.get("/auth/callback?token=made-up", None).await;
    assert_eq!(r.headers[header::LOCATION], "/sign-in?link=invalid");
    let r = t.get("/auth/callback", None).await;
    assert_eq!(r.headers[header::LOCATION], "/sign-in?link=invalid");
}

#[tokio::test]
async fn unknown_emails_and_unsafe_next() {
    let t = app().await;
    let r = t.post("/api/v1/sign-in", None, json!({ "email": "nobody@example.com" })).await;
    assert_eq!(r.body["ok"], false);
    assert_eq!(r.body["failure"], "unknown_email");
    assert!(r.body["message"].is_string());
    assert!(t.sent.lock().unwrap().is_empty());

    // Somewhere off-site becomes home.
    let r = t.post("/api/v1/sign-in", None, json!({ "email": OWNER, "next": "//evil.example" })).await;
    assert_eq!(r.body["value"]["returnsTo"], "/");
}

#[tokio::test]
async fn sign_in_emails_are_rate_limited() {
    let t = app().await;
    for _ in 0..8 {
        let r = t.post("/api/v1/sign-in", None, json!({ "email": OWNER })).await;
        // The answer never changes, so the limit gives nothing away.
        assert_eq!(r.body["ok"], true);
    }
    assert_eq!(t.sent.lock().unwrap().len(), 5);
}

#[tokio::test]
async fn writes_need_the_csrf_header() {
    let t = app().await;
    let req = Request::post("/api/v1/sign-in")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "email": OWNER }).to_string()))
        .unwrap();
    let r = t.send(req).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    assert!(t.sent.lock().unwrap().is_empty());
}

#[tokio::test]
async fn signing_out_ends_the_session() {
    let t = app().await;
    let cookie = t.sign_in(OWNER).await;
    let r = t.post("/api/v1/sign-out", Some(&cookie), Value::Null).await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.headers[header::SET_COOKIE].to_str().unwrap().contains("Max-Age=0"));
    assert_eq!(t.get("/api/v1/shell", Some(&cookie)).await.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn every_read_answers_the_owner() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    for path in [
        "/api/v1/overview",
        "/api/v1/overview?range=7d",
        "/api/v1/issues/i-noisy",
        "/api/v1/issues/i-noisy/events/latest",
        "/api/v1/issues/i-noisy/events/oldest",
        "/api/v1/releases",
        "/api/v1/releases?project=p-kiln",
        "/api/v1/monitors",
        "/api/v1/projects/p-kiln/settings",
        "/api/v1/alerts",
        "/api/v1/team",
    ] {
        let r = t.get(path, Some(&c)).await;
        assert_eq!(r.status, StatusCode::OK, "{path}: {:?}", r.body);
        assert!(!r.body.is_null(), "{path} answered null");
    }

    let r = t.post("/api/v1/issues/query", Some(&c), json!({ "filter": all_issues() })).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert!(r.body["issues"].as_array().is_some_and(|a| !a.is_empty()));

    let r = t.get("/api/v1/projects/p-recipes/setup", Some(&c)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);

    // Detail of the first release and monitor in their lists.
    let releases = t.get("/api/v1/releases", Some(&c)).await.body;
    let release = releases["releases"][0]["id"].as_str().expect("a release");
    assert_eq!(t.get(&format!("/api/v1/releases/{release}"), Some(&c)).await.status, StatusCode::OK);
    let monitors = t.get("/api/v1/monitors", Some(&c)).await.body;
    let monitor = monitors["monitors"][0]["id"].as_str().expect("a monitor");
    let r = t.get(&format!("/api/v1/monitors/{monitor}"), Some(&c)).await;
    assert!(!r.body.is_null());
}

#[tokio::test]
async fn missing_things_are_null_or_404() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    assert_eq!(t.get("/api/v1/issues/i-nope", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/releases/r-nope", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/monitors/mon-nope", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/projects/p-nope/settings", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/issues/i-noisy/events/e-nope", Some(&c)).await.status, StatusCode::NOT_FOUND);
    assert_eq!(t.get("/api/v1/projects/p-nope/setup", Some(&c)).await.status, StatusCode::NOT_FOUND);
    assert_eq!(t.get("/api/v1/no-such-route", Some(&c)).await.status, StatusCode::NOT_FOUND);
    let r = t.get("/api/v1/overview?range=fortnight", Some(&c)).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    assert!(r.body["error"].is_string(), "{:?}", r.body);
    let r = t.post("/api/v1/issues/query", Some(&c), json!({ "filter": {} })).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    assert!(r.body["error"].as_str().is_some_and(|m| m.contains("projectIds")), "{:?}", r.body);
}

#[tokio::test]
async fn collaborators_only_see_their_projects() {
    let t = app().await;
    let c = t.sign_in(PRIYA).await;

    let r = t.post("/api/v1/issues/query", Some(&c), json!({ "filter": all_issues() })).await;
    let projects: Vec<&str> =
        r.body["issues"].as_array().unwrap().iter().map(|i| i["projectId"].as_str().unwrap()).collect();
    assert!(!projects.is_empty());
    assert!(projects.iter().all(|p| ["p-kiln", "p-harbour"].contains(p)), "{projects:?}");

    // Someone else's issue is as missing as one that doesn't exist.
    assert_eq!(t.get("/api/v1/issues/i-moss-regressed", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/projects/p-moss/settings", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/issues/i-moss-regressed/events/latest", Some(&c)).await.status, StatusCode::NOT_FOUND);

    let shell = t.get("/api/v1/shell", Some(&c)).await.body;
    let shell_projects: Vec<&str> =
        shell["projects"].as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap()).collect();
    assert_eq!(shell_projects.len(), 2, "{shell_projects:?}");

    for path in ["/api/v1/releases", "/api/v1/monitors"] {
        let body = t.get(path, Some(&c)).await.body.to_string();
        assert!(!body.contains("p-moss"), "{path} leaked p-moss");
    }
}

#[tokio::test]
async fn invites_can_be_read_and_accepted_once() {
    let t = app().await;
    let r = t.get("/api/v1/invites/valid", None).await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.body["status"], "pending", "{:?}", r.body);
    assert_eq!(t.get("/api/v1/invites/expired", None).await.body["status"], "expired");
    assert_eq!(t.get("/api/v1/invites/used", None).await.body["status"], "used");
    assert_eq!(t.get("/api/v1/invites/made-up", None).await.body, Value::Null);

    let r = t.post("/api/v1/invites/expired/accept", None, Value::Null).await;
    assert_eq!(r.body["failure"], "invite_expired");
    let r = t.post("/api/v1/invites/made-up/accept", None, Value::Null).await;
    assert_eq!(r.body["failure"], "invite_expired");

    let r = t.post("/api/v1/invites/valid/accept", None, Value::Null).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    assert_eq!(r.body["value"]["email"], "dev@mossgrovehall.co.uk");
    let cookie = r.cookie().expect("accepting signs you in");
    assert_eq!(t.get("/api/v1/shell", Some(&cookie)).await.status, StatusCode::OK);

    let r = t.post("/api/v1/invites/valid/accept", None, Value::Null).await;
    assert_eq!(r.body["failure"], "invite_used");
    // Once they've joined, every link they were sent is spent.
    let r = t.post("/api/v1/invites/expired/accept", None, Value::Null).await;
    assert_eq!(r.body["failure"], "invite_used");
}

#[tokio::test]
async fn health_and_the_frontend() {
    let t = app().await;
    let r = t.get("/healthz", None).await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
    assert_eq!(r.headers[header::X_FRAME_OPTIONS], "DENY");
    // A missing asset is a 404, never the app.
    assert_eq!(t.get("/assets/nope.js", None).await.status, StatusCode::NOT_FOUND);
    // A client route gets the app (or, without a frontend build, says so).
    let status = t.get("/issues/i-noisy", None).await.status;
    assert!(status == StatusCode::OK || status == StatusCode::SERVICE_UNAVAILABLE, "{status}");
}
