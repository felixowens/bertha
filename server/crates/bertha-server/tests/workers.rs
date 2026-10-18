//! The background workers, one pass at a time against a fixed clock: a site goes down
//! and comes back, alerts go out (and retry), new issues alert once, and housekeeping
//! lifts snoozes.

#![allow(clippy::unwrap_used, reason = "tests panic on purpose")]

mod common;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::Json;
use axum::http::StatusCode;
use axum::routing::post;
use bertha_core::time::{DAY, SECOND};
use bertha_server::alerts::Alerter;
use bertha_server::mail::Mailer;
use bertha_server::uptime::Checker;
use bertha_server::workers::{self, Context, check_due, deliver_due, housekeep};
use common::*;
use serde_json::{Value, json};

type Inbox = Arc<Mutex<Vec<Value>>>;

/// A webhook receiver on a local port. Returns its URL and what it received.
async fn sink() -> (String, Inbox) {
    let got: Inbox = Arc::default();
    let keep = got.clone();
    let app = axum::Router::new().route(
        "/hook",
        post(move |Json(body): Json<Value>| {
            let keep = keep.clone();
            async move {
                keep.lock().unwrap().push(body);
                StatusCode::NO_CONTENT
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{addr}/hook"), got)
}

/// Destinations straight into the table: the API only takes https webhooks.
async fn webhook(t: &TestApp, id: &str, url: &str) {
    sqlx::query(
        "INSERT INTO alert_destinations (id, kind, label, url, created_at) VALUES (?, 'webhook', 'Sink', ?, 0)",
    )
    .bind(id)
    .bind(url)
    .execute(t.db.writer())
    .await
    .unwrap();
}

/// Only this test's rules fire: the seeded ones are switched off.
async fn only_rule(t: &TestApp, cookie: &str, rule: Value) {
    sqlx::query("UPDATE alert_rules SET enabled = 0").execute(t.db.writer()).await.unwrap();
    let r = t.post("/api/v1/alerts/rules", Some(cookie), rule).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
}

/// A worker context whose checker answers for `flaky.test` as `up` says.
fn context(t: &TestApp, up: Arc<AtomicBool>) -> Context {
    let checker = Checker::canned(move |url| {
        if url.contains("flaky.test") && !up.load(Ordering::Relaxed) {
            (false, None, Some("Timed out after 10s".into()))
        } else {
            (true, Some(200), None)
        }
    });
    Context {
        db: t.db.clone(),
        checker,
        alerter: Alerter::new(t.db.clone()),
        mailer: Mailer::memory().0,
        http: bertha_server::uptime::http_client().unwrap(),
        live: t.live.clone(),
        retention: 90 * DAY,
        check_every: None,
    }
}

/// Deliveries as (destination, status, attempts, last error).
async fn pending(t: &TestApp) -> Vec<(String, String, i64, Option<String>)> {
    sqlx::query_as("SELECT destination_id, status, attempts, last_error FROM alert_deliveries ORDER BY id")
        .fetch_all(t.db.reader())
        .await
        .unwrap()
}

#[tokio::test]
async fn a_site_goes_down_and_comes_back() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (url, inbox) = sink().await;
    webhook(&t, "d-sink", &url).await;
    webhook(&t, "d-dead", "http://127.0.0.1:1/hook").await;
    only_rule(
        &t,
        &c,
        json!({
            "name": "Sites", "projectIds": ["p-invoice"], "environments": [],
            "triggers": ["monitor_down", "monitor_recovered"],
            "destinationIds": ["d-sink", "d-dead"], "enabled": true
        }),
    )
    .await;
    let monitor = json!({ "projectId": "p-invoice", "name": "Invoice app", "url": "https://flaky.test/health", "intervalSeconds": 60, "paused": false });
    let r = t.post("/api/v1/monitors", Some(&c), monitor).await;
    let id = r.body["value"]["id"].as_str().unwrap().to_owned();

    let up = Arc::new(AtomicBool::new(false));
    let ctx = context(&t, up.clone());
    let mut live = t.live.subscribe();
    let step = || t.db.clock().advance(70 * SECOND);

    // The first failure isn't enough: it may be the network.
    step();
    check_due(&ctx).await.unwrap();
    let detail = t.get(&format!("/api/v1/monitors/{id}"), Some(&c)).await.body;
    assert_eq!(detail["monitor"]["state"], "up", "{detail:?}");
    assert!(pending(&t).await.is_empty());

    step();
    check_due(&ctx).await.unwrap();
    let detail = t.get(&format!("/api/v1/monitors/{id}"), Some(&c)).await.body;
    assert_eq!(detail["monitor"]["state"], "down");
    let nudge = loop {
        let e = tokio::time::timeout(Duration::from_secs(1), live.recv()).await.unwrap().unwrap();
        let e = serde_json::to_value(&*e).unwrap();
        if e["monitorId"] == id.as_str() {
            break e;
        }
    };
    assert_eq!(nudge["kind"], "monitor");
    assert_eq!(nudge["state"], "down");

    assert_eq!(deliver_due(&ctx).await.unwrap(), 1, "the sink takes it, the dead one doesn't");
    {
        let got = inbox.lock().unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0]["kind"], "monitor_down");
        assert_eq!(got[0]["title"], "Invoice app is down");
        assert_eq!(got[0]["text"], "Timed out after 10s.\nhttps://flaky.test/health");
        assert_eq!(got[0]["url"], format!("https://bertha.test/uptime/{id}"));
    }
    let rows = pending(&t).await;
    let row = |dest: &str| rows.iter().find(|r| r.0 == dest).unwrap().clone();
    assert_eq!(row("d-sink").1, "sent");
    let dead = row("d-dead");
    assert_eq!((dead.1.as_str(), dead.2), ("pending", 1), "the dead destination is retried");
    assert_eq!(dead.3.as_deref(), Some("Couldn't connect to it."));
    assert_eq!(deliver_due(&ctx).await.unwrap(), 0, "not yet: the retry waits 30s");

    // Still down: no second alert.
    step();
    check_due(&ctx).await.unwrap();
    assert_eq!(pending(&t).await.len(), 2);

    up.store(true, Ordering::Relaxed);
    step();
    check_due(&ctx).await.unwrap();
    let detail = t.get(&format!("/api/v1/monitors/{id}"), Some(&c)).await.body;
    assert_eq!(detail["monitor"]["state"], "up");
    deliver_due(&ctx).await.unwrap();
    {
        let got = inbox.lock().unwrap();
        assert_eq!(got.len(), 2);
        assert_eq!(got[1]["title"], "Invoice app is back up");
        // Down from the first failure to the recovery: three steps of 70s.
        assert_eq!(got[1]["text"], "Down for 3m.\nhttps://flaky.test/health");
    }

    // The dead destination gives up after six tries.
    for _ in 0..6 {
        t.db.clock().advance(3 * 60 * 60 * SECOND);
        deliver_due(&ctx).await.unwrap();
    }
    let rows = pending(&t).await;
    let dead: Vec<_> = rows.iter().filter(|r| r.0 == "d-dead").collect();
    assert_eq!(dead.len(), 2);
    assert!(dead.iter().all(|r| r.1 == "failed" && r.2 == 6), "{rows:?}");
}

#[tokio::test]
async fn a_slow_site_alerts_as_degraded() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (url, inbox) = sink().await;
    webhook(&t, "d-sink", &url).await;
    only_rule(
        &t,
        &c,
        json!({
            "name": "Slow", "projectIds": ["p-invoice"], "environments": [],
            "triggers": ["monitor_degraded"], "destinationIds": ["d-sink"], "enabled": true
        }),
    )
    .await;
    let monitor = json!({ "projectId": "p-invoice", "name": "Invoice app", "url": "https://slow.test/health", "intervalSeconds": 60, "paused": false });
    let id = t.post("/api/v1/monitors", Some(&c), monitor).await.body["value"]["id"].as_str().unwrap().to_owned();

    let slow = Arc::new(AtomicBool::new(true));
    let answers = slow.clone();
    let mut ctx = context(&t, Arc::new(AtomicBool::new(true)));
    ctx.checker = Checker::canned(move |_| {
        let warning = answers.load(Ordering::Relaxed).then(|| "Answered in 4.2s".to_owned());
        (true, Some(200), warning)
    });

    t.db.clock().advance(70 * SECOND);
    check_due(&ctx).await.unwrap();
    let detail = t.get(&format!("/api/v1/monitors/{id}"), Some(&c)).await.body;
    assert_eq!(detail["monitor"]["state"], "degraded", "{detail:?}");
    deliver_due(&ctx).await.unwrap();
    {
        let got = inbox.lock().unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0]["kind"], "monitor_degraded");
        assert_eq!(got[0]["title"], "Invoice app is degraded");
        assert_eq!(got[0]["text"], "Answered in 4.2s. It still answers.\nhttps://slow.test/health");
    }

    // Back to normal: degraded to up isn't a recovery from down, so nothing more.
    slow.store(false, Ordering::Relaxed);
    t.db.clock().advance(70 * SECOND);
    check_due(&ctx).await.unwrap();
    let detail = t.get(&format!("/api/v1/monitors/{id}"), Some(&c)).await.body;
    assert_eq!(detail["monitor"]["state"], "up");
    deliver_due(&ctx).await.unwrap();
    assert_eq!(inbox.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn new_issues_alert_once() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (url, inbox) = sink().await;
    webhook(&t, "d-sink", &url).await;
    only_rule(
        &t,
        &c,
        json!({
            "name": "Kiln", "projectIds": ["p-kiln"], "environments": ["production"],
            "triggers": ["new_issue"], "destinationIds": ["d-sink"], "enabled": true
        }),
    )
    .await;
    let ctx = context(&t, Arc::new(AtomicBool::new(true)));
    let key: String = sqlx::query_scalar("SELECT ingest_key FROM projects WHERE id = 'p-kiln'")
        .fetch_one(t.db.reader())
        .await
        .unwrap();

    let event = |env: &str| {
        json!({ "timestamp": "2026-10-13T09:00:00Z", "release": "2.4.1", "environment": env,
                "exception": { "type": "RangeError", "message": "Kiln temperature out of range", "frames": [] } })
    };
    let send = |events: Value| {
        let body = json!({ "sdk": { "name": "@bigbertha/sdk", "version": "0.1.0" }, "events": events });
        let req = axum::http::Request::post("/ingest/v1/events")
            .header("content-type", "text/plain")
            .header("authorization", format!("Bearer {key}"))
            .body(axum::body::Body::from(body.to_string()))
            .unwrap();
        t.send(req)
    };
    let r = send(json!([event("production"), event("production")])).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);

    // The ingest worker queues the alert; wait for it.
    for _ in 0..200 {
        if !pending(&t).await.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    assert_eq!(deliver_due(&ctx).await.unwrap(), 1);
    {
        let got = inbox.lock().unwrap();
        assert_eq!(got[0]["kind"], "new_issue");
        assert_eq!(got[0]["title"], "New issue in Kiln & Clay: RangeError");
        let text = got[0]["text"].as_str().unwrap();
        assert!(text.contains(": Kiln temperature out of range\nFirst seen in production, release 2.4.1."), "{text}");
        assert!(got[0]["url"].as_str().unwrap().starts_with("https://bertha.test/issues/"));
    }

    // More of the same issue, and the same error in staging, which the rule skips.
    assert_eq!(send(json!([event("production"), event("staging")])).await.status, StatusCode::ACCEPTED);
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(deliver_due(&ctx).await.unwrap(), 0);
    assert_eq!(inbox.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn housekeeping_lifts_snoozes_and_tells_open_pages() {
    let t = app().await;
    let ctx = context(&t, Arc::new(AtomicBool::new(true)));
    let now = t.db.now();
    sqlx::query("UPDATE issues SET status = 'snoozed', snooze_until = ? WHERE id = 'i-noisy'")
        .bind(now - 1000)
        .execute(t.db.writer())
        .await
        .unwrap();
    let mut live = t.live.subscribe();

    housekeep(&ctx, true).await.unwrap();
    let e = tokio::time::timeout(Duration::from_secs(1), live.recv()).await.unwrap().unwrap();
    let e = serde_json::to_value(&*e).unwrap();
    assert_eq!(e["kind"], "issuesChanged");
    assert_eq!(e["issueIds"], json!(["i-noisy"]));

    let c = t.sign_in(OWNER).await;
    let issue = t.get("/api/v1/issues/i-noisy", Some(&c)).await.body;
    assert_eq!(issue["issue"]["status"], "unresolved", "{issue:?}");
}

#[tokio::test]
async fn workers_start_and_stop() {
    let t = app().await;
    let w = workers::Workers::start(context(&t, Arc::new(AtomicBool::new(true))));
    tokio::time::timeout(Duration::from_secs(5), w.stop()).await.expect("workers stop promptly");
}
