// The client end to end against a mock ingest server: what reaches bertha, when, and
// what each integration adds.

use std::collections::{BTreeMap, VecDeque};
use std::error::Error;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use bigbertha::{Capture, Guard, Level, Options};
use serde_json::{Value, json};

/// Tests share the global client, so they take turns.
fn serial() -> MutexGuard<'static, ()> {
    static LOCK: Mutex<()> = Mutex::new(());
    LOCK.lock().unwrap_or_else(PoisonError::into_inner)
}

#[derive(Debug, Clone)]
struct Got {
    path: String,
    headers: BTreeMap<String, String>,
    gzipped: bool,
    body: Value,
}

enum Reply {
    Status(u16, Vec<(&'static str, &'static str)>, &'static str),
    Hangup,
}

#[derive(Clone, Default)]
struct Mock {
    url: String,
    got: Arc<Mutex<Vec<Got>>>,
    replies: Arc<Mutex<VecDeque<Reply>>>,
}

impl Mock {
    fn start() -> Mock {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let mock = Mock { url: format!("http://{}", listener.local_addr().expect("addr")), ..Mock::default() };
        let m = mock.clone();
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let m = m.clone();
                thread::spawn(move || m.serve(stream));
            }
        });
        mock
    }

    fn serve(&self, stream: TcpStream) {
        let mut reader = BufReader::new(stream.try_clone().expect("clone"));
        let mut out = stream;
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).unwrap_or(0) == 0 {
                return;
            }
            let path = line.split_whitespace().nth(1).unwrap_or_default().to_owned();
            let mut headers = BTreeMap::new();
            loop {
                let mut h = String::new();
                reader.read_line(&mut h).expect("header");
                let h = h.trim_end();
                if h.is_empty() {
                    break;
                }
                if let Some((k, v)) = h.split_once(':') {
                    headers.insert(k.trim().to_ascii_lowercase(), v.trim().to_owned());
                }
            }
            let len: usize = headers.get("content-length").and_then(|v| v.parse().ok()).unwrap_or(0);
            let mut raw = vec![0; len];
            reader.read_exact(&mut raw).expect("body");
            let gzipped = raw.starts_with(&[0x1f, 0x8b]);
            let text = if gzipped {
                let mut s = String::new();
                flate2::read::GzDecoder::new(&raw[..]).read_to_string(&mut s).expect("gunzip");
                s
            } else {
                String::from_utf8(raw).expect("utf8")
            };
            let body: Value = serde_json::from_str(&text).expect("json");
            let reply = self.replies.lock().expect("replies").pop_front();
            self.got.lock().expect("got").push(Got { path, headers, gzipped, body });
            let (status, extra, body) = match reply {
                Some(Reply::Hangup) => return,
                Some(Reply::Status(s, h, b)) => (s, h, b),
                None => (200, vec![], r#"{"accepted":1,"rejected":0}"#),
            };
            let mut res =
                format!("HTTP/1.1 {status} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\n", body.len());
            for (k, v) in extra {
                res.push_str(&format!("{k}: {v}\r\n"));
            }
            res.push_str("\r\n");
            res.push_str(body);
            if out.write_all(res.as_bytes()).is_err() {
                return;
            }
        }
    }

    fn reply(&self, r: Reply) {
        self.replies.lock().expect("replies").push_back(r);
    }

    fn requests(&self, path: &str) -> Vec<Got> {
        self.got.lock().expect("got").iter().filter(|g| g.path == path).cloned().collect()
    }

    fn events(&self) -> Vec<Value> {
        self.requests("/ingest/v1/events")
            .iter()
            .flat_map(|g| g.body["events"].as_array().cloned().unwrap_or_default())
            .collect()
    }

    /// Waits for `n` events.
    fn wait(&self, n: usize, timeout: Duration) -> Vec<Value> {
        let end = Instant::now() + timeout;
        loop {
            let events = self.events();
            if events.len() >= n || Instant::now() > end {
                return events;
            }
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn options(&self) -> Options {
        bigbertha::options!().key("bk_test").url(&self.url).heartbeat(false).environment("test")
    }
}

fn init(o: Options) -> Guard {
    bigbertha::init(o).expect("initialised")
}

#[derive(Debug)]
struct Declined(std::io::Error);

impl std::fmt::Display for Declined {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("card declined for order 41")
    }
}

impl Error for Declined {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        Some(&self.0)
    }
}

