//! The tools an agent triages with. Reads and the triage writes only, under the token
//! owner's own access: no keys, team, alerts, monitors or project settings. Something
//! out of the token's reach reads the same as something that doesn't exist.

use bertha_core::api::{IssueChange, Outcome, TriageInput};
use bertha_core::domain::{
    AgentReportKind, AssigneeFilter, Environment, EnvironmentFilter, IssueFilter, IssueSort, IssueStatus, Level,
    Project, Snooze, StatusFilter, TimeRange, TriageFilter, TriageOutcome,
};
use bertha_core::ids::{EventId, IssueId, MemberId};
use bertha_core::live::LiveEvent;
use bertha_core::time::{IsoDate, parse_millis};
use bertha_db::reports::{NewReport, SUMMARY_LIMIT};
use bertha_db::{EventWhich, Viewer, ref_segment};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use super::render;
use crate::app::AppState;
use crate::routes::mutations::{tell, tell_assignee};

/// Markdown for the agent, or a message saying what went wrong and what to do.
type Reply = Result<String, String>;

const LIST_DEFAULT: usize = 25;
const LIST_MAX: usize = 100;
const EVENTS_DEFAULT: u32 = 20;
const EVENTS_MAX: u32 = 100;

const ISSUE_REF: &str =
    "The issue: a bertha link like https://bertha.example.com/issues/i_…, its id, or its short id like KILN-4F.";

fn read_only(title: &str) -> Value {
    json!({ "title": title, "readOnlyHint": true, "openWorldHint": false })
}

fn destructive(title: &str) -> Value {
    json!({ "title": title, "readOnlyHint": false, "destructiveHint": true, "idempotentHint": false, "openWorldHint": false })
}

fn writes(title: &str, idempotent: bool) -> Value {
    json!({ "title": title, "readOnlyHint": false, "destructiveHint": false, "idempotentHint": idempotent, "openWorldHint": false })
}

