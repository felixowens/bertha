//! Uptime monitors, their checks and incidents.

use std::collections::HashMap;

use bertha_core::domain::{Incident, Monitor, MonitorState, TimeRange, UptimeCheck};
use bertha_core::ids::{IncidentId, MonitorId, ProjectId};
use bertha_core::pages::{MonitorDetail, UptimeData};
use bertha_core::time::{DAY, HOUR, IsoDate, Millis};

use crate::codec::parse;
use crate::reads::issues::SummaryShape;
use crate::scope::Viewer;
use crate::series::Grid;
use crate::{Db, Result};

/// Checks drawn in a monitor's strip of recent results.
pub const RECENT: usize = 48;
/// Checks listed on the monitor page.
const CHECKS_LISTED: i64 = 30;
/// Issues during an incident count as related when they arrive this much faster than
/// usual, and at least `SPIKE_MIN` times.
const SPIKE_FACTOR: i64 = 3;
const SPIKE_MIN: i64 = 5;

impl Db {
    /// Monitors in the viewer's projects, optionally only those in one state.
    async fn monitor_list(&self, scope: &str, id: Option<&str>, state: Option<MonitorState>) -> Result<Vec<Monitor>> {
        let since = self.now() - 30 * DAY;
        let state = state.map(|s| s.as_str());
        let rows = sqlx::query!(
            r#"SELECT m.id, m.project_id, m.name, m.url, m.interval_seconds, m.state, m.since, m.latest_response_ms,
                      (SELECT SUM(c.ok * c.samples) FROM checks c WHERE c.monitor_id = m.id AND c.at >= ?2) AS "ok_samples?: i64",
                      (SELECT SUM(c.samples) FROM checks c WHERE c.monitor_id = m.id AND c.at >= ?2) AS "samples?: i64"
               FROM monitors m JOIN projects p ON p.id = m.project_id
               WHERE m.project_id IN (SELECT value FROM json_each(?1))
                 AND (?3 IS NULL OR m.id = ?3)
                 AND (?4 IS NULL OR m.state = ?4)
               ORDER BY p.created_at, m.name"#,
            scope,
            since,
            id,
            state
        )
        .fetch_all(&self.read)
        .await?;
        if rows.is_empty() {
            return Ok(vec![]);
        }
        let ids: Vec<&str> = rows.iter().map(|r| r.id.as_str()).collect();
        let recent = self.recent_checks(&serde_json::to_string(&ids)?).await?;
        rows.into_iter()
            .map(|r| {
                let uptime = match (r.ok_samples, r.samples) {
                    (Some(ok), Some(n)) if n > 0 => round2(ok as f64 * 100.0 / n as f64),
                    _ => 100.0,
                };
                let mut strip = recent.get(&r.id).cloned().unwrap_or_default();
                strip.reverse();
                let mut padded = vec![None; RECENT.saturating_sub(strip.len())];
                padded.extend(strip.into_iter().map(Some));
                Ok(Monitor {
                    id: MonitorId(r.id),
                    project_id: ProjectId(r.project_id),
                    name: r.name,
                    url: r.url,
                    interval_seconds: r.interval_seconds as u32,
                    state: parse(&r.state, MonitorState::parse)?,
                    since: IsoDate::from_millis(r.since),
                    uptime30d: uptime,
                    latest_response_ms: r.latest_response_ms.map(|v| v.max(0) as u32),
                    recent: padded,
                })
            })
            .collect()
    }

