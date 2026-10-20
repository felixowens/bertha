//! Page view models: the `ready` data of each page in `src/contract/pages.ts`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::*;
use crate::ids::AlertRuleId;
use crate::time::IsoDate;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ShellCounts {
    pub unresolved: u32,
    pub assigned_to_me: u32,
    pub monitors_down: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ShellData {
    pub viewer: Member,
    pub projects: Vec<Project>,
    pub saved_views: Vec<SavedView>,
    pub counts: ShellCounts,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct OverviewKpis {
    pub events: Kpi,
    pub new_issues: Kpi,
    pub regressions: Kpi,
    pub uptime: Kpi,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct OverviewData {
    pub range: TimeRange,
    /// The project this overview is limited to; `None` for all projects.
    pub project: Option<Project>,
    /// That project's brief; `None` for all projects or when it has none.
    pub brief: Option<Prose>,
    pub kpis: OverviewKpis,
    pub projects: Vec<Project>,
    /// Events per project within the range, keyed by project id.
    pub project_events: BTreeMap<String, u32>,
    pub attention: Vec<IssueSummary>,
    /// Hourly for 24h, daily for 7d and 30d.
    pub events: LevelSeries,
    pub releases: Vec<Release>,
    /// Down and degraded, worst first.
    pub monitors_attention: Vec<Monitor>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ProjectsData {
    /// Worst health first.
    pub projects: Vec<Project>,
    pub project_events: BTreeMap<String, u32>,
    pub monitors: Vec<Monitor>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueList {
    pub issues: Vec<IssueSummary>,
    pub total: u32,
    pub assignable: Vec<Person>,
    /// Labels on the issues the viewer can see in these projects, most used first.
    pub labels: Vec<LabelCount>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueDetail {
    pub issue: Issue,
    pub project: Project,
    pub event: Event,
    pub cursor: EventCursor,
    pub related: Vec<RelatedEvent>,
    pub history: TimeSeries,
    pub releases: Vec<Release>,
    pub assignable: Vec<Person>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventAt {
    pub event: Event,
    pub cursor: EventCursor,
    pub related: Vec<RelatedEvent>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ReleaseList {
    pub releases: Vec<Release>,
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ReleaseDetail {
    pub release: Release,
    pub project: Project,
    pub previous: Option<Release>,
    /// The next deploy of the same project to the same environment.
    pub next: Option<Release>,
    pub new_issues: Vec<IssueSummary>,
    pub regressed_issues: Vec<IssueSummary>,
    /// Issues resolved before this deploy that stayed quiet since.
    pub held_fixes: Vec<IssueSummary>,
    pub around: TimeSeries,
    /// Whole hours after the deploy that have passed, 0–24.
    pub after_hours: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct UptimeData {
    pub monitors: Vec<Monitor>,
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct MonitorDetail {
    pub monitor: Monitor,
    pub project: Project,
    pub checks: Vec<UptimeCheck>,
    pub incidents: Vec<Incident>,
    pub response_times: TimeSeries,
    pub related_issues: Vec<IssueSummary>,
    /// Daily uptime over 90 days; `None` where it was paused or didn't exist.
    pub uptime_by_day: PercentSeries,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ProjectSettings {
    pub project: Project,
    pub brief: Option<Prose>,
    pub watch_fixes: bool,
    pub fix_watching: FixWatching,
    pub setup: ProjectSetup,
    /// Oldest first.
    pub monitors: Vec<Monitor>,
    pub members: Vec<Member>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AlertsData {
    pub rules: Vec<AlertRule>,
    pub destinations: Vec<AlertDestination>,
    /// The last 50, newest first.
    pub deliveries: Vec<AlertDelivery>,
    pub projects: Vec<Project>,
    pub environments: Vec<Environment>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct TeamData {
    pub members: Vec<Member>,
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AgentsData {
    /// The viewer's own tokens, newest first.
    pub tokens: Vec<AccessToken>,
    /// Newest first: every report for the owner, the viewer's own otherwise.
    pub reports: Vec<AgentReport>,
    pub mcp_url: String,
}

/// A token just made, with the secret shown this once.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct CreatedToken {
    pub token: AccessToken,
    pub secret: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct InviteData {
    pub status: InviteStatus,
    pub invited_by: Person,
    pub email: String,
    pub project_names: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EmailLinkHandoff {
    pub sent_to: String,
    pub returns_to: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct CreatedProject {
    pub project: Project,
    pub setup: ProjectSetup,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct Delivered {
    pub delivered_at: IsoDate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct DestinationDeleted {
    /// Rules left with nowhere to send, now turned off.
    pub rules_turned_off: Vec<AlertRuleId>,
}
