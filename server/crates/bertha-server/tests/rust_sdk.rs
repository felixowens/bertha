//! The Rust SDK against a real bertha: an axum app's errors and panics become issues with
//! Rust frames, the app's own code as the culprit, and the request.

#![allow(clippy::unwrap_used, reason = "tests panic on purpose")]

mod common;

use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::*;
use serde_json::{Value, json};
use tower::ServiceExt;

#[test]
fn an_axum_app_reports_to_bertha() {
    // anyhow reads RUST_LIB_BACKTRACE once per process, so the app runs in a child.
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--ignored", "--exact", "axum_app", "--nocapture"])
        .env("RUST_LIB_BACKTRACE", "1")
        .status()
        .unwrap();
    assert!(status.success());
}

#[inline(never)]
async fn find_order(id: u32) -> anyhow::Result<String> {
    use anyhow::Context;
    let found: Result<String, std::io::Error> =
        Err(std::io::Error::new(std::io::ErrorKind::NotFound, "orders.db has no row"));
    found.with_context(|| format!("order {id} is missing"))
}

async fn order() -> (StatusCode, String) {
    match find_order(41).await {
        Ok(o) => (StatusCode::OK, o),
        Err(e) => {
            bigbertha::capture_anyhow(&e);
            (StatusCode::NOT_FOUND, "Not found".into())
        }
    }
}

async fn refund() -> String {
    let refunds: Vec<u32> = vec![];
    refunds[3].to_string()
}

async fn latest_event(t: &TestApp, cookie: &str, issue: &Value) -> Value {
    let id = issue["id"].as_str().unwrap();
    t.get(&format!("/api/v1/issues/{id}/events/latest"), Some(cookie)).await.body["event"].clone()
}

async fn issue_of_type(t: &TestApp, cookie: &str, kind: &str) -> Value {
    for _ in 0..300 {
        let r = t.post("/api/v1/issues/query", Some(cookie), json!({ "filter": all_issues() })).await;
        if let Some(i) = r.body["issues"].as_array().and_then(|a| a.iter().find(|i| i["type"] == kind)) {
            return i.clone();
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("no {kind} issue was ingested");
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "run by an_axum_app_reports_to_bertha"]
async fn axum_app() {
    let t = app().await;
    let c = t.sign_in(OWNER).await;
    let (key,): (String,) =
        sqlx::query_as("SELECT ingest_key FROM projects WHERE id = 'p-kiln'").fetch_one(t.db.reader()).await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(axum::serve(listener, t.app.clone()).into_future());

    let guard =
        bigbertha::init(bigbertha::options!().key(&key).url(&url).environment("production").release("3.1.0")).unwrap();
    let shop = axum::Router::new()
        .route("/orders/{id}", axum::routing::get(order))
        .route("/refunds", axum::routing::post(refund))
        .layer(bigbertha::tower::layer());
    let get = Request::get("/orders/41").header("host", "shop.test").body(Body::empty()).unwrap();
    assert_eq!(shop.clone().oneshot(get).await.unwrap().status(), StatusCode::NOT_FOUND);
    let post = Request::post("/refunds").header("host", "shop.test").body(Body::empty()).unwrap();
    assert_eq!(shop.oneshot(post).await.unwrap().status(), StatusCode::INTERNAL_SERVER_ERROR);
    assert!(tokio::task::spawn_blocking(move || guard.flush(Duration::from_secs(5))).await.unwrap());

    let missing = issue_of_type(&t, &c, "io::Error").await;
    let event = latest_event(&t, &c, &missing).await;
    assert_eq!(missing["message"], "order 41 is missing");
    assert_eq!(missing["level"], "error");
    assert!(missing["culprit"].as_str().unwrap().contains("find_order"), "{}", missing["culprit"]);
    let text = event["exception"]["message"].as_str().unwrap();
    assert!(text.starts_with("order 41 is missing\n\nCaused by ") && text.ends_with("orders.db has no row"), "{text}");
    let first = &event["exception"]["frames"][0];
    assert_eq!(first["file"], "tests/rust_sdk.rs");
    assert_eq!(first["inApp"], true);
    assert_eq!(event["request"]["url"], "http://shop.test/orders/41");
    assert_eq!(event["request"]["status"], 404);
    assert_eq!(event["release"], "3.1.0");
    assert!(event["context"]["runtime"].as_str().unwrap().starts_with("Rust "));

    let panic = issue_of_type(&t, &c, "panic").await;
    let event = latest_event(&t, &c, &panic).await;
    assert_eq!(panic["level"], "fatal");
    assert_eq!(panic["message"], "index out of bounds: the len is 0 but the index is 3");
    assert!(panic["culprit"].as_str().unwrap().contains("refund"), "{}", panic["culprit"]);
    assert_eq!(event["mechanism"], json!({ "handler": "panic", "handled": false }));
    assert_eq!(event["request"]["status"], 500);
    let frames = event["exception"]["frames"].as_array().unwrap();
    assert!(frames.iter().any(|f| f["inApp"] == false), "std and tokio frames are kept, as not the app's");
}
