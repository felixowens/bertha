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
            "get_trace",
            "search_logs",
            "log_patterns",
            "list_events",
            "list_issues",
            "list_projects",
            "get_release",
            "get_monitor",
            "add_note",
            "start_triage",
            "update_triage",
            "update_issue",
            "merge_issues",
            "report_problem",
            "request_feature"
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
async fn an_events_trace_reads_as_a_tree() {
    let t = app().await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let args = json!({ "issue": "HARB-1J", "event": "e-harbour-1" });

    let (text, err) = tool(&t, &secret, "get_event", args.clone()).await;
    assert!(!err, "{text}");
    for want in [
        "- Trace: `4bf92f3577b34da6a3ce929d0e0e4736`, span `00f067aa0ba902b7`. bertha kept 22 spans from harbour-web, harbour-bookings, practice-sync over 40.38s (get_trace lists them):",
        "  - This event happened in `GET /book/[practice]/slots` (harbour-bookings), 590ms in, 15.03s long, under page /book/whitby › GET /book/whitby/slots",
        "  - No answer from practice-sync.internal: `GET practice-sync.internal/slots` (harbour-bookings) failed, and practice-sync.internal sent no spans.",
    ] {
        assert!(text.contains(want), "missing {want}:\n{text}");
    }
    assert!(
        text.contains("  - Most time spent in: `GET practice-sync.internal/slots` (harbour-bookings) 8.00s"),
        "{text}"
    );

    let (text, err) = tool(&t, &secret, "get_trace", args).await;
    assert!(!err, "{text}");
    assert!(text.starts_with("## Trace `4bf92f3577b34da6a3ce929d0e0e4736`\n"), "{text}");
    for want in [
        "- **page /book/whitby** · harbour-web browser · internal · +0ms · 40.38s · span `",
        "  - **GET /book/whitby/slots** · harbour-web browser · client · +560ms · 15.08s · span `",
        "    - **GET /book/[practice]/slots** · harbour-bookings server · server · +590ms · 15.03s · span `00f067aa0ba902b7` · error: FetchError",
        "      - Error here: **HARB-1J** FetchError: request to https://practice-sync.internal/slots",
        "· this event `e-harbour-1`",
        "        - practice-sync.internal sent no spans, so the trail goes cold here.",
        "Error here: **HARB-1Q** UnhandledRejection",
        "db.statement=SELECT id, starts_at",
    ] {
        assert!(text.contains(want), "missing {want}:\n{text}");
    }

    let (theirs, _) = issues(&t).await;
    let (text, err) = tool(&t, &secret, "get_trace", json!({ "issue": theirs["id"] })).await;
    assert!(!err, "{text}");
    assert!(text.contains("has no trace") || text.contains("bertha has no spans"), "{text}");
    let (text, err) = tool(&t, &secret, "get_trace", json!({ "issue": "HARB-1J", "event": "e-nope" })).await;
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
        let (_, err) = tool(&t, &secret, "merge_issues", json!({ "into": theirs["id"], "issues": [r] })).await;
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
async fn agents_claim_record_and_label_triages() {
    let t = app().await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let (priya, _) = token(&t, PRIYA, "priya agent").await;
    let mut live = t.live.subscribe();

    // get_issue brings the brief, the claim and what earlier triages found.
    let (text, _) = tool(&t, &secret, "get_issue", json!({ "issue": "KILN-R" })).await;
    assert!(text.contains("- Labels: checkout"), "{text}");
    assert!(text.contains("## Project brief"), "{text}");
    assert!(text.contains("204"), "the brief itself: {text}");
    assert!(text.contains("In progress: Charles via claude-laptop started `tr-cart-now`"), "{text}");
    assert!(text.contains("needs more data"), "the earlier triage: {text}");
    let (text, _) = tool(&t, &priya, "get_issue", json!({ "issue": "KILN-Y" })).await;
    assert!(text.contains("Stale: Priya Natarajan via priya-agent"), "{text}");

    // Someone else's going triage: say who, and take it over only on purpose.
    let (text, err) = tool(&t, &priya, "start_triage", json!({ "issue": "KILN-R" })).await;
    assert!(err && text.contains("Charles started triaging this") && text.contains("claude-laptop"), "{text}");
    let (text, err) = tool(&t, &priya, "start_triage", json!({ "issue": "KILN-R", "take_over": true })).await;
    assert!(!err && text.contains("It's yours"), "{text}");
    assert!(live.try_recv().is_ok(), "open pages hear about it");
    let id = text.split('`').nth(1).unwrap().to_owned();
    assert!(id.starts_with("tr_"), "{id}");

    let (text, err) = tool(
        &t,
        &priya,
        "update_triage",
        json!({ "triage": id, "found": "The basket API answers 204.", "tried": "Nothing yet." }),
    )
    .await;
    assert!(!err && text.contains("in progress") && text.contains("> The basket API answers 204."), "{text}");
    let (text, err) = tool(&t, &secret, "update_triage", json!({ "triage": id, "found": "mine" })).await;
    assert!(err && text.contains("Only the person who started"), "{text}");
    let (text, err) = tool(&t, &priya, "update_triage", json!({ "triage": id })).await;
    assert!(err && text.starts_with("Say what to record"), "{text}");
    let (text, err) = tool(&t, &priya, "update_triage", json!({ "triage": id, "outcome": "solved" })).await;
    assert!(err && text.contains("isn't a triage outcome"), "{text}");
    let (text, err) = tool(&t, &priya, "update_triage", json!({ "triage": id, "pr": 88 })).await;
    assert!(err && text.contains("go with outcome fixed"), "{text}");
    let elsewhere = json!({ "triage": id, "outcome": "fixed", "pr": "https://github.com/someone/else/pull/3" });
    let (text, err) = tool(&t, &priya, "update_triage", elsewhere).await;
    assert!(err && text.contains("isn't a PR on sundial-dev/kiln-and-clay"), "{text}");
    let (text, err) = tool(&t, &priya, "update_triage", json!({ "triage": id, "outcome": "fixed", "pr": "pie" })).await;
    assert!(err && text.contains("isn't a PR"), "{text}");
    let (text, err) = tool(
        &t,
        &priya,
        "update_triage",
        json!({ "triage": id, "fix": "Treat 204 as empty.", "outcome": "fixed", "pr": "https://github.com/sundial-dev/kiln-and-clay/pull/88" }),
    )
    .await;
    // The test server has no GitHub token, so the fix waits to be marked shipped.
    assert!(!err && text.contains("ended: fixed") && text.contains("Shipping: PR #88, not watched."), "{text}");
    assert!(text.contains("Set BERTHA_GITHUB_TOKEN") && text.contains("action fix_shipped"), "{text}");
    let (text, err) = tool(&t, &priya, "update_triage", json!({ "triage": id, "found": "more" })).await;
    assert!(err && text.contains("has ended"), "{text}");
    // Out of reach reads as missing.
    let (text, err) = tool(&t, &priya, "update_triage", json!({ "triage": "tr-moss-fixed", "found": "x" })).await;
    assert!(err && text.contains("no longer exists"), "{text}");

    // Labels, and the filters that use them.
    let (text, err) = tool(
        &t,
        &secret,
        "update_issue",
        json!({ "issue": "KILN-R", "action": "label", "add_labels": ["Empty Basket"], "remove_labels": ["checkout"] }),
    )
    .await;
    assert!(!err && text.starts_with("KILN-R has empty-basket."), "{text}");
    let (text, err) = tool(&t, &secret, "update_issue", json!({ "issue": "KILN-R", "action": "label" })).await;
    assert!(err && text.contains("add_labels"), "{text}");
    let (text, err) =
        tool(&t, &secret, "update_issue", json!({ "issue": "KILN-R", "action": "label", "add_labels": ["no/slash"] }))
            .await;
    assert!(err && text.contains("can't be a label"), "{text}");
    let (text, _) =
        tool(&t, &secret, "list_issues", json!({ "labels": ["empty-basket"], "status": "all", "range": "30d" })).await;
    assert!(text.contains("KILN-R") && text.contains("labelled empty-basket"), "{text}");
    let (text, _) =
        tool(&t, &secret, "list_issues", json!({ "query": "label:flaky-network", "status": "all", "range": "30d" }))
            .await;
    assert!(text.contains("HARB-1J") && !text.contains("KILN-R"), "{text}");
    let (text, _) =
        tool(&t, &priya, "list_issues", json!({ "triage": "never", "status": "all", "range": "30d" })).await;
    assert!(!text.contains("KILN-R") && !text.contains("MOSS-"), "{text}");
    let (text, err) = tool(&t, &secret, "list_issues", json!({ "triage": "sometimes" })).await;
    assert!(err && text.contains("isn't a triage filter"), "{text}");

    // A fix bertha isn't watching, marked shipped by hand.
    let (text, _) = tool(&t, &priya, "list_issues", json!({ "triage": "fix_waiting", "range": "30d" })).await;
    assert!(text.contains("with a fix waiting to ship") && text.contains("KILN-R"), "{text}");
    let (text, err) = tool(&t, &priya, "update_issue", json!({ "issue": "KILN-R", "action": "fix_shipped" })).await;
    assert!(!err && text.starts_with("Marked the fix shipped") && text.contains("resolved KILN-R"), "{text}");
    let (text, _) = tool(&t, &priya, "get_issue", json!({ "issue": "KILN-R" })).await;
    assert!(text.contains("marked PR #88 shipped") && text.contains("Shipping: PR #88, shipped"), "{text}");
    let (text, err) = tool(&t, &priya, "update_issue", json!({ "issue": "HARB-1J", "action": "fix_shipped" })).await;
    assert!(err && text.contains("no fixed triage"), "{text}");

    let (text, _) = tool(&t, &secret, "list_projects", json!({})).await;
    assert!(text.contains("brief"), "{text}");
}

#[tokio::test]
async fn the_app_starts_and_records_triages() {
    let t = app().await;
    let owner = t.sign_in(OWNER).await;
    let priya = t.sign_in(PRIYA).await;
    let r = t.post("/api/v1/issues/i-4/triages", Some(&priya), json!({})).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    assert_eq!(r.body["value"]["state"], "active");
    let id = r.body["value"]["id"].as_str().unwrap().to_owned();
    let r = t.post("/api/v1/issues/i-4/triages", Some(&owner), json!({})).await;
    assert_eq!(r.body["failure"], "in_progress", "{:?}", r.body);
    assert!(r.body["message"].as_str().unwrap().contains("Priya"), "{:?}", r.body);
    let r = t.post(&format!("/api/v1/triages/{id}"), Some(&priya), json!({ "found": "A stale chunk." })).await;
    assert_eq!(r.body["value"]["found"], "A stale chunk.", "{:?}", r.body);
    let r = t.post(&format!("/api/v1/triages/{id}"), Some(&owner), json!({ "found": "no" })).await;
    assert_eq!(r.body["failure"], "permission_denied");
    let r = t.post(&format!("/api/v1/triages/{id}"), Some(&owner), json!({ "outcome": "abandoned" })).await;
    assert_eq!(r.body["value"]["outcome"], "abandoned", "the owner can end it");
    let r = t.post("/api/v1/issues/i-moss-regressed/triages", Some(&priya), json!({})).await;
    assert_eq!(r.body["failure"], "not_found");
    let r = t.post("/api/v1/issues/i-4/triages", Some(&owner), json!({ "takeOver": true })).await;
    assert_eq!(r.body["ok"], true);
}

#[tokio::test]
async fn agents_report_problems_and_requests_to_the_owner() {
    let t = app().await;
    let (theirs, foreign) = issues(&t).await;
    let (secret, priya) = token(&t, PRIYA, "codex on studio mac").await;
    let (owners_agent, owner) = token(&t, OWNER, "claude on laptop").await;
    let short = theirs["shortId"].as_str().unwrap();

    let (text, err) = tool(
        &t,
        &secret,
        "report_problem",
        json!({ "summary": "get_issue doesn't say which page it was on", "details": "Had to guess from the breadcrumbs.", "tool": "get_issue", "issue": short }),
    )
    .await;
    assert!(!err, "{text}");
    assert!(text.starts_with(&format!("Sent the problem to bertha's owner, with {short}.")), "{text}");
    let (text, err) =
        tool(&t, &owners_agent, "request_feature", json!({ "summary": "list_events by release", "details": "" })).await;
    assert!(!err && text.starts_with("Sent the request to bertha's owner."), "{text}");

    // An issue out of reach, or a blank summary, sends nothing.
    let (text, err) =
        tool(&t, &secret, "report_problem", json!({ "summary": "x", "details": "", "issue": foreign["shortId"] }))
            .await;
    assert!(err && text.starts_with("No issue"), "{text}");
    let (text, err) = tool(&t, &secret, "request_feature", json!({ "summary": "  ", "details": "" })).await;
    assert!(err && text.contains("Nothing was sent"), "{text}");

    // The owner reads every report; Priya only her own agents'.
    let r = t.get("/api/v1/agents", Some(&owner)).await;
    let reports = r.body["reports"].as_array().unwrap();
    assert_eq!(reports.len(), 2, "{reports:?}");
    let problem = reports.iter().find(|r| r["kind"] == "problem").unwrap();
    assert!(reports.iter().any(|r| r["kind"] == "request" && r["by"]["email"] == OWNER));
    assert_eq!(problem["tool"], "get_issue");
    assert_eq!(problem["issue"]["shortId"], short);
    assert_eq!(problem["via"], "codex on studio mac");
    assert_eq!(problem["by"]["email"], PRIYA);
    assert_eq!(problem["version"], env!("CARGO_PKG_VERSION"));
    assert_eq!(problem["done"], false);
    let r = t.get("/api/v1/agents", Some(&priya)).await;
    let mine = r.body["reports"].as_array().unwrap();
    assert_eq!(mine.len(), 1);
    assert_eq!(mine[0]["id"], problem["id"]);

    // Only the owner marks one done.
    let id = problem["id"].as_str().unwrap();
    let path = format!("/api/v1/agents/reports/{id}/done");
    let r = t.post(&path, Some(&priya), json!({ "done": true })).await;
    assert_eq!(r.body["failure"], "permission_denied", "{:?}", r.body);
    let r = t.post(&path, Some(&owner), json!({ "done": true })).await;
    assert_eq!(r.body["ok"], true, "{:?}", r.body);
    let r = t.get("/api/v1/agents", Some(&priya)).await;
    assert_eq!(r.body["reports"][0]["done"], true);
    let r = t.post(&path, Some(&owner), json!({ "done": false })).await;
    assert_eq!(r.body["ok"], true);
    let r = t.post("/api/v1/agents/reports/ar_nope/done", Some(&owner), json!({ "done": true })).await;
    assert_eq!(r.body["failure"], "not_found");
}

#[tokio::test]
async fn an_agent_merges_issues_grouping_split() {
    let t = app().await;
    let (secret, cookie) = token(&t, OWNER, "claude").await;
    let r = t.post("/api/v1/issues/query", Some(&cookie), json!({ "filter": all_issues() })).await;
    let kiln: Vec<&Value> =
        r.body["issues"].as_array().unwrap().iter().filter(|i| i["projectId"] == "p-kiln").collect();
    let moss = r.body["issues"].as_array().unwrap().iter().find(|i| i["projectId"] == "p-moss").unwrap();
    let (keep, fold) = (kiln[0], kiln[1]);
    let short = |i: &Value| i["shortId"].as_str().unwrap().to_owned();
    let events = keep["eventCount"].as_u64().unwrap() + fold["eventCount"].as_u64().unwrap();

    let (text, err) = tool(&t, &secret, "merge_issues", json!({ "into": short(keep), "issues": [short(keep)] })).await;
    assert!(err && text.contains("the issue you're merging into"), "{text}");
    let (text, err) = tool(&t, &secret, "merge_issues", json!({ "into": short(keep), "issues": [] })).await;
    assert!(err && text.starts_with("Name at least one"), "{text}");
    let (text, err) = tool(&t, &secret, "merge_issues", json!({ "into": short(keep), "issues": [short(moss)] })).await;
    assert!(err && text.starts_with("Only issues in the same project"), "{text}");

    let mut live = t.live.subscribe();
    let link = format!("https://bertha.test/issues/{}", fold["id"].as_str().unwrap());
    let (text, err) = tool(&t, &secret, "merge_issues", json!({ "into": short(keep), "issues": [link] })).await;
    assert!(!err, "{text}");
    assert!(
        text.starts_with(&format!(
            "Merged {} into {}, which now has {events} events.",
            fold["id"].as_str().unwrap(),
            short(keep)
        )),
        "{text}"
    );
    assert!(live.try_recv().is_ok(), "open pages hear about it");
    let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": short(keep) })).await;
    assert!(!err && text.contains(&format!("{} merged into it by Charles via claude.", short(fold))), "{text}");
    let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": short(fold) })).await;
    assert!(err && text.starts_with("No issue"), "{text}");
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
    ingest_to(t, "p-kiln", "ingest_key", path, body).await
}

/// `key` is the column: `ingest_key` for events, `upload_key` for deploys.
async fn ingest_to(t: &TestApp, project: &str, key: &str, path: &str, body: Value) -> Reply {
    let key: String = sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT {key} FROM projects WHERE id = ?")))
        .bind(project)
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

/// Finds the issue whose list line mentions `what`, once ingest has grouped it.
async fn issue_named(t: &TestApp, secret: &str, what: &str) -> String {
    for _ in 0..200 {
        let (text, _) = tool(t, secret, "list_issues", json!({ "query": what, "status": "all", "range": "30d" })).await;
        if let Some(found) = text.lines().find(|l| l.contains("/issues/")).and_then(|l| l.rsplit("/issues/").next()) {
            return found.trim().to_owned();
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("no issue for {what}");
}

#[tokio::test]
async fn a_browser_event_says_where_and_how_it_surfaced() {
    let t = app().await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let (old, new) = ("4acb4861a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5", "288deca0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6");
    let trace = "5bf92f3577b34da6a3ce929d0e0e4736";

    // CI recorded the newer build; the visitor's tab still ran the older one.
    let deploy = json!({ "release": new, "environment": "production", "deployedAt": "2026-10-13T07:00:00Z",
        "commit": { "sha": new, "message": "Show prices with tax", "author": "Ana" } });
    let r = ingest_to(&t, "p-kiln", "upload_key", "/ingest/v1/deploys", deploy).await;
    assert_eq!(r.status, StatusCode::CREATED, "{:?}", r.body);
    let masked = |f: &str| json!({ "file": "webkit-masked-url://hidden/", "function": f, "line": 1, "column": 2 });
    let browser = json!({
        "timestamp": "2026-10-13T09:00:00Z",
        "release": old,
        "environment": "production",
        "exception": { "type": "Error", "message": "No response from the extension", "frames": [masked("r"), masked("Promise")],
            "data": { "code": "\"ETIMEDOUT\"" } },
        "mechanism": { "handler": "onunhandledrejection", "handled": false },
        "trace": { "traceId": trace },
        "request": { "method": "GET", "url": "https://kiln.test/courses/discounted-packages" },
        "user": { "ip": "203.0.113.9" },
        "breadcrumbs": [{ "timestamp": "2026-10-13T08:59:00Z", "category": "navigation", "message": "Loaded /courses/discounted-packages (back_forward)" }],
        "context": {
            "browser": "Safari 18.6", "os": "iPadOS 18.6", "viewport": "1194×702 @2x", "online": true, "visible": true,
            "navigation": "back_forward", "automated": false, "pageAgeMs": 192_000, "language": "en-AU",
            "versions": { "react": "18.3.1", "next": "15.1.0" },
        },
    });
    let server = json!({
        "timestamp": "2026-10-13T09:00:00Z",
        "environment": "production",
        "exception": { "type": "TypeError", "message": "Cannot read properties of undefined (reading 'price')", "frames": [
            { "file": "/app/src/api/packages.js", "function": "discounted", "line": 14, "column": 9 },
        ] },
        "mechanism": { "handler": "onRequestError", "handled": false },
        "trace": { "traceId": trace, "spanId": "00f067aa0ba902b7" },
        "request": { "method": "GET", "url": "https://api.harbour.test/packages", "status": 500,
            "headers": { "Accept": "application/json", "Cookie": "s=1", "Authorization": "Bearer x" } },
        "context": { "runtime": "node 22.11.0", "host": "web.1" },
    });
    let sdk = json!({ "name": "@bigbertha/sdk", "version": "0.5.0" });
    let r = ingest(&t, "/ingest/v1/events", json!({ "sdk": sdk, "events": [browser] })).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
    let r =
        ingest_to(&t, "p-harbour", "ingest_key", "/ingest/v1/events", json!({ "sdk": sdk, "events": [server] })).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);

    let id = issue_named(&t, &secret, "No response from the extension").await;
    let api = issue_named(&t, &secret, "reading 'price'").await;
    let (text, err) = tool(&t, &secret, "get_issue", json!({ "issue": id })).await;
    assert!(!err, "{text}");
    for said in [
        "- Culprit: ",
        "began by",
        "no deploy was recorded, bertha first saw it in an event then",
        &format!("- Older build, probably: `{new}` was deployed to production at"),
        "the visitor was on an older build (a tab left open, or a cached page)",
        "- Surfaced: unhandled promise rejection (onunhandledrejection), not caught by the app",
        "- Page: GET https://kiln.test/courses/discounted-packages",
        "- User: ip 203.0.113.9",
        "- Context: browser Safari 18.6, os iPadOS 18.6",
        "- Page state: viewport 1194×702 @2x, online, tab visible, arrived with back or forward (back_forward), \
         page open for 3m 12s, not automated, language en-AU",
        "- Versions: next 15.1.0, react 18.3.1",
        &format!("- Trace: `{trace}`"),
        "- Same trace in other issues",
        "TypeError: Cannot read properties of undefined (reading 'price')",
        &format!("/issues/{api}"),
        "Every frame is in a browser extension or a script the browser hides",
        "1. [extension] `webkit-masked-url://hidden/:1:2` in `r`",
        "- `code`: \"ETIMEDOUT\"",
        "Loaded /courses/discounted-packages (back_forward)",
        "Releases of this project in that time, newest first:",
        "in production, first seen in an event at",
        &format!("{new} deployed to production at"),
    ] {
        assert!(text.contains(said), "missing {said:?}:\n{text}");
    }
    assert!(!text.contains("[app] `"), "{text}");
    assert!(!text.contains("No frame is the project's code"), "{text}");
    assert!(!text.contains("match that time"), "{text}");

    // The server side of the same page load: its request, with no credentials.
    let (text, err) = tool(&t, &secret, "get_event", json!({ "issue": api })).await;
    assert!(!err, "{text}");
    for said in [
        "- Surfaced: error while Next.js handled a request (onRequestError), not caught by the app",
        "- Request: GET https://api.harbour.test/packages → 500",
        "  - accept: application/json",
        "- Context: runtime node 22.11.0, host web.1",
        "span `00f067aa0ba902b7`",
        "No response from the extension",
    ] {
        assert!(text.contains(said), "missing {said:?}:\n{text}");
    }
    assert!(!text.contains("cookie") && !text.contains("authorization"), "{text}");
    assert!(!text.contains("Page state"), "{text}");
}

/// A log line sent with an event's id, and the lines before it.
#[tokio::test]
async fn logs_around_an_event_and_across_projects() {
    let t = app().await;
    let (secret, _) = token(&t, OWNER, "claude on laptop").await;
    let mut event = knex_event("2026-10-13T09:00:00Z", "filters[id][$between]=3", true);
    event["id"] = json!("f00d0000000000000000000000000001");
    let sdk = json!({ "name": "@bigbertha/sdk", "version": "0.9.2" });
    let r = ingest(&t, "/ingest/v1/events", json!({ "sdk": sdk, "events": [event] })).await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
    let at = |s: u64| ((1_791_882_000 + s) * 1_000_000_000).to_string();
    let line = |s: u64, severity: u8, message: &str, attributes: Value| json!({ "timeUnixNano": at(s), "severityNumber": severity, "body": { "stringValue": message }, "attributes": attributes });
    let logs = json!({ "resourceLogs": [{ "scopeLogs": [{ "logRecords": [
        line(0, 9, "FAQ list requested with 3 filters", json!([{ "key": "route", "value": { "stringValue": "/faqs" } }])),
        line(0, 9, "FAQ list requested with 4 filters", json!([])),
        line(0, 17, "whereBetween failed", json!([
            { "key": "bertha.event_id", "value": { "stringValue": "f00d0000000000000000000000000001" } }
        ])),
    ] }] }] });
    let r = ingest(&t, "/ingest/v1/logs", logs).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    let id = issue_named(&t, &secret, "whereBetween").await;

    let (text, err) = tool(&t, &secret, "get_event", json!({ "issue": id })).await;
    assert!(!err, "{text}");
    // The seed logged around 09:00 too.
    assert!(text.contains(" lines from its project between 2m before and 30s after it; search_logs"), "{text}");

    let (text, err) = tool(&t, &secret, "search_logs", json!({ "issue": id })).await;
    assert!(!err, "{text}");
    assert!(text.contains(" lines from its project between 2m before and 30s after it, "), "{text}");
    assert!(text.contains("info [KILN] FAQ list requested with 3 filters · route=/faqs"), "{text}");
    let marked: Vec<&str> = text.lines().filter(|l| l.ends_with("← this event")).collect();
    assert_eq!(marked.len(), 1, "{text}");
    assert!(marked[0].contains("error [KILN] whereBetween failed · event="), "{text}");

    let (text, err) = tool(&t, &secret, "search_logs", json!({ "project": "KILN", "query": "route:/faqs" })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with("1 line matches; the newest 1"), "{text}");
    let (text, err) = tool(&t, &secret, "search_logs", json!({ "query": "\"FAQ list\"", "level": "error" })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with("No log lines match."), "{text}");

    let (text, err) = tool(&t, &secret, "log_patterns", json!({ "project": "KILN", "query": "FAQ" })).await;
    assert!(!err, "{text}");
    assert!(text.starts_with("1 pattern, most lines first."), "{text}");
    assert!(text.contains("- 2 lines, info [KILN]"), "{text}");
    assert!(text.contains("e.g. FAQ list requested with"), "{text}");
}
