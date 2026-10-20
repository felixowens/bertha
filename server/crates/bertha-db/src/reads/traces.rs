//! An event's trace: the spans the apps sent for it over OTLP, as a tree, with the
//! trace's error events placed on the spans they happened in.

use std::collections::{BTreeMap, HashMap};

use bertha_core::domain::{EventTrace, Level, Runtime, SpanEvent, SpanKind, SpanStatus, TraceIssue, TraceSpan};
use bertha_core::ids::{EventId, IssueId, ProjectId};
use bertha_core::time::{IsoDate, Millis};

use crate::codec::{from_blob, parse};
use crate::scope::Viewer;
use crate::stored::{EVENT_PAYLOAD_LIMIT, StoredEvent};
use crate::{Db, Result};

/// Spans shown; a trace past this says how many it left out.
pub const SPANS_SHOWN: usize = 2_000;
/// Events of the trace placed on its spans.
const EVENTS_PLACED: i64 = 50;

struct Row {
    project_id: String,
    span: TraceSpan,
    start_us: i64,
    end_us: i64,
}

struct Placed {
    event_id: String,
    project_id: String,
    at: Millis,
    span_id: Option<String>,
    issue: TraceIssue,
}

impl Db {
    /// The spans of an event's trace. `None` when the viewer can't see the event;
    /// `Some(None)` when it has no trace, or none of its spans were kept.
    ///
    /// Spans from projects the viewer can't see keep their shape (times, kind, status)
    /// but not what they say.
    pub async fn event_trace(
        &self,
        viewer: &Viewer,
        issue_id: &str,
        event_id: &str,
    ) -> Result<Option<Option<EventTrace>>> {
        if self.visible_issue_project(viewer, issue_id).await?.is_none() {
            return Ok(None);
        }
        let Some(trace_id) =
            sqlx::query_scalar!("SELECT trace_id FROM events WHERE id = ? AND issue_id = ?", event_id, issue_id)
                .fetch_optional(&self.read)
                .await?
        else {
            return Ok(None);
        };
        let Some(trace_id) = trace_id else { return Ok(Some(None)) };

        let total = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "n!: i64" FROM spans WHERE trace_id = ?"#, trace_id)
            .fetch_one(&self.read)
            .await?;
        if total == 0 {
            return Ok(Some(None));
        }
        let shown = SPANS_SHOWN as i64;
        let stored = sqlx::query!(
            "SELECT project_id, span_id, parent_id, service, runtime, name, kind, start_us, duration_us,
                    status, status_message, attributes
               FROM spans WHERE trace_id = ? ORDER BY start_us, span_id LIMIT ?",
            trace_id,
            shown
        )
        .fetch_all(&self.read)
        .await?;
        let mut rows = Vec::with_capacity(stored.len());
        for r in stored {
            let attributes: BTreeMap<String, String> = serde_json::from_str(&r.attributes)?;
            rows.push(Row {
                start_us: r.start_us,
                end_us: r.start_us + r.duration_us.max(0),
                span: TraceSpan {
                    id: r.span_id,
                    parent_id: r.parent_id,
                    project_id: Some(ProjectId(r.project_id.clone())),
                    service: r.service,
                    runtime: parse(&r.runtime, Runtime::parse)?,
                    name: r.name,
                    kind: parse(&r.kind, SpanKind::parse)?,
                    start_ms: 0.0,
                    duration_ms: r.duration_us.max(0) as f64 / 1000.0,
                    status: parse(&r.status, SpanStatus::parse)?,
                    status_message: r.status_message,
                    attributes,
                    event: None,
                    silent: None,
                },
                project_id: r.project_id,
            });
        }

        let scope = viewer.scope_json();
        let events = sqlx::query!(
            r#"SELECT e.id, e.received_at, e.payload, i.id AS issue_id, i.project_id, i.short_id,
                      i.level, i.type AS kind, i.message
                 FROM events e JOIN issues i ON i.id = e.issue_id
                WHERE e.trace_id = ?1 AND i.project_id IN (SELECT value FROM json_each(?2))
                ORDER BY e.id = ?3 DESC, e.received_at DESC, e.id DESC LIMIT ?4"#,
            trace_id,
            scope,
            event_id,
            EVENTS_PLACED
        )
        .fetch_all(&self.read)
        .await?;
        let mut placed = Vec::with_capacity(events.len());
        for e in events {
            let payload: StoredEvent = from_blob(&e.payload, EVENT_PAYLOAD_LIMIT)?;
            placed.push(Placed {
                event_id: e.id,
                project_id: e.project_id,
                at: e.received_at,
                span_id: payload.trace.and_then(|t| t.span_id),
                issue: TraceIssue {
                    id: IssueId(e.issue_id),
                    short_id: e.short_id,
                    level: parse(&e.level, Level::parse)?,
                    r#type: e.kind,
                    message: e.message,
                },
            });
        }

        let t0 = rows.iter().map(|r| r.start_us).min().unwrap_or(0);
        let end = rows.iter().map(|r| r.end_us).max().unwrap_or(t0);
        let spans = assemble(rows, placed, t0, viewer);
        Ok(Some(Some(EventTrace {
            trace_id,
            started_at: IsoDate::from_millis(t0.div_euclid(1000)),
            duration_ms: (end - t0) as f64 / 1000.0,
            spans,
            truncated: u32::try_from(total - shown).unwrap_or(0),
        })))
    }
}

