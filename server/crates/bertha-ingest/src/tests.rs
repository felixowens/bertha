#![allow(clippy::unwrap_used, reason = "tests")]

use bertha_core::ingest::{IngestContext, IngestRequest, IngestUser};
use sourcemap::SourceMapBuilder;

use super::*;

const NOW: Millis = 1_760_000_000_000;
const BUNDLE: &str = "https://shop.test/assets/index-4f9a2c1b.js";
const DEBUG_ID: &str = "c0ffee00-0000-4000-8000-000000000001";

fn ctx() -> Context {
    Context { received_at: NOW, client_ip: Some("203.0.113.9".parse().unwrap()) }
}

fn no_maps(_: &str) -> Option<Arc<SourceMap>> {
    None
}

fn event(json: serde_json::Value) -> IngestEvent {
    serde_json::from_value(json).unwrap()
}

fn thrown(r#type: &str, message: &str, frames: serde_json::Value) -> IngestEvent {
    event(serde_json::json!({
        "timestamp": "2025-10-09T08:53:20Z",
        "exception": { "type": r#type, "message": message, "frames": frames },
    }))
}

/// A bundle where line 1 has two calls: col 100 is inside `renderCart`, calling
/// `sumLines`; col 200 is inside `sumLines`, where it throws.
fn cart_map() -> Arc<SourceMap> {
    let source = (1..=30).map(|n| format!("// cart.ts line {n}")).collect::<Vec<_>>().join("\n");
    let mut b = SourceMapBuilder::new(Some("index-4f9a2c1b.js"));
    let src = b.add_source("webpack://shop/./src/cart.ts");
    b.set_source_contents(src, Some(&source));
    b.add(0, 99, 11, 4, Some("webpack://shop/./src/cart.ts"), Some("sumLines"), false);
    b.add(0, 199, 19, 9, Some("webpack://shop/./src/cart.ts"), Some("reduce"), false);
    let lib = b.add_source("webpack://shop/./node_modules/react-dom/client.js");
    let _ = lib;
    b.add(0, 299, 2, 0, Some("webpack://shop/./node_modules/react-dom/client.js"), Some("renderCart"), false);
    Arc::new(b.into_sourcemap())
}

fn with_cart_map(id: &str) -> Option<Arc<SourceMap>> {
    (id == DEBUG_ID).then(cart_map)
}

#[test]
fn an_event_needs_something_to_say() {
    assert_eq!(check(&event(serde_json::json!({ "timestamp": "x" }))), Err(Rejected::Empty));
    assert_eq!(check(&event(serde_json::json!({ "timestamp": "x", "message": "  " }))), Err(Rejected::Empty));
    assert!(check(&event(serde_json::json!({ "timestamp": "x", "message": "hi" }))).is_ok());
}

#[test]
fn messages_become_issues_too() {
    let n = normalize(
        event(serde_json::json!({ "timestamp": "nonsense", "message": "\n  Cache warmed late\nmore" })),
        &ctx(),
        &no_maps,
    );
    assert_eq!(n.r#type, "Message");
    assert_eq!(n.message, "Cache warmed late");
    assert_eq!(n.at, NOW, "an unreadable time is when it arrived");
    assert_eq!(n.level, Level::Error);
    assert!(n.payload.exception.is_none());
}

#[test]
fn times_are_clamped() {
    let future =
        normalize(event(serde_json::json!({ "timestamp": "2099-01-01T00:00:00Z", "message": "x" })), &ctx(), &no_maps);
    assert_eq!(future.at, NOW);
    let ancient =
        normalize(event(serde_json::json!({ "timestamp": "2001-01-01T00:00:00Z", "message": "x" })), &ctx(), &no_maps);
    assert_eq!(ancient.at, NOW - MAX_AGE_MS);
    let fine =
        normalize(event(serde_json::json!({ "timestamp": "2025-10-09T08:00:00Z", "message": "x" })), &ctx(), &no_maps);
    assert_eq!(fine.at, parse_millis("2025-10-09T08:00:00Z").unwrap());
}

#[test]
fn long_things_are_cut() {
    assert_eq!(cut("abcdef", 4), "abc…");
    assert_eq!(cut("abc", 4), "abc");
    assert_eq!(cut("ééééé", 3), "éé…");
    let long = "x".repeat(20_000);
    let n = normalize(thrown("Error", &long, serde_json::json!([])), &ctx(), &no_maps);
    assert_eq!(n.message.chars().count(), limits::SHORT_CHARS);
    assert_eq!(n.payload.exception.unwrap().message.chars().count(), limits::MESSAGE_CHARS);
    let frames: Vec<_> = (0..500).map(|i| serde_json::json!({ "file": format!("/app/f{i}.js"), "line": 1 })).collect();
    let n = normalize(thrown("RangeError", "deep", serde_json::json!(frames)), &ctx(), &no_maps);
    assert_eq!(n.payload.exception.unwrap().frames.len(), limits::FRAMES);
}

#[test]
fn causes_read_as_part_of_the_message() {
    let mut e = thrown("Error", "Couldn't save the basket", serde_json::json!([]));
    e.exception.as_mut().unwrap().cause = Some(Box::new(IngestException {
        r#type: "TypeError".into(),
        message: "Failed to fetch".into(),
        frames: vec![],
        cause: None,
        data: None,
        component_stack: None,
    }));
    let n = normalize(e, &ctx(), &no_maps);
    assert_eq!(n.message, "Couldn't save the basket");
    assert_eq!(
        n.payload.exception.unwrap().message,
        "Couldn't save the basket\n\nCaused by TypeError: Failed to fetch"
    );
}

#[test]
fn frames_map_through_uploaded_maps() {
    let mut e = thrown(
        "TypeError",
        "Cannot read properties of undefined (reading 'price')",
        serde_json::json!([
            { "file": BUNDLE, "function": "a", "line": 1, "column": 200 },
            { "file": BUNDLE, "function": "b", "line": 1, "column": 100 },
            { "file": format!("{BUNDLE}?v=2"), "function": "c", "line": 1, "column": 300 },
            { "file": "https://shop.test/assets/vendor-99.js", "function": "d", "line": 3, "column": 7 },
        ]),
    );
    e.debug_ids = Some([(BUNDLE.to_owned(), DEBUG_ID.to_owned())].into());
    assert_eq!(debug_ids(&e), vec![DEBUG_ID.to_owned()]);

    let n = normalize(e, &ctx(), &with_cart_map);
    let frames = n.payload.exception.unwrap().frames;
    let top = &frames[0];
    assert!(top.mapped);
    assert_eq!(top.file, "src/cart.ts");
    assert_eq!((top.line, top.column), (Some(20), Some(10)));
    // Named by the caller's call site, not the `reduce` it was calling.
    assert_eq!(top.function.as_deref(), Some("sumLines"));
    let ctx_lines = top.context.as_ref().unwrap();
    assert_eq!((ctx_lines.start_line, ctx_lines.highlight), (15, 20));
    assert_eq!(ctx_lines.lines.len(), 11);
    assert_eq!(ctx_lines.lines[5], "// cart.ts line 20");
    assert!(top.in_app);
    assert_eq!(frames[1].function.as_deref(), Some("renderCart"));
    // A query string doesn't stop a match; library code stays library code.
    assert!(frames[2].mapped && !frames[2].in_app);
    assert_eq!(frames[2].file, "node_modules/react-dom/client.js");
    // No map: kept as sent.
    assert!(!frames[3].mapped);
    assert_eq!(frames[3].file, "https://shop.test/assets/vendor-99.js");
    assert_eq!(n.culprit.as_deref(), Some("src/cart.ts in sumLines"));
}

#[test]
fn unmapped_frames_keep_the_lines_the_sdk_read() {
    let lines: Vec<String> = (1..=40).map(|n| format!("// faq.ts line {n}")).collect();
    let mut e = thrown(
        "AssertionError",
        "x",
        serde_json::json!([
            { "file": "/app/node_modules/knex/lib/query/querybuilder.js", "line": 660, "column": 5, "inApp": false },
            // More than a window's worth around line 20: trimmed to 15–25.
            { "file": "/app/src/api/faq.ts", "line": 20, "column": 3, "context": { "startLine": 1, "lines": lines } },
            // Near the top of the file the window starts at line 1.
            { "file": "/app/src/index.ts", "line": 2, "context": { "startLine": 1, "lines": ["a", "b", "c"] } },
            // Lines that don't reach the frame's line are from some other file.
            { "file": "/app/src/stale.ts", "line": 9, "context": { "startLine": 1, "lines": ["a", "b"] } },
            { "file": "/app/src/zero.ts", "line": 1, "context": { "startLine": 0, "lines": ["a", "b"] } },
            { "file": "/app/src/no-line.ts", "context": { "startLine": 1, "lines": ["a"] } },
        ]),
    );
    let long = "x".repeat(CONTEXT_LINE_CHARS + 50);
    e.exception.as_mut().unwrap().frames[2].context.as_mut().unwrap().lines[1] = long;

    let frames = normalize(e, &ctx(), &no_maps).payload.exception.unwrap().frames;
    assert_eq!(frames[0].context, None);
    let faq = frames[1].context.as_ref().unwrap();
    assert!(!frames[1].mapped && frames[1].in_app);
    assert_eq!((faq.start_line, faq.highlight, faq.lines.len()), (15, 20, 11));
    assert_eq!(faq.lines[5], "// faq.ts line 20");
    let index = frames[2].context.as_ref().unwrap();
    assert_eq!((index.start_line, index.highlight, index.lines.len()), (1, 2, 3));
    assert_eq!(index.lines[1].chars().count(), CONTEXT_LINE_CHARS);
    assert!(frames[3..].iter().all(|f| f.context.is_none()));
}

#[test]
fn a_map_wins_over_lines_the_sdk_sent() {
    let mut e = thrown(
        "TypeError",
        "x",
        serde_json::json!([
            { "file": BUNDLE, "line": 1, "column": 200, "context": { "startLine": 1, "lines": ["bundled code"] } },
        ]),
    );
    e.debug_ids = Some([(BUNDLE.to_owned(), DEBUG_ID.to_owned())].into());
    let frames = normalize(e, &ctx(), &with_cart_map).payload.exception.unwrap().frames;
    assert!(frames[0].mapped);
    assert_eq!(frames[0].context.as_ref().unwrap().lines[5], "// cart.ts line 20");
}

#[test]
fn minified_names_without_a_mapped_caller_are_dropped() {
    let mut e = thrown(
        "TypeError",
        "x",
        serde_json::json!([
            { "file": BUNDLE, "function": "Timeout.ce", "line": 1, "column": 200 },
            { "file": "node:internal/timers", "function": "listOnTimeout", "line": 605, "column": 17 },
        ]),
    );
    e.debug_ids = Some([(BUNDLE.to_owned(), DEBUG_ID.to_owned())].into());
    let frames = normalize(e.clone(), &ctx(), &with_cart_map).payload.exception.unwrap().frames;
    assert!(frames[0].mapped);
    assert_eq!(frames[0].function, None, "the map has no `ce`");
    // A name the map knows is the real one.
    e.exception.as_mut().unwrap().frames[0].function = Some("Object.renderCart".into());
    let frames = normalize(e, &ctx(), &with_cart_map).payload.exception.unwrap().frames;
    assert_eq!(frames[0].function.as_deref(), Some("Object.renderCart"));
}

#[test]
fn a_redeploy_keeps_the_issue() {
    let frames = |hash: &str| {
        serde_json::json!([
            { "file": format!("https://shop.test/_next/static/chunks/app/page-{hash}.js"), "function": "Checkout", "line": 1, "column": 900 },
        ])
    };
    let a = normalize(thrown("TypeError", "x is undefined", frames("1be296b83c6c4508")), &ctx(), &no_maps);
    let b = normalize(thrown("TypeError", "x is undefined", frames("e4bb476ef1dbdaf9")), &ctx(), &no_maps);
    assert_eq!(a.fingerprint, b.fingerprint);
    assert_eq!(a.culprit.as_deref(), Some("chunks/app/page-1be296.js in Checkout"));
    let c = normalize(thrown("RangeError", "x is undefined", frames("e4bb476ef1dbdaf9")), &ctx(), &no_maps);
    assert_ne!(a.fingerprint, c.fingerprint);
}

#[test]
fn the_sdk_fingerprint_wins() {
    let mut a = thrown("Error", "one", serde_json::json!([]));
    let mut b = thrown("TypeError", "two", serde_json::json!([]));
    a.fingerprint = Some(vec!["payments".into()]);
    b.fingerprint = Some(vec!["payments".into()]);
    assert_eq!(normalize(a, &ctx(), &no_maps).fingerprint, normalize(b, &ctx(), &no_maps).fingerprint);
}

#[test]
fn users_tags_and_requests() {
    let mut e = thrown("Error", "boom", serde_json::json!([]));
    e.release = Some("  2.4.1 ".into());
    e.environment = Some("preview".into());
    e.user = Some(IngestUser { id: None, email: Some("Ana@Example.com".into()), ip: Some("auto".into()) });
    e.request = Some(IngestRequest {
        method: "post".into(),
        url: "https://shop.test/cart?coupon=X#top".into(),
        status: Some(999),
        headers: None,
    });
    e.context =
        Some(IngestContext { browser: Some("Safari 18".into()), os: Some("iOS 18".into()), ..Default::default() });
    let n = normalize(e.clone(), &ctx(), &no_maps);
    assert_eq!(n.release.as_deref(), Some("2.4.1"));
    assert_eq!(n.environment, bertha_core::domain::Environment::Staging);
    let user = n.payload.user.as_ref().unwrap();
    assert_eq!(user.ip.as_deref(), Some("203.0.113.9"));
    let req = n.payload.request.as_ref().unwrap();
    assert_eq!((req.method.as_str(), req.status), ("POST", None));
    assert_eq!(
        n.tags,
        vec![
            ("url".into(), "https://shop.test/cart".into()),
            ("browser".into(), "Safari 18".into()),
            ("os".into(), "iOS 18".into()),
            ("release".into(), "2.4.1".into()),
            ("environment".into(), "staging".into()),
            ("user".into(), "Ana@Example.com".into()),
        ]
    );
    // The same person whatever the case of their email.
    e.user = Some(IngestUser { id: None, email: Some("ana@example.com".into()), ip: None });
    assert_eq!(normalize(e, &ctx(), &no_maps).user_hash, n.user_hash);
}

#[test]
fn the_apps_own_tags_count_after_the_built_in_ones() {
    let mut e = thrown("Error", "boom", serde_json::json!([]));
    e.context = Some(IngestContext { browser: Some("Safari 18".into()), ..Default::default() });
    e.tags = Some(
        [("area", "cart"), ("Browser", "spoofed"), ("tenant", "acme")]
            .into_iter()
            .map(|(k, v)| (k.to_owned(), v.to_owned()))
            .collect(),
    );
    let n = normalize(e, &ctx(), &no_maps);
    // A tag named like a built-in one doesn't count twice.
    assert_eq!(
        n.tags,
        vec![
            ("browser".into(), "Safari 18".into()),
            ("environment".into(), "production".into()),
            ("area".into(), "cart".into()),
            ("tenant".into(), "acme".into()),
        ]
    );
}

#[test]
fn breadcrumbs_keep_the_newest() {
    let crumbs: Vec<_> = (0..150)
        .map(|i| serde_json::json!({ "timestamp": "2025-10-09T08:53:00Z", "category": if i % 2 == 0 { "fetch" } else { "custom" }, "message": format!("b{i}") }))
        .collect();
    let mut e = thrown("Error", "x", serde_json::json!([]));
    e.breadcrumbs = Some(serde_json::from_value(serde_json::json!(crumbs)).unwrap());
    let n = normalize(e, &ctx(), &no_maps);
    let b = &n.payload.breadcrumbs;
    assert_eq!(b.len(), limits::BREADCRUMBS);
    assert_eq!(b[0].message, "b50");
    assert_eq!(b[0].category, BreadcrumbCategory::Fetch);
    assert_eq!(b[1].category, BreadcrumbCategory::Log);
}

#[test]
fn sources_are_cleaned() {
    assert_eq!(clean_source("webpack://_N_E/./src/app/page.tsx"), "src/app/page.tsx");
    assert_eq!(clean_source("../../src/main.ts"), "src/main.ts");
    assert_eq!(clean_source("webpack://_N_E/(app-pages-browser)/./components/Cart.tsx"), "components/Cart.tsx");
}

#[test]
fn async_frames_keep_only_their_file() {
    let n = normalize(
        thrown(
            "Error",
            "boom",
            serde_json::json!([
                { "file": "/app/node_modules/knex/lib/query.js", "line": 1, "column": 1, "inApp": false },
                { "file": "async /app/src/middlewares/legacy-http.js", "line": 151, "column": 5 },
            ]),
        ),
        &ctx(),
        &no_maps,
    );
    assert_eq!(n.culprit.as_deref(), Some("app/src/middlewares/legacy-http.js"));
    let frames = n.payload.exception.unwrap().frames;
    assert_eq!(frames[1].file, "/app/src/middlewares/legacy-http.js");
    assert!(frames[1].in_app);

    // An older SDK and a newer one report the same error as one issue.
    let parsed = |file: &str| {
        normalize(
            thrown("AssertionError", "boom", serde_json::json!([{ "file": file, "line": 151, "column": 5 }])),
            &ctx(),
            &no_maps,
        )
        .fingerprint
    };
    assert_eq!(parsed("async /app/src/middlewares/legacy-http.js"), parsed("/app/src/middlewares/legacy-http.js"));
}

#[test]
fn how_and_where_it_surfaced() {
    let e = event(serde_json::json!({
        "timestamp": "2025-10-09T08:53:20Z",
        "exception": {
            "type": "Error", "message": "No response", "frames": [],
            "data": { "code": "\"ETIMEDOUT\"", "status": "504" },
            "componentStack": "\n    at Basket\n    at App",
        },
        "mechanism": { "handler": "onunhandledrejection", "handled": false },
        "trace": { "traceId": "4BF92F3577B34DA6A3CE929D0E0E4736", "spanId": "00f067aa0ba902b7" },
        "request": {
            "method": "GET", "url": "https://shop.test/courses",
            "headers": { "Accept": "text/html", "Cookie": "s=1", "Authorization": "Bearer x", "X-Api-Key": "k" },
        },
        "breadcrumbs": [{ "timestamp": "2025-10-09T08:53:19Z", "category": "ui", "message": "button.buy" }],
        "context": {
            "viewport": "1194×702 @2x", "online": true, "visible": false, "navigation": "back_forward",
            "automated": false, "pageAgeMs": 125000.7, "referrer": "https://google.com/",
            "language": "en-AU", "timezone": "Australia/Sydney", "connection": "4g", "host": "web.1",
            "versions": { "react": "18.3.1", "next": "15.1.0" },
        },
    }));
    let n = normalize(e, &ctx(), &no_maps);
    let p = n.payload;
    let mechanism = p.mechanism.unwrap();
    assert_eq!((mechanism.handler.as_str(), mechanism.handled), ("onunhandledrejection", false));
    let trace = p.trace.unwrap();
    assert_eq!(trace.trace_id, "4bf92f3577b34da6a3ce929d0e0e4736");
    assert_eq!(trace.span_id.as_deref(), Some("00f067aa0ba902b7"));
    let ex = p.exception.unwrap();
    assert_eq!(ex.data.get("code").map(String::as_str), Some("\"ETIMEDOUT\""));
    assert_eq!(ex.component_stack.as_deref(), Some("at Basket\n    at App"));
    let headers = p.request.unwrap().headers;
    assert_eq!(headers.keys().map(String::as_str).collect::<Vec<_>>(), ["accept"]);
    assert_eq!(p.breadcrumbs[0].category, bertha_core::domain::BreadcrumbCategory::Click);
    let c = p.context;
    assert_eq!(c.viewport.as_deref(), Some("1194×702 @2x"));
    assert_eq!((c.online, c.visible, c.automated), (Some(true), Some(false), Some(false)));
    assert_eq!(c.navigation, Some(bertha_core::domain::Navigation::BackForward));
    assert_eq!(c.page_age_ms, Some(125_000));
    assert_eq!(c.timezone.as_deref(), Some("Australia/Sydney"));
    assert_eq!(c.host.as_deref(), Some("web.1"));
    assert_eq!(c.versions.get("react").map(String::as_str), Some("18.3.1"));
}

#[test]
fn bad_traces_and_navigations_are_dropped() {
    let e = event(serde_json::json!({
        "timestamp": "2025-10-09T08:53:20Z",
        "message": "hi",
        "trace": { "traceId": "00000000000000000000000000000000" },
        "context": { "navigation": "teleport", "pageAgeMs": -4 },
    }));
    let n = normalize(e, &ctx(), &no_maps);
    assert!(n.payload.trace.is_none());
    assert_eq!(n.payload.context.navigation, None);
    assert_eq!(n.payload.context.page_age_ms, None);
    let e = event(serde_json::json!({
        "timestamp": "2025-10-09T08:53:20Z",
        "message": "hi",
        "trace": { "traceId": "4bf92f3577b34da6a3ce929d0e0e4736", "spanId": "nope" },
    }));
    let trace = normalize(e, &ctx(), &no_maps).payload.trace.unwrap();
    assert_eq!(trace.span_id, None);
}
