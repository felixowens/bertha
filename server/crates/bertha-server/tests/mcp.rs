//! The MCP endpoint, the way Claude Code and Codex use it: one JSON-RPC message per POST,
//! with an access token made in Settings → Agents.

#![allow(clippy::unwrap_used, reason = "tests panic on purpose")]

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use common::*;
use serde_json::{Value, json};
use std::time::Duration;

/// Signs in as `email` and makes a token through the app's own API.
async fn token(t: &TestApp, email: &str, name: &str) -> (String, String) {
    let cookie = t.sign_in(email).await;
    let r = t.post("/api/v1/agents/tokens", Some(&cookie), json!({ "name": name })).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    (r.body["value"]["secret"].as_str().unwrap().to_owned(), cookie)
}

async fn rpc(t: &TestApp, auth: Option<&str>, message: Value) -> Reply {
    let mut req = Request::post("/mcp")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json, text/event-stream");
    if let Some(a) = auth {
        req = req.header(header::AUTHORIZATION, a);
    }
    t.send(req.body(Body::from(message.to_string())).unwrap()).await
}

/// Calls a tool and returns its text and whether it was an error.
async fn tool(t: &TestApp, secret: &str, name: &str, arguments: Value) -> (String, bool) {
    let r = rpc(
        t,
        Some(&format!("Bearer {secret}")),
        json!({ "jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": { "name": name, "arguments": arguments } }),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["id"], 7);
    let result = &r.body["result"];
    (result["content"][0]["text"].as_str().unwrap_or_default().to_owned(), result["isError"] == true)
}

/// An issue in a project Priya can see, and one in a project she can't.
async fn issues(t: &TestApp) -> (Value, Value) {
    let owner = t.sign_in(OWNER).await;
    let r = t.post("/api/v1/issues/query", Some(&owner), json!({ "filter": all_issues() })).await;
    let all = r.body["issues"].as_array().unwrap();
    let theirs = all.iter().find(|i| i["projectId"] == "p-kiln").unwrap().clone();
    let foreign = all.iter().find(|i| i["projectId"] == "p-moss").unwrap().clone();
    (theirs, foreign)
}

#[tokio::test]
async fn initialize_and_list_the_tools() {
    let t = app().await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let auth = format!("Bearer {secret}");
    let r = rpc(
        &t,
        Some(&auth),
        json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "test", "version": "1" }
        } }),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.headers[header::CONTENT_TYPE], "application/json");
    assert_eq!(r.body["result"]["protocolVersion"], "2025-06-18");
    assert_eq!(r.body["result"]["serverInfo"]["name"], "bertha");
    assert!(r.body["result"]["instructions"].as_str().unwrap().contains("get_issue"));

    // A version bertha doesn't know gets the newest it does.
    let r = rpc(
        &t,
        Some(&auth),
        json!({ "jsonrpc": "2.0", "id": 2, "method": "initialize", "params": { "protocolVersion": "1999-01-01" } }),
    )
    .await;
    assert_eq!(r.body["result"]["protocolVersion"], "2025-11-25");

    let r = rpc(&t, Some(&auth), json!({ "jsonrpc": "2.0", "method": "notifications/initialized" })).await;
    assert_eq!(r.status, StatusCode::ACCEPTED);
    let r = rpc(&t, Some(&auth), json!({ "jsonrpc": "2.0", "id": 3, "method": "ping" })).await;
    assert_eq!(r.body["result"], json!({}));

    let r = rpc(&t, Some(&auth), json!({ "jsonrpc": "2.0", "id": 4, "method": "tools/list" })).await;
    let names: Vec<&str> =
        r.body["result"]["tools"].as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
    assert_eq!(
        names,
        [
            "get_issue",
            "get_event",
            "list_events",
            "list_issues",
            "list_projects",
            "get_release",
            "get_monitor",
            "add_note",
            "update_issue"
        ]
    );
    for tool in r.body["result"]["tools"].as_array().unwrap() {
        assert_eq!(tool["inputSchema"]["type"], "object", "{}", tool["name"]);
    }

    let r = rpc(&t, Some(&auth), json!({ "jsonrpc": "2.0", "id": 5, "method": "resources/list" })).await;
    assert_eq!(r.body["error"]["code"], -32601);
    let r = rpc(
        &t,
        Some(&auth),
        json!({ "jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": { "name": "delete_everything" } }),
    )
    .await;
    assert_eq!(r.body["error"]["code"], -32602);
    let r = rpc(&t, Some(&auth), json!([{ "jsonrpc": "2.0", "id": 1, "method": "ping" }])).await;
    assert_eq!(r.body["error"]["code"], -32600);
}

