//! What the SDK and CI talk to, end to end: keys, limits, the queue, source maps,
//! deploys, and the live stream that tells open pages.

#![allow(clippy::unwrap_used, reason = "tests panic on purpose")]

mod common;

use std::io::Write;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use common::*;
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const DEBUG_ID: &str = "C0FFEE00-0000-4000-8000-000000000001";
const BUNDLE: &str = "https://kiln.test/assets/index-4f9a2c1b.js";

async fn keys(t: &TestApp, project: &str) -> (String, String) {
    sqlx::query_as::<_, (String, String)>("SELECT ingest_key, upload_key FROM projects WHERE id = ?")
        .bind(project)
        .fetch_one(t.db.reader())
        .await
        .unwrap()
}

fn gzip(bytes: &[u8]) -> Vec<u8> {
    let mut e = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
    e.write_all(bytes).unwrap();
    e.finish().unwrap()
}

/// A POST the way the SDK sends it: no cookie, no CSRF header, a key.
async fn ingest(t: &TestApp, path: &str, key: Option<&str>, body: Vec<u8>) -> Reply {
    let mut req =
        Request::post(path).header(header::CONTENT_TYPE, "text/plain").header(header::ORIGIN, "https://kiln.test");
    if let Some(k) = key {
        req = req.header(header::AUTHORIZATION, format!("Bearer {k}"));
    }
    t.send(req.body(Body::from(body)).unwrap()).await
}

fn batch(events: Value) -> Vec<u8> {
    json!({ "sdk": { "name": "@bigbertha/sdk", "version": "0.1.0" }, "events": events }).to_string().into_bytes()
}

fn thrown(message: &str) -> Value {
    json!({
        "timestamp": "2026-10-13T09:00:00Z",
        "release": "2.4.1",
        "exception": { "type": "TypeError", "message": message, "frames": [
            { "file": BUNDLE, "function": "a", "line": 1, "column": 200 },
            { "file": BUNDLE, "function": "b", "line": 1, "column": 100 },
        ]},
        "debugIds": { BUNDLE: DEBUG_ID },
    })
}

