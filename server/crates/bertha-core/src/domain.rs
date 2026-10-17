//! The domain nouns, mirroring `packet/contract/domain.ts`. `ts-rs` generates
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
string_enum!(DayBucket { Day = "day" });
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
string_enum!(MonitorState { Up = "up", Down = "down", Degraded = "degraded", Paused = "paused" });
string_enum!(Role { Owner = "owner", Collaborator = "collaborator" });
string_enum!(AlertTrigger {
    NewIssue = "new_issue",
    Regression = "regression",
    Spike = "spike",
    MonitorDown = "monitor_down",
    MonitorRecovered = "monitor_recovered",
});
string_enum!(IssueSort { LastSeen = "last_seen", FirstSeen = "first_seen", Events = "events", Users = "users" });
string_enum!(AssigneeFilter { Me = "me", Unassigned = "unassigned", Anyone = "anyone" });
string_enum!(InviteStatus { Pending = "pending", Expired = "expired", Used = "used" });

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
    pub bucket: DayBucket,
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
    pub runtimes: Vec<Runtime>,
    pub environments: Vec<Environment>,
    pub health: ProjectHealth,
    pub last_event_at: Option<IsoDate>,
    pub events24h: u32,
    pub unresolved_issues: u32,
    pub monitor_id: Option<MonitorId>,
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
pub struct ProjectSetup {
    pub project_id: ProjectId,
    pub ingest_key: String,
    pub snippet: String,
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
    pub user_count: u32,
    pub environments: Vec<Environment>,
    pub trend: TimeSeries,
    pub is_new: bool,
    pub is_regression: bool,
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
    pub key: TagKey,
    pub distinct: u32,
    pub values: Vec<TagValue>,
}

string_enum!(UnsnoozeReason { DatePassed = "date_passed", EventThreshold = "event_threshold" });

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum Activity {
    FirstSeen { at: IsoDate, release: Option<String> },
    Regressed { at: IsoDate, release: Option<String> },
    Resolved { at: IsoDate, by: Person },
    Ignored { at: IsoDate, by: Person },
    Reopened { at: IsoDate, by: Person },
    Snoozed { at: IsoDate, by: Person, snooze: Snooze },
    Unsnoozed { at: IsoDate, reason: UnsnoozeReason },
    Assigned { at: IsoDate, by: Person, to: Option<Person> },
    Note { at: IsoDate, by: Person, body: Prose },
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
pub struct EventException {
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
    pub frames: Vec<StackFrame>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct RequestInfo {
    pub method: String,
    pub url: String,
    pub status: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventContext {
    pub browser: Option<String>,
    pub os: Option<String>,
    pub runtime: Option<String>,
    pub user_agent: Option<String>,
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
    pub breadcrumbs: Vec<Breadcrumb>,
    pub request: Option<RequestInfo>,
    pub user: Option<AffectedUser>,
    pub context: EventContext,
    pub tags: BTreeMap<String, String>,
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
    pub deployed_at: IsoDate,
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
}

impl Member {
    pub fn person(&self) -> Person {
        Person { id: self.id.clone(), name: self.name.clone(), email: self.email.clone() }
    }
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
    pub destination_ids: Vec<DestinationId>,
    pub enabled: bool,
    pub last_fired_at: Option<IsoDate>,
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
    pub range: TimeRange,
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
