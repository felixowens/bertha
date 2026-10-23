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

#[tokio::test]
async fn the_owners_stream_hears_a_project_made_after_it_opened() {
    let t = app().await;
    let owner = t.sign_in(OWNER).await;
    let req = Request::get("/api/v1/live").header(header::COOKIE, owner.clone()).body(Body::empty()).unwrap();
    let mut stream = t.app.clone().oneshot(req).await.unwrap().into_body();

    let input =
        json!({ "name": "Lantern Books", "client": null, "url": null, "runtimes": ["browser"], "environments": [] });
    let r = t.post("/api/v1/projects", Some(&owner), input).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    let id = r.body["value"]["project"]["id"].as_str().unwrap().to_owned();
    let key = r.body["value"]["setup"]["ingestKey"].as_str().unwrap().to_owned();

    let r = ingest(&t, "/ingest/v1/events", Some(&key), batch(json!([thrown("first light")]))).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
    let heard = next_data(&mut stream).await;
    assert_eq!(heard["kind"], "ingested", "{heard}");
    assert_eq!(heard["projectId"], id.as_str());
    t.live.close();
}

fn otlp_span(id: &str, parent: Option<&str>, name: &str, kind: u8, start_ms: u64, end_ms: u64) -> Value {
    let nanos = |ms: u64| (1_760_346_000_000 + ms) * 1_000_000;
    json!({
        "traceId": "0af7651916cd43dd8448eb211c80319c", "spanId": id, "parentSpanId": parent.unwrap_or(""),
        "name": name, "kind": kind,
        "startTimeUnixNano": nanos(start_ms).to_string(), "endTimeUnixNano": nanos(end_ms).to_string(),
        "attributes": [{ "key": "http.request.header.authorization", "value": { "stringValue": "Bearer abc" } }],
    })
}

fn otlp(service: &str, spans: Value) -> Vec<u8> {
    json!({ "resourceSpans": [{
        "resource": { "attributes": [{ "key": "service.name", "value": { "stringValue": service } }] },
        "scopeSpans": [{ "spans": spans }],
    }]})
    .to_string()
    .into_bytes()
}

/// OTLP spans land; an error event in the same trace shows them, on the span it named.
#[tokio::test]
async fn traces_come_in_over_otlp() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, upload) = keys(&t, "p-moss").await;

    let mut call = otlp_span("00f067aa0ba902b7", Some("b7ad6b7169203331"), "GET stock.internal/levels", 3, 100, 1_100);
    call["attributes"]
        .as_array_mut()
        .unwrap()
        .push(json!({ "key": "url.full", "value": { "stringValue": "https://stock.internal/levels" } }));
    call["status"] = json!({ "code": 2, "message": "connect ETIMEDOUT" });
    let spans = json!([
        otlp_span("b7ad6b7169203331", None, "GET /cart", 2, 0, 1_200),
        call,
        { "traceId": "0", "spanId": "1", "name": "bad", "startTimeUnixNano": "1" },
    ]);
    let r = ingest(&t, "/ingest/v1/traces", Some(&key), gzip(&otlp("kiln-web", spans))).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["partialSuccess"]["rejectedSpans"], "1");
    assert_eq!(r.headers[header::CONTENT_TYPE], "application/json");
    let r = ingest(&t, "/ingest/v1/traces", Some(&upload), otlp("kiln-web", json!([]))).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "the ingest key, not the upload key");
    let r = ingest(&t, "/ingest/v1/traces", Some(&key), b"{nope".to_vec()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);

    // Protobuf, as the Node exporter sends it: an empty export answers an empty response.
    let req = Request::post(format!("/ingest/v1/traces?key={key}"))
        .header(header::CONTENT_TYPE, "application/x-protobuf")
        .body(Body::empty())
        .unwrap();
    let r = t.send(req).await;
    assert_eq!((r.status, &r.body), (StatusCode::OK, &Value::Null));
    assert_eq!(r.headers[header::CONTENT_TYPE], "application/x-protobuf");

    let mut event = thrown("Stock levels timed out");
    event["trace"] = json!({ "traceId": "0af7651916cd43dd8448eb211c80319c", "spanId": "b7ad6b7169203331" });
    let r = ingest(&t, "/ingest/v1/events", Some(&key), batch(json!([event]))).await;
    assert_eq!(r.status, StatusCode::ACCEPTED);
    let issue = issue_named(&t, &c, "Stock levels timed out").await;
    let id = issue["id"].as_str().unwrap();
    let event = t.get(&format!("/api/v1/issues/{id}/events/latest"), Some(&c)).await.body["event"].clone();
    let event_id = event["id"].as_str().unwrap();

    let r = t.get(&format!("/api/v1/issues/{id}/events/{event_id}/trace"), Some(&c)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    let trace = r.body;
    assert_eq!(trace["traceId"], "0af7651916cd43dd8448eb211c80319c");
    assert_eq!(trace["durationMs"], 1_200.0);
    assert_eq!(trace["spans"][0]["service"], "kiln-web");
    assert_eq!(trace["spans"][0]["kind"], "server");
    assert_eq!(trace["spans"][0]["event"]["issue"]["id"], id);
    assert_eq!(trace["spans"][0]["attributes"]["http.request.header.authorization"], "[redacted]");
    assert_eq!(trace["spans"][1]["startMs"], 100.0);
    assert_eq!(trace["spans"][1]["silent"], "stock.internal", "failed with no status code: it never answered");

    // A collaborator who can't see the project gets a 404, like the event.
    let p = t.sign_in(PRIYA).await;
    let r = t.get(&format!("/api/v1/issues/{id}/events/{event_id}/trace"), Some(&p)).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
}