pub fn list() -> Value {
    json!([
        {
            "name": "get_issue",
            "description": "Everything about one issue, as markdown: what it is, its project and repo, its labels, the project's brief, who is triaging it and what earlier triages found, tried and fixed, counts, the latest event's full stack trace (every frame, with source lines for the app's code and the throw), breadcrumbs, request with its query, user, the deployed commit, tags, deploys in the last 30 days, and activity with notes. It says plainly when the app didn't send something. Start triage here.",
            "inputSchema": {
                "type": "object",
                "properties": { "issue": { "type": "string", "description": ISSUE_REF } },
                "required": ["issue"],
            },
            "annotations": read_only("Get an issue"),
        },
        {
            "name": "get_event",
            "description": "One event of an issue in full: the oldest, the latest, or one by id. Use it to compare events, or to step through them with the ids each answer gives.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue": { "type": "string", "description": ISSUE_REF },
                    "event": { "type": "string", "description": "\"latest\" (the default), \"oldest\", or an event id." },
                },
                "required": ["issue"],
            },
            "annotations": read_only("Get an event"),
        },
        {
            "name": "list_events",
            "description": "An issue's newest events, one line each: time, release, environment, request with its query, user, message, the first app frame and tags. Use it to see what the failing events have in common, then get_event for one in full.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue": { "type": "string", "description": ISSUE_REF },
                    "limit": { "type": "integer", "minimum": 1, "maximum": EVENTS_MAX, "description": "Default 20." },
                },
                "required": ["issue"],
            },
            "annotations": read_only("List an issue's events"),
        },
        {
            "name": "list_issues",
            "description": "Issues matching a filter, most recently seen first unless sorted otherwise. With no arguments: unresolved issues seen in the last 7 days, across every project you can see.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project": { "type": "string", "description": "A project's key (like KILN), name or id." },
                    "status": { "type": "string", "enum": ["unresolved", "resolved", "ignored", "snoozed", "all"], "description": "Default unresolved." },
                    "query": { "type": "string", "description": "Words to find in the type, message, culprit or tags. label:name in it filters by a label too." },
                    "labels": { "type": "array", "items": { "type": "string" }, "description": "Only issues with every one of these labels." },
                    "triage": { "type": "string", "enum": ["active", "never"], "description": "active: someone is triaging it now. never: nobody has triaged it yet." },
                    "level": { "type": "string", "enum": ["fatal", "error", "warning"] },
                    "environment": { "type": "string", "enum": ["production", "staging", "development"] },
                    "assignee": { "type": "string", "enum": ["me", "unassigned", "anyone"], "description": "Default anyone." },
                    "sort": { "type": "string", "enum": ["last_seen", "first_seen", "events", "users"], "description": "Default last_seen." },
                    "range": { "type": "string", "enum": ["24h", "7d", "30d"], "description": "Only issues seen in this time. Default 7d." },
                    "limit": { "type": "integer", "minimum": 1, "maximum": LIST_MAX, "description": "Default 25." },
                },
            },
            "annotations": read_only("List issues"),
        },
        {
            "name": "list_projects",
            "description": "The projects you can see, worst health first, with their keys, repos, sites, unresolved issues and uptime monitors, and which have a brief.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "range": { "type": "string", "enum": ["24h", "7d", "30d"], "description": "The time event counts cover. Default 24h." },
                },
            },
            "annotations": read_only("List projects"),
        },
        {
            "name": "get_release",
            "description": "One deploy: its commit, the deploys either side of it, and the issues it brought, brought back or fixed.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "release": { "type": "string", "description": "A bertha link to the release, its id, or its version like 1.4.2." },
                    "project": { "type": "string", "description": "With a version: the project's key, name or id, when more than one project has that version." },
                },
                "required": ["release"],
            },
            "annotations": read_only("Get a release"),
        },
        {
            "name": "get_monitor",
            "description": "One uptime monitor: its state, incidents, recent checks and the issues that started while it was down.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "monitor": { "type": "string", "description": "A bertha link to the monitor, its id, its name or the URL it checks." },
                },
                "required": ["monitor"],
            },
            "annotations": read_only("Get a monitor"),
        },
        {
            "name": "add_note",
            "description": "Adds a note to an issue's activity, for the people who triage it: the cause, the fix, the commit or PR. It shows as yours, through this token's name. Markdown is fine.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue": { "type": "string", "description": ISSUE_REF },
                    "body": { "type": "string", "description": "The note." },
                },
                "required": ["issue", "body"],
            },
            "annotations": writes("Add a note", false),
        },
        {
            "name": "start_triage",
            "description": "Claims an issue before you dig in, so nobody else does the same work at the same time. It answers with the triage's id for update_triage. If someone else is on it, it says who and since when; take_over only if they've stopped. Calling it again through the same token resumes your own triage. A triage nobody updates for 2 hours goes stale and anyone can start a new one.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue": { "type": "string", "description": ISSUE_REF },
                    "take_over": { "type": "boolean", "description": "Ends someone else's triage as abandoned and starts yours." },
                },
                "required": ["issue"],
            },
            "annotations": writes("Start triaging an issue", false),
        },
        {
            "name": "update_triage",
            "description": "Writes down what your triage found, tried and fixed, for whoever meets this issue next. Write when it's worth recording, not as a running log. An outcome ends the triage: fixed (with the fix and its commit or PR), not_a_bug, cant_fix, needs_data (say what's missing) or abandoned. Each field replaces what was there; leave one out to keep it. Markdown is fine.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "triage": { "type": "string", "description": "The triage's id, from start_triage or get_issue (tr_…)." },
                    "found": { "type": "string", "description": "The cause, or what you learned about it." },
                    "tried": { "type": "string", "description": "What you tried, and what didn't work." },
                    "fix": { "type": "string", "description": "The fix, with its commit or PR." },
                    "outcome": { "type": "string", "enum": ["fixed", "not_a_bug", "cant_fix", "needs_data", "abandoned"] },
                },
                "required": ["triage"],
            },
            "annotations": writes("Record a triage", true),
        },
        {
            "name": "update_issue",
            "description": "Triage an issue. resolve_in_next_release is the usual one after a fix is merged: events from the build running now don't reopen it, events from the next one do. resolve is for a fix that's already deployed. ignore is for noise that can't be fixed. snooze hides it until a time or for a number of events. assign needs assignee. label adds and removes labels (lowercase letters, digits and dashes, at most 10 an issue).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue": { "type": "string", "description": ISSUE_REF },
                    "action": { "type": "string", "enum": ["resolve_in_next_release", "resolve", "ignore", "snooze", "reopen", "assign", "unassign", "label"] },
                    "until": { "type": "string", "description": "snooze only: an ISO 8601 time, like 2026-10-20T09:00:00Z." },
                    "events": { "type": "integer", "minimum": 1, "description": "snooze only: wake after this many more events." },
                    "assignee": { "type": "string", "description": "assign only: \"me\", or the email or name of someone get_issue lists as assignable." },
                    "add_labels": { "type": "array", "items": { "type": "string" }, "description": "label only: labels to add, like [\"flaky-network\"]." },
                    "remove_labels": { "type": "array", "items": { "type": "string" }, "description": "label only: labels to take off." },
                },
                "required": ["issue", "action"],
            },
            "annotations": writes("Triage an issue", true),
        },
        {
            "name": "merge_issues",
            "description": "Folds issues that are the same error into one, when grouping split them (a different SDK, or a frame that moved). The others' events, counts, tags, users and notes move onto `into`, and the others are deleted. New events like theirs land on `into` too. It can't be undone, so compare the stacks with get_issue first. Only issues in the same project.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "into": { "type": "string", "description": "The issue to keep. Usually the one with the most recent events. Same forms as issue elsewhere." },
                    "issues": { "type": "array", "items": { "type": "string" }, "minItems": 1, "description": "The issues to fold into it, each a link, id or short id." },
                },
                "required": ["into", "issues"],
            },
            "annotations": destructive("Merge issues"),
        },
        {
            "name": "report_problem",
            "description": "Tells bertha's owner that bertha itself got in your way: a tool failed or answered wrongly, data you needed wasn't there, or a description misled you. Not for errors in the apps; those are issues. One report per problem, sent when you hit it. The owner reads it in bertha, with the issue you were on.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "summary": { "type": "string", "maxLength": SUMMARY_LIMIT, "description": "One line: what went wrong, like \"get_issue doesn't say which page the error was on\"." },
                    "details": { "type": "string", "description": "What you were doing, what you got, what you expected and how you worked round it. Markdown is fine." },
                    "tool": { "type": "string", "description": "The bertha tool it was about, like get_issue." },
                    "issue": { "type": "string", "description": "The issue you were working on, if any. Same forms as issue elsewhere." },
                },
                "required": ["summary", "details"],
            },
            "annotations": writes("Report a problem with bertha", false),
        },
        {
            "name": "request_feature",
            "description": "Asks bertha's owner for something bertha doesn't do yet that would have helped you: a tool, an argument, or data a tool could return. Say what you were trying to do and what you'd have done with it. The owner reads it in bertha, with the issue you were on.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "summary": { "type": "string", "maxLength": SUMMARY_LIMIT, "description": "One line: what you'd like, like \"list_events filtered by release\"." },
                    "details": { "type": "string", "description": "What you were trying to do and how this would have helped. Markdown is fine." },
                    "tool": { "type": "string", "description": "The bertha tool it would change, if any." },
                    "issue": { "type": "string", "description": "The issue you were working on, if any. Same forms as issue elsewhere." },
                },
                "required": ["summary", "details"],
            },
            "annotations": writes("Request a feature in bertha", false),
        },
    ])
}

