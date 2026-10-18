//! The uptime worker's side of monitors: which are due, and what a check result does
//! to a monitor's state and its incidents.

use bertha_core::domain::MonitorState;
use bertha_core::ids::{IncidentId, MonitorId, ProjectId};
use bertha_core::time::{Millis, SECOND};

use crate::codec::parse;
use crate::writes::monitors::{CheckResult, insert_check};
use crate::{Db, Result};

/// A site is down after this many failed checks in a row. One failure is often the
/// network between here and there.
pub const DOWN_AFTER: i64 = 2;

/// A monitor whose next check is due.
#[derive(Debug, Clone, PartialEq)]
pub struct DueMonitor {
    pub id: MonitorId,
    pub url: String,
    pub interval: Millis,
}

/// A monitor moved between up, degraded and down.
#[derive(Debug, Clone, PartialEq)]
pub struct Transition {
    pub monitor_id: MonitorId,
    pub project_id: ProjectId,
    pub project_name: String,
    pub name: String,
    pub url: String,
    pub from: MonitorState,
    pub to: MonitorState,
    /// What the failing checks said, when going down.
    pub cause: Option<String>,
    /// The incident this opened or closed.
    pub incident_id: Option<IncidentId>,
    /// How long it was down, when coming back up.
    pub down_for: Option<Millis>,
    pub at: Millis,
}

impl Db {
    /// Unpaused monitors whose next check time has come, most overdue first.
    pub async fn due_monitors(&self, limit: i64) -> Result<Vec<DueMonitor>> {
        let now = self.now();
        let rows = sqlx::query!(
            "SELECT id, url, interval_seconds FROM monitors
             WHERE paused = 0 AND next_check_at <= ? ORDER BY next_check_at LIMIT ?",
            now,
            limit
        )
        .fetch_all(&self.read)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| DueMonitor { id: MonitorId(r.id), url: r.url, interval: r.interval_seconds * SECOND })
            .collect())
    }

    /// Brings every check due later than `within` from now forward to then. Only for
    /// end-to-end tests that can't wait a minute between checks.
    pub async fn pull_checks_forward(&self, within: Millis) -> Result<()> {
        let at = self.now() + within;
        sqlx::query!("UPDATE monitors SET next_check_at = ?1 WHERE next_check_at > ?1", at)
            .execute(&self.write)
            .await?;
        Ok(())
    }

    /// Stores a check and moves the monitor's state: down after [`DOWN_AFTER`] failures
    /// in a row (opening an incident), up or degraded on the next good check (closing
    /// it). Returns the transition, if there was one. A monitor that was paused, deleted
    /// or pointed at another URL while the check ran keeps its state and the result is
    /// dropped.
    pub async fn record_check(
        &self,
        monitor_id: &MonitorId,
        checked_url: &str,
        check: &CheckResult,
        next_check_at: Millis,
    ) -> Result<Option<Transition>> {
        let mut tx = self.write.begin().await?;
        let Some(m) = sqlx::query!(
            "SELECT m.project_id, p.name AS project_name, m.name, m.url, m.paused, m.state, m.consecutive_failures
             FROM monitors m JOIN projects p ON p.id = m.project_id WHERE m.id = ?",
            monitor_id.0
        )
        .fetch_optional(&mut *tx)
        .await?
        else {
            return Ok(None);
        };
        if m.paused == 1 || m.url != checked_url {
            return Ok(None);
        }
        let from = parse(&m.state, MonitorState::parse)?;
        let failures = if check.ok { 0 } else { m.consecutive_failures + 1 };
        let to = match (check.ok, check.degraded) {
            (true, true) => MonitorState::Degraded,
            (true, false) => MonitorState::Up,
            (false, _) if failures >= DOWN_AFTER => MonitorState::Down,
            // A single failure: not down yet, and not up either if it was down.
            (false, _) => from,
        };

        insert_check(&mut tx, &monitor_id.0, check).await?;
        let to_s = to.as_str();
        let ms = check.response_ms.map(i64::from);
        sqlx::query!(
            "UPDATE monitors SET state = ?1, since = CASE WHEN state = ?1 THEN since ELSE ?2 END,
                    consecutive_failures = ?3, latest_response_ms = COALESCE(?4, latest_response_ms),
                    next_check_at = ?5
             WHERE id = ?6",
            to_s,
            check.at,
            failures,
            ms,
            next_check_at,
            monitor_id.0
        )
        .execute(&mut *tx)
        .await?;

        let mut incident_id = None;
        let mut down_for = None;
        let mut cause = None;
        if to == MonitorState::Down && from != MonitorState::Down {
            // The incident started with the first failure of this run, not the one
            // that confirmed it.
            let started = sqlx::query_scalar!(
                r#"SELECT MIN(at) AS "at!: i64" FROM checks
                   WHERE monitor_id = ?1 AND ok = 0
                     AND at > COALESCE((SELECT MAX(at) FROM checks WHERE monitor_id = ?1 AND ok = 1), 0)"#,
                monitor_id.0
            )
            .fetch_one(&mut *tx)
            .await?;
            let why = check.error.clone().unwrap_or_else(|| "No response".into());
            let id = IncidentId::generate();
            sqlx::query!(
                "INSERT INTO incidents (id, monitor_id, started_at, cause, failed_checks) VALUES (?, ?, ?, ?, ?)",
                id.0,
                monitor_id.0,
                started,
                why,
                failures
            )
            .execute(&mut *tx)
            .await?;
            incident_id = Some(id);
            cause = Some(why);
        } else if to == MonitorState::Down {
            sqlx::query!(
                "UPDATE incidents SET failed_checks = failed_checks + 1 WHERE monitor_id = ? AND resolved_at IS NULL",
                monitor_id.0
            )
            .execute(&mut *tx)
            .await?;
        } else if from == MonitorState::Down {
            let open = sqlx::query!(
                "UPDATE incidents SET resolved_at = ? WHERE monitor_id = ? AND resolved_at IS NULL
                 RETURNING id, started_at",
                check.at,
                monitor_id.0
            )
            .fetch_optional(&mut *tx)
            .await?;
            if let Some(i) = open {
                incident_id = Some(IncidentId(i.id));
                down_for = Some(check.at - i.started_at);
            }
        }
        tx.commit().await?;

        Ok((from != to).then(|| Transition {
            monitor_id: monitor_id.clone(),
            project_id: ProjectId(m.project_id),
            project_name: m.project_name,
            name: m.name,
            url: m.url,
            from,
            to,
            cause,
            incident_id,
            down_for,
            at: check.at,
        }))
    }
}