fn declined() -> Declined {
    Declined(std::io::Error::new(std::io::ErrorKind::ConnectionReset, "stripe hung up"))
}

#[test]
fn errors_are_batched_after_a_second() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options().release("1.2.3").tag("region", "eu"));
    let started = Instant::now();
    for _ in 0..3 {
        bigbertha::capture_error(&declined()).expect("captured");
    }
    thread::sleep(Duration::from_millis(500));
    assert!(mock.events().is_empty(), "debounced");
    let events = mock.wait(3, Duration::from_secs(3));
    assert!(started.elapsed() >= Duration::from_secs(1));
    assert_eq!(mock.requests("/ingest/v1/events").len(), 1, "one batch");

    let batch = &mock.requests("/ingest/v1/events")[0];
    assert_eq!(batch.headers["authorization"], "Bearer bk_test");
    assert_eq!(batch.headers["content-type"], "text/plain");
    assert_eq!(batch.body["sdk"]["name"], "bertha.rust");
    assert!(batch.gzipped, "3 events are over 1 KB");

    let e = &events[0];
    assert_eq!(e["exception"]["type"], "Declined");
    assert_eq!(e["exception"]["message"], "card declined for order 41");
    assert_eq!(e["exception"]["cause"]["type"], "io::Error");
    assert_eq!(e["exception"]["cause"]["message"], "stripe hung up");
    assert_eq!(e["exception"]["frames"], json!([]));
    assert_eq!(e["level"], "error");
    assert_eq!(e["mechanism"], json!({ "handler": "captureException", "handled": true }));
    assert_eq!(e["release"], "1.2.3");
    assert_eq!(e["environment"], "test");
    assert_eq!(e["tags"]["region"], "eu");
    assert!(e["context"]["runtime"].as_str().is_some_and(|r| r.starts_with("Rust 1.")));
    assert!(e["id"].as_str().is_some_and(|id| id.len() == 36));
    assert!(e.get("request").is_none(), "unset fields aren't sent as null");
    drop(guard);
}

#[test]
fn the_release_is_the_commit_then_the_crate_version_and_the_heartbeat_says_so() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options().heartbeat(true).commit("ABCDEF1"));
    bigbertha::capture_message("checkout slow", Capture::new());
    assert!(guard.flush(Duration::from_secs(3)));
    let e = &mock.events()[0];
    assert_eq!(e["release"], "abcdef1", "the release `bertha deploy` records by default");
    assert_eq!(e["message"], "checkout slow");
    assert_eq!(e["level"], "warning");
    let beats = mock.requests("/ingest/v1/heartbeat");
    assert_eq!(beats.len(), 1);
    assert_eq!(beats[0].body, json!({ "environment": "test", "release": "abcdef1", "commit": "abcdef1" }));
    drop(guard);

    let guard = init(mock.options().commit(""));
    bigbertha::capture_message("checkout slow", Capture::new());
    assert!(guard.flush(Duration::from_secs(3)));
    assert_eq!(mock.events()[1]["release"], env!("CARGO_PKG_VERSION"));
    drop(guard);
}

#[test]
fn at_most_100_events_a_minute_in_batches_of_100() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    let ids: Vec<_> =
        (0..120).filter_map(|i| bigbertha::capture_message(format!("slow {i}"), Capture::new())).collect();
    assert_eq!(ids.len(), 100);
    assert!(guard.flush(Duration::from_secs(3)));
    assert_eq!(mock.events().len(), 100);
    assert_eq!(mock.requests("/ingest/v1/events").len(), 1);
    drop(guard);
}

#[test]
fn sampling_and_before_send() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options().sample_rate(0.0));
    assert!(bigbertha::capture_message("never", Capture::new()).is_none());
    drop(guard);

    let guard = init(mock.options().before_send(|mut e| {
        if e.message.as_deref() == Some("drop me") {
            return None;
        }
        if e.message.as_deref() == Some("explode") {
            panic!("before_send bug");
        }
        e.tags.get_or_insert_default().insert("seen".into(), "yes".into());
        Some(e)
    }));
    bigbertha::capture_message("drop me", Capture::new());
    bigbertha::capture_message("keep me", Capture::new());
    bigbertha::capture_message("explode", Capture::new());
    assert!(guard.flush(Duration::from_secs(3)));
    let events = mock.events();
    let messages: Vec<_> = events.iter().map(|e| e["message"].as_str().unwrap_or_default()).collect();
    assert_eq!(messages, ["keep me", "explode"]);
    assert_eq!(events[0]["tags"]["seen"], "yes");
    assert!(events[1]["tags"].get("seen").is_none(), "sent as it was");
    drop(guard);
}