/// Runs a tool. `None` when there's no tool by that name.
pub async fn call(s: &AppState, v: &Viewer, name: &str, args: &Value) -> Option<Reply> {
    let reply = match name {
        "get_issue" => get_issue(s, v, parse(args)).await,
        "get_event" => get_event(s, v, parse(args)).await,
        "list_events" => list_events(s, v, parse(args)).await,
        "list_issues" => list_issues(s, v, parse(args)).await,
        "list_projects" => list_projects(s, v, parse(args)).await,
        "get_release" => get_release(s, v, parse(args)).await,
        "get_monitor" => get_monitor(s, v, parse(args)).await,
        "add_note" => add_note(s, v, parse(args)).await,
        "start_triage" => start_triage(s, v, parse(args)).await,
        "update_triage" => update_triage(s, v, parse(args)).await,
        "update_issue" => update_issue(s, v, parse(args)).await,
        "merge_issues" => merge_issues(s, v, parse(args)).await,
        "report_problem" => report(s, v, AgentReportKind::Problem, parse(args)).await,
        "request_feature" => report(s, v, AgentReportKind::Request, parse(args)).await,
        _ => return None,
    };
    Some(reply)
}

/// The arguments, or (as the tool's answer) what's wrong with them.
fn parse<T: DeserializeOwned>(args: &Value) -> Result<T, String> {
    serde_json::from_value(args.clone()).map_err(|e| format!("The arguments don't fit this tool: {e}."))
}

