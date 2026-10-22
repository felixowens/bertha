//! The domain nouns, mirroring `src/contract/domain.ts`. `ts-rs` generates
//! `src/api/generated/api.ts` from these and `src/api/contract-check.ts` asserts the
//! two agree, so the server can't drift from the contract.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::ids::*;
use crate::time::IsoDate;

/// Markdown. Used only for notes on issues.
pub type Prose = String;

/// Declares a string enum with its wire names.
macro_rules! string_enum {
    ($(#[$m:meta])* $name:ident { $($variant:ident = $wire:literal),+ $(,)? }) => {
        $(#[$m])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
        #[ts(export, export_to = "src/api/generated/api.ts")]
        pub enum $name {
            $(#[serde(rename = $wire)] $variant),+
        }

        impl $name {
            pub const ALL: &'static [$name] = &[$($name::$variant),+];

            pub fn as_str(self) -> &'static str {
                match self { $($name::$variant => $wire),+ }
            }

            pub fn parse(s: &str) -> Option<Self> {
                match s { $($wire => Some($name::$variant),)+ _ => None }
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str(self.as_str())
            }
        }
    };
}

string_enum!(TimeRange { Day = "24h", Week = "7d", Month = "30d" });
string_enum!(Environment { Production = "production", Staging = "staging", Development = "development" });
string_enum!(Level { Fatal = "fatal", Error = "error", Warning = "warning" });
string_enum!(Bucket { Hour = "hour", Day = "day" });
string_enum!(Runtime { Browser = "browser", Server = "server", Edge = "edge" });
string_enum!(ProjectHealth {
    Down = "down",
    Regressed = "regressed",
    NewIssues = "new_issues",
    Healthy = "healthy",
    AwaitingFirstEvent = "awaiting_first_event",
});
string_enum!(IssueStatus { Unresolved = "unresolved", Resolved = "resolved", Ignored = "ignored", Snoozed = "snoozed" });
string_enum!(TagKey { Url = "url", Browser = "browser", Os = "os", Release = "release", Environment = "environment", User = "user" });
string_enum!(BreadcrumbCategory { Navigation = "navigation", Fetch = "fetch", Click = "click", Console = "console", Log = "log" });
string_enum!(BreadcrumbLevel { Info = "info", Warning = "warning", Error = "error" });
string_enum!(Navigation { Navigate = "navigate", Reload = "reload", BackForward = "back_forward", Prerender = "prerender" });
string_enum!(ReleaseSource { Deploy = "deploy", Heartbeat = "heartbeat", Event = "event" });
string_enum!(MonitorState { Up = "up", Down = "down", Degraded = "degraded", Paused = "paused" });
string_enum!(Role { Owner = "owner", Collaborator = "collaborator" });
string_enum!(AlertTrigger {
    NewIssue = "new_issue",
    Regression = "regression",
    Spike = "spike",
    MonitorDown = "monitor_down",
    MonitorDegraded = "monitor_degraded",
    MonitorRecovered = "monitor_recovered",
    LogMatch = "log_match",
});
string_enum!(IssueSort { LastSeen = "last_seen", FirstSeen = "first_seen", Events = "events", Users = "users" });
string_enum!(AssigneeFilter { Me = "me", Unassigned = "unassigned", Anyone = "anyone" });
string_enum!(
    /// `active`: being triaged now. `never`: no triage was ever started.
    /// `fix_waiting`: not resolved, and the latest triage ended fixed.
    TriageFilter { Active = "active", Never = "never", FixWaiting = "fix_waiting" }
);
string_enum!(InviteStatus { Pending = "pending", Expired = "expired", Used = "used" });
string_enum!(
    /// Lowest first, so `Ord` compares severity.
    LogLevel { Debug = "debug", Info = "info", Warning = "warning", Error = "error", Fatal = "fatal" }
);
string_enum!(LogRange { Hour = "1h", Day = "24h", Week = "7d", Month = "30d" });
string_enum!(LogScope { Trace = "trace", Nearby = "nearby" });

impl Level {
    /// Most severe first, so `min()` of a set is the worst.
    pub fn rank(self) -> u8 {
        match self {
            Level::Fatal => 0,
            Level::Error => 1,
            Level::Warning => 2,
        }
    }
}

impl TimeRange {
    pub fn millis(self) -> crate::time::Millis {
        use crate::time::{DAY, HOUR};
        match self {
            TimeRange::Day => 24 * HOUR,
            TimeRange::Week => 7 * DAY,
            TimeRange::Month => 30 * DAY,
        }
    }
}

/// Bucketed counts, oldest first. `None` = no data at all for that bucket.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TimeSeries {
    pub bucket: Bucket,
    pub start: IsoDate,
    pub counts: Vec<Option<u32>>,
}

/// A `TimeSeries` of percentages, e.g. daily uptime. `None` = no data for that bucket.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct PercentSeries {
    pub bucket: Bucket,
    pub start: IsoDate,
    pub counts: Vec<Option<f64>>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ByLevel {
    pub fatal: Vec<Option<u32>>,
    pub error: Vec<Option<u32>>,
    pub warning: Vec<Option<u32>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LevelSeries {
    pub bucket: Bucket,
    pub start: IsoDate,
    pub by_level: ByLevel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Kpi {
    pub value: f64,
    pub previous: f64,
    pub trend: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Person {
    pub id: MemberId,
    pub name: String,
    pub email: String,
}

// ── Projects ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Project {
    pub id: ProjectId,
    pub key: String,
    pub name: String,
    pub client: Option<String>,
    pub url: Option<String>,
    /// Where the code lives; commits link into it.
    pub repo_url: Option<String>,
    pub runtimes: Vec<Runtime>,
    pub environments: Vec<Environment>,
    pub health: ProjectHealth,
    pub last_event_at: Option<IsoDate>,
    pub events24h: u32,
    pub unresolved_issues: u32,
    /// Oldest first.
    pub monitor_ids: Vec<MonitorId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct SourceMapStatus {
    pub latest_release: Option<String>,
    pub uploaded: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct SetupSnippet {
    pub label: String,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ProjectSetup {
    pub project_id: ProjectId,
    pub ingest_key: String,
    pub snippets: Vec<SetupSnippet>,
    pub first_event_at: Option<IsoDate>,
    pub source_maps: SourceMapStatus,
}

// ── Issues and events ───────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum Snooze {
    Until { until: IsoDate },
    Events { total: u32, remaining: u32 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueSummary {
    pub id: IssueId,
    pub short_id: String,
    pub project_id: ProjectId,
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
    pub culprit: Option<String>,
    pub level: Level,
    pub status: IssueStatus,
    pub snooze: Option<Snooze>,
    pub assignee: Option<Person>,
    pub first_seen: IsoDate,
    pub last_seen: IsoDate,
    pub event_count: u32,
    /// Events within the selected range.
    pub events_in_range: u32,
    pub user_count: u32,
    pub environments: Vec<Environment>,
    pub trend: TimeSeries,
    pub is_new: bool,
    pub is_regression: bool,
    /// Who is triaging it now; `None` unless a triage is active (not stale).
    pub triage: Option<TriageClaim>,
    /// Sorted.
    pub labels: Vec<String>,
    /// The latest triage's fix while the issue isn't resolved.
    pub fix: Option<FixClaim>,
}

/// An issue's waiting (or shipped) fix, for the list.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct FixClaim {
    pub pr: Option<u32>,
    pub state: FixState,
}

string_enum!(
    /// How a fixed triage's change is getting to production.
    FixState {
        WaitingMerge = "waiting_merge",
        WaitingRelease = "waiting_release",
        Shipped = "shipped",
        Closed = "closed",
        Unwatched = "unwatched",
    }
);

string_enum!(
    /// Whether bertha follows a project's fixes on GitHub, and if not, why not.
    FixWatching { On = "on", Off = "off", NoToken = "no_token", NotGithub = "not_github", NoRepo = "no_repo" }
);

/// bertha following a fix from its PR to a production release.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct FixWatch {
    pub pr: Option<u32>,
    /// The commit the triage named, or the PR's merge commit once it merged.
    pub commit: Option<String>,
    pub state: FixState,
    /// Where it shipped.
    pub release: Option<String>,
    /// Why bertha isn't following it, or what GitHub last answered.
    pub problem: Option<String>,
}

/// Someone on an issue right now.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TriageClaim {
    pub by: Person,
    pub via: Option<String>,
    pub since: IsoDate,
}

string_enum!(
    /// `stale`: active, but with no update for two hours.
    TriageState { Active = "active", Stale = "stale", Done = "done" }
);
string_enum!(TriageOutcome {
    Fixed = "fixed",
    NotABug = "not_a_bug",
    CantFix = "cant_fix",
    NeedsData = "needs_data",
    Abandoned = "abandoned",
});

/// One go at an issue and what came of it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Triage {
    pub id: TriageId,
    pub by: Person,
    /// The access token's name when an agent did it.
    pub via: Option<String>,
    pub started_at: IsoDate,
    pub updated_at: IsoDate,
    pub state: TriageState,
    pub outcome: Option<TriageOutcome>,
    /// The cause and what was learned, including data bertha didn't have.
    pub found: Option<Prose>,
    /// What was tried that didn't work.
    pub tried: Option<Prose>,
    /// The change, with its PR or commit.
    pub fix: Option<Prose>,
    /// The release the issue was on when the triage started.
    pub release: Option<String>,
    /// How the fix is getting to production; `None` unless the outcome is fixed.
    pub watch: Option<FixWatch>,
}

/// A label is at most this long.
pub const LABEL_CHARS: usize = 32;
/// An issue has at most this many labels.
pub const LABELS_PER_ISSUE: usize = 10;
/// A triage with no update for this long is stale: anyone can start over it.
pub const TRIAGE_STALE_MS: i64 = 2 * 60 * 60 * 1000;

/// A label as stored: trimmed and lowercased, with spaces and underscores made dashes.
/// `None` when it is empty, too long, or has anything but letters, digits and dashes.
pub fn normalize_label(raw: &str) -> Option<String> {
    let lower = raw.to_lowercase();
    let label = lower
        .split(|c: char| c.is_whitespace() || c == '_' || c == '-')
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let ok = !label.is_empty()
        && label.chars().count() <= LABEL_CHARS
        && label.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    ok.then_some(label)
}

/// A label in use, and on how many issues.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LabelCount {
    pub name: String,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TagValue {
    pub value: String,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TagBreakdown {
    /// A [`TagKey`], or a tag the app sent with its events.
    pub key: String,
    pub distinct: u32,
    pub values: Vec<TagValue>,
}

string_enum!(UnsnoozeReason { DatePassed = "date_passed", EventThreshold = "event_threshold" });

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum Activity {
    FirstSeen {
        at: IsoDate,
        release: Option<String>,
    },
    Regressed {
        at: IsoDate,
        release: Option<String>,
    },
    Resolved {
        at: IsoDate,
        by: Person,
        /// The access token an agent did it with; absent when the person did it.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
    },
    Ignored {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
    },
    Reopened {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
    },
    Snoozed {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
        snooze: Snooze,
    },
    Unsnoozed {
        at: IsoDate,
        reason: UnsnoozeReason,
    },
    Assigned {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
        to: Option<Person>,
    },
    Note {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
        body: Prose,
    },
    /// On the issue that was kept: the short ids of the issues folded into it.
    Merged {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
        from: Vec<String>,
    },
    Labelled {
        at: IsoDate,
        by: Person,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
        added: Vec<String>,
        removed: Vec<String>,
    },
    /// A triage's fix reached `release`, which resolved the issue. `by` is `None` when
    /// bertha saw it ship.
    FixShipped {
        at: IsoDate,
        by: Option<Person>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        via: Option<String>,
        #[serde(rename = "triageId")]
        triage_id: TriageId,
        pr: Option<u32>,
        commit: Option<String>,
        release: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Issue {
    #[serde(flatten)]
    pub summary: IssueSummary,
    pub first_release: Option<String>,
    pub regressed_in: Option<String>,
    pub tags: Vec<TagBreakdown>,
    /// Newest first.
    pub triages: Vec<Triage>,
    pub activity: Vec<Activity>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct FrameContext {
    pub start_line: u32,
    pub lines: Vec<String>,
    pub highlight: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct StackFrame {
    pub file: String,
    pub function: Option<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub in_app: bool,
    pub mapped: bool,
    pub context: Option<FrameContext>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Breadcrumb {
    pub at: IsoDate,
    pub category: BreadcrumbCategory,
    pub level: BreadcrumbLevel,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AffectedUser {
    pub id: Option<String>,
    pub email: Option<String>,
    pub ip: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
#[serde(rename_all = "camelCase")]
pub struct EventException {
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
    pub frames: Vec<StackFrame>,
    /// The error's own fields (`code`, `status`…), stringified. Events stored before
    /// 0.5 have none.
    #[serde(default)]
    pub data: BTreeMap<String, String>,
    /// React's component stack, from an error boundary.
    #[serde(default)]
    pub component_stack: Option<String>,
}

/// How an error reached the SDK. `handled: false` means nothing in the app caught it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Mechanism {
    pub handler: String,
    pub handled: bool,
}

/// W3C trace context: events sharing a trace id came from the same page load or request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Trace {
    pub trace_id: String,
    pub span_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct RequestInfo {
    pub method: String,
    pub url: String,
    pub status: Option<u32>,
    /// Server-side only, without credentials.
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
}

/// Where the error happened. Every field after `user_agent` came with SDK 0.5, so
/// older stored events default them.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventContext {
    pub browser: Option<String>,
    pub os: Option<String>,
    pub runtime: Option<String>,
    pub user_agent: Option<String>,
    #[serde(default)]
    pub viewport: Option<String>,
    #[serde(default)]
    pub online: Option<bool>,
    #[serde(default)]
    pub visible: Option<bool>,
    #[serde(default)]
    pub navigation: Option<Navigation>,
    #[serde(default)]
    pub automated: Option<bool>,
    #[serde(default)]
    pub page_age_ms: Option<u32>,
    #[serde(default)]
    pub referrer: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub connection: Option<String>,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub versions: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Event {
    pub id: EventId,
    pub issue_id: IssueId,
    pub received_at: IsoDate,
    pub release: Option<String>,
    pub environment: Environment,
    pub level: Level,
    pub exception: Option<EventException>,
    pub mechanism: Option<Mechanism>,
    pub trace: Option<Trace>,
    pub breadcrumbs: Vec<Breadcrumb>,
    pub request: Option<RequestInfo>,
    pub user: Option<AffectedUser>,
    pub context: EventContext,
    pub tags: BTreeMap<String, String>,
}

/// An event of another issue on the same trace (the page load or request).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct RelatedEvent {
    pub issue: IssueSummary,
    pub event_id: EventId,
    pub received_at: IsoDate,
}

string_enum!(SpanKind { Server = "server", Client = "client", Internal = "internal", Producer = "producer", Consumer = "consumer" });
string_enum!(SpanStatus { Ok = "ok", Error = "error", Unset = "unset" });

/// The issue an event on a span belongs to: enough to name and link it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TraceIssue {
    pub id: IssueId,
    pub short_id: String,
    pub level: Level,
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct SpanEvent {
    pub event_id: EventId,
    pub issue: TraceIssue,
}

/// One span of a kept trace, sent by the apps over OTLP. Times are milliseconds from the
/// trace's start.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TraceSpan {
    pub id: String,
    pub parent_id: Option<String>,
    /// `None` for a project the viewer can't see; then `name` and `service` are empty.
    pub project_id: Option<ProjectId>,
    pub service: String,
    pub runtime: Runtime,
    pub name: String,
    pub kind: SpanKind,
    pub start_ms: f64,
    pub duration_ms: f64,
    pub status: SpanStatus,
    pub status_message: Option<String>,
    pub attributes: BTreeMap<String, String>,
    pub event: Option<SpanEvent>,
    /// The host of a failed call into a service that sent no spans for it.
    pub silent: Option<String>,
}

/// The spans of an event's trace, kept because an error happened in it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventTrace {
    pub trace_id: String,
    pub started_at: IsoDate,
    pub duration_ms: f64,
    /// Parents before children, siblings by start.
    pub spans: Vec<TraceSpan>,
    /// Spans past the ones shown.
    pub truncated: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventCursor {
    pub index: u32,
    pub total: u32,
    pub newer_id: Option<EventId>,
    pub older_id: Option<EventId>,
}

// ── Logs ────────────────────────────────────────────────────────────────

impl LogLevel {
    /// Its place, lowest first: 0 is debug, 4 fatal. Stored as this, so "this level and
    /// above" is a range.
    pub fn rank(self) -> i64 {
        self as i64
    }

    pub fn from_rank(n: i64) -> Option<LogLevel> {
        usize::try_from(n).ok().and_then(|n| LogLevel::ALL.get(n).copied())
    }

    /// From an OTel severity number (1–24); `None` outside it.
    pub fn from_severity(n: i32) -> Option<LogLevel> {
        match n {
            1..=8 => Some(LogLevel::Debug),
            9..=12 => Some(LogLevel::Info),
            13..=16 => Some(LogLevel::Warning),
            17..=20 => Some(LogLevel::Error),
            21..=24 => Some(LogLevel::Fatal),
            _ => None,
        }
    }

    /// From a severity name as loggers write it: `WARN`, `Warning`, `err`, `trace`…
    pub fn from_text(s: &str) -> Option<LogLevel> {
        match s.trim().to_ascii_lowercase().as_str() {
            "trace" | "debug" | "verbose" | "fine" | "finer" | "finest" => Some(LogLevel::Debug),
            "info" | "information" | "informational" | "notice" | "log" => Some(LogLevel::Info),
            "warn" | "warning" => Some(LogLevel::Warning),
            "error" | "err" | "severe" => Some(LogLevel::Error),
            "fatal" | "critical" | "crit" | "alert" | "emergency" | "emerg" | "panic" => Some(LogLevel::Fatal),
            _ => None,
        }
    }
}

impl LogRange {
    pub fn millis(self) -> crate::time::Millis {
        use crate::time::{DAY, HOUR};
        match self {
            LogRange::Hour => HOUR,
            LogRange::Day => 24 * HOUR,
            LogRange::Week => 7 * DAY,
            LogRange::Month => 30 * DAY,
        }
    }

    /// The volume chart's bucket: 1 minute, 15 minutes, 2 hours, 8 hours.
    pub fn bucket_seconds(self) -> u32 {
        match self {
            LogRange::Hour => 60,
            LogRange::Day => 900,
            LogRange::Week => 7200,
            LogRange::Month => 28800,
        }
    }
}

/// The issue event a log line was also reported as.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogEventRef {
    pub issue_id: IssueId,
    pub event_id: EventId,
}

/// One line an app logged, sent by an SDK or over OTLP.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogLine {
    pub id: String,
    pub project_id: ProjectId,
    pub at: IsoDate,
    pub level: LogLevel,
    pub message: String,
    pub fields: BTreeMap<String, String>,
    pub service: Option<String>,
    pub release: Option<String>,
    pub environment: Environment,
    pub trace_id: Option<String>,
    pub span_id: Option<String>,
    /// `None` when the line names no event, or one the viewer can't see.
    pub event: Option<LogEventRef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogFilter {
    /// Empty = every project the viewer can see.
    pub project_ids: Vec<ProjectId>,
    pub min_level: LogLevel,
    pub query: String,
    pub range: LogRange,
    /// The range ends here; `None` = now.
    pub until: Option<IsoDate>,
    pub pattern_id: Option<String>,
}

/// Lines per bucket and level. `None` = no logs kept for that bucket.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogByLevel {
    pub debug: Vec<Option<u32>>,
    pub info: Vec<Option<u32>>,
    pub warning: Vec<Option<u32>>,
    pub error: Vec<Option<u32>>,
    pub fatal: Vec<Option<u32>>,
}

impl LogByLevel {
    pub fn of(&self, level: LogLevel) -> &[Option<u32>] {
        match level {
            LogLevel::Debug => &self.debug,
            LogLevel::Info => &self.info,
            LogLevel::Warning => &self.warning,
            LogLevel::Error => &self.error,
            LogLevel::Fatal => &self.fatal,
        }
    }

    pub fn of_mut(&mut self, level: LogLevel) -> &mut Vec<Option<u32>> {
        match level {
            LogLevel::Debug => &mut self.debug,
            LogLevel::Info => &mut self.info,
            LogLevel::Warning => &mut self.warning,
            LogLevel::Error => &mut self.error,
            LogLevel::Fatal => &mut self.fatal,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogVolume {
    pub start: IsoDate,
    pub bucket_seconds: u32,
    pub by_level: LogByLevel,
}

/// Lines a project sent past its rate cap.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogDrop {
    pub project_id: ProjectId,
    pub lines: u32,
    pub since: IsoDate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogList {
    /// Oldest first.
    pub lines: Vec<LogLine>,
    pub older: Option<String>,
    pub newer: String,
    /// Counted up to 10,000.
    pub total: u32,
    pub volume: LogVolume,
    pub dropped: Vec<LogDrop>,
}

/// Lines with the same message once the parts that vary are replaced.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogPattern {
    pub id: String,
    pub project_id: ProjectId,
    pub template: String,
    pub level: LogLevel,
    pub count: u32,
    pub counts: Vec<Option<u32>>,
    pub first_seen: IsoDate,
    pub last_seen: IsoDate,
    pub sample: LogLine,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogPatternList {
    pub patterns: Vec<LogPattern>,
    pub volume: LogVolume,
}

/// The lines around one event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventLogs {
    pub scope: LogScope,
    pub lines: Vec<LogLine>,
    pub event_line_id: Option<String>,
    pub from: IsoDate,
    pub to: IsoDate,
    pub project_has_logs: bool,
}

/// Alert when a log search matches this many lines within the window.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogMatch {
    pub query: String,
    pub min_level: LogLevel,
    pub count: u32,
    pub within_minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ProjectLogSettings {
    pub min_level: LogLevel,
    /// 1 to 90.
    pub retention_days: u32,
}

impl Default for ProjectLogSettings {
    fn default() -> Self {
        ProjectLogSettings { min_level: LogLevel::Info, retention_days: 14 }
    }
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct LogUsage {
    pub lines: u32,
    pub bytes: u32,
    pub oldest: Option<IsoDate>,
    pub dropped_today: u32,
}

// ── Releases ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Commit {
    pub sha: String,
    pub message: String,
    pub author: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Release {
    pub id: ReleaseId,
    pub project_id: ProjectId,
    pub version: String,
    pub environment: Environment,
    /// When it went out; for `Event` and `Heartbeat` sources, when bertha first saw it.
    pub deployed_at: IsoDate,
    pub source: ReleaseSource,
    pub commit: Option<Commit>,
    pub new_issues: u32,
    pub regressed_issues: u32,
    pub quiet_since_deploy: u32,
    pub event_count: u32,
}

// ── Uptime ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Monitor {
    pub id: MonitorId,
    pub project_id: ProjectId,
    pub name: String,
    pub url: String,
    pub interval_seconds: u32,
    pub state: MonitorState,
    pub since: IsoDate,
    pub uptime30d: f64,
    pub latest_response_ms: Option<u32>,
    pub recent: Vec<Option<MonitorState>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct UptimeCheck {
    pub at: IsoDate,
    pub ok: bool,
    pub http_status: Option<u32>,
    pub response_ms: Option<u32>,
    pub error: Option<String>,
    pub region: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Incident {
    pub id: IncidentId,
    pub started_at: IsoDate,
    pub resolved_at: Option<IsoDate>,
    pub cause: String,
    pub failed_checks: u32,
}

// ── People and alerts ───────────────────────────────────────────────────

/// Which projects someone can see, or a rule applies to: every project, or a list.
/// On the wire: `"all"` or `["p_…", …]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectIds {
    All,
    Some(Vec<ProjectId>),
}

impl ProjectIds {
    pub fn contains(&self, id: &ProjectId) -> bool {
        match self {
            ProjectIds::All => true,
            ProjectIds::Some(ids) => ids.contains(id),
        }
    }
}

impl Serialize for ProjectIds {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            ProjectIds::All => s.serialize_str("all"),
            ProjectIds::Some(ids) => ids.serialize(s),
        }
    }
}

impl<'de> Deserialize<'de> for ProjectIds {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Wire {
            Str(String),
            List(Vec<ProjectId>),
        }
        match Wire::deserialize(d)? {
            Wire::Str(s) if s == "all" => Ok(ProjectIds::All),
            Wire::Str(s) => Err(serde::de::Error::custom(format!("expected \"all\" or a list, got \"{s}\""))),
            Wire::List(ids) => Ok(ProjectIds::Some(ids)),
        }
    }
}

impl TS for ProjectIds {
    type WithoutGenerics = Self;
    type OptionInnerType = Self;
    fn name(_: &ts_rs::Config) -> String {
        "string[] | \"all\"".to_owned()
    }
    fn inline(cfg: &ts_rs::Config) -> String {
        Self::name(cfg)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Member {
    pub id: MemberId,
    pub name: String,
    pub email: String,
    pub role: Role,
    pub project_ids: ProjectIds,
    pub joined_at: Option<IsoDate>,
    /// When the current invitation was sent; `None` once joined.
    pub invited_at: Option<IsoDate>,
    /// When the current invitation stops working (may be past); `None` once joined.
    pub invite_expires_at: Option<IsoDate>,
}

impl Member {
    pub fn person(&self) -> Person {
        Person { id: self.id.clone(), name: self.name.clone(), email: self.email.clone() }
    }
}

/// Lets an agent reach the MCP endpoint as the member who made it. Only its hash is kept.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AccessToken {
    pub id: AccessTokenId,
    pub name: String,
    pub created_at: IsoDate,
    pub last_used_at: Option<IsoDate>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum AgentReportKind {
    /// bertha got in the agent's way.
    Problem,
    /// Something bertha doesn't do yet.
    Request,
}

impl AgentReportKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AgentReportKind::Problem => "problem",
            AgentReportKind::Request => "request",
        }
    }
}

/// The issue an agent was working on when it reported.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ReportIssue {
    pub id: IssueId,
    pub short_id: String,
}

/// An agent telling the owner that bertha itself got in its way, or asking for more.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AgentReport {
    pub id: AgentReportId,
    pub kind: AgentReportKind,
    pub summary: String,
    pub details: String,
    pub tool: Option<String>,
    /// `None` if there was none, or the viewer can no longer see it.
    pub issue: Option<ReportIssue>,
    /// The bertha version that served the agent.
    pub version: String,
    pub by: Person,
    /// The access token's name.
    pub via: String,
    pub at: IsoDate,
    pub done: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum AlertDestination {
    Email { id: DestinationId, address: String },
    Webhook { id: DestinationId, label: String, url: String },
}

impl AlertDestination {
    pub fn id(&self) -> &DestinationId {
        match self {
            AlertDestination::Email { id, .. } | AlertDestination::Webhook { id, .. } => id,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Spike {
    pub events: u32,
    pub within_minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AlertRule {
    pub id: AlertRuleId,
    pub name: String,
    pub project_ids: ProjectIds,
    pub environments: Vec<Environment>,
    pub triggers: Vec<AlertTrigger>,
    pub spike: Option<Spike>,
    pub log_match: Option<LogMatch>,
    pub destination_ids: Vec<DestinationId>,
    pub enabled: bool,
    pub last_fired_at: Option<IsoDate>,
}

/// One alert bertha tried to send.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AlertDelivery {
    pub id: String,
    pub at: IsoDate,
    pub rule_id: AlertRuleId,
    pub destination_id: DestinationId,
    pub ok: bool,
    /// Why it failed, in plain words.
    pub error: Option<String>,
    /// What it was about, e.g. "New issue KILN-4F in Kiln & Clay".
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueFilter {
    pub project_ids: Vec<ProjectId>,
    pub status: StatusFilter,
    pub levels: Vec<Level>,
    pub environment: EnvironmentFilter,
    pub assignee: AssigneeFilter,
    pub query: String,
    pub sort: IssueSort,
    /// Only issues seen within the range.
    pub range: TimeRange,
    /// Only issues first seen within the range: what the New issues card counts.
    #[serde(default, skip_serializing_if = "Option::is_none", with = "only_true")]
    #[ts(optional, type = "true")]
    pub new_in_range: Option<bool>,
    /// Only these issues (a triage queue); the other fields still apply.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ids: Option<Vec<IssueId>>,
    /// Issues with every one of these labels.
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub triage: Option<TriageFilter>,
}

impl IssueFilter {
    pub fn new_in_range(&self) -> bool {
        self.new_in_range == Some(true)
    }
}

/// `true` or absent on the wire; `false` reads as absent.
pub(crate) mod only_true {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(v: &Option<bool>, s: S) -> Result<S::Ok, S::Error> {
        match v {
            Some(true) => s.serialize_bool(true),
            _ => s.serialize_none(),
        }
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Option<bool>, D::Error> {
        Ok(Option::<bool>::deserialize(d)?.filter(|b| *b))
    }
}

impl Default for IssueFilter {
    fn default() -> Self {
        Self {
            project_ids: vec![],
            status: StatusFilter::Is(IssueStatus::Unresolved),
            levels: vec![],
            environment: EnvironmentFilter::ANY,
            assignee: AssigneeFilter::Anyone,
            query: String::new(),
            sort: IssueSort::LastSeen,
            range: TimeRange::Week,
            new_in_range: None,
            ids: None,
            labels: vec![],
            triage: None,
        }
    }
}

/// A status or `"all"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(untagged)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum StatusFilter {
    Is(IssueStatus),
    All(AllLiteral),
}

/// An environment or `"all"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(untagged)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum EnvironmentFilter {
    Is(Environment),
    All(AllLiteral),
}

impl StatusFilter {
    pub const ANY: Self = Self::All(AllLiteral::All);
}

impl EnvironmentFilter {
    pub const ANY: Self = Self::All(AllLiteral::All);
}

string_enum!(AllLiteral { All = "all" });

/// `Partial<IssueFilter>`: what a saved view sets.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueFilterPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub project_ids: Option<Vec<ProjectId>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub status: Option<StatusFilter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub levels: Option<Vec<Level>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub environment: Option<EnvironmentFilter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub assignee: Option<AssigneeFilter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub sort: Option<IssueSort>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub range: Option<TimeRange>,
    #[serde(default, skip_serializing_if = "Option::is_none", with = "only_true")]
    #[ts(optional, type = "true")]
    pub new_in_range: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ids: Option<Vec<IssueId>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub labels: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub triage: Option<TriageFilter>,
}

impl IssueFilterPatch {
    /// The default filter with this patch applied.
    pub fn apply(&self, mut f: IssueFilter) -> IssueFilter {
        if let Some(v) = &self.project_ids {
            f.project_ids = v.clone();
        }
        if let Some(v) = self.status {
            f.status = v;
        }
        if let Some(v) = &self.levels {
            f.levels = v.clone();
        }
        if let Some(v) = self.environment {
            f.environment = v;
        }
        if let Some(v) = self.assignee {
            f.assignee = v;
        }
        if let Some(v) = &self.query {
            f.query = v.clone();
        }
        if let Some(v) = self.sort {
            f.sort = v;
        }
        if let Some(v) = self.range {
            f.range = v;
        }
        if self.new_in_range.is_some() {
            f.new_in_range = self.new_in_range;
        }
        if let Some(v) = &self.ids {
            f.ids = Some(v.clone());
        }
        if let Some(v) = &self.labels {
            f.labels = v.clone();
        }
        if self.triage.is_some() {
            f.triage = self.triage;
        }
        f
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct SavedView {
    pub id: String,
    pub name: String,
    pub count: u32,
    pub filter: IssueFilterPatch,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_are_lowercase_words_joined_by_dashes() {
        assert_eq!(normalize_label("  Flaky Network ").as_deref(), Some("flaky-network"));
        assert_eq!(normalize_label("third_party").as_deref(), Some("third-party"));
        assert_eq!(normalize_label("a  --  b").as_deref(), Some("a-b"));
        assert_eq!(normalize_label("-edge-").as_deref(), Some("edge"));
        assert_eq!(normalize_label("v2").as_deref(), Some("v2"));
        assert_eq!(normalize_label(&"x".repeat(32)).map(|l| l.len()), Some(32));
        for bad in ["", " - ", "no/slash", "café", &"x".repeat(33)] {
            assert_eq!(normalize_label(bad), None, "{bad:?}");
        }
    }
}
