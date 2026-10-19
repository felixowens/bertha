//! Folding mis-grouped issues into one. Anyone who can triage the project can do it.

use bertha_core::api::{MergeIssuesFailure, Outcome};
use bertha_core::domain::{Activity, Issue};
use bertha_core::ids::ProjectId;
use bertha_core::time::IsoDate;

use crate::scope::Viewer;
use crate::writes::issues::add_activity;
use crate::{Db, Error, Result};

impl Db {
    /// Moves the sources' events, rollups, tags, users and notes onto the target and
    /// deletes the sources. Their fingerprints become aliases of the target, so new
    /// events like them land there too.
    pub async fn merge_issues(
        &self,
        viewer: &Viewer,
        target_id: &str,
        source_ids: &[String],
    ) -> Result<Outcome<Issue, MergeIssuesFailure>> {
        let mut sources: Vec<&str> = Vec::with_capacity(source_ids.len());
        for s in source_ids {
            if s != target_id && !sources.contains(&s.as_str()) {
                sources.push(s);
            }
        }
        if sources.is_empty() {
            return Err(Error::Invalid("Pick an issue to merge into this one.".into()));
        }
        let json = serde_json::to_string(&sources)?;

        let mut tx = self.write.begin().await?;
        let Some(target_project) = sqlx::query_scalar!("SELECT project_id FROM issues WHERE id = ?", target_id)
            .fetch_optional(&mut *tx)
            .await?
            .filter(|p| viewer.can_see(&ProjectId(p.clone())))
        else {
            return Ok(Outcome::fail(MergeIssuesFailure::NotFound));
        };
        let found = sqlx::query!(
            "SELECT id, short_id, project_id, environments FROM issues WHERE id IN (SELECT value FROM json_each(?))",
            json
        )
        .fetch_all(&mut *tx)
        .await?;
        if found.len() != sources.len() || found.iter().any(|r| !viewer.can_see(&ProjectId(r.project_id.clone()))) {
            return Ok(Outcome::fail(MergeIssuesFailure::NotFound));
        }
        let environments = found.iter().fold(0, |acc, r| acc | r.environments);
        if found.iter().any(|r| r.project_id != target_project) {
            return Ok(Outcome::fail(MergeIssuesFailure::DifferentProjects));
        }

        // Fingerprints first: the sources' own, and any aliases already pointing at them.
        sqlx::query!(
            "UPDATE issue_aliases SET issue_id = ?1 WHERE issue_id IN (SELECT value FROM json_each(?2))",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!(
            "INSERT OR REPLACE INTO issue_aliases (project_id, fingerprint, issue_id)
             SELECT project_id, fingerprint, ?1 FROM issues WHERE id IN (SELECT value FROM json_each(?2))",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;

        // Events: a retried send already on the target stays there once.
        sqlx::query!(
            "UPDATE OR IGNORE events SET issue_id = ?1 WHERE issue_id IN (SELECT value FROM json_each(?2))",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!(
            "INSERT INTO issue_hourly (issue_id, hour, count)
             SELECT ?1, hour, SUM(count) FROM issue_hourly WHERE issue_id IN (SELECT value FROM json_each(?2))
             GROUP BY hour
             ON CONFLICT (issue_id, hour) DO UPDATE SET count = count + excluded.count",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!(
            "INSERT INTO issue_tags (issue_id, key, value, count)
             SELECT ?1, key, value, SUM(count) FROM issue_tags WHERE issue_id IN (SELECT value FROM json_each(?2))
             GROUP BY key, value
             ON CONFLICT (issue_id, key, value) DO UPDATE SET count = count + excluded.count",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!(
            "INSERT INTO issue_tag_keys (issue_id, key, distinct_count)
             SELECT ?1, key, MAX(distinct_count) FROM issue_tag_keys
             WHERE issue_id IN (SELECT value FROM json_each(?2)) GROUP BY key
             ON CONFLICT (issue_id, key) DO UPDATE SET distinct_count = MAX(distinct_count, excluded.distinct_count)",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!(
            "INSERT OR IGNORE INTO issue_users (issue_id, user_hash)
             SELECT ?1, user_hash FROM issue_users WHERE issue_id IN (SELECT value FROM json_each(?2))",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;
        // Notes are what people wrote; the rest of the sources' history goes with them.
        sqlx::query!(
            "UPDATE activity SET issue_id = ?1
             WHERE issue_id IN (SELECT value FROM json_each(?2)) AND json_extract(data, '$.kind') = 'note'",
            target_id,
            json
        )
        .execute(&mut *tx)
        .await?;

        // The target's summary covers everything now: earliest first seen, latest last
        // seen, worst level, every environment.
        sqlx::query!(
            "UPDATE issues SET
                first_seen = (SELECT MIN(first_seen) FROM issues WHERE id = ?1 OR id IN (SELECT value FROM json_each(?2))),
                last_seen = (SELECT MAX(last_seen) FROM issues WHERE id = ?1 OR id IN (SELECT value FROM json_each(?2))),
                event_count = (SELECT SUM(event_count) FROM issues WHERE id = ?1 OR id IN (SELECT value FROM json_each(?2))),
                environments = environments | ?3,
                first_release = (SELECT first_release FROM issues
                                 WHERE id = ?1 OR id IN (SELECT value FROM json_each(?2))
                                 ORDER BY first_seen, id LIMIT 1),
                level = (SELECT level FROM issues WHERE id = ?1 OR id IN (SELECT value FROM json_each(?2))
                         ORDER BY CASE level WHEN 'fatal' THEN 0 WHEN 'error' THEN 1 ELSE 2 END LIMIT 1),
                user_count = (SELECT COUNT(*) FROM issue_users WHERE issue_id = ?1),
                version = version + 1
             WHERE id = ?1",
            target_id,
            json,
            environments
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query!("DELETE FROM issues WHERE id IN (SELECT value FROM json_each(?))", json).execute(&mut *tx).await?;
        // The sources are gone, so the target keeps the record of what it absorbed.
        let now = self.now();
        let from =
            sources.iter().filter_map(|id| found.iter().find(|r| r.id == *id)).map(|r| r.short_id.clone()).collect();
        let entry = Activity::Merged {
            at: IsoDate::from_millis(now),
            by: viewer.person(),
            via: viewer.agent().map(str::to_owned),
            from,
        };
        add_activity(&mut tx, target_id, now, &entry).await?;
        tx.commit().await?;
        tracing::info!(target = target_id, merged = sources.len(), "issues merged");

        match self.issue(target_id).await? {
            Some(issue) => Ok(Outcome::Ok(issue)),
            None => Err(Error::Corrupt(format!("issue {target_id} vanished after merging"))),
        }
    }
}
