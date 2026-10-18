//! Saving monitors and recording check results.

use bertha_core::api::{DeleteMonitorFailure, MonitorInput, Outcome, SaveMonitorFailure};
use bertha_core::domain::Monitor;
use bertha_core::ids::{MonitorId, ProjectId};
use bertha_core::time::{Millis, SECOND};
use bertha_core::validate;

use crate::scope::Viewer;
use crate::writes::uptime::DueMonitor;
use crate::{Db, Error, Result};

const INTERVALS: [u32; 3] = [60, 300, 900];
const NAME_LIMIT: usize = 200;

/// One check of a URL, as the uptime checker saw it.
#[derive(Debug, Clone, PartialEq)]
pub struct CheckResult {
    pub at: Millis,
    pub ok: bool,
    /// Answered, but slower than the degraded threshold.
    pub degraded: bool,
    pub http_status: Option<u16>,
    pub response_ms: Option<u32>,
    /// Plain words: "Timed out after 10s", "TLS certificate expired".
    pub error: Option<String>,
    pub region: String,
}

impl CheckResult {
    fn state(&self) -> &'static str {
        match (self.ok, self.degraded) {
            (false, _) => "down",
            (true, true) => "degraded",
            (true, false) => "up",
        }
    }
}

struct Existing {
    id: String,
    project_id: String,
    url: String,
    paused: i64,
    state: String,
    next_check_at: i64,
}

impl Db {
    /// The monitor this input would update. Without an id it's a new one: a project
    /// can have several.
    async fn existing_monitor(&self, input: &MonitorInput) -> Result<Option<Existing>> {
        let Some(id) = input.id.as_ref().map(|m| m.as_str()) else { return Ok(None) };
        Ok(sqlx::query_as!(
            Existing,
            "SELECT id, project_id, url, paused, state, next_check_at FROM monitors WHERE id = ?",
            id
        )
        .fetch_optional(&self.read)
        .await?)
    }

    /// Whether saving this input needs a first check: a new or unpaused monitor, or a
    /// new URL. Renaming a monitor while its site is down shouldn't fail.
    pub async fn monitor_needs_check(&self, input: &MonitorInput) -> Result<bool> {
        if input.paused {
            return Ok(false);
        }
        Ok(match self.existing_monitor(input).await? {
            None => true,
            Some(m) => m.paused == 1 || m.url != input.url.trim(),
        })
    }

