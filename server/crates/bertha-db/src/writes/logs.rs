//! Log lines, kept in their own file (see [`crate::logs_path`]). Queries there aren't
//! checked at build time: `cargo sqlx prepare` only knows the main file.

use std::collections::{BTreeMap, HashMap};

use bertha_core::domain::{Environment, LogLevel, ProjectLogSettings};
use bertha_core::ids::ProjectId;
use bertha_core::logs::{limits, pattern_id, template};
use bertha_core::time::{DAY, MINUTE, Millis};

use sqlx::AssertSqlSafe;

use crate::{Db, Result};

/// One line, ready to store (bounded by `bertha-ingest`).
#[derive(Debug, Clone, PartialEq)]
pub struct NewLog {
    pub at: Millis,
    pub level: LogLevel,
    pub message: String,
    pub fields: BTreeMap<String, String>,
    pub service: Option<String>,
    pub release: Option<String>,
    pub environment: Environment,
    pub trace_id: Option<String>,
    pub span_id: Option<String>,
    /// The `bertha.event_id` it was sent with, resolved when read.
    pub event_ref: Option<String>,
}

/// What a housekeeping pass took out of the logs file.
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct LogsSwept {
    /// Past the project's retention.
    pub expired: u64,
    /// The oldest of a project past the size cap.
    pub evicted: u64,
}

/// Rows deleted at a time, so ingest isn't held up behind one long delete.
const SLICE: i64 = 5_000;

impl Db {
    /// What a project keeps, for ingest. `None` for a project that doesn't exist.
    pub async fn project_log_settings(&self, project: &ProjectId) -> Result<Option<ProjectLogSettings>> {
        let row = sqlx::query!(
            r#"SELECT log_min_level, log_retention_days AS "days: i64" FROM projects WHERE id = ?"#,
            project.0
        )
        .fetch_optional(&self.read)
        .await?;
        Ok(row.map(|r| ProjectLogSettings {
            min_level: LogLevel::parse(&r.log_min_level).unwrap_or(LogLevel::Info),
            retention_days: u32::try_from(r.days).unwrap_or(14),
        }))
    }

