//! Housekeeping: lifting snoozes whose date passed, and keeping the file small.

use bertha_core::domain::{Activity, UnsnoozeReason};
use bertha_core::ids::{IssueId, ProjectId};
use bertha_core::time::{DAY, HOUR, IsoDate, Millis};

use crate::writes::issues::add_activity;
use crate::{Db, Result};

/// Checks older than this are folded into one row per hour.
pub const FOLD_CHECKS_AFTER: Millis = 7 * DAY;
/// Used invitations stay this long after they expire, so the link still says "used"
/// or "expired" instead of "not found".
const KEEP_INVITES: Millis = 30 * DAY;
/// Delivered and abandoned alerts are kept this long, for looking into what was sent.
const KEEP_DELIVERIES: Millis = 30 * DAY;

/// What one housekeeping pass did, for the log.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Swept {
    pub events: u64,
    pub checks_folded: u64,
    pub checks_removed: u64,
    pub sourcemaps: u64,
    pub tokens: u64,
    pub sessions: u64,
    pub deliveries: u64,
}

impl Db {
    /// Issues snoozed until a time that has passed go back to unresolved, each with an
    /// `unsnoozed` entry. Returns them by project.
    pub async fn lift_expired_snoozes(&self) -> Result<Vec<(ProjectId, IssueId)>> {
        let now = self.now();
        let mut tx = self.write.begin().await?;
        // RETURNING sees the row after the update, so read the times first.
        let lifted = sqlx::query!(
            r#"SELECT id, project_id, snooze_until AS "until!: i64" FROM issues
               WHERE status = 'snoozed' AND snooze_until IS NOT NULL AND snooze_until <= ?"#,
            now
        )
        .fetch_all(&mut *tx)
        .await?;
        for i in &lifted {
            sqlx::query!(
                "UPDATE issues SET status = 'unresolved', snooze_until = NULL, snooze_total = NULL,
                                   snooze_remaining = NULL, version = version + 1
                 WHERE id = ?",
                i.id
            )
            .execute(&mut *tx)
            .await?;
        }
        for i in &lifted {
            // Dated when the snooze ran out, not when this pass noticed.
            let entry = Activity::Unsnoozed { at: IsoDate::from_millis(i.until), reason: UnsnoozeReason::DatePassed };
            add_activity(&mut tx, &i.id, i.until, &entry).await?;
        }
        tx.commit().await?;
        Ok(lifted.into_iter().map(|i| (ProjectId(i.project_id), IssueId(i.id))).collect())
    }

    /// Deletes what's past keeping and folds old checks. `retention` applies to events,
    /// checks and source maps; issues and their hourly counts stay.
    pub async fn sweep(&self, retention: Millis) -> Result<Swept> {
        let now = self.now();
        let cutoff = now - retention;
        let mut swept = Swept::default();

        // In slices, so ingest isn't held up behind one long delete.
        loop {
            let n = sqlx::query!(
                "DELETE FROM events WHERE id IN (SELECT id FROM events WHERE received_at < ? LIMIT 5000)",
                cutoff
            )
            .execute(&self.write)
            .await?
            .rows_affected();
            swept.events += n;
            if n < 5000 {
                break;
            }
        }
        swept.checks_removed =
            sqlx::query!("DELETE FROM checks WHERE at < ?", cutoff).execute(&self.write).await?.rows_affected();
        swept.checks_folded = self.fold_checks(now - FOLD_CHECKS_AFTER).await?;

        // A map is needed as long as its bundle may still run: keep every map from the
        // retention window, and always the project's latest release's.
        swept.sourcemaps = sqlx::query!(
            "DELETE FROM sourcemaps WHERE uploaded_at < ?1
               AND COALESCE(release, '') <> COALESCE((
                 SELECT s2.release FROM sourcemaps s2 WHERE s2.project_id = sourcemaps.project_id
                 ORDER BY s2.uploaded_at DESC LIMIT 1), '')",
            cutoff
        )
        .execute(&self.write)
        .await?
        .rows_affected();

        let invites_before = now - KEEP_INVITES;
        swept.tokens = sqlx::query!(
            "DELETE FROM tokens WHERE (kind = 'sign_in' AND (expires_at < ?1 OR used_at IS NOT NULL))
                                   OR (kind = 'invite' AND expires_at < ?2)",
            now,
            invites_before
        )
        .execute(&self.write)
        .await?
        .rows_affected();
        swept.sessions =
            sqlx::query!("DELETE FROM sessions WHERE expires_at < ?", now).execute(&self.write).await?.rows_affected();

        let deliveries_before = now - KEEP_DELIVERIES;
        swept.deliveries = sqlx::query!(
            "DELETE FROM alert_deliveries WHERE status <> 'pending' AND created_at < ?",
            deliveries_before
        )
        .execute(&self.write)
        .await?
        .rows_affected();
        sqlx::query!("DELETE FROM alert_cooldowns WHERE until < ?", now).execute(&self.write).await?;
        Ok(swept)
    }

    /// Folds the good checks before `before` into one row per monitor and hour, which
    /// keeps the hour's first check and counts the rest in `samples`. Failures and slow
    /// answers stay as they were. Returns how many rows went.
    async fn fold_checks(&self, before: Millis) -> Result<u64> {
        // Whole hours only, so the next pass doesn't find half an hour to fold again.
        let before = before - before.rem_euclid(HOUR);
        let mut tx = self.write.begin().await?;
        sqlx::query!(
            "WITH g AS (
               SELECT monitor_id, at / ?2 AS h, MIN(at) AS first, SUM(samples) AS n,
                      CAST(SUM(response_ms * samples) / SUM(samples) AS INTEGER) AS ms
               FROM checks WHERE at < ?1 AND ok = 1 AND degraded = 0
               GROUP BY monitor_id, h HAVING COUNT(*) > 1)
             UPDATE checks SET samples = g.n, response_ms = g.ms
             FROM g WHERE checks.monitor_id = g.monitor_id AND checks.at = g.first",
            before,
            HOUR
        )
        .execute(&mut *tx)
        .await?;
        let removed = sqlx::query!(
            "DELETE FROM checks WHERE at < ?1 AND ok = 1 AND degraded = 0 AND EXISTS (
               SELECT 1 FROM checks c2
               WHERE c2.monitor_id = checks.monitor_id AND c2.ok = 1 AND c2.degraded = 0
                 AND c2.at < checks.at AND c2.at / ?2 = checks.at / ?2)",
            before,
            HOUR
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();
        tx.commit().await?;
        Ok(removed)
    }

    /// Lets SQLite refresh its query planner statistics. Cheap; run often.
    pub async fn optimize(&self) -> Result<()> {
        sqlx::query("PRAGMA optimize").execute(&self.write).await?;
        Ok(())
    }

    /// Rewrites the file to give back the space deleted rows left. Blocks writes while
    /// it runs, so weekly at most.
    pub async fn vacuum(&self) -> Result<()> {
        sqlx::query("VACUUM").execute(&self.write).await?;
        Ok(())
    }
}
