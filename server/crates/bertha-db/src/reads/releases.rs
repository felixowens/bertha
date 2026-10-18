//! Releases and what each deploy changed.

use bertha_core::domain::{Commit, Release, TimeRange};
use bertha_core::ids::{ProjectId, ReleaseId};
use bertha_core::pages::{ReleaseDetail, ReleaseList};
use bertha_core::time::{HOUR, IsoDate, Millis, floor_hour};

use crate::codec::env_from_bit;
use crate::reads::issues::SummaryShape;
use crate::scope::{Viewer, ids_json};
use crate::series::Grid;
use crate::{Db, Result};

/// Which releases to load.
#[derive(Default)]
struct ReleaseQuery<'a> {
    scope: &'a str,
    project: Option<&'a str>,
    since: Option<Millis>,
    id: Option<&'a str>,
}

impl Db {
    /// Newest first. Counts are worked out from issue history, so they stay true as
    /// issues are triaged:
    /// - new: issues first seen in this version;
    /// - regressed: issues that came back in this version;
    /// - quiet: issues resolved between the previous deploy to the same environment and
    ///   this one, with no event since this deploy;
    /// - events: events tagged with this version.
    async fn release_rows(&self, q: ReleaseQuery<'_>) -> Result<Vec<Release>> {
        let rows = sqlx::query!(
            r#"SELECT r.id, r.project_id, r.version, r.environment, r.deployed_at,
                      r.commit_sha, r.commit_message, r.commit_author,
                      (SELECT COUNT(*) FROM issues i WHERE i.project_id = r.project_id
                        AND i.first_release = r.version) AS "new_issues!: i64",
                      (SELECT COUNT(*) FROM issues i WHERE i.project_id = r.project_id
                        AND i.regressed_in = r.version) AS "regressed_issues!: i64",
                      (SELECT COUNT(*) FROM issues i WHERE i.project_id = r.project_id
                        AND i.status = 'resolved' AND i.resolved_at <= r.deployed_at
                        AND i.resolved_at > COALESCE((SELECT MAX(p.deployed_at) FROM releases p
                              WHERE p.project_id = r.project_id AND p.environment = r.environment
                                AND p.deployed_at < r.deployed_at), 0)
                        AND i.last_seen < r.deployed_at) AS "quiet!: i64",
                      (SELECT COALESCE(SUM(t.count), 0) FROM issue_tags t JOIN issues i ON i.id = t.issue_id
                        WHERE i.project_id = r.project_id AND t.key = 'release'
                          AND t.value = r.version) AS "event_count!: i64"
               FROM releases r
               WHERE r.project_id IN (SELECT value FROM json_each(?1))
                 AND (?2 IS NULL OR r.project_id = ?2)
                 AND (?3 IS NULL OR r.deployed_at >= ?3)
                 AND (?4 IS NULL OR r.id = ?4)
               ORDER BY r.deployed_at DESC, r.id"#,
            q.scope,
            q.project,
            q.since,
            q.id
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|r| {
                let commit = match (r.commit_sha, r.commit_message, r.commit_author) {
                    (Some(sha), message, author) => {
                        Some(Commit { sha, message: message.unwrap_or_default(), author: author.unwrap_or_default() })
                    }
                    _ => None,
                };
                Ok(Release {
                    id: ReleaseId(r.id),
                    project_id: ProjectId(r.project_id),
                    version: r.version,
                    environment: env_from_bit(r.environment)?,
                    deployed_at: IsoDate::from_millis(r.deployed_at),
                    commit,
                    new_issues: r.new_issues as u32,
                    regressed_issues: r.regressed_issues as u32,
                    quiet_since_deploy: r.quiet as u32,
                    event_count: r.event_count.clamp(0, u32::MAX as i64) as u32,
                })
            })
            .collect()
    }

    /// A project's releases from `since` on. No scope check: callers check first.
    pub(crate) async fn releases_since(&self, project: &str, since: Millis) -> Result<Vec<Release>> {
        let scope = ids_json(&[ProjectId(project.to_owned())]);
        self.release_rows(ReleaseQuery { scope: &scope, since: Some(since), ..Default::default() }).await
    }

    /// Releases of the projects in `scope` from `since` on.
    pub(crate) async fn release_rows_in(&self, scope: &str, since: Millis) -> Result<Vec<Release>> {
        self.release_rows(ReleaseQuery { scope, since: Some(since), ..Default::default() }).await
    }

    pub async fn list_releases(&self, viewer: &Viewer, project: Option<&str>) -> Result<ReleaseList> {
        let releases =
            self.release_rows(ReleaseQuery { scope: viewer.scope_json(), project, ..Default::default() }).await?;
        Ok(ReleaseList { releases, projects: self.projects(viewer).await? })
    }

