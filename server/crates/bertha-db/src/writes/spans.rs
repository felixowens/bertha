//! Spans from OTLP. Stored as sent (bounded by `bertha-ingest`); most go after an hour,
//! see [`Db::sweep`].

use std::collections::BTreeMap;

use bertha_core::domain::{Runtime, SpanKind, SpanStatus};
use bertha_core::ids::ProjectId;
use bertha_core::time::Millis;
use sqlx::SqliteConnection;

use crate::{Db, Result};

/// One span, ready to store.
#[derive(Debug, Clone, PartialEq)]
pub struct NewSpan {
    pub trace_id: String,
    pub span_id: String,
    pub parent_id: Option<String>,
    pub service: String,
    pub runtime: Runtime,
    pub name: String,
    pub kind: SpanKind,
    /// Microseconds since the epoch.
    pub start_us: i64,
    pub duration_us: i64,
    pub status: SpanStatus,
    pub status_message: Option<String>,
    pub attributes: BTreeMap<String, String>,
}

impl Db {
    /// Stores a batch. A span sent again keeps the first copy, unless it got longer: the
    /// browser resends its page span as the page goes on.
    /// Returns how many were new or grew.
    pub async fn save_spans(&self, project: &ProjectId, spans: &[NewSpan], received_at: Millis) -> Result<u64> {
        let mut tx = self.write.begin().await?;
        let mut saved = 0;
        for s in spans {
            saved += insert_span(&mut tx, project, s, received_at).await?;
        }
        tx.commit().await?;
        Ok(saved)
    }
}

pub(crate) async fn insert_span(
    conn: &mut SqliteConnection,
    project: &ProjectId,
    s: &NewSpan,
    received_at: Millis,
) -> Result<u64> {
    let attributes = serde_json::to_string(&s.attributes)?;
    let (runtime, kind, status) = (s.runtime.as_str(), s.kind.as_str(), s.status.as_str());
    let done = sqlx::query!(
        "INSERT INTO spans (project_id, trace_id, span_id, parent_id, service, runtime, name, kind,
                            start_us, duration_us, status, status_message, attributes, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO UPDATE SET duration_us = excluded.duration_us, status = excluded.status,
                                   status_message = excluded.status_message, attributes = excluded.attributes
          WHERE excluded.duration_us > spans.duration_us",
        project.0,
        s.trace_id,
        s.span_id,
        s.parent_id,
        s.service,
        runtime,
        s.name,
        kind,
        s.start_us,
        s.duration_us,
        status,
        s.status_message,
        attributes,
        received_at
    )
    .execute(&mut *conn)
    .await?;
    Ok(done.rows_affected())
}