/// The fixtures' clock, which lines are dated against.
const NOW_MS: u64 = 1_791_882_720_000;

fn otlp_line(message: &str, severity: u8, ago_ms: u64, attributes: Value) -> Value {
    json!({
        "timeUnixNano": ((NOW_MS - ago_ms) * 1_000_000).to_string(),
        "severityNumber": severity,
        "body": { "stringValue": message },
        "attributes": attributes,
    })
}

/// A logs export as `@bigbertha/sdk` sends it: string attributes, no service.name.
fn otlp_logs(records: Value) -> Vec<u8> {
    json!({ "resourceLogs": [{
        "resource": { "attributes": [{ "key": "deployment.environment.name", "value": { "stringValue": "production" } }] },
        "scopeLogs": [{ "logRecords": records }],
    }]})
    .to_string()
    .into_bytes()
}

fn log_filter(project: &str, query: &str) -> Value {
    json!({ "projectIds": [project], "minLevel": "debug", "query": query, "range": "1h", "until": null, "patternId": null })
}

async fn logged(t: &TestApp, cookie: &str, project: &str, query: &str) -> Value {
    let r = t.post("/api/v1/logs/query", Some(cookie), json!({ "filter": log_filter(project, query) })).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    r.body
}

/// The protobuf messages an OpenTelemetry exporter sends, cut down to what's used.
mod pb {
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct Request {
        #[prost(message, repeated, tag = "1")]
        pub resource_logs: Vec<ResourceLogs>,
    }
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ResourceLogs {
        #[prost(message, optional, tag = "1")]
        pub resource: Option<Resource>,
        #[prost(message, repeated, tag = "2")]
        pub scope_logs: Vec<ScopeLogs>,
    }
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct Resource {
        #[prost(message, repeated, tag = "1")]
        pub attributes: Vec<KeyValue>,
    }
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ScopeLogs {
        #[prost(message, repeated, tag = "2")]
        pub log_records: Vec<LogRecord>,
    }
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct LogRecord {
        #[prost(fixed64, tag = "1")]
        pub time_unix_nano: u64,
        #[prost(int32, tag = "2")]
        pub severity_number: i32,
        #[prost(message, optional, tag = "5")]
        pub body: Option<AnyValue>,
        #[prost(message, repeated, tag = "6")]
        pub attributes: Vec<KeyValue>,
        #[prost(bytes = "vec", tag = "9")]
        pub trace_id: Vec<u8>,
    }
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct KeyValue {
        #[prost(string, tag = "1")]
        pub key: String,
        #[prost(message, optional, tag = "2")]
        pub value: Option<AnyValue>,
    }
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct AnyValue {
        #[prost(string, tag = "1")]
        pub string_value: String,
    }
    pub fn text(s: &str) -> Option<AnyValue> {
        Some(AnyValue { string_value: s.into() })
    }
}