/// Infrastructure failures, said the way the app says them.
fn db_error(e: bertha_db::Error) -> String {
    match e {
        bertha_db::Error::Invalid(m) => m,
        bertha_db::Error::Forbidden => "Only the owner can do that. Nothing was changed.".to_owned(),
        other => {
            tracing::error!(error = ?other, "an MCP tool failed");
            "Something went wrong on the server. Try again.".to_owned()
        }
    }
}

async fn issue_id(s: &AppState, v: &Viewer, reference: &str) -> Result<String, String> {
    s.db.find_issue(v, reference).await.map_err(db_error)?.ok_or_else(|| {
        format!(
            "No issue {} in projects you can see. Check the link or short id, or find it with list_issues.",
            reference.trim()
        )
    })
}

async fn project_ref(s: &AppState, v: &Viewer, reference: &str) -> Result<Project, String> {
    let projects = s.db.shell(v).await.map_err(db_error)?.projects;
    let r = reference.trim();
    let found =
        projects.iter().find(|p| p.id.0 == r || p.key.eq_ignore_ascii_case(r) || p.name.eq_ignore_ascii_case(r));
    match found {
        Some(p) => Ok(p.clone()),
        None => {
            let keys: Vec<&str> = projects.iter().map(|p| p.key.as_str()).collect();
            Err(format!("No project {r} that you can see. Yours are: {}.", keys.join(", ")))
        }
    }
}

#[derive(Deserialize)]
struct IssueArgs {
    issue: String,
}

async fn get_issue(s: &AppState, v: &Viewer, args: Result<IssueArgs, String>) -> Reply {
    let id = issue_id(s, v, &args?.issue).await?;
    let detail = s.db.issue_detail(v, &id).await.map_err(db_error)?;
    let detail = detail.ok_or("That issue has no events yet. Try again in a minute.")?;
    let brief = s.db.project_brief(v, &detail.project.id).await.map_err(db_error)?;
    Ok(render::issue(&detail, brief.as_deref(), &s.config.public_url))
}

#[derive(Deserialize)]
struct EventArgs {
    issue: String,
    event: Option<String>,
}

async fn get_event(s: &AppState, v: &Viewer, args: Result<EventArgs, String>) -> Reply {
    let args = args?;
    let id = issue_id(s, v, &args.issue).await?;
    let which = match args.event.as_deref().map(str::trim) {
        None | Some("" | "latest") => EventWhich::Latest,
        Some("oldest") => EventWhich::Oldest,
        Some(other) => EventWhich::Id(EventId(other.to_owned())),
    };
    let at = s.db.event_at(v, &id, &which).await.map_err(db_error)?;
    let at = at.ok_or("That issue has no event with that id. Use \"latest\", \"oldest\" or an id from get_issue.")?;
    let issue = s.db.issue_detail(v, &id).await.map_err(db_error)?.ok_or("That issue has no events yet.")?;
    Ok(render::event(&at.event, &at.cursor, &issue.issue.summary, &issue.releases, &at.related, &s.config.public_url))
}

#[derive(Deserialize)]
struct EventsArgs {
    issue: String,
    limit: Option<u32>,
}

async fn list_events(s: &AppState, v: &Viewer, args: Result<EventsArgs, String>) -> Reply {
    let args = args?;
    let id = issue_id(s, v, &args.issue).await?;
    let limit = args.limit.unwrap_or(EVENTS_DEFAULT).clamp(1, EVENTS_MAX);
    let issue = s.db.issue_detail(v, &id).await.map_err(db_error)?.ok_or("That issue has no events yet.")?;
    let events = s.db.recent_events(v, &id, limit).await.map_err(db_error)?.unwrap_or_default();
    Ok(render::events(&events, issue.cursor.total, &issue.issue.summary))
}