#[test]
fn scrubs_by_default() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    bigbertha::add_breadcrumb("auth", "Authorization: Bearer eyJhbGciOi.J9x-y_z");
    bigbertha::capture_message(
        "No account for ana.b+x@example.co.uk",
        Capture::new().request(bigbertha::IngestRequest {
            method: "GET".into(),
            url: "https://a.test/cb?code=abc&state=1&api_key=k#x".into(),
            status: None,
            headers: None,
        }),
    );
    assert!(guard.flush(Duration::from_secs(3)));
    let e = &mock.events()[0];
    assert_eq!(e["message"], "No account for [email]");
    assert_eq!(e["breadcrumbs"][0]["message"], "Authorization: Bearer [redacted]");
    assert_eq!(e["request"]["url"], "https://a.test/cb?code=[redacted]&state=1&api_key=[redacted]#x");
    drop(guard);

    let guard = init(mock.options().scrub(false));
    bigbertha::capture_message("ana@example.com", Capture::new());
    assert!(guard.flush(Duration::from_secs(3)));
    assert_eq!(mock.events()[1]["message"], "ana@example.com");
    drop(guard);
}

#[test]
fn keeps_the_last_100_breadcrumbs_and_the_user() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options().scrub(false));
    for i in 0..150 {
        bigbertha::add_breadcrumb_at("cart", format!("step {i}"), Some("info"));
    }
    bigbertha::set_user(Some(bigbertha::IngestUser { id: Some("u_1".into()), ..Default::default() }));
    bigbertha::capture_message(
        "x",
        Capture::new().user(bigbertha::IngestUser { email: Some("a@b.co".into()), ..Default::default() }),
    );
    assert!(guard.flush(Duration::from_secs(3)));
    let e = &mock.events()[0];
    let crumbs = e["breadcrumbs"].as_array().expect("crumbs");
    assert_eq!(crumbs.len(), 100);
    assert_eq!(crumbs[0]["message"], "step 50");
    assert_eq!(crumbs[99]["message"], "step 149");
    assert_eq!(e["user"], json!({ "id": "u_1", "email": "a@b.co" }));
    drop(guard);
}