    /// Stores a batch in one transaction, with its patterns and per-minute counts.
    /// Returns how many were stored.
    pub async fn save_logs(&self, project: &ProjectId, lines: &[NewLog]) -> Result<u64> {
        if lines.is_empty() {
            return Ok(0);
        }
        // Pattern → (template, worst level, first, last); (minute, pattern, level) → lines.
        let mut patterns: HashMap<String, (String, LogLevel, Millis, Millis)> = HashMap::new();
        let mut minutes: HashMap<(Millis, String, i64), i64> = HashMap::new();
        let mut tx = self.logs.write.begin().await?;
        for l in lines {
            let template = template(&l.message);
            let pattern = pattern_id(&project.0, &template);
            let fields = serde_json::to_string(&l.fields)?;
            let bytes = (l.message.len() + fields.len() + 64) as i64;
            sqlx::query(
                "INSERT INTO lines (project_id, at, level, message, fields, service, release, environment,
                                    trace_id, span_id, event_ref, pattern_id, bytes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&project.0)
            .bind(l.at)
            .bind(l.level.rank())
            .bind(&l.message)
            .bind(&fields)
            .bind(&l.service)
            .bind(&l.release)
            .bind(l.environment.as_str())
            .bind(&l.trace_id)
            .bind(&l.span_id)
            .bind(&l.event_ref)
            .bind(&pattern)
            .bind(bytes)
            .execute(&mut *tx)
            .await?;
            *minutes.entry((l.at.div_euclid(MINUTE) * MINUTE, pattern.clone(), l.level.rank())).or_default() += 1;
            let p = patterns.entry(pattern).or_insert((template, l.level, l.at, l.at));
            p.1 = p.1.max(l.level);
            p.2 = p.2.min(l.at);
            p.3 = p.3.max(l.at);
        }
        for (id, (template, level, first, last)) in &patterns {
            sqlx::query(
                "INSERT INTO patterns (id, project_id, template, level, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET level = MAX(level, excluded.level),
                   first_seen = MIN(first_seen, excluded.first_seen), last_seen = MAX(last_seen, excluded.last_seen)",
            )
            .bind(id)
            .bind(&project.0)
            .bind(template)
            .bind(level.rank())
            .bind(first)
            .bind(last)
            .execute(&mut *tx)
            .await?;
        }
        for ((minute, pattern, level), n) in &minutes {
            sqlx::query(
                "INSERT INTO minutes (project_id, minute, pattern_id, level, lines) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT DO UPDATE SET lines = lines + excluded.lines",
            )
            .bind(&project.0)
            .bind(minute)
            .bind(pattern)
            .bind(level)
            .bind(n)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(lines.len() as u64)
    }

    /// Counts lines a project sent past its rate cap.
    pub async fn record_log_drop(&self, project: &ProjectId, lines: u64) -> Result<()> {
        let now = self.now();
        sqlx::query(
            "INSERT INTO drops (project_id, day, rate, since) VALUES (?, ?, ?, ?)
             ON CONFLICT DO UPDATE SET rate = rate + excluded.rate, since = COALESCE(since, excluded.since)",
        )
        .bind(&project.0)
        .bind(now.div_euclid(DAY))
        .bind(lines as i64)
        .bind(now)
        .execute(&self.logs.write)
        .await?;
        Ok(())
    }

    /// Everything a deleted project logged.
    pub(crate) async fn delete_project_logs(&self, project: &str) -> Result<u64> {
        let mut deleted = 0;
        loop {
            let n = sqlx::query("DELETE FROM lines WHERE id IN (SELECT id FROM lines WHERE project_id = ? LIMIT ?)")
                .bind(project)
                .bind(SLICE)
                .execute(&self.logs.write)
                .await?
                .rows_affected();
            deleted += n;
            if n < SLICE as u64 {
                break;
            }
        }
        for table in ["patterns", "minutes", "drops", "usage"] {
            sqlx::query(AssertSqlSafe(format!("DELETE FROM {table} WHERE project_id = ?")))
                .bind(project)
                .execute(&self.logs.write)
                .await?;
        }
        Ok(deleted)
    }

    /// Deletes each project's lines past its retention, then its oldest past the size
    /// cap (counted as dropped), and the patterns and counts nothing kept is in.
    pub(crate) async fn sweep_logs(&self) -> Result<LogsSwept> {
        let now = self.now();
        let mut swept = LogsSwept::default();
        let kept: HashMap<String, i64> =
            sqlx::query!(r#"SELECT id AS "id!", log_retention_days AS "days: i64" FROM projects"#)
                .fetch_all(&self.read)
                .await?
                .into_iter()
                .map(|r| (r.id, r.days))
                .collect();
        let logged: Vec<String> = sqlx::query_scalar("SELECT project_id FROM usage").fetch_all(&self.logs.read).await?;
        for project in logged {
            let Some(days) = kept.get(&project) else {
                // Deleted while its lines were being written.
                swept.expired += self.delete_project_logs(&project).await?;
                continue;
            };
            let cutoff = now - days * DAY;
            loop {
                let n = sqlx::query(
                    "DELETE FROM lines WHERE id IN (SELECT id FROM lines WHERE project_id = ? AND at < ? LIMIT ?)",
                )
                .bind(&project)
                .bind(cutoff)
                .bind(SLICE)
                .execute(&self.logs.write)
                .await?
                .rows_affected();
                swept.expired += n;
                if n < SLICE as u64 {
                    break;
                }
            }
            let mut evicted = 0;
            loop {
                let bytes: i64 = sqlx::query_scalar("SELECT bytes FROM usage WHERE project_id = ?")
                    .bind(&project)
                    .fetch_optional(&self.logs.write)
                    .await?
                    .unwrap_or(0);
                if bytes <= limits::PROJECT_BYTES {
                    break;
                }
                let n = sqlx::query(
                    "DELETE FROM lines WHERE id IN (
                       SELECT id FROM lines WHERE project_id = ? ORDER BY at, id LIMIT ?)",
                )
                .bind(&project)
                .bind(SLICE)
                .execute(&self.logs.write)
                .await?
                .rows_affected();
                evicted += n;
                if n == 0 {
                    break;
                }
            }
            if evicted > 0 {
                sqlx::query(
                    "INSERT INTO drops (project_id, day, size) VALUES (?, ?, ?)
                     ON CONFLICT DO UPDATE SET size = size + excluded.size",
                )
                .bind(&project)
                .bind(now.div_euclid(DAY))
                .bind(evicted as i64)
                .execute(&self.logs.write)
                .await?;
                swept.evicted += evicted;
            }
            // Counts and patterns from before the oldest line left would show logs that
            // can't be listed.
            let oldest: Option<i64> = sqlx::query_scalar("SELECT MIN(at) FROM lines WHERE project_id = ?")
                .bind(&project)
                .fetch_one(&self.logs.write)
                .await?;
            let oldest = oldest.unwrap_or(now);
            sqlx::query("DELETE FROM minutes WHERE project_id = ? AND minute < ?")
                .bind(&project)
                .bind(oldest.div_euclid(MINUTE) * MINUTE)
                .execute(&self.logs.write)
                .await?;
            sqlx::query("DELETE FROM patterns WHERE project_id = ? AND last_seen < ?")
                .bind(&project)
                .bind(oldest)
                .execute(&self.logs.write)
                .await?;
        }
        sqlx::query("DELETE FROM drops WHERE day < ?").bind(now.div_euclid(DAY) - 31).execute(&self.logs.write).await?;
        Ok(swept)
    }
}