#[derive(Deserialize)]
struct ListArgs {
    project: Option<String>,
    status: Option<String>,
    query: Option<String>,
    level: Option<String>,
    environment: Option<String>,
    assignee: Option<String>,
    sort: Option<String>,
    range: Option<String>,
    limit: Option<usize>,
    #[serde(default)]
    labels: Vec<String>,
    triage: Option<String>,
}

fn choice<T>(value: Option<&str>, field: &str, parse: impl Fn(&str) -> Option<T>) -> Result<Option<T>, String> {
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        None => Ok(None),
        Some(v) => {
            parse(v).map(Some).ok_or_else(|| format!("{v} isn't a {field} bertha knows. See the tool's schema."))
        }
    }
}

async fn list_issues(s: &AppState, v: &Viewer, args: Result<ListArgs, String>) -> Reply {
    let a = args?;
    let mut filter = IssueFilter::default();
    let mut what = Vec::new();
    if let Some(p) = a.project.as_deref() {
        let project = project_ref(s, v, p).await?;
        what.push(format!("in {}", project.name));
        filter.project_ids = vec![project.id];
    }
    filter.status = match a.status.as_deref().map(str::trim) {
        None | Some("") => StatusFilter::Is(IssueStatus::Unresolved),
        Some("all") => StatusFilter::ANY,
        Some(other) => {
            StatusFilter::Is(choice(Some(other), "status", IssueStatus::parse)?.unwrap_or(IssueStatus::Unresolved))
        }
    };
    if let Some(l) = choice(a.level.as_deref(), "level", Level::parse)? {
        filter.levels = vec![l];
    }
    if let Some(e) = choice(a.environment.as_deref(), "environment", Environment::parse)? {
        filter.environment = EnvironmentFilter::Is(e);
    }
    if let Some(x) = choice(a.assignee.as_deref(), "assignee", AssigneeFilter::parse)? {
        filter.assignee = x;
    }
    if let Some(x) = choice(a.sort.as_deref(), "sort", IssueSort::parse)? {
        filter.sort = x;
    }
    if let Some(x) = choice(a.range.as_deref(), "range", TimeRange::parse)? {
        filter.range = x;
    }
    filter.query = a.query.unwrap_or_default().trim().to_owned();
    if !filter.query.is_empty() {
        what.push(format!("matching \"{}\"", filter.query));
    }
    filter.labels = a.labels.iter().map(|l| l.trim().to_owned()).filter(|l| !l.is_empty()).collect();
    if !filter.labels.is_empty() {
        what.push(format!("labelled {}", filter.labels.join(", ")));
    }
    filter.triage = choice(a.triage.as_deref(), "triage filter", TriageFilter::parse)?;
    match filter.triage {
        Some(TriageFilter::Active) => what.push("being triaged".to_owned()),
        Some(TriageFilter::Never) => what.push("never triaged".to_owned()),
        None => {}
    }
    let status = match &filter.status {
        StatusFilter::Is(st) => format!("{st} issues"),
        StatusFilter::All(_) => "issues".to_owned(),
    };
    let what = std::iter::once(status)
        .chain(what)
        .chain([format!("seen in the last {}", render::range(filter.range))])
        .collect::<Vec<_>>()
        .join(" ");
    let limit = a.limit.unwrap_or(LIST_DEFAULT).clamp(1, LIST_MAX);
    let list = s.db.list_issues(v, &filter).await.map_err(db_error)?;
    Ok(render::issue_list(&list, limit, &what, &s.config.public_url))
}

#[derive(Deserialize)]
struct ProjectsArgs {
    range: Option<String>,
}

async fn list_projects(s: &AppState, v: &Viewer, args: Result<ProjectsArgs, String>) -> Reply {
    let range = choice(args?.range.as_deref(), "range", TimeRange::parse)?.unwrap_or(TimeRange::Day);
    let data = s.db.list_projects(v, range).await.map_err(db_error)?;
    let briefed = s.db.briefed_projects(v).await.map_err(db_error)?;
    Ok(render::projects(&data, &briefed))
}

#[derive(Deserialize)]
struct ReleaseArgs {
    release: String,
    project: Option<String>,
}

