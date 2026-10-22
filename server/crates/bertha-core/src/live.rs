//! What `GET /api/v1/live` streams: small nudges that something changed, so open
//! pages can refetch what they show. `src/contract`'s `LiveEvent`; the app reads it
//! through `Backend.subscribe`.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::MonitorState;
use crate::ids::{IssueId, MonitorId, ProjectId};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
#[ts(export, export_to = "src/api/generated/api.ts")]
pub enum LiveEvent {
    /// A batch of events landed in one project.
    Ingested {
        project_id: ProjectId,
        events: u32,
        /// Issues seen for the first time.
        new_issues: Vec<IssueId>,
        /// Resolved issues that came back.
        regressed: Vec<IssueId>,
        /// Every other issue that got events, including ignored and snoozed ones.
        touched: Vec<IssueId>,
    },
    /// Someone triaged, noted or assigned issues in one project.
    IssuesChanged { project_id: ProjectId, issue_ids: Vec<IssueId> },
    /// Log lines arrived in one project; at most once a second each.
    Logs { project_id: ProjectId, lines: u32 },
    /// A monitor went up, down or degraded.
    Monitor { project_id: ProjectId, monitor_id: MonitorId, state: MonitorState },
    /// This stream fell behind and missed changes: refetch everything on screen.
    Resync,
}

impl LiveEvent {
    /// Whether a viewer who sees these projects should hear about this. Each event
    /// names one project, so nothing about another project's issues can leak.
    pub fn visible_to(&self, can_see: impl Fn(&ProjectId) -> bool) -> bool {
        match self {
            LiveEvent::Ingested { project_id, .. }
            | LiveEvent::IssuesChanged { project_id, .. }
            | LiveEvent::Logs { project_id, .. }
            | LiveEvent::Monitor { project_id, .. } => can_see(project_id),
            LiveEvent::Resync => true,
        }
    }
}