    /// Creates or updates a monitor. `first` is the check the caller ran because
    /// [`Db::monitor_needs_check`] said so; a failed one is `unreachable` and saves nothing.
    pub async fn save_monitor(
        &self,
        viewer: &Viewer,
        input: &MonitorInput,
        first: Option<&CheckResult>,
    ) -> Result<Outcome<Monitor, SaveMonitorFailure>> {
        if !viewer.can_see(&input.project_id) {
            return Err(Error::Forbidden);
        }
        let Some(url) = validate::monitor_url(&input.url) else {
            return Ok(Outcome::fail(SaveMonitorFailure::InvalidUrl));
        };
        if !INTERVALS.contains(&input.interval_seconds) {
            return Err(Error::Invalid("Check every 1, 5 or 15 minutes.".into()));
        }
        let name = input.name.trim();
        if name.is_empty() || name.len() > NAME_LIMIT {
            return Err(Error::Invalid(format!("Give the monitor a name of up to {NAME_LIMIT} characters.")));
        }
        if let Some(check) = first.filter(|c| !c.ok) {
            let why = check.error.as_deref().unwrap_or("No response");
            return Ok(Outcome::fail_with(SaveMonitorFailure::Unreachable, format!("The first check failed: {why}.")));
        }

        let now = self.now();
        let interval = i64::from(input.interval_seconds) * SECOND;
        let paused = i64::from(input.paused);
        let existing = self.existing_monitor(input).await?;
        if input.id.is_some() && existing.is_none() {
            return Err(Error::Invalid("That monitor was deleted. Add it again.".into()));
        }
        if existing.as_ref().is_some_and(|m| !viewer.can_see(&ProjectId(m.project_id.clone()))) {
            return Err(Error::Forbidden);
        }
        let mut tx = self.write.begin().await?;
        let id = match existing {
            None => {
                let id = MonitorId::generate();
                let state = if input.paused { "paused" } else { first.map_or("up", CheckResult::state) };
                let next = now + interval;
                sqlx::query!(
                    "INSERT INTO monitors (id, project_id, name, url, interval_seconds, paused, state, since,
                                           latest_response_ms, next_check_at, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id.0,
                    input.project_id.0,
                    name,
                    url,
                    input.interval_seconds,
                    paused,
                    state,
                    now,
                    None::<i64>,
                    next,
                    now
                )
                .execute(&mut *tx)
                .await?;
                id.0
            }
            Some(m) => {
                // State only moves when pausing, unpausing, or a fresh check says so.
                let state = match (input.paused, first) {
                    (true, _) => "paused".to_owned(),
                    (false, Some(c)) => c.state().to_owned(),
                    (false, None) => m.state.clone(),
                };
                let next = if first.is_some() { now + interval } else { m.next_check_at.min(now + interval) };
                sqlx::query!(
                    "UPDATE monitors SET project_id = ?, name = ?, url = ?, interval_seconds = ?, paused = ?,
                            since = CASE WHEN state = ? THEN since ELSE ? END, state = ?,
                            consecutive_failures = CASE WHEN ? THEN 0 ELSE consecutive_failures END,
                            next_check_at = ?
                     WHERE id = ?",
                    input.project_id.0,
                    name,
                    url,
                    input.interval_seconds,
                    paused,
                    state,
                    now,
                    state,
                    first.is_some(),
                    next,
                    m.id
                )
                .execute(&mut *tx)
                .await?;
                m.id
            }
        };
        if let Some(check) = first {
            insert_check(&mut tx, &id, check).await?;
            let ms = check.response_ms.map(i64::from);
            sqlx::query!("UPDATE monitors SET latest_response_ms = ? WHERE id = ?", ms, id).execute(&mut *tx).await?;
        }
        tx.commit().await?;
        match self.monitor_by_id(&id).await? {
            Some(m) => Ok(Outcome::Ok(m)),
            None => Err(Error::Corrupt(format!("monitor {id} vanished after saving"))),
        }
    }

    /// Deletes a monitor with its checks and incidents. The owner's alone.
    pub async fn delete_monitor(&self, viewer: &Viewer, id: &str) -> Result<Outcome<(), DeleteMonitorFailure>> {
        if !viewer.is_owner() {
            return Ok(Outcome::fail(DeleteMonitorFailure::PermissionDenied));
        }
        let done = sqlx::query!("DELETE FROM monitors WHERE id = ?", id).execute(&self.write).await?.rows_affected();
        if done == 0 {
            return Ok(Outcome::fail(DeleteMonitorFailure::NotFound));
        }
        tracing::info!(monitor = id, "monitor deleted");
        Ok(Outcome::Ok(()))
    }

    /// A monitor the viewer may check right now, with what the checker needs.
    pub async fn monitor_to_check(&self, viewer: &Viewer, id: &str) -> Result<Option<DueMonitor>> {
        let Some(row) = sqlx::query!("SELECT id, project_id, url, interval_seconds FROM monitors WHERE id = ?", id)
            .fetch_optional(&self.read)
            .await?
        else {
            return Ok(None);
        };
        if !viewer.can_see(&ProjectId(row.project_id)) {
            return Ok(None);
        }
        Ok(Some(DueMonitor { id: MonitorId(row.id), url: row.url, interval: row.interval_seconds * SECOND }))
    }
}

pub(crate) async fn insert_check(tx: &mut sqlx::SqliteConnection, monitor_id: &str, c: &CheckResult) -> Result<()> {
    let status = c.http_status.map(i64::from);
    let ms = c.response_ms.map(i64::from);
    sqlx::query!(
        "INSERT OR REPLACE INTO checks (monitor_id, at, ok, degraded, http_status, response_ms, error, region)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        monitor_id,
        c.at,
        c.ok,
        c.degraded,
        status,
        ms,
        c.error,
        c.region
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}