async fn get_release(s: &AppState, v: &Viewer, args: Result<ReleaseArgs, String>) -> Reply {
    let a = args?;
    let key = ref_segment(&a.release, "releases");
    let base = &s.config.public_url;
    if let Some(d) = s.db.release_detail(v, key).await.map_err(db_error)? {
        return Ok(render::release(&d, base));
    }
    let project = match a.project.as_deref() {
        Some(p) => Some(project_ref(s, v, p).await?),
        None => None,
    };
    let list = s.db.list_releases(v, project.as_ref().map(|p| p.id.0.as_str())).await.map_err(db_error)?;
    let found: Vec<_> = list.releases.iter().filter(|r| r.version == key).collect();
    let mut projects: Vec<_> = found.iter().map(|r| &r.project_id).collect();
    projects.dedup();
    if projects.len() > 1 {
        return Err(format!("More than one project has release {key}. Name the project too."));
    }
    // Newest first, so the latest deploy of that version, whichever environment.
    let Some(r) = found.first() else {
        return Err(format!("No release {key} in projects you can see."));
    };
    let d = s.db.release_detail(v, &r.id.0).await.map_err(db_error)?.ok_or("That release is gone.")?;
    Ok(render::release(&d, base))
}

#[derive(Deserialize)]
struct MonitorArgs {
    monitor: String,
}

async fn get_monitor(s: &AppState, v: &Viewer, args: Result<MonitorArgs, String>) -> Reply {
    let a = args?;
    let key = ref_segment(&a.monitor, "uptime");
    let base = &s.config.public_url;
    if let Some(d) = s.db.monitor_detail(v, key).await.map_err(db_error)? {
        return Ok(render::monitor(&d, base));
    }
    let monitors = s.db.list_monitors(v).await.map_err(db_error)?.monitors;
    let found = monitors
        .iter()
        .find(|m| m.name.eq_ignore_ascii_case(key) || m.url.trim_end_matches('/') == key.trim_end_matches('/'));
    let Some(m) = found else {
        return Err(format!("No monitor {key} in projects you can see."));
    };
    let d = s.db.monitor_detail(v, &m.id.0).await.map_err(db_error)?.ok_or("That monitor is gone.")?;
    Ok(render::monitor(&d, base))
}

#[derive(Deserialize)]
struct NoteArgs {
    issue: String,
    body: String,
}

async fn add_note(s: &AppState, v: &Viewer, args: Result<NoteArgs, String>) -> Reply {
    let a = args?;
    let id = issue_id(s, v, &a.issue).await?;
    match s.db.add_issue_note(v, &id, &a.body).await.map_err(db_error)? {
        Outcome::Ok(issue) => {
            tell(s, std::iter::once(&issue.summary));
            let who = render::by_line(v);
            Ok(format!(
                "Added the note to {} as {who}.\n\n{}",
                issue.summary.short_id,
                render::issue_link(&s.config.public_url, &issue.summary)
            ))
        }
        Outcome::Failed(_, message) => Err(message),
    }
}

#[derive(Deserialize)]
struct ReportArgs {
    summary: String,
    #[serde(default)]
    details: String,
    tool: Option<String>,
    issue: Option<String>,
}

async fn report(s: &AppState, v: &Viewer, kind: AgentReportKind, args: Result<ReportArgs, String>) -> Reply {
    let a = args?;
    let issue = match a.issue.as_deref().map(str::trim) {
        Some(r) if !r.is_empty() => Some(issue_id(s, v, r).await?),
        _ => None,
    };
    let new = NewReport {
        kind,
        summary: &a.summary,
        details: &a.details,
        tool: a.tool.as_deref(),
        issue_id: issue.as_deref(),
        version: env!("CARGO_PKG_VERSION"),
    };
    let made = s.db.add_agent_report(v, &new).await.map_err(db_error)?;
    let what = match kind {
        AgentReportKind::Problem => "the problem",
        AgentReportKind::Request => "the request",
    };
    let on = made.issue.map(|i| format!(", with {}", i.short_id)).unwrap_or_default();
    Ok(format!(
        "Sent {what} to bertha's owner{on}. They read it under Settings → Agents: {}/settings/agents\n\nCarry on with the task; nothing else is needed from you.",
        s.config.public_url
    ))
}