#[tokio::test]
async fn only_access_tokens_get_in() {
    let t = app().await;
    let (secret, cookie) = token(&t, OWNER, "codex").await;
    let ping = json!({ "jsonrpc": "2.0", "id": 1, "method": "ping" });

    let r = rpc(&t, None, ping.clone()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert!(r.headers[header::WWW_AUTHENTICATE].to_str().unwrap().starts_with("Bearer"));
    assert!(r.body["error"].as_str().unwrap().contains("Settings → Agents"));

    // The app's session doesn't count here, as a cookie or as a bearer token.
    let mut req =
        Request::post("/mcp").header(header::COOKIE, &cookie).header(header::CONTENT_TYPE, "application/json");
    req = req.header("x-bertha", "1");
    let r = t.send(req.body(Body::from(ping.to_string())).unwrap()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    let session = cookie.strip_prefix("bertha_session=").unwrap();
    assert_eq!(rpc(&t, Some(&format!("Bearer {session}")), ping.clone()).await.status, StatusCode::UNAUTHORIZED);
    assert_eq!(rpc(&t, Some("Bearer ba_made-up"), ping.clone()).await.status, StatusCode::UNAUTHORIZED);
    assert_eq!(rpc(&t, Some(&secret), ping.clone()).await.status, StatusCode::UNAUTHORIZED, "the scheme is needed");
    assert_eq!(rpc(&t, Some(&format!("bearer {secret}")), ping.clone()).await.status, StatusCode::OK);

    // Another site's page can't use it, even with the token.
    let req = Request::post("/mcp")
        .header(header::AUTHORIZATION, format!("Bearer {secret}"))
        .header(header::ORIGIN, "https://evil.example")
        .header(header::CONTENT_TYPE, "application/json");
    assert_eq!(t.send(req.body(Body::from(ping.to_string())).unwrap()).await.status, StatusCode::FORBIDDEN);

    assert_eq!(t.get("/mcp", None).await.status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(t.get("/.well-known/oauth-protected-resource/mcp", None).await.status, StatusCode::NOT_FOUND);

    // Revoked, it stops at once.
    let list = t.get("/api/v1/agents", Some(&cookie)).await;
    assert_eq!(list.body["mcpUrl"], "https://bertha.test/mcp");
    let id = list.body["tokens"][0]["id"].as_str().unwrap().to_owned();
    assert!(list.body["tokens"][0]["lastUsedAt"].is_string());
    let r = t.post(&format!("/api/v1/agents/tokens/{id}/revoke"), Some(&cookie), json!(null)).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    assert_eq!(rpc(&t, Some(&format!("Bearer {secret}")), ping.clone()).await.status, StatusCode::UNAUTHORIZED);
    let r = t.post(&format!("/api/v1/agents/tokens/{id}/revoke"), Some(&cookie), json!(null)).await;
    assert_eq!(r.body["failure"], "not_found");
}

#[tokio::test]
async fn tokens_are_managed_from_a_session_only() {
    let t = app().await;
    let r = t.post("/api/v1/agents/tokens", None, json!({ "name": "x" })).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    let (secret, cookie) = token(&t, PRIYA, "claude").await;
    let mut req = Request::post("/api/v1/agents/tokens")
        .header(header::AUTHORIZATION, format!("Bearer {secret}"))
        .header(header::CONTENT_TYPE, "application/json")
        .header("x-bertha", "1");
    req = req.header(header::ACCEPT, "application/json");
    assert_eq!(
        t.send(req.body(Body::from(json!({ "name": "more" }).to_string())).unwrap()).await.status,
        StatusCode::UNAUTHORIZED
    );

    let r = t.post("/api/v1/agents/tokens", Some(&cookie), json!({ "name": "   " })).await;
    assert_eq!(r.body["failure"], "invalid_name");
    assert!(r.body["message"].as_str().unwrap().contains("claude on laptop"));

    // Each member sees only their own.
    let owner = t.sign_in(OWNER).await;
    assert_eq!(t.get("/api/v1/agents", Some(&owner)).await.body["tokens"], json!([]));
    assert_eq!(t.get("/api/v1/agents", Some(&cookie)).await.body["tokens"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn get_issue_by_link_id_or_short_id() {
    let t = app().await;
    let (theirs, _) = issues(&t).await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let id = theirs["id"].as_str().unwrap();
    let short = theirs["shortId"].as_str().unwrap();

    let (text, err) =
        tool(&t, &secret, "get_issue", json!({ "issue": format!("https://bertha.test/issues/{id}") })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with(&format!("# {short} ")), "{text}");
    assert!(text.contains(&format!("https://bertha.test/issues/{id}")));
    for section in ["## Event `", "## The last 30 days", "## Activity"] {
        assert!(text.contains(section), "missing {section}:\n{text}");
    }
    let (by_id, _) = tool(&t, &secret, "get_issue", json!({ "issue": id })).await;
    let (by_short, _) = tool(&t, &secret, "get_issue", json!({ "issue": short.to_lowercase() })).await;
    assert_eq!(by_id, text);
    assert_eq!(by_short, text);

    let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": "NOPE-1" })).await;
    assert!(err);
    assert_eq!(
        text,
        "No issue NOPE-1 in projects you can see. Check the link or short id, or find it with list_issues."
    );
    let (text, err) = tool(&t, &secret, "get_issue", json!({})).await;
    assert!(err && text.starts_with("The arguments don't fit"), "{text}");

    let (text, err) = tool(&t, &secret, "get_event", json!({ "issue": id, "event": "oldest" })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with("## Event `"), "{text}");
    let (text, err) = tool(&t, &secret, "get_event", json!({ "issue": id, "event": "e-nope" })).await;
    assert!(err, "{text}");
}

#[tokio::test]
async fn a_collaborators_token_sees_only_their_projects() {
    let t = app().await;
    let (theirs, foreign) = issues(&t).await;
    let (secret, _) = token(&t, PRIYA, "claude").await;

    let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": theirs["shortId"] })).await;
    assert!(!err, "{text}");
    for r in [&foreign["id"], &foreign["shortId"]] {
        let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": r })).await;
        assert!(err && text.starts_with("No issue"), "{text}");
        let (_, err) = tool(&t, &secret, "add_note", json!({ "issue": r, "body": "hi" })).await;
        assert!(err);
        let (_, err) = tool(&t, &secret, "update_issue", json!({ "issue": r, "action": "resolve" })).await;
        assert!(err);
    }

    let (text, err) = tool(&t, &secret, "list_projects", json!({})).await;
    assert!(!err);
    assert!(text.contains("Kiln") && !text.contains("p-moss"), "{text}");
    let (text, err) = tool(&t, &secret, "list_issues", json!({ "status": "all", "range": "30d", "limit": 100 })).await;
    assert!(!err);
    assert!(!text.contains(foreign["shortId"].as_str().unwrap()), "{text}");
    let (text, err) = tool(&t, &secret, "list_issues", json!({ "project": "p-moss" })).await;
    assert!(err && text.starts_with("No project p-moss"), "{text}");
}

#[tokio::test]
async fn triage_shows_who_did_it_and_through_which_token() {
    let t = app().await;
    let (theirs, _) = issues(&t).await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let short = theirs["shortId"].as_str().unwrap();
    let mut live = t.live.subscribe();

    let (text, err) = tool(
        &t,
        &secret,
        "add_note",
        json!({ "issue": short, "body": "The cart map runs before the items load. Fixed in #41." }),
    )
    .await;
    assert!(!err, "{text}");
    assert!(text.contains("via claude on laptop"), "{text}");
    assert!(live.try_recv().is_ok(), "open pages hear about it");

    let (text, err) =
        tool(&t, &secret, "update_issue", json!({ "issue": short, "action": "resolve_in_next_release" })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with(&format!("{short} is resolved")), "{text}");
    // Doing it again changes nothing and still answers.
    let (_, err) =
        tool(&t, &secret, "update_issue", json!({ "issue": short, "action": "resolve_in_next_release" })).await;
    assert!(!err);

    let (text, _) = tool(&t, &secret, "get_issue", json!({ "issue": short })).await;
    assert!(text.contains("Note from Charles via claude on laptop:\n> The cart map runs"), "{text}");
    assert!(text.contains("Resolved by") && text.contains("via claude on laptop."), "{text}");

    // The app's own API shows the same.
    let owner = t.sign_in(OWNER).await;
    let id = theirs["id"].as_str().unwrap();
    let detail = t.get(&format!("/api/v1/issues/{id}"), Some(&owner)).await;
    let activity = detail.body["issue"]["activity"].as_array().unwrap();
    let note = activity.iter().rev().find(|a| a["kind"] == "note").unwrap();
    assert_eq!(note["via"], "claude on laptop");
    assert_eq!(activity.iter().rev().find(|a| a["kind"] == "resolved").unwrap()["via"], "claude on laptop");

    // What a person does in the app has no `via`.
    let r = t.post(&format!("/api/v1/issues/{id}/notes"), Some(&owner), json!({ "body": "Thanks." })).await;
    let mine = r.body["value"]["activity"].as_array().unwrap().iter().find(|a| a["body"] == "Thanks.").unwrap().clone();
    assert!(mine.get("via").is_none(), "{mine}");

    let (text, err) = tool(&t, &secret, "update_issue", json!({ "issue": short, "action": "snooze" })).await;
    assert!(err && text.starts_with("Snooze takes"), "{text}");
    let (text, err) =
        tool(&t, &secret, "update_issue", json!({ "issue": short, "action": "snooze", "events": 50 })).await;
    assert!(!err && text.contains("snoozed for 50 more of 50 events"), "{text}");
    let (text, err) = tool(
        &t,
        &secret,
        "update_issue",
        json!({ "issue": short, "action": "assign", "assignee": "nobody@example.com" }),
    )
    .await;
    assert!(err && text.contains("can't be assigned"), "{text}");
    let (text, err) =
        tool(&t, &secret, "update_issue", json!({ "issue": short, "action": "assign", "assignee": PRIYA })).await;
    assert!(!err && text.contains("assigned to Priya"), "{text}");
    assert!(t.sent.lock().unwrap().iter().any(|m| m.to == PRIYA && m.body.contains(short)), "Priya hears about it");
    let (text, err) = tool(&t, &secret, "update_issue", json!({ "issue": short, "action": "explode" })).await;
    assert!(err && text.contains("isn't an action"), "{text}");
}

#[tokio::test]
async fn releases_and_monitors_by_link_id_or_name() {
    let t = app().await;
    let (secret, cookie) = token(&t, OWNER, "codex").await;
    let releases = t.get("/api/v1/releases?project=p-kiln", Some(&cookie)).await;
    let r = &releases.body["releases"][0];
    let id = r["id"].as_str().unwrap();
    let version = r["version"].as_str().unwrap();
    let (by_link, err) =
        tool(&t, &secret, "get_release", json!({ "release": format!("https://bertha.test/releases/{id}") })).await;
    assert!(!err, "{by_link}");
    assert!(by_link.starts_with(&format!("# Release {version} of ")), "{by_link}");
    let (text, err) = tool(&t, &secret, "get_release", json!({ "release": version, "project": "kiln" })).await;
    assert!(!err && text.starts_with(&format!("# Release {version}")), "{text}");

    let monitors = t.get("/api/v1/monitors", Some(&cookie)).await;
    let m = &monitors.body["monitors"][0];
    let name = m["name"].as_str().unwrap();
    let (text, err) = tool(&t, &secret, "get_monitor", json!({ "monitor": name.to_uppercase() })).await;
    assert!(!err && text.starts_with(&format!("# Monitor {name}")), "{text}");
    let (text, err) = tool(&t, &secret, "get_monitor", json!({ "monitor": "nothing here" })).await;
    assert!(err && text.starts_with("No monitor"), "{text}");
}

/// An event the Node SDK sends from a server, as the SDK and CI do: no cookie, a key.
async fn ingest(t: &TestApp, path: &str, body: Value) -> Reply {
    let key: String = sqlx::query_scalar("SELECT ingest_key FROM projects WHERE id = 'p-kiln'")
        .fetch_one(t.db.reader())
        .await
        .unwrap();
    let req = Request::post(path)
        .header(header::CONTENT_TYPE, "text/plain")
        .header(header::AUTHORIZATION, format!("Bearer {key}"));
    t.send(req.body(Body::from(body.to_string())).unwrap()).await
}

/// Thrown in a dependency, 40 frames deep, below the app's own call into it.
fn knex_event(at: &str, q: &str, with_request: bool) -> Value {
    let mut frames = vec![json!({
        "file": "/app/node_modules/knex/lib/query/querybuilder.js", "function": "Builder.whereBetween", "line": 812, "column": 13,
        "context": { "startLine": 811, "lines": ["  whereBetween(column, values) {", "    assert(Array.isArray(values), 'The second argument to whereBetween must be an array.');", "  }"] },
    })];
    for i in 0..38 {
        frames.push(json!({ "file": format!("/app/node_modules/@strapi/database/dist/f{i}.js"), "function": format!("step{i}"), "line": i + 1, "column": 1 }));
    }
    frames.push(json!({
        "file": "async /app/src/api/faq/controllers/faq.js", "function": null, "line": 9, "column": 20,
        "context": { "startLine": 8, "lines": ["  async find(ctx) {", "    return super.find(ctx);", "  },"] },
    }));
    let mut e = json!({
        "timestamp": at,
        "release": "v111",
        "environment": "production",
        "exception": { "type": "AssertionError", "message": "The second argument to whereBetween must be an array.", "frames": frames },
    });
    if with_request {
        e["request"] = json!({ "method": "GET", "url": format!("https://api.kiln.test/faqs?{q}"), "status": 500 });
    }
    e
}

#[tokio::test]
async fn an_event_says_everything_it_knows_and_what_it_lacks() {
    let t = app().await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let sdk = json!({ "name": "@bigbertha/sdk", "version": "0.3.0" });
    let events = json!([
        knex_event("2026-10-13T09:00:00Z", "filters[id][$between]=3", true),
        knex_event("2026-10-13T09:05:00Z", "filters[id][$between]=7", false),
    ]);
    let r = ingest(&t, "/ingest/v1/events", json!({ "sdk": sdk, "events": events })).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
    // The running process says which commit it is; CI never recorded v111.
    let r = ingest(
        &t,
        "/ingest/v1/heartbeat",
        json!({ "release": "v111", "environment": "production", "commit": "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432" }),
    )
    .await;
    assert_eq!(r.status, StatusCode::NO_CONTENT);

    let mut id = None;
    for _ in 0..200 {
        let (text, _) =
            tool(&t, &secret, "list_issues", json!({ "query": "whereBetween", "status": "all", "range": "30d" })).await;
        if let Some(found) = text
            .lines()
            .find(|l| l.contains("whereBetween") && l.contains("/issues/"))
            .and_then(|l| l.rsplit("/issues/").next())
        {
            id = Some(found.trim().to_owned());
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    let id = id.expect("the event became an issue");

    let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": id })).await;
    assert!(!err, "{text}");
    // The newest event came without a request, user or breadcrumbs, and says so.
    for said in [
        "- Commit: `9f8e7d6c5b4a` (release v111 began",
        "- Request: none reported with this event.",
        "- User: none reported.",
        "No breadcrumbs were sent with this event.",
        "It was thrown in dependency code. The project's code calls in at frame 40, `/app/src/api/faq/controllers/faq.js:9:20`",
        "1. `/app/node_modules/knex/lib/query/querybuilder.js:812:13` in `Builder.whereBetween`",
        ">812 |     assert(Array.isArray(values)",
        "39. `/app/node_modules/@strapi/database/dist/f37.js:38:1` in `step37`",
        "40. [app] `/app/src/api/faq/controllers/faq.js:9:20`",
        "> 9 |     return super.find(ctx);",
    ] {
        assert!(text.contains(said), "missing {said:?}:\n{text}");
    }
    assert!(!text.contains("async /app"), "{text}");
    assert!(!text.contains("dependency frames"), "nothing folds:\n{text}");
    assert!(!text.contains("minified"), "a server's files aren't bundled:\n{text}");

    let (text, err) = tool(&t, &secret, "list_events", json!({ "issue": id })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with("## 2 of 2 events of "), "{text}");
    let lines: Vec<&str> = text.lines().filter(|l| l.starts_with("- ")).collect();
    assert_eq!(lines.len(), 2, "{text}");
    assert!(lines[0].contains("2026-10-13T09:05:00"), "newest first: {text}");
    assert!(lines[1].contains("GET https://api.kiln.test/faqs?filters[id][$between]=3 → 500"), "{text}");
    assert!(lines[1].contains("at `/app/src/api/faq/controllers/faq.js:9:20`"), "{text}");
    let (text, _) = tool(&t, &secret, "list_events", json!({ "issue": id, "limit": 1 })).await;
    assert!(text.contains("(1 older events not listed."), "{text}");
}