/// An OpenTelemetry Collector forwarding a service's stdout, as protobuf.
#[tokio::test]
async fn logs_come_in_over_otlp_protobuf() {
    use prost::Message as _;
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, upload) = keys(&t, "p-moss").await;
    let body = pb::Request {
        resource_logs: vec![pb::ResourceLogs {
            resource: Some(pb::Resource {
                attributes: vec![
                    pb::KeyValue { key: "service.name".into(), value: pb::text("moss-worker") },
                    pb::KeyValue { key: "service.version".into(), value: pb::text("3.1.0") },
                ],
            }),
            scope_logs: vec![pb::ScopeLogs {
                log_records: vec![pb::LogRecord {
                    time_unix_nano: (NOW_MS - 5_000) * 1_000_000,
                    severity_number: 13,
                    body: pb::text("Stock sync slow for ana@example.com"),
                    attributes: vec![pb::KeyValue { key: "supplier".into(), value: pb::text("greenleaf") }],
                    trace_id: vec![0xab; 16],
                }],
            }],
        }],
    }
    .encode_to_vec();
    let send = |key: String, body: Vec<u8>| {
        let req = Request::post(format!("/ingest/v1/logs?key={key}"))
            .header(header::CONTENT_TYPE, "application/x-protobuf")
            .body(Body::from(body))
            .unwrap();
        t.send(req)
    };
    let r = send(upload, body.clone()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "the ingest key, not the upload key");
    let r = send(key, body).await;
    assert_eq!((r.status, &r.body), (StatusCode::OK, &Value::Null), "an empty response: everything kept");
    assert_eq!(r.headers[header::CONTENT_TYPE], "application/x-protobuf");

    let list = logged(&t, &c, "p-moss", "supplier:greenleaf").await;
    let line = &list["lines"][0];
    assert_eq!(list["lines"].as_array().unwrap().len(), 1, "{list:?}");
    assert_eq!(line["level"], "warning");
    assert_eq!(line["message"], "Stock sync slow for [email]");
    assert_eq!(line["service"], "moss-worker");
    assert_eq!(line["release"], "3.1.0");
    assert_eq!(line["traceId"], "ab".repeat(16));
    assert_eq!(line["fields"]["supplier"], "greenleaf");

    let r = t
        .post("/api/v1/logs/patterns", Some(&c), json!({ "filter": log_filter("p-moss", "supplier:greenleaf") }))
        .await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["patterns"][0]["count"], 1, "{:#}", r.body);

    // A collaborator outside the project reads nothing of it.
    let p = t.sign_in(PRIYA).await;
    assert_eq!(logged(&t, &p, "p-moss", "supplier:greenleaf").await["lines"], json!([]));
}

