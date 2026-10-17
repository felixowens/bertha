//! Shapes stored as blobs: an event's payload.

use std::collections::BTreeMap;

use bertha_core::domain::{AffectedUser, Breadcrumb, Environment, Event, EventContext, EventException, Level, RequestInfo};
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
    pub breadcrumbs: Vec<Breadcrumb>,
    pub request: Option<RequestInfo>,
    pub user: Option<AffectedUser>,
    pub context: EventContext,
    pub tags: BTreeMap<String, String>,
}

impl StoredEvent {
    pub fn into_event(self, id: EventId, issue_id: IssueId, received_at: Millis) -> Event {
        Event {
            id,
            issue_id,
            received_at: IsoDate::from_millis(received_at),
            release: self.release,
            environment: self.environment,
            level: self.level,
            exception: self.exception,
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
                breadcrumbs: e.breadcrumbs,
                request: e.request,
                user: e.user,
                context: e.context,
                tags: e.tags,
            },
        )
    }
}