#[test]
fn waits_when_bertha_says_slow_down() {
    let _s = serial();
    let mock = Mock::start();
    mock.reply(Reply::Status(429, vec![("retry-after", "1")], r#"{"error":"slow down"}"#));
    let guard = init(mock.options());
    bigbertha::capture_message("x", Capture::new());
    let started = Instant::now();
    assert!(guard.flush(Duration::from_secs(5)));
    assert!(started.elapsed() >= Duration::from_secs(1), "paused for Retry-After");
    let tries = mock.requests("/ingest/v1/events");
    assert_eq!(tries.len(), 2);
    assert_eq!(
        tries[0].body["events"][0]["id"], tries[1].body["events"][0]["id"],
        "the same event, so retries are safe"
    );
    drop(guard);
}

#[test]
fn retries_when_bertha_cant_be_reached() {
    let _s = serial();
    let mock = Mock::start();
    mock.reply(Reply::Hangup);
    let guard = init(mock.options());
    bigbertha::capture_message("x", Capture::new());
    assert!(guard.flush(Duration::from_secs(5)));
    assert_eq!(mock.requests("/ingest/v1/events").len(), 2);
    drop(guard);
}

#[test]
fn gives_up_on_a_refusal() {
    let _s = serial();
    let mock = Mock::start();
    mock.reply(Reply::Status(401, vec![], r#"{"error":"Unknown key"}"#));
    let guard = init(mock.options());
    bigbertha::capture_message("x", Capture::new());
    assert!(guard.flush(Duration::from_secs(3)));
    bigbertha::capture_message("y", Capture::new());
    assert!(guard.flush(Duration::from_secs(3)));
    assert_eq!(mock.requests("/ingest/v1/events").len(), 2, "no retries");
    drop(guard);
}

#[test]
fn dropping_the_guard_sends_whats_left() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    bigbertha::capture_message("last words", Capture::new());
    drop(guard);
    assert_eq!(mock.events().len(), 1);
    assert!(bigbertha::capture_message("after", Capture::new()).is_none(), "stopped");
}

#[test]
fn without_a_key_nothing_starts() {
    let _s = serial();
    assert!(bigbertha::init(Options::default().url("http://127.0.0.1:9")).is_none());
}

#[test]
fn panics_are_fatal_with_the_stack() {
    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    let worker = thread::Builder::new().name("worker".into()).spawn(|| {
        let orders: Vec<u32> = vec![];
        orders[3]
    });
    assert!(worker.expect("spawned").join().is_err());
    assert!(guard.flush(Duration::from_secs(3)));
    let e = &mock.events()[0];
    assert_eq!(e["level"], "fatal");
    assert_eq!(e["mechanism"], json!({ "handler": "panic", "handled": false }));
    assert_eq!(e["exception"]["type"], "panic");
    assert_eq!(e["exception"]["message"], "index out of bounds: the len is 0 but the index is 3");
    assert_eq!(e["tags"]["thread"], "worker");
    let frames = e["exception"]["frames"].as_array().expect("frames");
    let here = frames.iter().find(|f| f["inApp"] == true).expect("an app frame");
    assert_eq!(here["file"], "tests/client.rs");
    assert!(here["function"].as_str().is_some_and(|f| f.contains("panics_are_fatal_with_the_stack")), "{here}");
    assert!(!frames.iter().any(|f| f["function"].as_str().is_some_and(|f| f.contains("bigbertha::"))));
    drop(guard);
}

#[test]
fn the_tracing_layer_reports_errors_with_breadcrumbs() {
    use tracing_subscriber::prelude::*;

    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    let subscriber = tracing_subscriber::registry().with(bigbertha::tracing::layer());
    tracing::subscriber::with_default(subscriber, || {
        tracing::info!(order = 41, "charging");
        tracing::debug!("not kept");
        let e = declined();
        tracing::error!(error = &e as &dyn Error, order = 41, "payment failed");
        tracing::error!(status = 502, "upstream timed out");
        // Already captured by hand: not a second event.
        let e = declined();
        bigbertha::capture_error(&e);
        tracing::error!(error = %e, "payment failed");
    });
    assert!(guard.flush(Duration::from_secs(3)));
    let events = mock.events();
    assert_eq!(events.len(), 3, "{events:#?}");

    let e = &events[0];
    assert_eq!(e["message"], "payment failed");
    assert_eq!(e["exception"]["type"], "Declined");
    assert_eq!(e["exception"]["message"], "card declined for order 41");
    assert_eq!(e["exception"]["cause"]["message"], "stripe hung up");
    assert_eq!(e["mechanism"], json!({ "handler": "tracing", "handled": true }));
    assert_eq!(e["tags"]["order"], "41");
    assert_eq!(e["tags"]["target"], "client");
    let crumbs = e["breadcrumbs"].as_array().expect("crumbs");
    assert_eq!(crumbs.len(), 1);
    assert_eq!(crumbs[0]["message"], "charging order=41");
    assert_eq!(crumbs[0]["category"], "client");
    assert_eq!(crumbs[0]["level"], "info");

    assert_eq!(events[1]["message"], "upstream timed out");
    assert!(events[1].get("exception").is_none());
    assert_eq!(events[2]["mechanism"]["handler"], "captureException");
    drop(guard);
}

#[test]
fn the_tower_layer_attaches_the_request() {
    use axum::routing::get;
    use tower::ServiceExt;

    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    let app = axum::Router::new()
        .route(
            "/orders/{id}",
            get(|| async {
                bigbertha::capture_anyhow(&anyhow::anyhow!("order 41 is missing"));
                (axum::http::StatusCode::NOT_FOUND, "gone")
            }),
        )
        .route(
            "/explode",
            get(|| async {
                let orders: Vec<u32> = vec![];
                orders[3].to_string()
            }),
        )
        .layer(bigbertha::tower::layer());

    let req = axum::http::Request::get("/orders/41?ref=email")
        .header("host", "shop.test")
        .header("x-forwarded-proto", "https")
        .header("x-forwarded-for", "203.0.113.9, 10.0.0.1")
        .header("authorization", "Bearer secret")
        .header("cookie", "sid=1")
        .header("x-request-id", "req_7")
        .header("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
        .body(axum::body::Body::empty())
        .expect("request");
    let rt = tokio::runtime::Builder::new_current_thread().build().expect("runtime");
    let res = rt.block_on(app.clone().oneshot(req)).expect("response");
    assert_eq!(res.status(), 404);

    let req = axum::http::Request::get("/explode")
        .header("host", "shop.test")
        .body(axum::body::Body::empty())
        .expect("request");
    let res = rt.block_on(app.oneshot(req)).expect("response");
    assert_eq!(res.status(), 500, "a panic is a 500");

    assert!(guard.flush(Duration::from_secs(3)));
    let events = mock.events();
    assert_eq!(events.len(), 2, "{events:#?}");

    let e = &events[0];
    assert_eq!(e["exception"]["message"], "order 41 is missing");
    assert_eq!(e["request"]["method"], "GET");
    assert_eq!(e["request"]["url"], "https://shop.test/orders/41?ref=email");
    assert_eq!(e["request"]["status"], 404);
    let headers = e["request"]["headers"].as_object().expect("headers");
    assert!(!headers.contains_key("authorization") && !headers.contains_key("cookie"));
    assert_eq!(headers["x-request-id"], "req_7");
    assert_eq!(e["user"]["ip"], "203.0.113.9");
    assert_eq!(e["trace"], json!({ "traceId": "4bf92f3577b34da6a3ce929d0e0e4736", "spanId": "00f067aa0ba902b7" }));
    assert_eq!(e["tags"]["request_id"], "req_7");

    let e = &events[1];
    assert_eq!(e["level"], "fatal");
    assert_eq!(e["mechanism"]["handler"], "panic");
    assert_eq!(e["request"]["url"], "http://shop.test/explode");
    assert_eq!(e["request"]["status"], 500);
    drop(guard);
}

#[test]
fn joins_the_active_opentelemetry_span() {
    use opentelemetry::trace::{TraceContextExt, Tracer, TracerProvider};

    let _s = serial();
    let mock = Mock::start();
    let guard = init(mock.options());
    let provider = opentelemetry_sdk::trace::SdkTracerProvider::builder().build();
    let tracer = provider.tracer("test");
    let (trace_id, span_id) = tracer.in_span("checkout", |cx| {
        bigbertha::capture_message("in a span", Capture::new());
        let sc = cx.span().span_context().clone();
        (sc.trace_id().to_string(), sc.span_id().to_string())
    });

    // A request on another trace keeps its own: the span would cut it off from the page.
    let scope = bigbertha::Scope::new();
    scope.set_trace(bigbertha::IngestTrace { trace_id: "4bf92f3577b34da6a3ce929d0e0e4736".into(), span_id: None });
    tracer.in_span("other", |_| scope.run(|| bigbertha::capture_message("other trace", Capture::new())));

    assert!(guard.flush(Duration::from_secs(3)));
    let events = mock.events();
    assert_eq!(events[0]["trace"], json!({ "traceId": trace_id, "spanId": span_id }));
    assert_eq!(events[1]["trace"], json!({ "traceId": "4bf92f3577b34da6a3ce929d0e0e4736" }));
    drop(guard);
}

#[test]
fn anyhow_errors_carry_their_backtrace() {
    let _s = serial();
    let mock = Mock::start();
    // anyhow reads RUST_LIB_BACKTRACE once per process, so the capture runs in a child.
    let status = std::process::Command::new(std::env::current_exe().expect("exe"))
        .args(["--ignored", "--exact", "anyhow_child", "--nocapture"])
        .env("RUST_LIB_BACKTRACE", "1")
        .env("BERTHA_URL", &mock.url)
        .env("BERTHA_KEY", "bk_test")
        .status()
        .expect("child ran");
    assert!(status.success());
    let e = &mock.events()[0];
    assert_eq!(e["exception"]["type"], "io::Error");
    assert_eq!(e["exception"]["message"], "loading order 41");
    assert_eq!(e["exception"]["cause"]["message"], "orders.db is missing");
    let frames = e["exception"]["frames"].as_array().expect("frames");
    let first = &frames[0];
    assert_eq!(first["file"], "tests/client.rs", "{frames:#?}");
    assert_eq!(first["inApp"], true);
    assert!(first["function"].as_str().is_some_and(|f| f.contains("load_order")), "{first}");
}

#[test]
#[ignore = "run by anyhow_errors_carry_their_backtrace"]
fn anyhow_child() {
    use anyhow::Context;

    #[inline(never)]
    fn load_order() -> anyhow::Result<()> {
        Err(std::io::Error::new(std::io::ErrorKind::NotFound, "orders.db is missing")).context("loading order 41")
    }

    let guard = init(bigbertha::options!().heartbeat(false));
    let e = load_order().expect_err("fails");
    bigbertha::capture_anyhow_with(&e, Capture::new().level(Level::Error));
    drop(guard);
}