/// The SDKs' JSON: gzipped as text/plain, every value a string, no service.
#[tokio::test]
async fn logs_come_in_as_the_sdks_send_them() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, _) = keys(&t, "p-moss").await;
    let mut live = t.live.subscribe();
    let lines = json!([
        otlp_line("Basket restored", 9, 3_000, json!([{ "key": "bertha.dropped", "value": { "stringValue": "4" } }])),
        otlp_line("Checking basket", 5, 2_000, json!([])),
    ]);
    let r = ingest(&t, "/ingest/v1/logs", Some(&key), gzip(&otlp_logs(lines))).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body, json!({}));
    assert_eq!(r.headers[header::CONTENT_TYPE], "application/json");

    let list = logged(&t, &c, "p-moss", "basket").await;
    let [line] = list["lines"].as_array().unwrap().as_slice() else { panic!("one line: {list:?}") };
    assert_eq!(line["message"], "Basket restored");
    assert_eq!(line["service"], Value::Null);
    assert_eq!(line["fields"]["bertha.dropped"], "4", "a field like any other");
    assert_eq!(list["lines"].as_array().unwrap().len(), 1, "debug is below the project's minimum level");

    let event = tokio::time::timeout(Duration::from_secs(2), live.recv()).await.unwrap().unwrap();
    assert_eq!(serde_json::to_value(&*event).unwrap(), json!({ "kind": "logs", "projectId": "p-moss", "lines": 1 }));

    let r = ingest(&t, "/ingest/v1/logs", Some(&key), b"{nope".to_vec()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    let r = ingest(&t, "/ingest/v1/logs", None, otlp_logs(json!([]))).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
}

/// The project's minimum level, set by its owner, decides what's kept.
#[tokio::test]
async fn logs_below_the_minimum_level_are_dropped() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, _) = keys(&t, "p-moss").await;
    let project = t.get("/api/v1/projects/p-moss/settings", Some(&c)).await.body["project"].clone();
    let mut input = json!({ "logs": { "minLevel": "error", "retentionDays": 7 } });
    for k in ["name", "client", "url", "repoUrl", "runtimes", "environments"] {
        input[k] = project[k].clone();
    }
    let r = t.post("/api/v1/projects/p-moss", Some(&c), input).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    let settings = t.get("/api/v1/projects/p-moss/settings", Some(&c)).await.body;
    assert_eq!(settings["logs"], json!({ "minLevel": "error", "retentionDays": 7 }));

    let lines =
        json!([otlp_line("Quota warning", 13, 1_000, json!([])), otlp_line("Quota exceeded", 17, 1_000, json!([]))]);
    let r = ingest(&t, "/ingest/v1/logs", Some(&key), otlp_logs(lines)).await;
    assert_eq!((r.status, &r.body), (StatusCode::OK, &json!({})), "dropped quietly");
    let list = logged(&t, &c, "p-moss", "quota").await;
    let messages: Vec<&Value> = list["lines"].as_array().unwrap().iter().map(|l| &l["message"]).collect();
    assert_eq!(messages, [&json!("Quota exceeded")]);
}

/// Past 2,000 lines a minute, the rest are dropped, counted and shown.
#[tokio::test]
async fn logs_past_the_rate_cap_are_counted() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, _) = keys(&t, "p-moss").await;
    let lines: Vec<Value> = (0..2_100).map(|i| otlp_line(&format!("Tick {i}"), 9, 1_000, json!([]))).collect();
    let r = ingest(&t, "/ingest/v1/logs", Some(&key), gzip(&otlp_logs(json!(lines)))).await;
    assert_eq!(r.status, StatusCode::OK, "not a 429: the lines aren't sent again");
    assert_eq!(r.body["partialSuccess"]["rejectedLogRecords"], "100");

    let list = logged(&t, &c, "p-moss", "tick").await;
    assert_eq!(list["total"], 2_000);
    assert_eq!(list["dropped"][0]["projectId"], "p-moss");
    assert_eq!(list["dropped"][0]["lines"], 100);
    let settings = t.get("/api/v1/projects/p-moss/settings", Some(&c)).await.body;
    assert_eq!(settings["logUsage"]["droppedToday"], 100);
}