    /// The last [`RECENT`] check results per monitor, newest first.
    async fn recent_checks(&self, ids: &str) -> Result<HashMap<String, Vec<MonitorState>>> {
        let rows = sqlx::query!(
            r#"SELECT monitor_id, ok, degraded FROM (
                 SELECT monitor_id, ok, degraded,
                        ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY at DESC) AS n
                 FROM checks WHERE monitor_id IN (SELECT value FROM json_each(?1)))
               WHERE n <= ?2 ORDER BY monitor_id, n"#,
            ids,
            RECENT as i64
        )
        .fetch_all(&self.read)
        .await?;
        let mut out: HashMap<String, Vec<MonitorState>> = HashMap::new();
        for r in rows {
            let s = match (r.ok, r.degraded) {
                (0, _) => MonitorState::Down,
                (_, 1) => MonitorState::Degraded,
                _ => MonitorState::Up,
            };
            out.entry(r.monitor_id).or_default().push(s);
        }
        Ok(out)
    }

    pub(crate) async fn monitors_down(&self, viewer: &Viewer) -> Result<Vec<Monitor>> {
        self.monitor_list(viewer.scope_json(), None, Some(MonitorState::Down)).await
    }

    pub(crate) async fn monitor_of_project(&self, project: &str) -> Result<Option<Monitor>> {
        let scope = serde_json::to_string(&[project])?;
        Ok(self.monitor_list(&scope, None, None).await?.pop())
    }

    pub async fn list_monitors(&self, viewer: &Viewer) -> Result<UptimeData> {
        Ok(UptimeData {
            monitors: self.monitor_list(viewer.scope_json(), None, None).await?,
            projects: self.projects(viewer).await?,
        })
    }

    pub async fn monitor_detail(&self, viewer: &Viewer, monitor_id: &str) -> Result<Option<MonitorDetail>> {
        let Some(monitor) = self.monitor_list(viewer.scope_json(), Some(monitor_id), None).await?.pop() else {
            return Ok(None);
        };
        let Some(project) = self.project(viewer, &monitor.project_id.0).await? else { return Ok(None) };

        let checks = sqlx::query!(
            "SELECT at, ok, http_status, response_ms, error, region FROM checks
             WHERE monitor_id = ? ORDER BY at DESC LIMIT ?",
            monitor_id,
            CHECKS_LISTED
        )
        .fetch_all(&self.read)
        .await?
        .into_iter()
        .map(|c| UptimeCheck {
            at: IsoDate::from_millis(c.at),
            ok: c.ok == 1,
            http_status: c.http_status.map(|v| v as u32),
            response_ms: c.response_ms.map(|v| v.max(0) as u32),
            error: c.error,
            region: c.region,
        })
        .collect();

        let incident_rows = sqlx::query!(
            "SELECT id, started_at, resolved_at, cause, failed_checks FROM incidents
             WHERE monitor_id = ? ORDER BY started_at DESC",
            monitor_id
        )
        .fetch_all(&self.read)
        .await?;
        let window = incident_rows.first().map(|i| (i.started_at, i.resolved_at.unwrap_or_else(|| self.now())));
        let incidents = incident_rows
            .into_iter()
            .map(|i| Incident {
                id: IncidentId(i.id),
                started_at: IsoDate::from_millis(i.started_at),
                resolved_at: i.resolved_at.map(IsoDate::from_millis),
                cause: i.cause,
                failed_checks: i.failed_checks.max(0) as u32,
            })
            .collect();

        let grid = Grid::hours_ending(self.now(), 48);
        let averages = sqlx::query!(
            r#"SELECT (at / 3600000) * 3600000 AS "hour!: i64",
                      CAST(ROUND(SUM(response_ms * samples) * 1.0 / SUM(samples)) AS INTEGER) AS "avg?: i64"
               FROM checks WHERE monitor_id = ?1 AND at >= ?2 AND response_ms IS NOT NULL
               GROUP BY 1"#,
            monitor_id,
            grid.start
        )
        .fetch_all(&self.read)
        .await?;
        let mut cells = vec![None; grid.len];
        for a in averages {
            if let (Some(i), Some(v)) = (grid.index(a.hour), a.avg) {
                cells[i] = Some(v.max(0) as u32);
            }
        }

        let related_issues = match window {
            Some((from, to)) => {
                let ids = self.issues_during(&monitor.project_id.0, from, to).await?;
                self.summaries_of(&ids, SummaryShape::month(self.now(), TimeRange::Week)).await?
            }
            None => vec![],
        };

        Ok(Some(MonitorDetail {
            monitor,
            project,
            checks,
            incidents,
            response_times: grid.series(cells),
            related_issues,
        }))
    }

    /// Issues first seen in a window, or arriving much faster than usual during it.
    async fn issues_during(&self, project: &str, from: Millis, to: Millis) -> Result<Vec<String>> {
        let from_hour = from - from.rem_euclid(HOUR);
        let span_hours = ((to - from_hour) / HOUR).max(1);
        let week_ago = from_hour - 7 * DAY;
        Ok(sqlx::query_scalar!(
            r#"WITH during AS (
                 SELECT issue_id, SUM(count) AS n FROM issue_hourly WHERE hour >= ?2 AND hour <= ?3 GROUP BY issue_id),
               before AS (
                 SELECT issue_id, SUM(count) AS n FROM issue_hourly WHERE hour >= ?4 AND hour < ?2 GROUP BY issue_id)
               SELECT i.id FROM issues i
               LEFT JOIN during d ON d.issue_id = i.id
               LEFT JOIN before b ON b.issue_id = i.id
               WHERE i.project_id = ?1
                 AND ((i.first_seen >= ?5 AND i.first_seen <= ?3)
                      OR (COALESCE(d.n, 0) >= ?6
                          AND COALESCE(d.n, 0) * 168 >= ?7 * COALESCE(b.n, 0) * ?8))
               ORDER BY i.first_seen DESC LIMIT 8"#,
            project,
            from_hour,
            to,
            week_ago,
            from,
            SPIKE_MIN,
            SPIKE_FACTOR,
            span_hours
        )
        .fetch_all(&self.read)
        .await?)
    }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