/// Orders the spans as a tree, places the events, marks silent calls and blanks what
/// the viewer may not read.
fn assemble(mut rows: Vec<Row>, placed: Vec<Placed>, t0: i64, viewer: &Viewer) -> Vec<TraceSpan> {
    for r in &mut rows {
        r.span.start_ms = (r.start_us - t0) as f64 / 1000.0;
    }
    let index: HashMap<String, usize> = rows.iter().enumerate().map(|(i, r)| (r.span.id.clone(), i)).collect();
    let parent = |r: &Row| {
        r.span.parent_id.as_ref().and_then(|p| index.get(p)).copied().filter(|p| rows[*p].span.id != r.span.id)
    };
    let mut children: Vec<Vec<usize>> = vec![vec![]; rows.len()];
    let mut roots = vec![];
    // Rows are by start already, so children come out in order.
    for (i, r) in rows.iter().enumerate() {
        match parent(r) {
            Some(p) => children[p].push(i),
            None => roots.push(i),
        }
    }

    // Parents before children; a cycle (a bad exporter) can't loop, each row goes once.
    let mut order = Vec::with_capacity(rows.len());
    let mut depth = vec![0usize; rows.len()];
    let mut seen = vec![false; rows.len()];
    let mut stack: Vec<(usize, usize)> = roots.iter().rev().map(|r| (*r, 0)).collect();
    while let Some((i, d)) = stack.pop() {
        if std::mem::replace(&mut seen[i], true) {
            continue;
        }
        depth[i] = d;
        order.push(i);
        stack.extend(children[i].iter().rev().map(|c| (*c, d + 1)));
    }
    order.extend((0..rows.len()).filter(|i| !seen[*i]));

    for e in placed {
        let Some(at) = place(&e, &rows, &index, &children, &depth) else { continue };
        if rows[at].span.event.is_none() {
            rows[at].span.event = Some(SpanEvent { event_id: EventId(e.event_id), issue: e.issue });
        }
    }
    for (i, r) in rows.iter_mut().enumerate() {
        if children[i].is_empty() {
            r.span.silent = silent(&r.span);
        }
        if !viewer.can_see(&ProjectId(r.project_id.clone())) {
            let s = &mut r.span;
            s.project_id = None;
            s.service = String::new();
            s.name = String::new();
            s.status_message = None;
            s.attributes = BTreeMap::new();
            s.silent = None;
            s.event = None;
        }
    }

    let mut slots: Vec<Option<TraceSpan>> = rows.into_iter().map(|r| Some(r.span)).collect();
    order.into_iter().filter_map(|i| slots[i].take()).collect()
}

