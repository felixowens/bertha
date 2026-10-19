//! The tools an agent triages with. Reads and the triage writes only, under the token
//! owner's own access: no keys, team, alerts, monitors or project settings. Something
//! out of the token's reach reads the same as something that doesn't exist.

use bertha_core::api::{IssueChange, Outcome};
use bertha_core::domain::{
    AssigneeFilter, Environment, EnvironmentFilter, IssueFilter, IssueSort, IssueStatus, Level, Project, Snooze,
    StatusFilter, TimeRange,
};
use bertha_core::ids::{EventId, MemberId};
use bertha_core::time::{IsoDate, parse_millis};
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

fn writes(title: &str, idempotent: bool) -> Value {
    json!({ "title": title, "readOnlyHint": false, "destructiveHint": false, "idempotentHint": idempotent, "openWorldHint": false })
}

pub fn list() -> Value {
    json!([
        {
            "name": "get_issue",
            "description": "Everything about one issue, as markdown: what it is, its project and repo, counts, the latest event's full stack trace (every frame, with source lines for the app's code and the throw), breadcrumbs, request with its query, user, the deployed commit, tags, deploys in the last 30 days, and activity with notes. It says plainly when the app didn't send something. Start triage here.",
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
                    "query": { "type": "string", "description": "Words to find in the type, message, culprit or tags." },
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
            "description": "The projects you can see, worst health first, with their keys, repos, sites, unresolved issues and uptime monitors.",
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
            "name": "update_issue",
            "description": "Triage an issue. resolve_in_next_release is the usual one after a fix is merged: events from the build running now don't reopen it, events from the next one do. resolve is for a fix that's already deployed. ignore is for noise that can't be fixed. snooze hides it until a time or for a number of events. assign needs assignee.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue": { "type": "string", "description": ISSUE_REF },
                    "action": { "type": "string", "enum": ["resolve_in_next_release", "resolve", "ignore", "snooze", "reopen", "assign", "unassign"] },
                    "until": { "type": "string", "description": "snooze only: an ISO 8601 time, like 2026-10-20T09:00:00Z." },
                    "events": { "type": "integer", "minimum": 1, "description": "snooze only: wake after this many more events." },
                    "assignee": { "type": "string", "description": "assign only: \"me\", or the email or name of someone get_issue lists as assignable." },
                },
                "required": ["issue", "action"],
            },
            "annotations": writes("Triage an issue", true),
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
        "update_issue" => update_issue(s, v, parse(args)).await,
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
    Ok(render::issue(&detail, &s.config.public_url))
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
    Ok(render::event(&at.event, &at.cursor, &issue.issue.summary, &issue.releases))
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
    Ok(render::projects(&data))
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
struct UpdateArgs {
    issue: String,
    action: String,
    until: Option<String>,
    events: Option<u32>,
    assignee: Option<String>,
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
        "snooze" => IssueChange::Snooze { snooze: snooze(&a, s.db.now())? },
        "assign" => {
            let who = a.assignee.as_deref().map(str::trim).filter(|w| !w.is_empty());
            let who = who.ok_or("Say who to assign it to: \"me\", or an email or name from get_issue.")?;
            IssueChange::Assign { person_id: Some(assignee(s, v, &id, who).await?) }
        }
        other => {
            return Err(format!(
                "{other} isn't an action. Use resolve_in_next_release, resolve, ignore, snooze, reopen, assign or unassign."
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
