//! The HTTP API end to end.

#![allow(clippy::unwrap_used, reason = "tests panic on purpose")]

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use common::*;
use serde_json::{Value, json};

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
        "/api/v1/overview?range=24h&project=p-kiln",
        "/api/v1/projects",
        "/api/v1/projects?range=30d",
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
async fn issues_open_by_short_id_too() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let short = t.get("/api/v1/issues/i-noisy", Some(&c)).await.body["issue"]["shortId"].clone();
    let short = short.as_str().expect("a short id");
    let found = t.get(&format!("/api/v1/issues/{}", short.to_lowercase()), Some(&c)).await.body;
    assert_eq!(found["issue"]["id"], "i-noisy");
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
    let owner = t.sign_in(OWNER).await;
    let moss = t.get("/api/v1/issues/i-moss-regressed", Some(&owner)).await.body["issue"]["shortId"].clone();
    let moss = moss.as_str().expect("a short id");
    assert_eq!(t.get(&format!("/api/v1/issues/{moss}"), Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/projects/p-moss/settings", Some(&c)).await.body, Value::Null);
    assert_eq!(t.get("/api/v1/issues/i-moss-regressed/events/latest", Some(&c)).await.status, StatusCode::NOT_FOUND);

    let shell = t.get("/api/v1/shell", Some(&c)).await.body;
    let shell_projects: Vec<&str> =
        shell["projects"].as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap()).collect();
    assert_eq!(shell_projects.len(), 2, "{shell_projects:?}");

    let r = t.get("/api/v1/projects", Some(&c)).await;
    let listed: Vec<&str> = r.body["projects"].as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap()).collect();
    assert_eq!(listed.len(), 2, "{:?}", r.body);
    // A project they can't see has no home page, as if it didn't exist.
    assert_eq!(t.get("/api/v1/overview?project=p-moss", Some(&c)).await.body, Value::Null);
    let home = t.get("/api/v1/overview?project=p-kiln", Some(&c)).await.body;
    assert_eq!(home["project"]["id"], "p-kiln");

    for path in ["/api/v1/releases", "/api/v1/monitors", "/api/v1/projects"] {
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
    // Source maps are embedded for bertha's own reports, never served.
    if let Some(map) = bertha_server::report::embedded_maps().next() {
        assert_eq!(t.get(&format!("/{map}"), None).await.status, StatusCode::NOT_FOUND);
    }
    // A client route gets the app (or, without a frontend build, says so).
    let status = t.get("/issues/i-noisy", None).await.status;
    assert!(status == StatusCode::OK || status == StatusCode::SERVICE_UNAVAILABLE, "{status}");
}

// ── Mutations ───────────────────────────────────────────────────────────

/// The `value` of a successful outcome, or a panic that shows the failure.
fn ok(r: &Reply) -> &Value {
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    &r.body["value"]
}

fn failure(r: &Reply) -> &str {
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["ok"], false, "{:?}", r.body);
    assert!(r.body["message"].as_str().is_some_and(|m| !m.is_empty()), "{:?}", r.body);
    r.body["failure"].as_str().unwrap()
}