/// The span an event happened in:
/// - the span the event names, or when that's a call, the server span under it in the
///   event's project (an SDK that only read `traceparent` names the caller's span);
/// - else the outermost span of its project that was open at the time;
/// - else its project's outermost span.
fn place(
    e: &Placed,
    rows: &[Row],
    index: &HashMap<String, usize>,
    children: &[Vec<usize>],
    depth: &[usize],
) -> Option<usize> {
    let own = |i: &usize| rows[*i].project_id == e.project_id;
    if let Some(&named) = e.span_id.as_ref().and_then(|s| index.get(s)) {
        if rows[named].span.kind != SpanKind::Client {
            return Some(named);
        }
        let under = children[named].iter().find(|c| own(c) && rows[**c].span.kind == SpanKind::Server);
        return Some(*under.unwrap_or(&named));
    }
    let at_us = e.at * 1000;
    let outermost = |open: bool| {
        (0..rows.len())
            .filter(own)
            .filter(|i| !open || (rows[*i].start_us..=rows[*i].end_us).contains(&at_us))
            .min_by_key(|i| (depth[*i], rows[*i].start_us))
    };
    outermost(true).or_else(|| outermost(false))
}

/// A failed HTTP call with nothing under it: the service it called sent no spans. Its
/// host, for saying where the trail goes cold.
fn silent(s: &TraceSpan) -> Option<String> {
    if s.kind != SpanKind::Client {
        return None;
    }
    let a = |k: &str| s.attributes.get(k).map(String::as_str);
    let url = a("url.full").or(a("http.url"));
    if url.is_none() && a("http.method").or(a("http.request.method")).is_none() {
        return None;
    }
    let code = a("http.response.status_code").or(a("http.status_code")).and_then(|c| c.parse::<u16>().ok());
    // A status code says the service answered; only a 5xx means it broke. Without one,
    // the call's own status says whether it got an answer.
    let failed = code.map_or(s.status == SpanStatus::Error, |c| c >= 500);
    if !failed {
        return None;
    }
    let host =
        url.and_then(|u| u.split_once("://")).map(|(_, rest)| rest.split(['/', '?', '#']).next().unwrap_or(rest));
    let host = host.map(|h| h.rsplit('@').next().unwrap_or(h)).filter(|h| !h.is_empty());
    host.or(a("server.address")).or(a("net.peer.name")).map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn client(attributes: &[(&str, &str)], status: SpanStatus) -> TraceSpan {
        TraceSpan {
            id: "a".into(),
            parent_id: None,
            project_id: None,
            service: String::new(),
            runtime: Runtime::Server,
            name: String::new(),
            kind: SpanKind::Client,
            start_ms: 0.0,
            duration_ms: 0.0,
            status,
            status_message: None,
            attributes: attributes.iter().map(|(k, v)| ((*k).into(), (*v).into())).collect(),
            event: None,
            silent: None,
        }
    }

    #[test]
    fn silent_calls() {
        let timeout = client(
            &[("http.method", "GET"), ("url.full", "https://user@practice-sync.internal/slots?x=1")],
            SpanStatus::Error,
        );
        assert_eq!(silent(&timeout).as_deref(), Some("practice-sync.internal"));
        let bad_gateway = client(
            &[("http.request.method", "GET"), ("server.address", "10.4.2.17"), ("http.response.status_code", "502")],
            SpanStatus::Unset,
        );
        assert_eq!(silent(&bad_gateway).as_deref(), Some("10.4.2.17"));
        let fine = client(&[("url.full", "https://api.test/"), ("http.status_code", "200")], SpanStatus::Unset);
        assert_eq!(silent(&fine), None);
        let not_found = client(&[("url.full", "https://api.test/"), ("http.status_code", "404")], SpanStatus::Unset);
        assert_eq!(silent(&not_found), None, "a 4xx answered");
        let refused = client(&[("url.full", "https://api.test/"), ("http.status_code", "401")], SpanStatus::Error);
        assert_eq!(silent(&refused), None, "a 4xx answered, even when the caller counts it a failure");
        let pending = client(&[("url.full", "https://api.test/")], SpanStatus::Unset);
        assert_eq!(silent(&pending), None);
        let db = client(&[("db.system", "postgresql")], SpanStatus::Error);
        assert_eq!(silent(&db), None, "only HTTP calls");
    }
}