#[derive(Deserialize)]
struct UpdateArgs {
    issue: String,
    action: String,
    until: Option<String>,
    events: Option<u32>,
    assignee: Option<String>,
    #[serde(default)]
    add_labels: Vec<String>,
    #[serde(default)]
    remove_labels: Vec<String>,
}

async fn update_issue(s: &AppState, v: &Viewer, args: Result<UpdateArgs, String>) -> Reply {
    let a = args?;
    let id = issue_id(s, v, &a.issue).await?;
    let change = match a.action.trim() {
        "resolve_in_next_release" => IssueChange::Resolve { in_next_release: Some(true) },
        "resolve" => IssueChange::Resolve { in_next_release: None },
        "ignore" => IssueChange::Ignore,
        "reopen" => IssueChange::Reopen,
        "unassign" => IssueChange::Assign { person_id: None },
        "label" => {
            if a.add_labels.is_empty() && a.remove_labels.is_empty() {
                return Err("Say which labels to add or remove, with add_labels or remove_labels.".to_owned());
            }
            IssueChange::Label { add: a.add_labels.clone(), remove: a.remove_labels.clone() }
        }
        "snooze" => IssueChange::Snooze { snooze: snooze(&a, s.db.now())? },
        "assign" => {
            let who = a.assignee.as_deref().map(str::trim).filter(|w| !w.is_empty());
            let who = who.ok_or("Say who to assign it to: \"me\", or an email or name from get_issue.")?;
            IssueChange::Assign { person_id: Some(assignee(s, v, &id, who).await?) }
        }
        other => {
            return Err(format!(
                "{other} isn't an action. Use resolve_in_next_release, resolve, ignore, snooze, reopen, assign, unassign or label."
            ));
        }
    };
    let changed = match s.db.update_issues(v, std::slice::from_ref(&id), &change, None).await.map_err(db_error)? {
        Outcome::Ok(changed) => changed,
        Outcome::Failed(_, message) => return Err(message),
    };
    tell(s, changed.iter());
    if let IssueChange::Assign { person_id: Some(to) } = &change
        && *to != v.member().id
    {
        tell_assignee(s, &v.member().name, &to.0, &changed).await;
    }
    let Some(issue) = changed.first() else { return Err("That issue is gone.".to_owned()) };
    let assignee = issue.assignee.as_ref().map_or("nobody".to_owned(), |p| p.name.clone());
    if let IssueChange::Label { .. } = change {
        let labels = if issue.labels.is_empty() { "no labels".to_owned() } else { issue.labels.join(", ") };
        return Ok(format!("{} has {labels}.\n\n{}", issue.short_id, render::issue_link(&s.config.public_url, issue)));
    }
    let next = match change {
        IssueChange::Resolve { in_next_release: Some(true) } => {
            " Events from the release running now won't reopen it; events from the next one will."
        }
        _ => "",
    };
    Ok(format!(
        "{} is {}, assigned to {assignee}.{next}\n\n{}",
        issue.short_id,
        render::status(issue),
        render::issue_link(&s.config.public_url, issue)
    ))
}

#[derive(Deserialize)]
struct StartTriageArgs {
    issue: String,
    #[serde(default)]
    take_over: bool,
}

async fn start_triage(s: &AppState, v: &Viewer, args: Result<StartTriageArgs, String>) -> Reply {
    let a = args?;
    let id = issue_id(s, v, &a.issue).await?;
    let change = match s.db.start_triage(v, &id, a.take_over).await.map_err(db_error)? {
        Outcome::Ok(change) => change,
        Outcome::Failed(_, message) => return Err(message),
    };
    tell(s, std::iter::once(&change.issue));
    let t = &change.triage;
    Ok(format!(
        "{}\nIt's yours. When you have something worth recording, update_triage with triage `{}`: found, tried, fix, and an outcome when you're done.",
        render::triage(t, &change.issue, &s.config.public_url),
        t.id.0
    ))
}

#[derive(Deserialize)]
struct UpdateTriageArgs {
    triage: String,
    found: Option<String>,
    tried: Option<String>,
    fix: Option<String>,
    outcome: Option<String>,
}

