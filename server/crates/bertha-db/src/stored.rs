//! Shapes stored as blobs: an event's payload.

use std::collections::BTreeMap;

use bertha_core::domain::{
    AffectedUser, Breadcrumb, Environment, Event, EventContext, EventException, Level, Mechanism, RequestInfo, Trace,
};
use bertha_core::grouping::is_extension;
use bertha_core::ids::{EventId, IssueId};
use bertha_core::time::{IsoDate, Millis};
use serde::{Deserialize, Serialize};

/// Inflated payloads larger than this are treated as damage. Ingest caps far below.
pub const EVENT_PAYLOAD_LIMIT: usize = 4 * 1024 * 1024;

/// The contract's `Event` without the columns stored beside it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredEvent {
    pub release: Option<String>,
    pub environment: Environment,
    pub level: Level,
    pub exception: Option<EventException>,
    /// Added in 0.5, like the fields of `EventContext` after `user_agent`.
    #[serde(default)]
    pub mechanism: Option<Mechanism>,
    #[serde(default)]
    pub trace: Option<Trace>,
    pub breadcrumbs: Vec<Breadcrumb>,
    pub request: Option<RequestInfo>,
    pub user: Option<AffectedUser>,
    pub context: EventContext,
    pub tags: BTreeMap<String, String>,
}

impl StoredEvent {
    pub fn into_event(mut self, id: EventId, issue_id: IssueId, received_at: Millis) -> Event {
        // Events stored before bertha knew Safari's masked extension URLs called them the app's.
        if let Some(x) = &mut self.exception {
            for f in x.frames.iter_mut().filter(|f| !f.mapped && is_extension(&f.file)) {
                f.in_app = false;
            }
        }
        Event {
            id,
            issue_id,
            received_at: IsoDate::from_millis(received_at),
            release: self.release,
            environment: self.environment,
            level: self.level,
            exception: self.exception,
            mechanism: self.mechanism,
            trace: self.trace,
            breadcrumbs: self.breadcrumbs,
            request: self.request,
            user: self.user,
            context: self.context,
            tags: self.tags,
        }
    }

    pub fn from_event(e: Event) -> (EventId, IssueId, StoredEvent) {
        (
            e.id,
            e.issue_id,
            StoredEvent {
                release: e.release,
                environment: e.environment,
                level: e.level,
                exception: e.exception,
                mechanism: e.mechanism,
                trace: e.trace,
                breadcrumbs: e.breadcrumbs,
                request: e.request,
                user: e.user,
                context: e.context,
                tags: e.tags,
            },
        )
    }
}