/// Waits for the worker: the issue whose message matches, once it exists.
async fn issue_named(t: &TestApp, cookie: &str, message: &str) -> Value {
    let mut filter = all_issues();
    filter["query"] = json!(message);
    for _ in 0..200 {
        let r = t.post("/api/v1/issues/query", Some(cookie), json!({ "filter": filter })).await;
        if let Some(i) = r.body["issues"].as_array().and_then(|a| a.iter().find(|i| i["message"] == message)) {
            return i.clone();
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("no issue named {message:?} was ingested");
}

#[tokio::test]
async fn keys_and_cors() {
    let t = app().await;
    let (ingest_key, upload_key) = keys(&t, "p-kiln").await;
    let body = || batch(json!([thrown("x")]));

    let r = ingest(&t, "/ingest/v1/events", None, body()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert!(r.body["error"].as_str().unwrap().contains("Bearer"));
    let r = ingest(&t, "/ingest/v1/events", Some("bk_wrong"), body()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    let r = ingest(&t, "/ingest/v1/events", Some(&upload_key), body()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "the upload key isn't an ingest key");
    // sendBeacon can't set headers.
    let r = ingest(&t, &format!("/ingest/v1/events?key={ingest_key}"), None, body()).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
    assert_eq!(r.headers[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");

    let r = ingest(&t, "/ingest/v1/deploys", Some(&ingest_key), json!({ "release": "1" }).to_string().into()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert!(r.body["error"].as_str().unwrap().contains("That's the ingest key"), "{:?}", r.body);

    let preflight = Request::options("/ingest/v1/events")
        .header(header::ORIGIN, "https://kiln.test")
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
        .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type")
        .body(Body::empty())
        .unwrap();
    let r = t.send(preflight).await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.headers[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");

    let r = ingest(&t, "/ingest/v1/nope", Some(&ingest_key), vec![]).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
    // The API itself stays same-origin.
    let r = t.get("/api/v1/shell", None).await;
    assert!(!r.headers.contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN));
}

#[tokio::test]
async fn bodies_are_bounded() {
    let t = app().await;
    let (key, _) = keys(&t, "p-kiln").await;
    let r = ingest(&t, "/ingest/v1/events", Some(&key), b"{nope".to_vec()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    assert!(r.body["error"].as_str().unwrap().starts_with("The body isn't a batch of events"));
    let r = ingest(&t, "/ingest/v1/events", Some(&key), vec![0x1f, 0x8b, 1, 2, 3]).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    // 9 MB of zeros gzips to a few KB: under the body limit, over the inflated one.
    let bomb = gzip(&vec![b' '; 9 * 1024 * 1024]);
    assert!(bomb.len() < 1024 * 1024);
    let r = ingest(&t, "/ingest/v1/events", Some(&key), bomb).await;
    assert_eq!(r.status, StatusCode::PAYLOAD_TOO_LARGE);
    let r = ingest(&t, "/ingest/v1/events", Some(&key), vec![b' '; 2 * 1024 * 1024]).await;
    assert_eq!(r.status, StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn events_become_issues() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, _) = keys(&t, "p-kiln").await;
    let mut live = t.live.subscribe();

    let events = json!([
        thrown("Gift card balance is NaN"),
        thrown("Gift card balance is NaN"),
        { "timestamp": "2026-10-13T09:00:00Z" },
        { "timestamp": "2026-10-13T09:00:00Z", "message": "Stock sync took 31s", "level": "warning" },
    ]);
    let r = ingest(&t, "/ingest/v1/events", Some(&key), gzip(&batch(events))).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
    assert_eq!(r.body, json!({ "accepted": 3, "rejected": 1 }));

    let issue = issue_named(&t, &c, "Gift card balance is NaN").await;
    assert_eq!(issue["projectId"], "p-kiln");
    assert_eq!(issue["eventCount"], 2);
    assert_eq!(issue["status"], "unresolved");
    let message = issue_named(&t, &c, "Stock sync took 31s").await;
    assert_eq!(message["type"], "Message");
    assert_eq!(message["level"], "warning");

    let nudge = tokio::time::timeout(Duration::from_secs(2), live.recv()).await.unwrap().unwrap();
    let nudge = serde_json::to_value(&*nudge).unwrap();
    assert_eq!(nudge["kind"], "ingested");
    assert_eq!(nudge["projectId"], "p-kiln");
    assert_eq!(nudge["events"], 3);
    assert_eq!(nudge["newIssues"].as_array().unwrap().len(), 2);

    let r = ingest(&t, "/ingest/v1/heartbeat", Some(&key), vec![]).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT);
    let r = ingest(&t, "/ingest/v1/heartbeat", Some(&key), json!({ "release": "2.4.1" }).to_string().into()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn stacks_map_through_uploaded_maps() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, upload) = keys(&t, "p-kiln").await;

    let source = (1..=30).map(|n| format!("// basket.ts line {n}")).collect::<Vec<_>>().join("\n");
    let mut b = sourcemap::SourceMapBuilder::new(Some("index-4f9a2c1b.js"));
    let src = b.add_source("webpack://kiln/./src/basket.ts");
    b.set_source_contents(src, Some(&source));
    b.add(0, 99, 11, 4, Some("webpack://kiln/./src/basket.ts"), Some("applyGiftCard"), false);
    b.add(0, 199, 19, 9, Some("webpack://kiln/./src/basket.ts"), Some("toFixed"), false);
    let mut map = Vec::new();
    b.into_sourcemap().to_writer(&mut map).unwrap();

    let path = format!("/ingest/v1/sourcemaps?debugId={DEBUG_ID}&file=index-4f9a2c1b.js&release=2.4.1");
    let r = ingest(&t, &path, Some(&key), gzip(&map)).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "maps need the upload key");
    let r = ingest(&t, "/ingest/v1/sourcemaps", Some(&upload), map.clone()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "no debug id anywhere");
    let r = ingest(&t, &path, Some(&upload), b"not a map".to_vec()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    let r = ingest(&t, &path, Some(&upload), gzip(&map)).await;
    assert_eq!(r.status, StatusCode::CREATED, "{:?}", r.body);
    assert_eq!(r.body, json!({ "debugId": DEBUG_ID.to_ascii_lowercase(), "sources": 1 }));

    let r = ingest(&t, "/ingest/v1/events", Some(&key), batch(json!([thrown("Gift card total is NaN")]))).await;
    assert_eq!(r.status, StatusCode::ACCEPTED);
    let issue = issue_named(&t, &c, "Gift card total is NaN").await;
    assert_eq!(issue["culprit"], "src/basket.ts in applyGiftCard");
    let id = issue["id"].as_str().unwrap();
    let r = t.get(&format!("/api/v1/issues/{id}/events/latest"), Some(&c)).await;
    let top = &r.body["event"]["exception"]["frames"][0];
    assert_eq!(top["mapped"], true, "{top}");
    assert_eq!(top["file"], "src/basket.ts");
    assert_eq!(top["line"], 20);
    assert_eq!(top["context"]["lines"][5], "// basket.ts line 20");
}

#[tokio::test]
async fn deploys_record_releases() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (_, upload) = keys(&t, "p-kiln").await;
    let deploy = json!({
        "release": "  3.0.0 ",
        "environment": "production",
        "commit": { "sha": "9f2c1ab", "message": "Fix gift card rounding", "author": "Ana" },
    });
    let r = ingest(&t, "/ingest/v1/deploys", Some(&upload), deploy.to_string().into()).await;
    assert_eq!(r.status, StatusCode::CREATED, "{:?}", r.body);
    let release_id = r.body["releaseId"].as_str().unwrap().to_owned();
    let r = t.get(&format!("/api/v1/releases/{release_id}"), Some(&c)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["release"]["version"], "3.0.0");
    assert_eq!(r.body["release"]["commit"]["sha"], "9f2c1ab");

    let r = ingest(&t, "/ingest/v1/deploys", Some(&upload), json!({ "release": " " }).to_string().into()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn floods_are_throttled() {
    let t = app().await;
    let (key, _) = keys(&t, "p-harbour").await;
    let hundred = || {
        let events: Vec<Value> =
            (0..100).map(|i| json!({ "timestamp": "x", "message": format!("flood {i}") })).collect();
        batch(json!(events))
    };
    for _ in 0..5 {
        let r = ingest(&t, "/ingest/v1/events", Some(&key), hundred()).await;
        assert_eq!(r.status, StatusCode::ACCEPTED);
    }
    // The bucket refills at 50 events a second while the test runs, so on a slow machine
    // a few may get through: then it's a partial 202, and a 429 only when none do.
    let r = ingest(&t, "/ingest/v1/events", Some(&key), hundred()).await;
    let (accepted, rejected) = (r.body["accepted"].as_u64().unwrap(), r.body["rejected"].as_u64().unwrap());
    assert_eq!(accepted + rejected, 100, "{:?}", r.body);
    assert!(rejected >= 90, "{:?}", r.body);
    let throttled = if accepted == 0 { StatusCode::TOO_MANY_REQUESTS } else { StatusCode::ACCEPTED };
    assert_eq!(r.status, throttled, "{:?}", r.body);
    assert!(r.body["retryAfter"].as_u64().unwrap() >= 1);
    assert!(r.headers.contains_key(header::RETRY_AFTER));
    // Another project isn't held back.
    let (other, _) = keys(&t, "p-kiln").await;
    let r = ingest(&t, "/ingest/v1/events", Some(&other), batch(json!([thrown("fine")]))).await;
    assert_eq!(r.status, StatusCode::ACCEPTED);
}

/// Reads the next `data:` line from an open SSE body.
async fn next_data(body: &mut Body) -> Value {
    loop {
        let frame = tokio::time::timeout(Duration::from_secs(2), body.frame()).await.unwrap().unwrap().unwrap();
        let Ok(bytes) = frame.into_data() else { continue };
        let text = String::from_utf8(bytes.to_vec()).unwrap();
        if let Some(data) = text.lines().find_map(|l| l.strip_prefix("data: ")) {
            return serde_json::from_str(data).unwrap();
        }
    }
}

#[tokio::test]
async fn the_live_stream_is_scoped() {
    let t = app().await;
    let owner = t.sign_in(OWNER).await;
    let priya = t.sign_in(PRIYA).await;
    let r = t.get("/api/v1/live", None).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);

    let open = |cookie: String| {
        let app = t.app.clone();
        async move {
            let req = Request::get("/api/v1/live").header(header::COOKIE, cookie).body(Body::empty()).unwrap();
            app.oneshot(req).await.unwrap()
        }
    };
    let res = open(priya).await;
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(res.headers()[header::CONTENT_TYPE], "text/event-stream");
    let mut priyas = res.into_body();
    let mut owners = open(owner.clone()).await.into_body();

    // Moss isn't Priya's: only the owner hears about it.
    let resolve = |id: &str| json!({ "issueIds": [id], "change": { "kind": "resolve" } });
    let r = t.post("/api/v1/issues/update", Some(&owner), resolve("i-moss-regressed")).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    let r = t.post("/api/v1/issues/update", Some(&owner), resolve("i-noisy")).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);

    let first = next_data(&mut owners).await;
    assert_eq!(first, json!({ "kind": "issuesChanged", "projectId": "p-moss", "issueIds": ["i-moss-regressed"] }));
    let theirs = next_data(&mut priyas).await;
    assert_eq!(theirs, json!({ "kind": "issuesChanged", "projectId": "p-kiln", "issueIds": ["i-noisy"] }));

    // Shutting down ends every stream.
    t.live.close();
    let end = tokio::time::timeout(Duration::from_secs(2), priyas.frame()).await.unwrap();
    assert!(end.is_none());
}