#[tokio::test]
async fn mutations_need_a_session_and_the_header() {
    let t = app().await;
    let r = t
        .post("/api/v1/issues/update", None, json!({ "issueIds": ["i-noisy"], "change": { "kind": "resolve" } }))
        .await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    let c = t.sign_in(OWNER).await;
    let req = Request::post("/api/v1/projects/p-kiln/rotate-key")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::COOKIE, &c)
        .body(Body::from("null"))
        .unwrap();
    assert_eq!(t.send(req).await.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn triaging_issues() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t
        .post("/api/v1/issues/update", Some(&c), json!({ "issueIds": ["i-noisy"], "change": { "kind": "resolve" } }))
        .await;
    let v = ok(&r);
    assert_eq!(v[0]["id"], "i-noisy");
    assert_eq!(v[0]["status"], "resolved");

    // Someone else reopened it after we looked: that's a conflict, and nothing changes.
    let seen = json!([{ "id": "i-noisy", "status": "unresolved", "assigneeId": null }]);
    let r = t
        .post(
            "/api/v1/issues/update",
            Some(&c),
            json!({ "issueIds": ["i-noisy"], "change": { "kind": "ignore" }, "seen": seen }),
        )
        .await;
    assert_eq!(failure(&r), "conflict");

    let r = t
        .post(
            "/api/v1/issues/update",
            Some(&c),
            json!({ "issueIds": ["i-noisy", "i-gone"], "change": { "kind": "reopen" } }),
        )
        .await;
    assert_eq!(failure(&r), "not_found");

    let r = t.post("/api/v1/issues/i-noisy/notes", Some(&c), json!({ "body": "Fixed in the cart rewrite." })).await;
    let issue = ok(&r);
    assert!(issue.to_string().contains("Fixed in the cart rewrite."));
    let r = t.post("/api/v1/issues/i-noisy/notes", Some(&c), json!({ "body": "   " })).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{:?}", r.body);
    let r = t.post("/api/v1/issues/i-gone/notes", Some(&c), json!({ "body": "hi" })).await;
    assert_eq!(failure(&r), "not_found");

    // A body that isn't the contract's shape is a 4xx with a reason, never a 500.
    let r = t.post("/api/v1/issues/update", Some(&c), json!({ "issueIds": "i-noisy" })).await;
    assert!(r.status.is_client_error(), "{}", r.status);
    assert!(r.body["error"].is_string());
}

#[tokio::test]
async fn collaborators_triage_only_their_issues() {
    let t = app().await;
    let c = t.sign_in(PRIYA).await;
    let r = t
        .post("/api/v1/issues/update", Some(&c), json!({ "issueIds": ["i-noisy"], "change": { "kind": "ignore" } }))
        .await;
    assert_eq!(ok(&r)[0]["status"], "ignored");
    let r = t
        .post(
            "/api/v1/issues/update",
            Some(&c),
            json!({ "issueIds": ["i-noisy", "i-moss-regressed"], "change": { "kind": "resolve" } }),
        )
        .await;
    assert_eq!(failure(&r), "permission_denied");
    let r = t.post("/api/v1/issues/i-moss-regressed/notes", Some(&c), json!({ "body": "hi" })).await;
    assert_eq!(failure(&r), "not_found");
}

#[tokio::test]
async fn creating_rekeying_and_deleting_projects() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let input = json!({ "name": "Lantern Books", "client": null, "url": null, "runtimes": ["browser", "server"], "environments": [] });
    let r = t.post("/api/v1/projects", Some(&c), input.clone()).await;
    let created = ok(&r).clone();
    let id = created["project"]["id"].as_str().unwrap().to_owned();
    let key = created["setup"]["ingestKey"].as_str().unwrap().to_owned();
    assert!(key.starts_with("bk_"), "{key}");
    assert_eq!(failure(&t.post("/api/v1/projects", Some(&c), input).await), "name_taken");
    let blank = json!({ "name": "  ", "client": null, "url": null, "runtimes": ["server"], "environments": [] });
    assert_eq!(failure(&t.post("/api/v1/projects", Some(&c), blank).await), "invalid_name");

    let r = t.post(&format!("/api/v1/projects/{id}/rotate-key"), Some(&c), Value::Null).await;
    assert_ne!(ok(&r)["ingestKey"], key);
    assert_eq!(t.post("/api/v1/projects/p-gone/rotate-key", Some(&c), Value::Null).await.status, StatusCode::NOT_FOUND);

    let path = format!("/api/v1/projects/{id}/delete");
    assert_eq!(failure(&t.post(&path, Some(&c), json!({ "confirmName": "lantern" })).await), "name_mismatch");
    let r = t.post(&path, Some(&c), json!({ "confirmName": "Lantern Books" })).await;
    assert_eq!(*ok(&r), Value::Null);
    assert_eq!(t.get(&format!("/api/v1/projects/{id}/settings"), Some(&c)).await.body, Value::Null);
}

