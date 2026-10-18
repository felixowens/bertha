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
            (TagKey::Url, "https://shop.test/cart".into()),
            (TagKey::Browser, "Safari 18".into()),
            (TagKey::Os, "iOS 18".into()),
            (TagKey::Release, "2.4.1".into()),
            (TagKey::Environment, "staging".into()),
            (TagKey::User, "Ana@Example.com".into()),
        ]
    );
    // The same person whatever the case of their email.
    e.user = Some(IngestUser { id: None, email: Some("ana@example.com".into()), ip: None });
    assert_eq!(normalize(e, &ctx(), &no_maps).user_hash, n.user_hash);
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
