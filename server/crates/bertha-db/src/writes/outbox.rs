//! The alert outbox: alerts waiting to go out, one row per destination, retried until
//! delivered or given up on. Cooldowns keep a storm of events to one alert.

use bertha_core::domain::{AlertDestination, AlertRule};
use bertha_core::ids::{AlertRuleId, DestinationId, IssueId};
use bertha_core::time::Millis;

use crate::{Db, Error, Result};

/// One alert to one destination, due now.
#[derive(Debug, Clone, PartialEq)]
pub struct Delivery {
    pub id: i64,
    pub destination: AlertDestination,
    /// The rendered alert as the server queued it (JSON).
    pub alert: String,
    /// Tries so far, before this one.
    pub attempts: i64,
}

impl Db {
    /// Rules that are switched on, for matching what just happened.
    pub async fn enabled_alert_rules(&self) -> Result<Vec<AlertRule>> {
        Ok(self.alert_rules().await?.into_iter().filter(|r| r.enabled).collect())
    }

    /// Events an issue has had since `since`, for spike rules.
    pub async fn events_since(&self, issue: &IssueId, since: Millis) -> Result<i64> {
        Ok(sqlx::query_scalar!("SELECT COUNT(*) FROM events WHERE issue_id = ? AND received_at >= ?", issue.0, since)
            .fetch_one(&self.read)
            .await?)
    }

    /// Queues an alert for each of the rule's destinations that still exists, unless
    /// the rule fired about this subject within its cooldown. Returns whether anything
    /// was queued.
    pub async fn enqueue_alert(
        &self,
        rule: &AlertRuleId,
        subject: &str,
        cooldown: Millis,
        destinations: &[DestinationId],
        alert: &str,
    ) -> Result<bool> {
        let now = self.now();
        let destinations = serde_json::to_string(destinations)?;
        let mut tx = self.write.begin().await?;
        let cooling = sqlx::query_scalar!(
            "SELECT 1 AS x FROM alert_cooldowns WHERE rule_id = ? AND subject = ? AND until > ?",
            rule.0,
            subject,
            now
        )
        .fetch_optional(&mut *tx)
        .await?
        .is_some();
        if cooling {
            return Ok(false);
        }
        let queued = sqlx::query!(
            "INSERT INTO alert_deliveries (rule_id, destination_id, alert, status, next_attempt_at, created_at)
             SELECT r.id, d.id, ?2, 'pending', ?3, ?3
             FROM alert_rules r, alert_destinations d
             WHERE r.id = ?1 AND r.enabled = 1 AND d.id IN (SELECT value FROM json_each(?4))",
            rule.0,
            alert,
            now,
            destinations
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if queued == 0 {
            return Ok(false);
        }
        let until = now + cooldown;
        sqlx::query!(
            "INSERT INTO alert_cooldowns (rule_id, subject, until) VALUES (?, ?, ?)
             ON CONFLICT (rule_id, subject) DO UPDATE SET until = excluded.until",
            rule.0,
            subject,
            until
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!("UPDATE alert_rules SET last_fired_at = ? WHERE id = ?", now, rule.0).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(true)
    }

    /// Pending deliveries whose time has come, oldest first.
    pub async fn due_deliveries(&self, limit: i64) -> Result<Vec<Delivery>> {
        let now = self.now();
        let rows = sqlx::query!(
            "SELECT o.id, o.alert, o.attempts, d.id AS destination_id, d.kind, d.address, d.label, d.url
             FROM alert_deliveries o JOIN alert_destinations d ON d.id = o.destination_id
             WHERE o.status = 'pending' AND o.next_attempt_at <= ?
             ORDER BY o.next_attempt_at, o.id LIMIT ?",
            now,
            limit
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|r| {
                let id = DestinationId(r.destination_id);
                let destination = match (r.kind.as_str(), r.address, r.label, r.url) {
                    ("email", Some(address), _, _) => AlertDestination::Email { id, address },
                    ("webhook", _, Some(label), Some(url)) => AlertDestination::Webhook { id, label, url },
                    _ => return Err(Error::Corrupt(format!("destination {id}"))),
                };
                Ok(Delivery { id: r.id, destination, alert: r.alert, attempts: r.attempts })
            })
            .collect()
    }

    pub async fn delivery_sent(&self, id: i64) -> Result<()> {
        let now = self.now();
        sqlx::query!(
            "UPDATE alert_deliveries SET status = 'sent', attempts = attempts + 1, last_error = NULL, tried_at = ?
             WHERE id = ?",
            now,
            id
        )
        .execute(&self.write)
        .await?;
        Ok(())
    }

    /// A failed try: again at `retry_at`, or never if `None`.
    pub async fn delivery_failed(&self, id: i64, error: &str, retry_at: Option<Millis>) -> Result<()> {
        let status = if retry_at.is_some() { "pending" } else { "failed" };
        let now = self.now();
        sqlx::query!(
            "UPDATE alert_deliveries SET status = ?, attempts = attempts + 1, last_error = ?,
                    next_attempt_at = COALESCE(?, next_attempt_at), tried_at = ?
             WHERE id = ?",
            status,
            error,
            retry_at,
            now,
            id
        )
        .execute(&self.write)
        .await?;
        Ok(())
    }

    /// The earliest pending delivery's time, so the worker knows how long to sleep.
    pub async fn next_delivery_at(&self) -> Result<Option<Millis>> {
        Ok(sqlx::query_scalar!(
            r#"SELECT MIN(next_attempt_at) AS "at?: i64" FROM alert_deliveries WHERE status = 'pending'"#
        )
        .fetch_one(&self.read)
        .await?)
    }
}
