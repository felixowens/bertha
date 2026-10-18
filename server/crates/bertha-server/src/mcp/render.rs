//! bertha's pages as markdown for an agent to read. Everything an app sent (messages,
//! breadcrumbs, URLs) is quoted as it came; long sections are cut off with a line that
//! says what was left out and which tool fetches the rest.

use std::fmt::Write;

use bertha_core::domain::{
    Activity, Event, EventCursor, Issue, IssueStatus, IssueSummary, Monitor, Project, Release, Snooze, StackFrame,
    TimeRange, TimeSeries,
};
use bertha_core::pages::{IssueDetail, IssueList, MonitorDetail, ProjectsData, ReleaseDetail};

/// Frames shown per exception; the rest are counted.
const FRAMES: usize = 50;
/// Longer runs of dependency frames fold to one line.
const VENDOR_RUN: usize = 3;
/// The breadcrumbs just before the error.
const BREADCRUMBS: usize = 40;
/// The newest activity entries.
const ACTIVITY: usize = 30;
/// Issues listed under a release or monitor.
const RELATED: usize = 15;
const CHECKS: usize = 20;

// `write!` into a String can't fail; these keep the call sites short.
macro_rules! line {
    ($out:expr) => { $out.push('\n') };
    ($out:expr, $($arg:tt)*) => {{ let _ = writeln!($out, $($arg)*); }};
}

pub fn issue_link(base: &str, s: &IssueSummary) -> String {
    format!("{base}/issues/{}", s.id.0)
}

pub fn range(r: TimeRange) -> &'static str {
    match r {
        TimeRange::Day => "24 hours",
        TimeRange::Week => "7 days",
        TimeRange::Month => "30 days",
    }
}

pub fn status(s: &IssueSummary) -> String {
    match (&s.status, &s.snooze) {
        (IssueStatus::Snoozed, Some(Snooze::Until { until })) => format!("snoozed until {}", until.0),
        (IssueStatus::Snoozed, Some(Snooze::Events { total, remaining })) => {
            format!("snoozed for {remaining} more of {total} events")
        }
        (other, _) => other.as_str().to_owned(),
    }
}

fn project_line(p: &Project) -> String {
    let mut s = format!("{} (key {}, id `{}`)", p.name, p.key, p.id.0);
    if let Some(repo) = &p.repo_url {
        let _ = write!(s, ", repo {repo}");
    }
    if let Some(url) = &p.url {
        let _ = write!(s, ", site {url}");
    }
    s
}