    pub async fn release_detail(&self, viewer: &Viewer, release_id: &str) -> Result<Option<ReleaseDetail>> {
        let Some(release) = self
            .release_rows(ReleaseQuery { scope: viewer.scope_json(), id: Some(release_id), ..Default::default() })
            .await?
            .pop()
        else {
            return Ok(None);
        };
        let project_id = release.project_id.0.clone();
        let Some(project) = self.project(viewer, &project_id).await? else { return Ok(None) };
        let deployed = release.deployed_at.millis().unwrap_or_default();

        let previous_id = sqlx::query_scalar!(
            "SELECT p.id FROM releases p JOIN releases r ON r.id = ?1
             WHERE p.project_id = r.project_id AND p.environment = r.environment
               AND (p.deployed_at < r.deployed_at OR (p.deployed_at = r.deployed_at AND p.id < r.id))
             ORDER BY p.deployed_at DESC, p.id DESC LIMIT 1",
            release_id
        )
        .fetch_optional(&self.read)
        .await?;
        let previous = match previous_id {
            Some(id) => self
                .release_rows(ReleaseQuery { scope: viewer.scope_json(), id: Some(&id), ..Default::default() })
                .await?
                .pop(),
            None => None,
        };

        let new_ids = sqlx::query_scalar!(
            "SELECT id FROM issues WHERE project_id = ? AND first_release = ? ORDER BY last_seen DESC",
            project_id,
            release.version
        )
        .fetch_all(&self.read)
        .await?;
        let regressed_ids = sqlx::query_scalar!(
            "SELECT id FROM issues WHERE project_id = ? AND regressed_in = ? ORDER BY last_seen DESC",
            project_id,
            release.version
        )
        .fetch_all(&self.read)
        .await?;
        let next_id = sqlx::query_scalar!(
            "SELECT n.id FROM releases n JOIN releases r ON r.id = ?1
             WHERE n.project_id = r.project_id AND n.environment = r.environment
               AND (n.deployed_at > r.deployed_at OR (n.deployed_at = r.deployed_at AND n.id > r.id))
             ORDER BY n.deployed_at, n.id LIMIT 1",
            release_id
        )
        .fetch_optional(&self.read)
        .await?;
        let next = match next_id {
            Some(id) => self
                .release_rows(ReleaseQuery { scope: viewer.scope_json(), id: Some(&id), ..Default::default() })
                .await?
                .pop(),
            None => None,
        };
        // The same rule as `quiet_since_deploy`, so the count and its list agree.
        let held_ids = sqlx::query_scalar!(
            "SELECT i.id FROM issues i JOIN releases r ON r.id = ?1
             WHERE i.project_id = r.project_id AND i.status = 'resolved' AND i.resolved_at <= r.deployed_at
               AND i.resolved_at > COALESCE((SELECT MAX(p.deployed_at) FROM releases p
                     WHERE p.project_id = r.project_id AND p.environment = r.environment
                       AND p.deployed_at < r.deployed_at), 0)
               AND i.last_seen < r.deployed_at
             ORDER BY i.resolved_at DESC, i.id",
            release_id
        )
        .fetch_all(&self.read)
        .await?;

        let shape = SummaryShape::month(self.now(), TimeRange::Week);
        let new_issues = self.summaries_of(&new_ids, shape).await?;
        let regressed_issues = self.summaries_of(&regressed_ids, shape).await?;
        let held_fixes = self.summaries_of(&held_ids, shape).await?;
        let after_hours = ((self.now() - deployed) / HOUR).clamp(0, 24) as u32;

        // 24 hours either side of the deploy; hours still to come stay empty.
        let grid = Grid { start: floor_hour(deployed) - 24 * HOUR, step: HOUR, len: 48 };
        let scope = ids_json(std::slice::from_ref(&release.project_id));
        let counts = sqlx::query!(
            r#"SELECT h.hour, SUM(h.count) AS "count!: i64" FROM issue_hourly h JOIN issues i ON i.id = h.issue_id
               WHERE i.project_id = ?1 AND h.hour >= ?2 AND h.hour < ?3 GROUP BY h.hour"#,
            project_id,
            grid.start,
            grid.end()
        )
        .fetch_all(&self.read)
        .await?;
        let alive = self.alive_any(&scope, grid.start).await?;
        let now_hour = floor_hour(self.now());
        let mut filled = grid.fill(counts.into_iter().map(|r| (r.hour, r.count)), &alive);
        for (i, cell) in filled.iter_mut().enumerate() {
            if grid.start + i as Millis * HOUR > now_hour {
                *cell = None;
            }
        }
        Ok(Some(ReleaseDetail {
            release,
            project,
            previous,
            next,
            new_issues,
            regressed_issues,
            held_fixes,
            around: grid.series(filled),
            after_hours,
        }))
    }
}