/// A line sent with the event's id links to it, and shows among the event's logs.
#[tokio::test]
async fn logs_link_to_their_event() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key, _) = keys(&t, "p-moss").await;
    let mut event = thrown("Basket lost its items");
    event["id"] = json!("c0ffee0000000000000000000000beef");
    let r = ingest(&t, "/ingest/v1/events", Some(&key), batch(json!([event]))).await;
    assert_eq!(r.status, StatusCode::ACCEPTED);
    let issue = issue_named(&t, &c, "Basket lost its items").await;
    let id = issue["id"].as_str().unwrap();
    let event_id = t.get(&format!("/api/v1/issues/{id}/events/latest"), Some(&c)).await.body["event"]["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let lines = json!([
        // `thrown` is dated 09:00, 12 minutes before now.
        otlp_line("Loading basket", 9, 12 * 60_000 + 20_000, json!([])),
        otlp_line(
            "Basket lost its items",
            17,
            12 * 60_000,
            json!([
                { "key": "bertha.event_id", "value": { "stringValue": "c0ffee0000000000000000000000beef" } }
            ])
        ),
    ]);
    let r = ingest(&t, "/ingest/v1/logs", Some(&key), otlp_logs(lines)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);

    let list = logged(&t, &c, "p-moss", "\"lost its items\"").await;
    let line = &list["lines"][0];
    assert_eq!(line["event"], json!({ "issueId": id, "eventId": event_id }));
    assert_eq!(line["fields"], json!({}), "the link isn't a field");

    let r = t.get(&format!("/api/v1/issues/{id}/events/{event_id}/logs"), Some(&c)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["scope"], "nearby");
    assert_eq!(r.body["eventLineId"], line["id"], "{:#}", r.body);
    let messages: Vec<&Value> = r.body["lines"].as_array().unwrap().iter().map(|l| &l["message"]).collect();
    assert!(messages.contains(&&json!("Loading basket")), "{messages:?}");

    let p = t.sign_in(PRIYA).await;
    let r = t.get(&format!("/api/v1/issues/{id}/events/{event_id}/logs"), Some(&p)).await;
    assert_eq!((r.status, &r.body), (StatusCode::OK, &Value::Null), "out of reach reads as missing");
}

/// A new project connects on whatever arrives first, before any error: log lines it
/// keeps none of, traces, and a heartbeat that names what's running.
#[tokio::test]
async fn a_project_connects_before_its_first_error() {
    let t = app().await;
    let owner = t.sign_in(OWNER).await;
    let new = |name: &str| json!({ "name": name, "client": null, "url": null, "runtimes": ["server"], "environments": ["production"] });
    let setup = async |id: &str| t.get(&format!("/api/v1/projects/{id}/setup"), Some(&owner)).await.body;

    for (name, path, via) in [("Lantern", "/ingest/v1/logs", "logs"), ("Ledger", "/ingest/v1/traces", "traces")] {
        let r = t.post("/api/v1/projects", Some(&owner), new(name)).await;
        let id = r.body["value"]["project"]["id"].as_str().unwrap().to_owned();
        let key = r.body["value"]["setup"]["ingestKey"].as_str().unwrap().to_owned();
        assert_eq!(setup(&id).await["connection"], Value::Null);
        let body = match via {
            // Debug, below the default minimum level: nothing is kept, but it's set up.
            "logs" => otlp_logs(json!([otlp_line("Booting", 5, 1_000, json!([]))])),
            _ => otlp("ledger", json!([otlp_span("a000000000000001", None, "GET /", 2, 0, 20)])),
        };
        let r = ingest(&t, path, Some(&key), body).await;
        assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
        let s = setup(&id).await;
        assert_eq!(s["connection"]["via"], via, "{s}");
        assert_eq!(s["connection"]["running"], Value::Null);
        assert_eq!(s["firstEventAt"], Value::Null);
        let project = t.get(&format!("/api/v1/projects/{id}/settings"), Some(&owner)).await.body["project"].clone();
        assert_eq!(project["health"], "healthy", "{project}");

        let beat = json!({ "release": "0.3.0", "environment": "production" }).to_string();
        let r = ingest(&t, "/ingest/v1/heartbeat", Some(&key), beat.into()).await;
        assert_eq!(r.status, StatusCode::NO_CONTENT);
        let s = setup(&id).await;
        assert_eq!(s["connection"]["via"], via, "the first arrival stays");
        assert_eq!(s["connection"]["running"]["release"], "0.3.0");
        assert_eq!(s["connection"]["running"]["environment"], "production");
    }
}
