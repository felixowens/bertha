//! Page view models: the `ready` data of each page in `src/contract/pages.ts`.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::*;
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
    pub kpis: OverviewKpis,
    pub projects: Vec<Project>,
    pub attention: Vec<IssueSummary>,
    pub events: LevelSeries,
    pub releases: Vec<Release>,
    pub monitors_down: Vec<Monitor>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueList {
    pub issues: Vec<IssueSummary>,
    pub total: u32,
    pub assignable: Vec<Person>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct IssueDetail {
    pub issue: Issue,
    pub project: Project,
    pub event: Event,
    pub cursor: EventCursor,
    pub history: TimeSeries,
    pub releases: Vec<Release>,
    pub assignable: Vec<Person>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct EventAt {
    pub event: Event,
    pub cursor: EventCursor,
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
    pub new_issues: Vec<IssueSummary>,
    pub regressed_issues: Vec<IssueSummary>,
    pub around: TimeSeries,
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
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct ProjectSettings {
    pub project: Project,
    pub setup: ProjectSetup,
    pub monitor: Option<Monitor>,
    pub members: Vec<Member>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub struct AlertsData {
    pub rules: Vec<AlertRule>,
    pub destinations: Vec<AlertDestination>,
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
