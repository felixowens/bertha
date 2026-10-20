//! Fixes that ship: a fixed triage's PR or commit, followed until a release contains it,
//! which resolves the issue. Following it on GitHub is the server's fixes worker; these
//! are the reads and writes it and the manual "fix shipped" share.

use bertha_core::domain::{Activity, FixState, Person};
use bertha_core::fixes::{FixRef, first_state, github_repo, is_sha, parse_fix};
use bertha_core::ids::{IssueId, ProjectId, TriageId};
use bertha_core::time::{IsoDate, Millis};
use sqlx::SqliteConnection;

use crate::codec::parse;
use crate::writes::issues::add_activity;
use crate::{Db, Error, Result};

/// An issue's latest triage, when it ended fixed.
pub(crate) struct LatestFix {
    pub id: String,
    pub state: Option<String>,
}

/// A release the fix may have shipped in.
pub(crate) struct ReleaseSeen {
    pub version: String,
    pub created_at: i64,
}

/// A fix bertha is following: GitHub watching is on for its project.
#[derive(Debug, Clone)]
pub struct WatchedFix {
    pub triage_id: String,
    pub issue_id: IssueId,
    pub project_id: ProjectId,
    pub repo_url: String,
    pub pr: Option<u32>,
    pub commit: Option<String>,
    pub state: FixState,
    /// When the PR merged, or the triage started for a bare commit: releases before this
    /// can't contain it.
    pub since: Millis,
    /// A bare commit may already have been running when the triage started, so the
    /// release running then is checked too.
    pub bare: bool,
    /// Releases first seen up to here were already found not to contain it.
    pub checked_to: Option<Millis>,
    /// The environment its releases are in: production, unless the issue only ever
    /// happened somewhere else.
    pub environment: i64,
}

/// A release with a commit, to compare the fix against.
#[derive(Debug, Clone)]
pub struct Candidate {
    pub version: String,
    pub commit: String,
    pub first_seen: Millis,
}

/// Whether a manual or watched ship resolved the issue.
#[derive(Debug, Clone, PartialEq)]
pub struct Shipped {
    pub project_id: ProjectId,
    pub issue_id: IssueId,
    pub resolved: bool,
}

impl Db {
    /// Fixed triages from before bertha followed fixes: reads their PR or commit from the
    /// fix text, like a new one. Only the latest triage on an unresolved issue is followed.
    pub(crate) async fn read_old_fixes(&self) -> Result<()> {
        let old = sqlx::query!(
            r#"SELECT t.id, t.fix, p.repo_url, i.status,
                      t.id = (SELECT l.id FROM triages l WHERE l.issue_id = t.issue_id
                               ORDER BY l.started_at DESC, l.id DESC LIMIT 1) AS "latest!: bool"
                 FROM triages t JOIN issues i ON i.id = t.issue_id JOIN projects p ON p.id = i.project_id
                WHERE t.outcome = 'fixed' AND t.fix_state IS NULL"#
        )
        .fetch_all(&self.write)
        .await?;
        for t in old {
            let repo = t.repo_url.as_deref().and_then(github_repo);
            let fix = parse_fix(t.fix.as_deref().unwrap_or(""), repo.as_ref());
            let (state, problem) = if t.latest && t.status != "resolved" {
                first_state(&fix)
            } else {
                (FixState::Unwatched, Some("Ended before bertha followed fixes.".to_owned()))
            };
            let pr = fix.pr.map(i64::from);
            let state = state.as_str();
            sqlx::query!(
                "UPDATE triages SET fix_pr = ?, fix_commit = ?, fix_state = ?, fix_problem = ? WHERE id = ?",
                pr,
                fix.commit,
                state,
                problem,
                t.id
            )
            .execute(&self.write)
            .await?;
        }
        Ok(())
    }

    /// Fixes waiting to merge or ship on projects bertha follows on GitHub.
    pub async fn watched_fixes(&self) -> Result<Vec<WatchedFix>> {
        let rows = sqlx::query!(
            r#"SELECT t.id, t.issue_id, i.project_id, p.repo_url AS "repo_url!", t.fix_pr, t.fix_commit,
                      t.fix_state AS "fix_state!", t.fix_merged_at, t.started_at, t.fix_checked_at, i.environments
                 FROM triages t JOIN issues i ON i.id = t.issue_id JOIN projects p ON p.id = i.project_id
                WHERE t.fix_state IN ('waiting_merge', 'waiting_release') AND t.outcome = 'fixed'
                  AND p.watch_fixes = 1 AND p.repo_url IS NOT NULL
                ORDER BY t.updated_at"#
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|r| {
                Ok(WatchedFix {
                    triage_id: r.id,
                    issue_id: IssueId(r.issue_id),
                    project_id: ProjectId(r.project_id),
                    repo_url: r.repo_url,
                    pr: r.fix_pr.and_then(|n| u32::try_from(n).ok()),
                    commit: r.fix_commit,
                    state: parse(&r.fix_state, FixState::parse)?,
                    since: r.fix_merged_at.unwrap_or(r.started_at),
                    bare: r.fix_merged_at.is_none(),
                    checked_to: r.fix_checked_at,
                    environment: if r.environments & 1 != 0 || r.environments == 0 {
                        1
                    } else {
                        r.environments & -r.environments
                    },
                })
            })
            .collect()
    }

