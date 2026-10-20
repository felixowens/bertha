//! bertha's pages as markdown for an agent to read. Everything an app sent (messages,
//! breadcrumbs, URLs) is quoted as it came; long sections are cut off with a line that
//! says what was left out and which tool fetches the rest.

use std::fmt::Write;

use bertha_core::domain::{
    Activity, Commit, Event, EventContext, EventCursor, FixState, FixWatch, Issue, IssueStatus, IssueSummary,
    Mechanism, Monitor, Navigation, Project, RelatedEvent, Release, ReleaseSource, RequestInfo, Snooze, StackFrame,
    TimeRange, TimeSeries, Triage, TriageOutcome, TriageState,
};
use bertha_core::grouping::is_extension;
use bertha_core::pages::{IssueDetail, IssueList, MonitorDetail, ProjectsData, ReleaseDetail};

/// Frames shown per exception, which is every frame bertha keeps.
const FRAMES: usize = 100;
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

/// `get_issue`: the issue, who is on it and what earlier triages found, the project's
/// brief, its latest event, tags, deploys and activity.
pub fn issue(d: &IssueDetail, brief: Option<&str>, base: &str) -> String {
    let s = &d.issue.summary;
    let mut out = String::new();
    line!(out, "# {}", title(s));
    line!(out);
    line!(out, "- Link: {}", issue_link(base, s));
    line!(out, "- Project: {}", project_line(&d.project));
    line!(out, "- Level: {} · Status: {}", s.level, status(s));
    match s.culprit.as_deref().map(str::trim) {
        Some(c) if !c.is_empty() => line!(out, "- Culprit: `{c}`"),
        _ => line!(out, "- Culprit: none"),
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
    if s.labels.is_empty() {
        line!(out, "- Labels: none");
    } else {
        line!(out, "- Labels: {}", s.labels.join(", "));
    }
    line!(out);

    triages(&mut out, &d.issue.triages, s);
    if let Some(brief) = brief {
        line!(out, "## Project brief");
        line!(out);
        line!(out, "What the project's owner wants anyone triaging it to know:");
        line!(out);
        quote(&mut out, brief);
        line!(out);
    }

    out.push_str(&event(&d.event, &d.cursor, s, &d.releases, &d.related, base));

    tags(&mut out, &d.issue);
    history(&mut out, &d.history, &d.releases);
    activity(&mut out, &d.issue);
    out
}

/// `get_event`, and the latest event inside `get_issue`. `releases` are the project's
/// recent releases, newest first, for the commit behind the event's release; `related`
/// are events of other issues on the same trace.
pub fn event(
    e: &Event,
    cursor: &EventCursor,
    s: &IssueSummary,
    releases: &[Release],
    related: &[RelatedEvent],
    base: &str,
) -> String {
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
    if let Some(version) = e.release.as_deref() {
        commit(&mut out, version, e, releases);
        older_build(&mut out, version, e, releases);
    }
    match &e.mechanism {
        Some(m) => line!(out, "- Surfaced: {}", surfaced(m)),
        None => line!(out, "- Surfaced: not reported (SDKs before 0.5 don't say how an error was caught)."),
    }
    request(&mut out, e.request.as_ref(), is_browser(&e.context));
    let user: Vec<String> = e
        .user
        .iter()
        .flat_map(|u| [("id", &u.id), ("email", &u.email), ("ip", &u.ip)])
        .filter_map(|(k, v)| v.as_ref().map(|v| format!("{k} {v}")))
        .collect();
    if user.is_empty() {
        line!(out, "- User: none reported.");
    } else {
        line!(out, "- User: {}", user.join(", "));
    }
    context(&mut out, &e.context);
    if let Some(t) = &e.trace {
        let span = t.span_id.as_deref().map(|s| format!(", span `{s}`")).unwrap_or_default();
        line!(out, "- Trace: `{}`{span}", t.trace_id);
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
    if !related.is_empty() {
        line!(out, "- Same trace in other issues (the same page load or request; get_event reads each):");
        for r in related {
            line!(
                out,
                "  - **{}** {}: {} · event `{}` at {} · {}",
                r.issue.short_id,
                r.issue.r#type,
                one_line(&r.issue.message),
                r.event_id.0,
                r.received_at.0,
                issue_link(base, &r.issue)
            );
        }
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
            if !x.data.is_empty() {
                line!(out);
                line!(out, "The error's own fields:");
                for (k, v) in &x.data {
                    line!(out, "- `{k}`: {}", one_line(v));
                }
            }
            if let Some(stack) = x.component_stack.as_deref().filter(|c| !c.trim().is_empty()) {
                line!(out);
                line!(out, "React component stack, innermost first:");
                fence(&mut out, stack.trim());
            }
        }
        None => line!(out, "No stack trace: this was reported without one."),
    }

    if e.breadcrumbs.is_empty() {
        line!(out);
        line!(out, "No breadcrumbs were sent with this event.");
    } else {
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
    if frames.iter().all(|f| is_extension(&f.file)) {
        line!(
            out,
            "Every frame is in a browser extension or a script the browser hides (webkit-masked-url). This is \
             probably not the app's code; check the page state and breadcrumbs before changing anything."
        );
    }
    match frames.iter().position(|f| f.in_app) {
        Some(0) => {}
        Some(app) => line!(
            out,
            "It was thrown in dependency code. The project's code calls in at frame {}, `{}`; frames 1–{app} \
             are the path from that call to the throw, so the cause is usually in what that call passed.",
            app + 1,
            location(&frames[app])
        ),
        None if frames.iter().all(|f| is_extension(&f.file)) => {}
        None => line!(
            out,
            "No frame is the project's code: the stack only shows dependencies and the runtime. Their calls \
             still name the library and the operation; look for where the project uses it."
        ),
    }
    line!(out);
    for (i, f) in frames.iter().take(FRAMES).enumerate() {
        line!(out, "{}. {}", i + 1, frame_line(f));
        // The project's frames, and the throw itself wherever it was.
        if let Some(ctx) = f.context.as_ref().filter(|_| f.in_app || i == 0) {
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
    }
    if frames.len() > FRAMES {
        line!(out, "({} more frames not shown.)", frames.len() - FRAMES);
    }
}

/// `file:line:col`, without the `async ` that SDKs before 0.4 left on some files.
fn location(f: &StackFrame) -> String {
    let mut at = f.file.strip_prefix("async ").unwrap_or(&f.file).to_owned();
    if let Some(l) = f.line {
        let _ = write!(at, ":{l}");
        if let Some(c) = f.column {
            let _ = write!(at, ":{c}");
        }
    }
    at
}

fn frame_line(f: &StackFrame) -> String {
    let at = location(f);
    let function = f.function.as_deref().map(|n| format!(" in `{n}`")).unwrap_or_default();
    let app = if is_extension(&f.file) {
        "[extension] "
    } else if f.in_app {
        "[app] "
    } else {
        ""
    };
    // Only a browser's bundle needs a map; a server's files are the source it runs.
    let bundled = f.file.starts_with("http://") || f.file.starts_with("https://");
    let mapped = if f.mapped || !bundled { "" } else { " (minified: no source map for this release)" };
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
        line!(out, "No releases of this project in that time.");
    } else {
        line!(out);
        line!(out, "Releases of this project in that time, newest first:");
        for r in releases {
            line!(out, "- {}", release_line(r));
        }
    }
    line!(out);
}

pub fn release_line(r: &Release) -> String {
    let commit = r.commit.as_ref().map(|c| format!(", commit {}", commit_text(c))).unwrap_or_default();
    let when = match r.source {
        ReleaseSource::Deploy => format!("deployed to {} at {}", r.environment, r.deployed_at.0),
        ReleaseSource::Heartbeat => {
            format!("in {}, first reported running at {} (no deploy recorded)", r.environment, r.deployed_at.0)
        }
        ReleaseSource::Event => {
            format!("in {}, first seen in an event at {} (no deploy recorded)", r.environment, r.deployed_at.0)
        }
    };
    format!("{} {when} (id `{}`){commit}", r.version, r.id.0)
}

/// The commit behind the event's release, and how sure bertha is of when it went out.
fn commit(out: &mut String, version: &str, e: &Event, releases: &[Release]) {
    let Some(r) = releases.iter().find(|r| r.version == version && r.environment == e.environment) else {
        line!(out, "- Commit: unknown; {version} wasn't seen in the last 30 days (get_release has older ones).");
        return;
    };
    let at = &r.deployed_at.0;
    let began = match r.source {
        ReleaseSource::Deploy => format!("began {at}"),
        ReleaseSource::Heartbeat => {
            format!("began by {at}: no deploy was recorded, a running process first reported it then")
        }
        ReleaseSource::Event => format!("began by {at}: no deploy was recorded, bertha first saw it in an event then"),
    };
    match &r.commit {
        Some(c) => line!(out, "- Commit: {} (release {version} {began})", commit_text(c)),
        None if r.source == ReleaseSource::Deploy => {
            line!(out, "- Commit: not recorded for {version}; it was deployed at {at} without one.")
        }
        None => line!(
            out,
            "- Commit: not recorded for {version}, and no deploy was. bertha first saw it at {at}, so it went out \
             then or earlier; look the version up in the repo's tags or CI."
        ),
    }
}

/// Says so when a newer release was already out where the event came from. A release
/// bertha only saw (no deploy) went out at some unknown time before then, so beside a
/// recorded deploy it's only probably older.
fn older_build(out: &mut String, version: &str, e: &Event, releases: &[Release]) {
    let Some(received) = e.received_at.millis() else { return };
    let Some(newest) = releases
        .iter()
        .filter(|r| r.environment == e.environment && r.version != version)
        .find(|r| r.deployed_at.millis().is_some_and(|at| at <= received))
    else {
        return;
    };
    let mine = releases.iter().find(|r| r.version == version && r.environment == e.environment);
    let sure = match mine {
        // Older than the releases bertha lists, so anything listed is newer.
        None => true,
        Some(m) if m.source == ReleaseSource::Deploy => {
            if newest.deployed_at.millis() <= m.deployed_at.millis() {
                return;
            }
            true
        }
        Some(_) if newest.source == ReleaseSource::Deploy => false,
        Some(_) => return,
    };
    let what = if is_browser(&e.context) {
        "the visitor was on an older build (a tab left open, or a cached page)"
    } else {
        "this came from an older build (an instance not yet replaced, or a deploy still rolling out)"
    };
    let (env, at, newer) = (&e.environment, &newest.deployed_at.0, &newest.version);
    if sure {
        line!(out, "- Older build: {env} has run `{newer}` since {at}; {what}.");
    } else {
        line!(
            out,
            "- Older build, probably: `{newer}` was deployed to {env} at {at}, before this event, and {version} \
             never was. Unless {version} went out without telling bertha, {what}."
        );
    }
}

fn surfaced(m: &Mechanism) -> String {
    let how = match m.handler.as_str() {
        "onerror" => "uncaught error (window onerror)".to_owned(),
        "onunhandledrejection" => "unhandled promise rejection (onunhandledrejection)".to_owned(),
        "uncaughtException" => "uncaught exception (process uncaughtException)".to_owned(),
        "unhandledRejection" => "unhandled promise rejection (process unhandledRejection)".to_owned(),
        "onRequestError" => "error while Next.js handled a request (onRequestError)".to_owned(),
        "wrapHandler" => "thrown out of a request handler (wrapHandler)".to_owned(),
        "ErrorBoundary" => "render error caught by a React error boundary (ErrorBoundary)".to_owned(),
        "captureException" => "reported by the app's own code (captureException)".to_owned(),
        other => format!("`{other}`"),
    };
    let caught = if m.handled { "caught by the app" } else { "not caught by the app" };
    format!("{how}, {caught}")
}

/// Browser SDKs report the page; server ones the request they were handling.
fn is_browser(c: &EventContext) -> bool {
    c.browser.is_some() || c.viewport.is_some()
}

fn request(out: &mut String, r: Option<&RequestInfo>, browser: bool) {
    let label = if browser { "Page" } else { "Request" };
    let Some(r) = r else {
        line!(out, "- {label}: none reported with this event.");
        return;
    };
    let status = r.status.map(|s| format!(" → {s}")).unwrap_or_default();
    line!(out, "- {label}: {} {}{status}", r.method, r.url);
    if !r.headers.is_empty() {
        line!(out, "- Request headers (credentials are never sent):");
        for (k, v) in &r.headers {
            line!(out, "  - {k}: {}", one_line(v));
        }
    }
}

fn context(out: &mut String, c: &EventContext) {
    let text = |k: &str, v: &Option<String>| v.as_ref().map(|v| format!("{k} {v}"));
    let flag = |v: Option<bool>, yes: &str, no: &str| v.map(|v| if v { yes } else { no }.to_owned());
    let ctx: Vec<String> = [
        text("browser", &c.browser),
        text("os", &c.os),
        text("runtime", &c.runtime),
        text("host", &c.host),
        text("user agent", &c.user_agent),
    ]
    .into_iter()
    .flatten()
    .collect();
    if !ctx.is_empty() {
        line!(out, "- Context: {}", ctx.join(", "));
    }
    let navigation = c.navigation.map(|n| match n {
        Navigation::Navigate => "arrived by a link or the address bar (navigate)".to_owned(),
        Navigation::Reload => "page was reloaded (reload)".to_owned(),
        Navigation::BackForward => "arrived with back or forward (back_forward)".to_owned(),
        Navigation::Prerender => "page was prerendered (prerender)".to_owned(),
    });
    let page: Vec<String> = [
        text("viewport", &c.viewport),
        flag(c.online, "online", "offline"),
        flag(c.visible, "tab visible", "tab hidden"),
        navigation,
        c.page_age_ms.map(|ms| format!("page open for {}", duration(ms))),
        flag(c.automated, "automated browser (navigator.webdriver)", "not automated"),
        text("referrer", &c.referrer),
        text("language", &c.language),
        text("timezone", &c.timezone),
        text("connection", &c.connection),
    ]
    .into_iter()
    .flatten()
    .collect();
    if !page.is_empty() {
        line!(out, "- Page state: {}", page.join(", "));
    }
    if !c.versions.is_empty() {
        let v: Vec<String> = c.versions.iter().map(|(k, v)| format!("{k} {v}")).collect();
        line!(out, "- Versions: {}", v.join(", "));
    }
}

/// `850ms`, `42s`, `3m 12s`, `2h 5m`, `3d 4h`.
fn duration(ms: u32) -> String {
    let s = ms / 1000;
    match s {
        0 => format!("{ms}ms"),
        1..60 => format!("{s}s"),
        60..3600 => format!("{}m {}s", s / 60, s % 60),
        3600..86_400 => format!("{}h {}m", s / 3600, s % 3600 / 60),
        _ => format!("{}d {}h", s / 86_400, s % 86_400 / 3600),
    }
}

/// `abc123def456 "Fix cart" by Ana`; a commit a running process reported has only its sha.
fn commit_text(c: &Commit) -> String {
    let mut s = format!("`{}`", short_sha(&c.sha));
    if !c.message.trim().is_empty() {
        let _ = write!(s, " \"{}\"", one_line(&c.message));
    }
    if !c.author.trim().is_empty() {
        let _ = write!(s, " by {}", c.author);
    }
    s
}

fn short_sha(sha: &str) -> &str {
    sha.get(..12).unwrap_or(sha)
}

/// The active triage first, then what earlier ones found.
fn triages(out: &mut String, triages: &[Triage], s: &IssueSummary) {
    line!(out, "## Triage");
    line!(out);
    let (open, done): (Vec<&Triage>, Vec<&Triage>) = triages.iter().partition(|t| t.outcome.is_none());
    match open.first() {
        Some(t) if t.state == TriageState::Active => {
            line!(
                out,
                "In progress: {} started `{}` at {}, last updated {}. Don't duplicate their work; start_triage with take_over only if they've stopped.",
                by(&t.by, &t.via),
                t.id.0,
                t.started_at.0,
                t.updated_at.0
            );
            triage_fields(out, t);
        }
        Some(t) => {
            line!(
                out,
                "Stale: {} started `{}` at {} and hasn't updated it since {}. start_triage takes it over.",
                by(&t.by, &t.via),
                t.id.0,
                t.started_at.0,
                t.updated_at.0
            );
            triage_fields(out, t);
        }
        None => line!(out, "Nobody is on it. start_triage on {} claims it before you dig in.", s.short_id),
    }
    if done.is_empty() {
        if open.is_empty() {
            line!(out, "No earlier triages.");
        }
    } else {
        line!(out);
        line!(out, "Earlier triages, newest first:");
        for t in done {
            let outcome = t.outcome.map(outcome_text).unwrap_or("ended");
            let release = t.release.as_deref().map(|r| format!(", on release {r}")).unwrap_or_default();
            line!(out, "- {} by {}, {outcome}{release}:", t.updated_at.0, by(&t.by, &t.via));
            triage_fields(out, t);
        }
    }
    line!(out);
}

fn triage_fields(out: &mut String, t: &Triage) {
    for (name, text) in [("Found", &t.found), ("Tried", &t.tried), ("Fix", &t.fix)] {
        if let Some(text) = text {
            line!(out, "  {name}:");
            for l in text.lines() {
                line!(out, "  > {l}");
            }
        }
    }
    if let Some(w) = &t.watch {
        line!(out, "  Shipping: {}", watch(w));
    }
}

pub fn outcome_text(o: TriageOutcome) -> &'static str {
    match o {
        TriageOutcome::Fixed => "fixed",
        TriageOutcome::NotABug => "not a bug",
        TriageOutcome::CantFix => "can't fix",
        TriageOutcome::NeedsData => "needs more data",
        TriageOutcome::Abandoned => "abandoned",
    }
}

fn fix_name(w: &FixWatch) -> String {
    match (w.pr, &w.commit) {
        (Some(pr), _) => format!("PR #{pr}"),
        (None, Some(c)) => format!("Commit `{}`", short_sha(c)),
        (None, None) => "The fix".to_owned(),
    }
}

/// Where a fix is on its way to production: "PR #196, merged as `a1b2c3d4e5f6`, waiting
/// for a production release."
pub fn watch(w: &FixWatch) -> String {
    let name = fix_name(w);
    let mut line = match w.state {
        FixState::WaitingMerge => format!("{name}, waiting for it to merge."),
        FixState::WaitingRelease => match (w.pr, &w.commit) {
            (Some(_), Some(c)) => format!("{name}, merged as `{}`, waiting for a production release.", short_sha(c)),
            _ => format!("{name}, waiting for a production release."),
        },
        FixState::Shipped => match &w.release {
            Some(r) => format!("{name}, shipped in {r}."),
            None => format!("{name}, shipped."),
        },
        FixState::Closed => format!("{name}, closed without merging."),
        FixState::Unwatched => format!("{name}, not watched."),
    };
    if let Some(p) = &w.problem {
        let _ = write!(line, " {p}");
    }
    line
}

/// What happens next to a fix `update_triage` just recorded.
pub fn watch_next(w: &FixWatch, s: &IssueSummary) -> String {
    match (w.state, &w.problem) {
        (FixState::WaitingMerge | FixState::WaitingRelease, None) => format!(
            "bertha is watching {} and will resolve {} when a production release contains it. You don't need to come back.",
            fix_name(w).replacen("Commit", "commit", 1),
            s.short_id
        ),
        (FixState::Shipped, _) => String::new(),
        (_, Some(p)) => format!("{p} update_issue with action fix_shipped does that, and resolves {}.", s.short_id),
        (_, None) => format!(
            "bertha isn't watching it. Once it's deployed, update_issue {} with action fix_shipped.",
            s.short_id
        ),
    }
}

/// `start_triage` and `update_triage`: the triage as it stands.
pub fn triage(t: &Triage, s: &IssueSummary, base: &str) -> String {
    let mut out = String::new();
    let state = match (t.state, t.outcome) {
        (_, Some(o)) => format!("ended: {}", outcome_text(o)),
        (TriageState::Stale, None) => "stale".to_owned(),
        _ => "in progress".to_owned(),
    };
    line!(out, "Triage `{}` of {} ({}), {state}.", t.id.0, s.short_id, issue_link(base, s));
    line!(out, "Started {} by {}; last updated {}.", t.started_at.0, by(&t.by, &t.via), t.updated_at.0);
    triage_fields(&mut out, t);
    out
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
            Activity::Merged { at, by: p, via, from } => {
                line!(out, "- {} {} merged into it by {}.", at.0, from.join(", "), by(p, via));
            }
            Activity::FixShipped { at, by: p, via, pr, commit, release, .. } => {
                let what = match (pr, commit) {
                    (Some(pr), _) => format!("PR #{pr}"),
                    (None, Some(c)) => format!("commit `{}`", short_sha(c)),
                    (None, None) => "the fix".to_owned(),
                };
                let r = release.as_deref().map(|r| format!(" in {r}")).unwrap_or_default();
                match p {
                    Some(p) => line!(out, "- {} {} marked {what} shipped{r}, which resolved it.", at.0, by(p, via)),
                    None => line!(out, "- {} bertha saw {what} ship{r}, which resolved it.", at.0),
                }
            }
            Activity::Labelled { at, by: p, via, added, removed } => {
                let mut what = Vec::new();
                if !added.is_empty() {
                    what.push(format!("labelled {}", added.join(", ")));
                }
                if !removed.is_empty() {
                    what.push(format!("unlabelled {}", removed.join(", ")));
                }
                line!(out, "- {} {} by {}.", at.0, capitalize(&what.join(" and ")), by(p, via));
            }
        }
    }
    if issue.activity.len() > ACTIVITY {
        line!(out, "({} older entries not shown.)", issue.activity.len() - ACTIVITY);
    }
}