#[tokio::test]
async fn only_the_owner_manages_projects() {
    let t = app().await;
    let c = t.sign_in(PRIYA).await;
    let input =
        json!({ "name": "Side thing", "client": null, "url": null, "runtimes": ["server"], "environments": [] });
    let r = t.post("/api/v1/projects", Some(&c), input).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    assert_eq!(r.body["error"], "Only the owner has access to this.");
    let r = t.post("/api/v1/projects/p-kiln/rotate-key", Some(&c), Value::Null).await;
    assert_eq!(failure(&r), "permission_denied");
    let r = t.post("/api/v1/projects/p-kiln/delete", Some(&c), json!({ "confirmName": "Kiln" })).await;
    assert_eq!(failure(&r), "permission_denied");
    // A project they can't see is missing, not forbidden.
    let r = t.post("/api/v1/projects/p-moss/rotate-key", Some(&c), Value::Null).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn saving_monitors_checks_them_first() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let monitor = |url: &str| json!({ "projectId": "p-invoice", "name": "Invoice app", "url": url, "intervalSeconds": 60, "paused": false });
    assert_eq!(failure(&t.post("/api/v1/monitors", Some(&c), monitor("ftp://x.dev")).await), "invalid_url");
    assert_eq!(failure(&t.post("/api/v1/monitors", Some(&c), monitor("not a url")).await), "invalid_url");
    let r = t.post("/api/v1/monitors", Some(&c), monitor("https://invoice.invalid")).await;
    assert_eq!(failure(&r), "unreachable");
    assert!(r.body["message"].as_str().unwrap().contains("Couldn't find the host"), "{:?}", r.body);

    let r = t.post("/api/v1/monitors", Some(&c), monitor("https://invoice.example.com/health")).await;
    let saved = ok(&r);
    assert_eq!(saved["url"], "https://invoice.example.com/health");
    assert_eq!(saved["projectId"], "p-invoice");

    let mut bad = monitor("https://invoice.example.com");
    bad["intervalSeconds"] = json!(61);
    assert_eq!(t.post("/api/v1/monitors", Some(&c), bad).await.status, StatusCode::BAD_REQUEST);

    let p = t.sign_in(PRIYA).await;
    let mut theirs = monitor("https://moss.example.com");
    theirs["projectId"] = json!("p-moss");
    assert_eq!(t.post("/api/v1/monitors", Some(&p), theirs).await.status, StatusCode::FORBIDDEN);
    // Not even on a project they can see: monitors are the owner's.
    let mut visible = monitor("https://kiln.example.com");
    visible["projectId"] = json!("p-kiln");
    assert_eq!(t.post("/api/v1/monitors", Some(&p), visible).await.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn alert_rules_and_destinations() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let rule = json!({
        "name": "Spikes", "projectIds": ["p-kiln"], "environments": ["production"],
        "triggers": ["spike"], "spike": { "events": 50, "withinMinutes": 10 },
        "destinationIds": ["d-email"], "enabled": true
    });
    let r = t.post("/api/v1/alerts/rules", Some(&c), rule.clone()).await;
    let id = ok(&r)["id"].as_str().unwrap().to_owned();

    let mut none = rule.clone();
    none["triggers"] = json!([]);
    assert_eq!(failure(&t.post("/api/v1/alerts/rules", Some(&c), none).await), "no_trigger");
    let mut nowhere = rule.clone();
    nowhere["destinationIds"] = json!([]);
    assert_eq!(failure(&t.post("/api/v1/alerts/rules", Some(&c), nowhere).await), "no_destination");

    let path = format!("/api/v1/alerts/rules/{id}/delete");
    assert_eq!(*ok(&t.post(&path, Some(&c), Value::Null).await), Value::Null);
    assert_eq!(failure(&t.post(&path, Some(&c), Value::Null).await), "not_found");

    let r = t.post("/api/v1/alerts/destinations", Some(&c), json!({ "kind": "email", "address": "nope" })).await;
    assert_eq!(failure(&r), "invalid_email");
    let r = t
        .post(
            "/api/v1/alerts/destinations",
            Some(&c),
            json!({ "kind": "webhook", "label": "", "url": "http://hooks.slack.com/x" }),
        )
        .await;
    assert_eq!(failure(&r), "invalid_webhook");
    let r = t
        .post(
            "/api/v1/alerts/destinations",
            Some(&c),
            json!({ "kind": "webhook", "label": "", "url": "https://hooks.slack.com/x" }),
        )
        .await;
    assert_eq!(ok(&r)["label"], "Slack");

    let p = t.sign_in(PRIYA).await;
    assert_eq!(t.post("/api/v1/alerts/rules", Some(&p), rule).await.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn testing_a_destination_sends_for_real() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t.post("/api/v1/alerts/destinations/d-email/test", Some(&c), Value::Null).await;
    assert!(ok(&r)["deliveredAt"].is_string());
    {
        let sent = t.sent.lock().unwrap();
        let mail = sent.last().unwrap();
        assert_eq!(mail.to, OWNER);
        assert!(mail.body.contains("https://bertha.test/settings/alerts"));
    }

    // Nothing listens on port 9, so the webhook can't be delivered.
    let r = t
        .post(
            "/api/v1/alerts/destinations",
            Some(&c),
            json!({ "kind": "webhook", "label": "Local", "url": "https://127.0.0.1:9/hook" }),
        )
        .await;
    let id = ok(&r)["id"].as_str().unwrap().to_owned();
    let r = t.post(&format!("/api/v1/alerts/destinations/{id}/test"), Some(&c), Value::Null).await;
    assert_eq!(failure(&r), "delivery_failed");
    assert!(r.body["message"].as_str().unwrap().contains("Couldn't connect"), "{:?}", r.body);

    assert_eq!(
        t.post("/api/v1/alerts/destinations/d-gone/test", Some(&c), Value::Null).await.status,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn inviting_and_managing_the_team() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t
        .post("/api/v1/team/invites", Some(&c), json!({ "email": "Ana@Example.com ", "projectIds": ["p-kiln"] }))
        .await;
    let member = ok(&r).clone();
    assert_eq!(member["email"], "Ana@Example.com");
    let link = {
        let sent = t.sent.lock().unwrap();
        let mail = sent.iter().rev().find(|m| m.to == "Ana@Example.com").expect("an invite was sent");
        mail.body.split_whitespace().find(|w| w.contains("/invite/")).expect("a link").to_owned()
    };
    let token = link.strip_prefix("https://bertha.test/invite/").expect("an invite link");
    let r = t.get(&format!("/api/v1/invites/{token}"), None).await;
    assert_eq!(r.body["status"], "pending", "{:?}", r.body);

    let r = t
        .post("/api/v1/team/invites", Some(&c), json!({ "email": PRIYA.to_uppercase(), "projectIds": ["p-kiln"] }))
        .await;
    assert_eq!(failure(&r), "already_member");
    let r =
        t.post("/api/v1/team/invites", Some(&c), json!({ "email": "not-an-email", "projectIds": ["p-kiln"] })).await;
    assert_eq!(failure(&r), "invalid_email");

    let r =
        t.post("/api/v1/team/members/m-priya/access", Some(&c), json!({ "projectIds": ["p-kiln", "p-moss"] })).await;
    assert_eq!(ok(&r)["projectIds"], json!(["p-kiln", "p-moss"]));
    let r = t.post("/api/v1/team/members/m-gone/access", Some(&c), json!({ "projectIds": ["p-kiln"] })).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);

    assert_eq!(
        failure(&t.post("/api/v1/team/members/m-owner/remove", Some(&c), Value::Null).await),
        "cannot_remove_owner"
    );

    // Collaborators can't change access or remove anyone.
    let p = t.sign_in(PRIYA).await;
    let r = t.post("/api/v1/team/members/m-tomasz/access", Some(&p), json!({ "projectIds": ["p-kiln"] })).await;
    assert_eq!(failure(&r), "permission_denied");
    assert_eq!(
        t.post("/api/v1/team/members/m-tomasz/remove", Some(&p), Value::Null).await.status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        t.post("/api/v1/team/invites", Some(&p), json!({ "email": "x@y.dev", "projectIds": ["p-kiln"] })).await.status,
        StatusCode::FORBIDDEN
    );

    // Removing someone ends their sessions.
    assert_eq!(*ok(&t.post("/api/v1/team/members/m-priya/remove", Some(&c), Value::Null).await), Value::Null);
    assert_eq!(t.get("/api/v1/shell", Some(&p)).await.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn editing_a_project() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let input = json!({
        "name": "Kiln & Clay", "client": "Kiln & Clay Ltd", "url": "https://kilnandclay.co.uk",
        "repoUrl": "https://github.com/sundial/kiln", "runtimes": ["browser"], "environments": ["production"]
    });
    let r = t.post("/api/v1/projects/p-kiln", Some(&c), input.clone()).await;
    let project = ok(&r);
    assert_eq!(project["name"], "Kiln & Clay");
    assert_eq!(project["repoUrl"], "https://github.com/sundial/kiln");
    let settings = t.get("/api/v1/projects/p-kiln/settings", Some(&c)).await.body;
    assert_eq!(settings["project"]["client"], "Kiln & Clay Ltd");

    let mut taken = input.clone();
    let moss = t.get("/api/v1/projects/p-moss/settings", Some(&c)).await.body;
    taken["name"] = moss["project"]["name"].clone();
    assert_eq!(failure(&t.post("/api/v1/projects/p-kiln", Some(&c), taken).await), "name_taken");
    assert_eq!(t.post("/api/v1/projects/p-gone", Some(&c), input.clone()).await.status, StatusCode::NOT_FOUND);

    let p = t.sign_in(PRIYA).await;
    assert_eq!(failure(&t.post("/api/v1/projects/p-kiln", Some(&p), input.clone()).await), "permission_denied");
    assert_eq!(t.post("/api/v1/projects/p-moss", Some(&p), input).await.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn checking_now_and_deleting_monitors() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t.post("/api/v1/monitors/mon-kiln-checkout/check", Some(&c), Value::Null).await;
    let check = ok(&r);
    assert!(check["at"].is_string(), "{check:?}");
    assert_eq!(check["ok"], true);
    let detail = t.get("/api/v1/monitors/mon-kiln-checkout", Some(&c)).await.body;
    assert!(detail.to_string().contains(check["at"].as_str().unwrap()), "the check was recorded");
    assert_eq!(failure(&t.post("/api/v1/monitors/mon-gone/check", Some(&c), Value::Null).await), "not_found");

    let p = t.sign_in(PRIYA).await;
    let r = t.post("/api/v1/monitors/mon-kiln-checkout/delete", Some(&p), Value::Null).await;
    assert_eq!(failure(&r), "permission_denied");

    assert_eq!(*ok(&t.post("/api/v1/monitors/mon-kiln-checkout/delete", Some(&c), Value::Null).await), Value::Null);
    assert_eq!(t.get("/api/v1/monitors/mon-kiln-checkout", Some(&c)).await.body, Value::Null);
    let settings = t.get("/api/v1/projects/p-kiln/settings", Some(&c)).await.body;
    assert_eq!(settings["monitors"].as_array().unwrap().len(), 1, "the other monitor stays");
    let r = t.post("/api/v1/monitors/mon-kiln-checkout/delete", Some(&c), Value::Null).await;
    assert_eq!(failure(&r), "not_found");
    assert_eq!(failure(&t.post("/api/v1/monitors/mon-kiln-checkout/check", Some(&c), Value::Null).await), "not_found");
}

#[tokio::test]
async fn editing_and_deleting_destinations() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t
        .post(
            "/api/v1/alerts/destinations",
            Some(&c),
            json!({ "id": "d-email", "kind": "email", "address": "alerts@sundial.dev" }),
        )
        .await;
    let d = ok(&r);
    assert_eq!(d["id"], "d-email");
    assert_eq!(d["address"], "alerts@sundial.dev");

    let r = t.post("/api/v1/alerts/destinations/d-push/delete", Some(&c), Value::Null).await;
    assert!(ok(&r)["rulesTurnedOff"].is_array(), "{:?}", r.body);
    let alerts = t.get("/api/v1/alerts", Some(&c)).await.body;
    assert!(!alerts["destinations"].to_string().contains("d-push"));
    assert!(!alerts["rules"].to_string().contains("d-push"));
    assert!(alerts["deliveries"].is_array());
    assert_eq!(failure(&t.post("/api/v1/alerts/destinations/d-push/delete", Some(&c), Value::Null).await), "not_found");

    let p = t.sign_in(PRIYA).await;
    let r = t.post("/api/v1/alerts/destinations/d-email/delete", Some(&p), Value::Null).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn resending_an_invite() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t.post("/api/v1/team/members/m-lapsed/resend", Some(&c), Value::Null).await;
    let member = ok(&r).clone();
    assert!(member["inviteExpiresAt"].is_string(), "{member:?}");
    let token = {
        let sent = t.sent.lock().unwrap();
        let mail =
            sent.iter().rev().find(|m| m.to == "practice.manager@harbourdental.co.uk").expect("an invite was sent");
        let link = mail.body.split_whitespace().find(|w| w.contains("/invite/")).expect("a link").to_owned();
        link.strip_prefix("https://bertha.test/invite/").expect("an invite link").to_owned()
    };
    assert_eq!(t.get(&format!("/api/v1/invites/{token}"), None).await.body["status"], "pending");

    let r = t.post("/api/v1/team/members/m-priya/resend", Some(&c), Value::Null).await;
    assert_eq!(failure(&r), "already_member");
    assert_eq!(failure(&t.post("/api/v1/team/members/m-gone/resend", Some(&c), Value::Null).await), "not_found");

    let p = t.sign_in(PRIYA).await;
    let r = t.post("/api/v1/team/members/m-lapsed/resend", Some(&p), Value::Null).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn merging_issues() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let r = t
        .post("/api/v1/issues/merge", Some(&c), json!({ "targetId": "i-noisy", "sourceIds": ["i-moss-regressed"] }))
        .await;
    assert_eq!(failure(&r), "different_projects");
    let r = t.post("/api/v1/issues/merge", Some(&c), json!({ "targetId": "i-noisy", "sourceIds": ["i-gone"] })).await;
    assert_eq!(failure(&r), "not_found");

    let r =
        t.post("/api/v1/issues/merge", Some(&c), json!({ "targetId": "i-noisy", "sourceIds": ["i-cart-map"] })).await;
    let merged = ok(&r);
    assert_eq!(merged["id"], "i-noisy");
    assert_eq!(t.get("/api/v1/issues/i-cart-map", Some(&c)).await.body, Value::Null);

    // A collaborator can't reach into a project they can't see.
    let p = t.sign_in(PRIYA).await;
    let r = t
        .post("/api/v1/issues/merge", Some(&p), json!({ "targetId": "i-hydration", "sourceIds": ["i-moss-regressed"] }))
        .await;
    assert_eq!(failure(&r), "not_found");
}

#[tokio::test]
async fn assigning_someone_else_emails_them() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let before = t.sent.lock().unwrap().len();
    let assign =
        |to: &str| json!({ "issueIds": ["i-noisy", "i-hydration"], "change": { "kind": "assign", "personId": to } });
    ok(&t.post("/api/v1/issues/update", Some(&c), assign("m-owner")).await);
    assert_eq!(t.sent.lock().unwrap().len(), before, "assigning yourself sends nothing");

    ok(&t.post("/api/v1/issues/update", Some(&c), assign("m-priya")).await);
    let sent = t.sent.lock().unwrap();
    let to_priya: Vec<_> = sent.iter().filter(|m| m.to == PRIYA).collect();
    assert_eq!(to_priya.len(), 1, "one email for both issues");
    assert!(to_priya[0].subject.contains("assigned"), "{}", to_priya[0].subject);
    // The link opens just those issues.
    assert!(to_priya[0].body.contains("https://bertha.test/issues?ids=i-noisy,i-hydration"), "{}", to_priya[0].body);
}