    /// Releases the fix could be in, oldest first: those with a commit, in its
    /// environment, first seen since it merged (or running when a bare commit's triage
    /// started) and not checked yet.
    pub async fn fix_candidates(&self, fix: &WatchedFix) -> Result<Vec<Candidate>> {
        let after = fix.checked_to.unwrap_or(i64::MIN);
        let rows = sqlx::query!(
            r#"SELECT version, commit_sha AS "commit_sha!", created_at FROM releases
                WHERE project_id = ?1 AND environment = ?2 AND commit_sha IS NOT NULL AND created_at > ?4
                  AND created_at >= CASE WHEN ?5 THEN COALESCE(
                        (SELECT MAX(created_at) FROM releases
                          WHERE project_id = ?1 AND environment = ?2 AND commit_sha IS NOT NULL AND created_at <= ?3),
                        ?3) ELSE ?3 END
                ORDER BY created_at, id LIMIT 20"#,
            fix.project_id.0,
            fix.environment,
            fix.since,
            after,
            fix.bare
        )
        .fetch_all(&self.read)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| Candidate { version: r.version, commit: r.commit_sha, first_seen: r.created_at })
            .collect())
    }

    /// The PR merged as `sha`: it now waits for a release.
    pub async fn fix_merged(&self, triage_id: &str, sha: &str, merged_at: Millis) -> Result<()> {
        let now = self.now();
        sqlx::query!(
            "UPDATE triages SET fix_state = 'waiting_release', fix_commit = ?, fix_merged_at = ?, fix_problem = NULL,
                                fix_checked_at = NULL, updated_at = MAX(updated_at, ?)
              WHERE id = ? AND fix_state = 'waiting_merge'",
            sha,
            merged_at,
            now,
            triage_id
        )
        .execute(&self.write)
        .await?;
        Ok(())
    }

    /// The PR closed without merging. A new triage, or marking it shipped, moves on.
    pub async fn fix_closed(&self, triage_id: &str) -> Result<()> {
        sqlx::query!(
            "UPDATE triages SET fix_state = 'closed', fix_problem = NULL WHERE id = ? AND fix_state = 'waiting_merge'",
            triage_id
        )
        .execute(&self.write)
        .await?;
        Ok(())
    }

    /// What GitHub answered when it couldn't be read, or `None` once it can.
    pub async fn fix_problem(&self, triage_id: &str, problem: Option<&str>) -> Result<()> {
        sqlx::query!("UPDATE triages SET fix_problem = ? WHERE id = ?", problem, triage_id)
            .execute(&self.write)
            .await?;
        Ok(())
    }

    /// Releases first seen up to `to` don't contain the fix.
    pub async fn fix_checked(&self, triage_id: &str, to: Millis) -> Result<()> {
        sqlx::query!("UPDATE triages SET fix_checked_at = ?, fix_problem = NULL WHERE id = ?", to, triage_id)
            .execute(&self.write)
            .await?;
        Ok(())
    }

    /// bertha saw the fix in `release`: marks it shipped and, if the issue is still open,
    /// resolves it there.
    pub async fn fix_seen_shipping(&self, triage_id: &str, release: &Candidate) -> Result<Option<Shipped>> {
        let now = self.now();
        let mut tx = self.write.begin().await?;
        let Some(t) = sqlx::query!(
            "SELECT t.issue_id, i.project_id, i.status FROM triages t JOIN issues i ON i.id = t.issue_id
              WHERE t.id = ? AND t.fix_state IN ('waiting_merge', 'waiting_release')",
            triage_id
        )
        .fetch_optional(&mut *tx)
        .await?
        else {
            return Ok(None);
        };
        let seen = ReleaseSeen { version: release.version.clone(), created_at: release.first_seen };
        // Resolved or ignored by someone meanwhile: their call stands.
        let reopen = matches!(t.status.as_str(), "unresolved" | "snoozed");
        let resolved = ship(&mut tx, &t.issue_id, triage_id, Some(&seen), now, None, None, reopen).await?;
        tx.commit().await?;
        tracing::info!(issue = t.issue_id, release = release.version, "fix shipped");
        Ok(Some(Shipped { project_id: ProjectId(t.project_id), issue_id: IssueId(t.issue_id), resolved }))
    }
}

/// The issue's latest triage, if it ended fixed.
pub(crate) async fn latest_fix(tx: &mut SqliteConnection, issue_id: &str) -> Result<Option<LatestFix>> {
    let t = sqlx::query!(
        "SELECT id, outcome, fix_state FROM triages WHERE issue_id = ?
          ORDER BY started_at DESC, id DESC LIMIT 1",
        issue_id
    )
    .fetch_optional(&mut *tx)
    .await?;
    Ok(t.filter(|t| t.outcome.as_deref() == Some("fixed")).map(|t| LatestFix { id: t.id, state: t.fix_state }))
}