/// `list_events`: one line per event, newest first, so an agent can see what varies.
pub fn events(events: &[Event], total: u32, s: &IssueSummary) -> String {
    let mut out = String::new();
    line!(out, "## {} of {total} events of {}, newest first", events.len(), s.short_id);
    line!(out);
    for e in events {
        let mut parts = vec![format!("`{}`", e.id.0), e.received_at.0.clone()];
        parts.push(format!("release {}", e.release.as_deref().unwrap_or("not reported")));
        parts.push(e.environment.to_string());
        if let Some(r) = &e.request {
            let status = r.status.map(|s| format!(" → {s}")).unwrap_or_default();
            parts.push(format!("{} {}{status}", r.method, r.url));
        }
        if let Some(u) = e.user.as_ref().and_then(|u| u.id.as_ref().or(u.email.as_ref()).or(u.ip.as_ref())) {
            parts.push(format!("user {u}"));
        }
        if let Some(x) = &e.exception {
            parts.push(format!("\"{}\"", one_line(&x.message)));
            if let Some(f) = x.frames.iter().find(|f| f.in_app) {
                parts.push(format!("at `{}`", location(f)));
            }
        }
        if !e.tags.is_empty() {
            let tags: Vec<String> = e.tags.iter().map(|(k, v)| format!("{k}={v}")).collect();
            parts.push(tags.join(" "));
        }
        line!(out, "- {}", parts.join(" · "));
    }
    if (events.len() as u32) < total {
        line!(out);
        line!(
            out,
            "({} older events not listed. get_event with \"oldest\" reads the first one.)",
            total as usize - events.len()
        );
    }
    line!(out);
    line!(out, "get_event with issue {} and an event id reads one in full.", s.short_id);
    out
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().chain(c).collect()).unwrap_or_default()
}

pub fn summary_line(s: &IssueSummary, base: &str) -> String {
    let mut assignee = s.assignee.as_ref().map(|p| format!(", assigned to {}", p.name)).unwrap_or_default();
    if let Some(t) = &s.triage {
        let _ = write!(assignee, ", being triaged by {} since {}", by(&t.by, &t.via), t.since.0);
    }
    if !s.labels.is_empty() {
        let _ = write!(assignee, " · labels {}", s.labels.join(", "));
    }
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

/// `briefed`: the projects that have a brief, which get_issue includes.
pub fn projects(d: &ProjectsData, briefed: &[String]) -> String {
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
        if briefed.contains(&p.id.0) {
            line!(out, "  - Has a brief from its owner; get_issue shows it with each issue.");
        }
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
    let label = if r.source == ReleaseSource::Deploy { "Deployed" } else { "Seen" };
    line!(out, "- {label}: {}", release_line(r));
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