async fn update_triage(s: &AppState, v: &Viewer, args: Result<UpdateTriageArgs, String>) -> Reply {
    let a = args?;
    let input = TriageInput {
        found: a.found,
        tried: a.tried,
        fix: a.fix,
        outcome: choice(a.outcome.as_deref(), "triage outcome", TriageOutcome::parse)?,
    };
    if input == TriageInput::default() {
        return Err("Say what to record: found, tried, fix or outcome. Nothing was changed.".to_owned());
    }
    let id = ref_segment(&a.triage, "triages").to_owned();
    let change = match s.db.update_triage(v, &id, &input).await.map_err(db_error)? {
        Outcome::Ok(change) => change,
        Outcome::Failed(_, message) => return Err(message),
    };
    tell(s, std::iter::once(&change.issue));
    let next = match change.triage.outcome {
        Some(TriageOutcome::Fixed) => {
            "\nOnce the fix is merged, update_issue with resolve_in_next_release, if you haven't."
        }
        Some(_) => "",
        None => "\nIt's still yours. An outcome ends it.",
    };
    Ok(format!("{}{next}", render::triage(&change.triage, &change.issue, &s.config.public_url)))
}

#[derive(Deserialize)]
struct MergeArgs {
    into: String,
    issues: Vec<String>,
}

async fn merge_issues(s: &AppState, v: &Viewer, args: Result<MergeArgs, String>) -> Reply {
    let a = args?;
    let target = issue_id(s, v, &a.into).await?;
    let mut sources = Vec::with_capacity(a.issues.len());
    for reference in &a.issues {
        let id = issue_id(s, v, reference).await?;
        if id == target {
            return Err(format!("{reference} is the issue you're merging into. Nothing was merged."));
        }
        sources.push(id);
    }
    if sources.is_empty() {
        return Err("Name at least one issue to merge into it. Nothing was merged.".to_owned());
    }
    let issue = match s.db.merge_issues(v, &target, &sources).await.map_err(db_error)? {
        Outcome::Ok(issue) => issue,
        Outcome::Failed(_, message) => return Err(message),
    };
    // The sources are gone; open lists drop them when they reload.
    s.live.send(LiveEvent::IssuesChanged {
        project_id: issue.summary.project_id.clone(),
        issue_ids: sources.iter().cloned().map(IssueId).chain([issue.summary.id.clone()]).collect(),
    });
    let merged = a.issues.iter().map(|r| ref_segment(r, "issues")).collect::<Vec<_>>().join(", ");
    Ok(format!(
        "Merged {merged} into {}, which now has {} events. New events like theirs land on it.\n\n{}",
        issue.summary.short_id,
        issue.summary.event_count,
        render::issue_link(&s.config.public_url, &issue.summary)
    ))
}

fn snooze(a: &UpdateArgs, now: i64) -> Result<Snooze, String> {
    match (a.until.as_deref().map(str::trim), a.events) {
        (Some(until), None) => {
            let at = parse_millis(until)
                .ok_or_else(|| format!("{until} isn't an ISO 8601 time, like 2026-10-20T09:00:00Z."))?;
            if at <= now {
                return Err("That time has passed. Snooze until a time still to come.".to_owned());
            }
            Ok(Snooze::Until { until: IsoDate::from_millis(at) })
        }
        (None, Some(n)) if n >= 1 => Ok(Snooze::Events { total: n, remaining: n }),
        _ => Err("Snooze takes either until (a time) or events (a number), not both or neither.".to_owned()),
    }
}

/// Who `who` means among the people this issue can be assigned to.
async fn assignee(s: &AppState, v: &Viewer, issue_id: &str, who: &str) -> Result<MemberId, String> {
    if who.eq_ignore_ascii_case("me") {
        return Ok(v.member().id.clone());
    }
    let detail = s.db.issue_detail(v, issue_id).await.map_err(db_error)?.ok_or("That issue has no events yet.")?;
    let found =
        detail.assignable.iter().find(|p| p.email.eq_ignore_ascii_case(who) || p.name.eq_ignore_ascii_case(who));
    match found {
        Some(p) => Ok(p.id.clone()),
        None => {
            let people: Vec<String> = detail.assignable.iter().map(|p| format!("{} ({})", p.name, p.email)).collect();
            Err(format!("{who} can't be assigned this issue. Who can: {}.", people.join(", ")))
        }
    }
}