fn title(s: &IssueSummary) -> String {
    format!("{} {}: {}", s.short_id, s.r#type, one_line(&s.message))
}

fn one_line(text: &str) -> String {
    let first = text.lines().next().unwrap_or("").trim();
    if text.trim().lines().nth(1).is_some() { format!("{first} …") } else { first.to_owned() }
}

/// A fenced block whose fence can't be closed by what's inside it.
fn fence(out: &mut String, body: &str) {
    let mut ticks = "```".to_owned();
    while body.contains(&ticks) {
        ticks.push('`');
    }
    line!(out, "{ticks}");
    line!(out, "{body}");
    line!(out, "{ticks}");
}

fn quote(out: &mut String, body: &str) {
    for l in body.lines() {
        line!(out, "> {l}");
    }
}

/// How the viewer's writes show on an issue.
pub fn by_line(v: &bertha_db::Viewer) -> String {
    by(&v.person(), &v.agent().map(str::to_owned))
}

fn by(person: &bertha_core::domain::Person, via: &Option<String>) -> String {
    match via {
        Some(token) => format!("{} via {token}", person.name),
        None => person.name.clone(),
    }
}

/// `get_issue`: the issue, its latest event, tags, deploys and activity.
pub fn issue(d: &IssueDetail, base: &str) -> String {
    let s = &d.issue.summary;
    let mut out = String::new();
    line!(out, "# {}", title(s));
    line!(out);
    line!(out, "- Link: {}", issue_link(base, s));
    line!(out, "- Project: {}", project_line(&d.project));
    line!(out, "- Level: {} · Status: {}", s.level, status(s));
    if let Some(c) = &s.culprit {
        line!(out, "- Culprit: `{c}`");
    }
    line!(
        out,
        "- Events: {} in all, {} in the last 7 days · Users affected: {}",
        s.event_count,
        s.events_in_range,
        s.user_count
    );
    let first_release = d.issue.first_release.as_deref().map(|r| format!(" in release {r}")).unwrap_or_default();
    line!(out, "- First seen: {}{first_release} · Last seen: {}", s.first_seen.0, s.last_seen.0);
    if let Some(r) = &d.issue.regressed_in {
        line!(out, "- Regressed in release {r}: it was resolved, then came back.");
    }
    if !s.environments.is_empty() {
        let envs: Vec<&str> = s.environments.iter().map(|e| e.as_str()).collect();
        line!(out, "- Environments: {}", envs.join(", "));
    }
    match &s.assignee {
        Some(p) => line!(out, "- Assignee: {} ({})", p.name, p.email),
        None => line!(out, "- Assignee: nobody"),
    }
    if !d.assignable.is_empty() {
        let people: Vec<String> = d.assignable.iter().map(|p| format!("{} ({})", p.name, p.email)).collect();
        line!(out, "- Can be assigned to: {}", people.join(", "));
    }
    line!(out);

    out.push_str(&event(&d.event, &d.cursor, s));

    tags(&mut out, &d.issue);
    history(&mut out, &d.history, &d.releases);
    activity(&mut out, &d.issue);
    out
}

/// `get_event`, and the latest event inside `get_issue`.
pub fn event(e: &Event, cursor: &EventCursor, s: &IssueSummary) -> String {
    let mut out = String::new();
    let place = match cursor.index {
        0 => "the latest".to_owned(),
        i if i + 1 == cursor.total => "the oldest".to_owned(),
        i => format!("number {} counting from the newest", i + 1),
    };
    line!(out, "## Event `{}`: {place} of {}", e.id.0, cursor.total);
    line!(out);
    let release = e.release.as_deref().unwrap_or("not reported");
    line!(
        out,
        "- Received: {} · Release: {release} · Environment: {} · Level: {}",
        e.received_at.0,
        e.environment,
        e.level
    );
    if let Some(r) = &e.request {
        let status = r.status.map(|s| format!(" → {s}")).unwrap_or_default();
        line!(out, "- Request: {} {}{status}", r.method, r.url);
    }
    if let Some(u) = &e.user {
        let parts: Vec<String> = [("id", &u.id), ("email", &u.email), ("ip", &u.ip)]
            .into_iter()
            .filter_map(|(k, v)| v.as_ref().map(|v| format!("{k} {v}")))
            .collect();
        if !parts.is_empty() {
            line!(out, "- User: {}", parts.join(", "));
        }
    }
    let c = &e.context;
    let ctx: Vec<String> =
        [("browser", &c.browser), ("os", &c.os), ("runtime", &c.runtime), ("user agent", &c.user_agent)]
            .into_iter()
            .filter_map(|(k, v)| v.as_ref().map(|v| format!("{k} {v}")))
            .collect();
    if !ctx.is_empty() {
        line!(out, "- Context: {}", ctx.join(", "));
    }
    if !e.tags.is_empty() {
        let tags: Vec<String> = e.tags.iter().map(|(k, v)| format!("{k}={v}")).collect();
        line!(out, "- Tags: {}", tags.join(", "));
    }
    let older = cursor.older_id.as_ref().map(|i| format!("older `{}`", i.0));
    let newer = cursor.newer_id.as_ref().map(|i| format!("newer `{}`", i.0));
    let around: Vec<String> = [older, newer].into_iter().flatten().collect();
    if !around.is_empty() {
        line!(out, "- Other events: {} (get_event with issue {} and that event id)", around.join(", "), s.short_id);
    }
    line!(out);

    match &e.exception {
        Some(x) => {
            line!(out, "### {}: {}", x.r#type, one_line(&x.message));
            if x.message.trim().lines().nth(1).is_some() {
                line!(out);
                fence(&mut out, x.message.trim());
            }
            line!(out);
            frames(&mut out, &x.frames);
        }
        None => line!(out, "No stack trace: this was reported without one."),
    }

    if !e.breadcrumbs.is_empty() {
        line!(out);
        line!(out, "### Breadcrumbs, oldest first, ending just before the error");
        line!(out);
        let skip = e.breadcrumbs.len().saturating_sub(BREADCRUMBS);
        if skip > 0 {
            line!(out, "({skip} earlier breadcrumbs not shown.)");
        }
        for b in &e.breadcrumbs[skip..] {
            line!(out, "- {} [{} {}] {}", b.at.0, b.category, b.level, one_line(&b.message));
        }
    }
    line!(out);
    out
}

fn frames(out: &mut String, frames: &[StackFrame]) {
    if frames.is_empty() {
        line!(out, "The exception came without frames.");
        return;
    }
    line!(out, "Frames, innermost (where it was thrown) first. [app] marks the project's own code.");
    line!(out);
    let mut i = 0;
    while i < frames.len().min(FRAMES) {
        let f = &frames[i];
        // A run of dependency frames folds to its first, as the app shows it.
        let run = frames[i..].iter().take_while(|f| !f.in_app).count();
        if run > VENDOR_RUN {
            line!(out, "{}. {}", i + 1, frame_line(f));
            line!(out, "{}–{}. ({} more frames in dependencies or the runtime.)", i + 2, i + run, run - 1);
            i += run;
            continue;
        }
        line!(out, "{}. {}", i + 1, frame_line(f));
        if f.in_app
            && let Some(ctx) = &f.context
        {
            let width = (ctx.start_line as usize + ctx.lines.len()).to_string().len();
            let body: Vec<String> = ctx
                .lines
                .iter()
                .enumerate()
                .map(|(k, l)| {
                    let n = ctx.start_line + k as u32;
                    let mark = if n == ctx.highlight { ">" } else { " " };
                    format!("{mark}{n:>width$} | {l}")
                })
                .collect();
            fence(out, &body.join("\n"));
        }
        i += 1;
    }
    if frames.len() > i {
        line!(out, "({} more frames not shown.)", frames.len() - i);
    }
}

fn frame_line(f: &StackFrame) -> String {
    let mut at = f.file.clone();
    if let Some(l) = f.line {
        let _ = write!(at, ":{l}");
        if let Some(c) = f.column {
            let _ = write!(at, ":{c}");
        }
    }
    let function = f.function.as_deref().map(|n| format!(" in `{n}`")).unwrap_or_default();
    let app = if f.in_app { "[app] " } else { "" };
    let mapped = if f.mapped { "" } else { " (minified: no source map for this release)" };
    format!("{app}`{at}`{function}{mapped}")
}

fn tags(out: &mut String, issue: &Issue) {
    if issue.tags.is_empty() {
        return;
    }
    line!(out, "## Tags across all events");
    line!(out);
    for t in &issue.tags {
        let values: Vec<String> = t.values.iter().map(|v| format!("{} ({})", v.value, v.count)).collect();
        let more = if (t.distinct as usize) > t.values.len() {
            format!(", {} values in all", t.distinct)
        } else {
            String::new()
        };
        line!(out, "- {}: {}{more}", t.key, values.join(", "));
    }
    line!(out);
}

fn history(out: &mut String, h: &TimeSeries, releases: &[Release]) {
    line!(out, "## The last 30 days");
    line!(out);
    let counts: Vec<String> = h.counts.iter().map(|c| c.map_or("-".to_owned(), |c| c.to_string())).collect();
    line!(out, "Events per {}, oldest first from {} (- is no data): {}", h.bucket, h.start.0, counts.join(" "));
    if releases.is_empty() {
        line!(out, "No deploys of this project in that time.");
    } else {
        line!(out);
        line!(out, "Deploys of this project in that time:");
        for r in releases {
            line!(out, "- {}", release_line(r));
        }
    }
    line!(out);
}

pub fn release_line(r: &Release) -> String {
    let commit = r
        .commit
        .as_ref()
        .map(|c| format!(", commit {} \"{}\" by {}", short_sha(&c.sha), one_line(&c.message), c.author))
        .unwrap_or_default();
    format!("{} to {} at {} (id `{}`){commit}", r.version, r.environment, r.deployed_at.0, r.id.0)
}

fn short_sha(sha: &str) -> &str {
    sha.get(..12).unwrap_or(sha)
}

fn activity(out: &mut String, issue: &Issue) {
    line!(out, "## Activity, newest first");
    line!(out);
    for a in issue.activity.iter().take(ACTIVITY) {
        match a {
            Activity::FirstSeen { at, release } => {
                let r = release.as_deref().map(|r| format!(" in {r}")).unwrap_or_default();
                line!(out, "- {} First seen{r}.", at.0);
            }
            Activity::Regressed { at, release } => {
                let r = release.as_deref().map(|r| format!(" in {r}")).unwrap_or_default();
                line!(out, "- {} Regressed{r}.", at.0);
            }
            Activity::Resolved { at, by: p, via } => line!(out, "- {} Resolved by {}.", at.0, by(p, via)),
            Activity::Ignored { at, by: p, via } => line!(out, "- {} Ignored by {}.", at.0, by(p, via)),
            Activity::Reopened { at, by: p, via } => line!(out, "- {} Reopened by {}.", at.0, by(p, via)),
            Activity::Snoozed { at, by: p, via, snooze } => {
                let what = match snooze {
                    Snooze::Until { until } => format!("until {}", until.0),
                    Snooze::Events { total, .. } => format!("for {total} events"),
                };
                line!(out, "- {} Snoozed {what} by {}.", at.0, by(p, via));
            }
            Activity::Unsnoozed { at, reason } => line!(out, "- {} Snooze ended ({reason}).", at.0),
            Activity::Assigned { at, by: p, via, to } => match to {
                Some(to) => line!(out, "- {} Assigned to {} by {}.", at.0, to.name, by(p, via)),
                None => line!(out, "- {} Unassigned by {}.", at.0, by(p, via)),
            },
            Activity::Note { at, by: p, via, body } => {
                line!(out, "- {} Note from {}:", at.0, by(p, via));
                quote(out, body);
            }
        }
    }
    if issue.activity.len() > ACTIVITY {
        line!(out, "({} older entries not shown.)", issue.activity.len() - ACTIVITY);
    }
}

pub fn summary_line(s: &IssueSummary, base: &str) -> String {
    let assignee = s.assignee.as_ref().map(|p| format!(", assigned to {}", p.name)).unwrap_or_default();
    let mut flags = Vec::new();
    if s.is_new {
        flags.push("new");
    }
    if s.is_regression {
        flags.push("regressed");
    }
    let flags = if flags.is_empty() { String::new() } else { format!(" [{}]", flags.join(", ")) };
    format!(
        "- **{}**{flags} {}: {} · {} · {} · {} events, {} users · last seen {}{assignee} · {}",
        s.short_id,
        s.r#type,
        one_line(&s.message),
        s.level,
        status(s),
        s.event_count,
        s.user_count,
        s.last_seen.0,
        issue_link(base, s)
    )
}

pub fn issue_list(list: &IssueList, shown: usize, what: &str, base: &str) -> String {
    let mut out = String::new();
    if list.issues.is_empty() {
        line!(out, "No {what}.");
        return out;
    }
    line!(out, "{} {what}, showing {}.", list.total, shown.min(list.issues.len()));
    line!(out);
    for s in list.issues.iter().take(shown) {
        line!(out, "{}", summary_line(s, base));
    }
    if (list.total as usize) > shown {
        line!(out);
        line!(out, "More match than are shown: narrow with query, project or status, or raise limit (up to 100).");
    }
    out
}

pub fn projects(d: &ProjectsData) -> String {
    let mut out = String::new();
    if d.projects.is_empty() {
        line!(out, "No projects you can see.");
        return out;
    }
    line!(out, "# Projects, worst health first");
    line!(out);
    for p in &d.projects {
        let events = d.project_events.get(&p.id.0).copied().unwrap_or(0);
        let last = p.last_event_at.as_ref().map(|t| format!(", last event {}", t.0)).unwrap_or_default();
        line!(
            out,
            "- **{}**: {}, {} unresolved issues, {events} events in range{last}",
            project_line(p),
            p.health,
            p.unresolved_issues
        );
        for m in d.monitors.iter().filter(|m| m.project_id == p.id) {
            line!(out, "  - Monitor {}", monitor_line(m));
        }
    }
    out
}

pub fn monitor_line(m: &Monitor) -> String {
    let ms = m.latest_response_ms.map(|ms| format!(", {ms}ms")).unwrap_or_default();
    format!(
        "{} ({}, id `{}`): {} since {}{ms}, {:.2}% up over 30 days",
        m.name, m.url, m.id.0, m.state, m.since.0, m.uptime30d
    )
}

fn related(out: &mut String, heading: &str, issues: &[IssueSummary], base: &str) {
    if issues.is_empty() {
        return;
    }
    line!(out, "## {heading}");
    line!(out);
    for s in issues.iter().take(RELATED) {
        line!(out, "{}", summary_line(s, base));
    }
    if issues.len() > RELATED {
        line!(out, "({} more not shown.)", issues.len() - RELATED);
    }
    line!(out);
}

pub fn release(d: &ReleaseDetail, base: &str) -> String {
    let r = &d.release;
    let mut out = String::new();
    line!(out, "# Release {} of {}", r.version, d.project.name);
    line!(out);
    line!(out, "- Deployed: {}", release_line(r));
    line!(out, "- Project: {}", project_line(&d.project));
    line!(
        out,
        "- Since this deploy: {} new issues, {} regressed, {} fixes held, {} events",
        r.new_issues,
        r.regressed_issues,
        r.quiet_since_deploy,
        r.event_count
    );
    if let Some(p) = &d.previous {
        line!(out, "- Previous deploy: {}", release_line(p));
    }
    if let Some(n) = &d.next {
        line!(out, "- Next deploy: {}", release_line(n));
    }
    let counts: Vec<String> = d.around.counts.iter().map(|c| c.map_or("-".to_owned(), |c| c.to_string())).collect();
    line!(
        out,
        "- Events per hour from 24h before to 24h after ({} hours after have passed): {}",
        d.after_hours,
        counts.join(" ")
    );
    line!(out);
    related(&mut out, "New in this release", &d.new_issues, base);
    related(&mut out, "Regressed in this release", &d.regressed_issues, base);
    related(&mut out, "Resolved before it and quiet since", &d.held_fixes, base);
    out
}

pub fn monitor(d: &MonitorDetail, base: &str) -> String {
    let m = &d.monitor;
    let mut out = String::new();
    line!(out, "# Monitor {}", m.name);
    line!(out);
    line!(out, "- {}", monitor_line(m));
    line!(out, "- Project: {}", project_line(&d.project));
    line!(out, "- Checked every {}s", m.interval_seconds);
    line!(out);
    if !d.incidents.is_empty() {
        line!(out, "## Incidents, newest first");
        line!(out);
        for i in d.incidents.iter().take(10) {
            let end = i.resolved_at.as_ref().map_or("still open".to_owned(), |t| format!("to {}", t.0));
            line!(out, "- {} {end}: {} ({} failed checks)", i.started_at.0, i.cause, i.failed_checks);
        }
        line!(out);
    }
    if !d.checks.is_empty() {
        line!(out, "## Recent checks, newest first");
        line!(out);
        for c in d.checks.iter().take(CHECKS) {
            let status = c.http_status.map(|s| format!("HTTP {s}")).unwrap_or_else(|| "no response".to_owned());
            let ms = c.response_ms.map(|ms| format!(", {ms}ms")).unwrap_or_default();
            let err = c.error.as_deref().map(|e| format!(", {e}")).unwrap_or_default();
            let ok = if c.ok { "ok" } else { "failed" };
            line!(out, "- {} {ok}: {status}{ms}{err} from {}", c.at.0, c.region);
        }
        line!(out);
    }
    related(&mut out, "Issues that started or spiked during the latest incident", &d.related_issues, base);
    out
}