/// The release running now in a project: production first, then the latest deployed.
pub(crate) async fn current_release(tx: &mut SqliteConnection, project_id: &str) -> Result<Option<ReleaseSeen>> {
    let r = sqlx::query_as!(
        ReleaseSeen,
        "SELECT version, created_at FROM releases WHERE project_id = ?
          ORDER BY environment = 1 DESC, deployed_at DESC, id DESC LIMIT 1",
        project_id
    )
    .fetch_optional(&mut *tx)
    .await?;
    Ok(r)
}

/// Marks a fix shipped in `release` and, with `resolve`, resolves its issue there: events
/// from releases first seen before it are old code. Returns whether it resolved.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn ship(
    tx: &mut SqliteConnection,
    issue_id: &str,
    triage_id: &str,
    release: Option<&ReleaseSeen>,
    now: Millis,
    by: Option<Person>,
    via: Option<String>,
    resolve: bool,
) -> Result<bool> {
    let version = release.map(|r| r.version.as_str());
    let t = sqlx::query!(
        "UPDATE triages SET fix_state = 'shipped', fix_release = ?, fix_problem = NULL WHERE id = ?
         RETURNING fix_pr, fix_commit",
        version,
        triage_id
    )
    .fetch_one(&mut *tx)
    .await?;
    if !resolve {
        return Ok(false);
    }
    // With no release at all, nothing is known to be old code.
    let from = release.map_or(now, |r| r.created_at);
    sqlx::query!(
        "UPDATE issues SET status = 'resolved', resolved_at = ?, regressed_at = NULL,
                resolved_in_release = ?, resolved_from = ?,
                snooze_until = NULL, snooze_total = NULL, snooze_remaining = NULL,
                version = version + 1
         WHERE id = ?",
        now,
        version,
        from,
        issue_id
    )
    .execute(&mut *tx)
    .await?;
    let entry = Activity::FixShipped {
        at: IsoDate::from_millis(now),
        by,
        via,
        triage_id: TriageId(triage_id.to_owned()),
        pr: t.fix_pr.and_then(|n| u32::try_from(n).ok()),
        commit: t.fix_commit,
        release: version.map(str::to_owned),
    };
    add_activity(tx, issue_id, now, &entry).await?;
    Ok(true)
}

/// Someone resolved the issue: a fix still waiting counts as shipped, so bertha stops
/// following it. A closed PR stays closed.
pub(crate) async fn resolved_by_hand(tx: &mut SqliteConnection, issue_id: &str, release: Option<&str>) -> Result<()> {
    sqlx::query!(
        "UPDATE triages SET fix_state = 'shipped', fix_release = ?, fix_problem = NULL
          WHERE issue_id = ? AND outcome = 'fixed' AND fix_state IN ('waiting_merge', 'waiting_release', 'unwatched')",
        release,
        issue_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

/// A triage ending fixed: what it names, and where following it starts. Earlier fixes on
/// the issue that were still waiting give way to this one.
pub(crate) async fn record_fix(
    tx: &mut SqliteConnection,
    triage_id: &str,
    issue_id: &str,
    text: Option<&str>,
    pr: Option<u32>,
    commit: Option<&str>,
) -> Result<()> {
    let repo = sqlx::query_scalar!(
        "SELECT p.repo_url FROM issues i JOIN projects p ON p.id = i.project_id WHERE i.id = ?",
        issue_id
    )
    .fetch_one(&mut *tx)
    .await?;
    let repo = repo.as_deref().and_then(github_repo);
    if let Some(c) = commit
        && !is_sha(c)
    {
        return Err(Error::Invalid(format!(
            "\"{c}\" isn't a commit. Give 7 to 40 characters of its sha. Nothing was changed."
        )));
    }
    let parsed = parse_fix(text.unwrap_or(""), repo.as_ref());
    let fix = match (pr, commit) {
        (None, None) => parsed,
        (pr, commit) => FixRef { pr, commit: commit.map(str::to_owned) },
    };
    let (state, problem) = first_state(&fix);
    let state = state.as_str();
    let pr = fix.pr.map(i64::from);
    sqlx::query!(
        "UPDATE triages SET fix_pr = ?, fix_commit = ?, fix_state = ?, fix_problem = ?, fix_merged_at = NULL,
                            fix_release = NULL, fix_checked_at = NULL
          WHERE id = ?",
        pr,
        fix.commit,
        state,
        problem,
        triage_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE triages SET fix_state = 'unwatched', fix_problem = 'A later triage replaced this fix.'
          WHERE issue_id = ? AND id != ? AND fix_state IN ('waiting_merge', 'waiting_release')",
        issue_id,
        triage_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}
