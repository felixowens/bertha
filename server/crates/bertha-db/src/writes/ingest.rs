//! What ingest writes: events grouped into issues, the hourly rollups every chart
//! reads, tag and user counts, releases first seen in events, deploys, heartbeats and
//! source maps.
//!
//! None of this goes through a `Viewer`: ingest is authenticated by a project's key,
//! and every function here takes the project that key belongs to.

use bertha_core::domain::{Activity, Environment, Level, TagKey, UnsnoozeReason};
use bertha_core::ids::{EventId, IssueId, ProjectId, ReleaseId};
use bertha_core::time::{IsoDate, Millis, floor_hour};

use super::issues::add_activity;
use crate::codec::{env_bit, short_id, to_blob};
use crate::stored::StoredEvent;
use crate::{Db, Result};

/// Value rows kept per tag key per issue; rarer values only count towards `distinct`.
pub const TAG_VALUES_PER_KEY: i64 = 50;

/// The project an ingest or upload key belongs to.
#[derive(Debug, Clone, PartialEq)]
pub struct KeyedProject {
    pub id: ProjectId,
    pub key: String,
    pub name: String,
}

/// One event, ready to store: grouped, symbolicated and bounded by `bertha-ingest`.
#[derive(Debug, Clone, PartialEq)]
pub struct NewEvent {
    /// The SDK's id, for dropping retried sends.
    pub client_id: Option<String>,
    pub at: Millis,
    pub fingerprint: [u8; 16],
    pub r#type: String,
    /// One line, for the issue title.
    pub message: String,
    pub culprit: Option<String>,
    pub level: Level,
    pub environment: Environment,
    pub release: Option<String>,
    /// Who it happened to, hashed: id, email or address.
    pub user_hash: Option<[u8; 16]>,
    pub tags: Vec<(TagKey, String)>,
    pub payload: StoredEvent,
}

/// What an event did to its issue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Change {
    /// The first event of a new issue.
    New,
    /// A resolved issue came back.
    Regressed,
    /// The event that lifted an events-snooze.
    Unsnoozed,
    /// Another event on an issue already open, ignored or snoozed.
    Repeat,
    /// A retried send: nothing was stored.
    Duplicate,
}

/// One stored event and its issue, for alerts and live updates.
#[derive(Debug, Clone, PartialEq)]
pub struct Ingested {
    pub change: Change,
    pub project_id: ProjectId,
    pub issue_id: IssueId,
    pub short_id: String,
    pub r#type: String,
    pub message: String,
    pub level: Level,
    pub environment: Environment,
    pub release: Option<String>,
    pub at: Millis,
    /// Whether the issue is ignored or snoozed after this event: those don't alert.
    pub quiet: bool,
}

fn severity(l: &str) -> u8 {
    match l {
        "fatal" => 3,
        "error" => 2,
        _ => 1,
    }
}

impl Db {
    pub async fn project_by_ingest_key(&self, key: &str) -> Result<Option<KeyedProject>> {
        let row = sqlx::query!("SELECT id, key, name FROM projects WHERE ingest_key = ?", key)
            .fetch_optional(&self.read)
            .await?;
        Ok(row.map(|r| KeyedProject { id: ProjectId(r.id), key: r.key, name: r.name }))
    }

    pub async fn project_by_upload_key(&self, key: &str) -> Result<Option<KeyedProject>> {
        let row = sqlx::query!("SELECT id, key, name FROM projects WHERE upload_key = ?", key)
            .fetch_optional(&self.read)
            .await?;
        Ok(row.map(|r| KeyedProject { id: ProjectId(r.id), key: r.key, name: r.name }))
    }

    /// Stores a batch in one transaction: all of it or, on a database error, none.
    pub async fn ingest(&self, project: &KeyedProject, events: &[NewEvent]) -> Result<Vec<Ingested>> {
        let mut tx = self.write.begin().await?;
        let mut out = Vec::with_capacity(events.len());
        let mut first_at: Option<Millis> = None;
        let mut last_at: Option<Millis> = None;
        for e in events {
            let done = ingest_one(&mut tx, project, e).await?;
            if done.change != Change::Duplicate {
                first_at = Some(first_at.map_or(e.at, |f| f.min(e.at)));
                last_at = Some(last_at.map_or(e.at, |l| l.max(e.at)));
            }
            out.push(done);
        }
        if let (Some(first), Some(last)) = (first_at, last_at) {
            sqlx::query!(
                "UPDATE projects SET first_event_at = COALESCE(MIN(first_event_at, ?1), ?1),
                                     last_event_at = COALESCE(MAX(last_event_at, ?2), ?2)
                 WHERE id = ?3",
                first,
                last,
                project.id.0
            )
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(out)
    }

    /// A process saying it's alive: this hour has data, even with no errors.
    pub async fn heartbeat(&self, project: &ProjectId, at: Millis) -> Result<()> {
        let hour = floor_hour(at);
        sqlx::query!("INSERT OR IGNORE INTO project_hours (project_id, hour) VALUES (?, ?)", project.0, hour)
            .execute(&self.write)
            .await?;
        Ok(())
    }

    /// A running process naming its release: the release starts here if no deploy or
    /// event announced it, and learns its commit if it didn't know one. A commit from
    /// CI, which has the message and author too, is never replaced.
    pub async fn running_release(
        &self,
        project: &ProjectId,
        version: &str,
        environment: Environment,
        at: Millis,
        commit: Option<&str>,
    ) -> Result<()> {
        let id = ReleaseId::generate();
        let env = env_bit(environment);
        let commit = commit.or_else(|| commit_like(version));
        sqlx::query!(
            "INSERT INTO releases (id, project_id, version, environment, deployed_at, commit_sha, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'heartbeat', ?)
             ON CONFLICT (project_id, version, environment) DO UPDATE SET commit_sha = excluded.commit_sha
               WHERE commit_sha IS NULL AND excluded.commit_sha IS NOT NULL",
            id.0,
            project.0,
            version,
            env,
            at,
            commit,
            at
        )
        .execute(&self.write)
        .await?;
        Ok(())
    }

    /// Records a deploy from CI. Deploying the same version again moves its time and
    /// fills in commit details it didn't have.
    pub async fn record_deploy(
        &self,
        project: &ProjectId,
        version: &str,
        environment: Environment,
        deployed_at: Millis,
        commit: Option<(&str, &str, &str)>,
    ) -> Result<ReleaseId> {
        let id = ReleaseId::generate();
        let env = env_bit(environment);
        let (sha, message, author) = match commit {
            Some((s, m, a)) => (Some(s), Some(m), Some(a)),
            None => (commit_like(version), None, None),
        };
        let now = self.now();
        let row = sqlx::query_scalar!(
            r#"INSERT INTO releases (id, project_id, version, environment, deployed_at, commit_sha, commit_message,
                                     commit_author, source, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'deploy', ?)
               ON CONFLICT (project_id, version, environment) DO UPDATE SET
                 deployed_at = excluded.deployed_at,
                 source = 'deploy',
                 commit_sha = COALESCE(excluded.commit_sha, commit_sha),
                 commit_message = COALESCE(excluded.commit_message, commit_message),
                 commit_author = COALESCE(excluded.commit_author, commit_author)
               RETURNING id AS "id!""#,
            id.0,
            project.0,
            version,
            env,
            deployed_at,
            sha,
            message,
            author,
            now
        )
        .fetch_one(&self.write)
        .await?;
        Ok(ReleaseId(row))
    }

    /// Keeps an uploaded source map (deflated). Uploading the same debug id again
    /// replaces it.
    pub async fn save_sourcemap(
        &self,
        project: &ProjectId,
        debug_id: &str,
        file: &str,
        release: Option<&str>,
        map_json: &[u8],
    ) -> Result<()> {
        let data = crate::codec::deflate(map_json);
        let now = self.now();
        sqlx::query!(
            "INSERT INTO sourcemaps (project_id, debug_id, file, release, data, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (project_id, debug_id) DO UPDATE SET
               file = excluded.file, release = excluded.release, data = excluded.data, uploaded_at = excluded.uploaded_at",
            project.0,
            debug_id,
            file,
            release,
            data,
            now
        )
        .execute(&self.write)
        .await?;
        Ok(())
    }

    /// The raw source map JSON for a debug id, if one was uploaded.
    pub async fn sourcemap(&self, project: &ProjectId, debug_id: &str, limit: usize) -> Result<Option<Vec<u8>>> {
        let row = sqlx::query_scalar!(
            "SELECT data FROM sourcemaps WHERE project_id = ? AND debug_id = ?",
            project.0,
            debug_id
        )
        .fetch_optional(&self.read)
        .await?;
        row.map(|b| crate::codec::inflate(&b, limit)).transpose()
    }
}

async fn ingest_one(tx: &mut sqlx::SqliteConnection, project: &KeyedProject, e: &NewEvent) -> Result<Ingested> {
    let fp = e.fingerprint.as_slice();
    let existing = sqlx::query!(
        "SELECT id, short_id, type, message, level, status, snooze_remaining, snooze_until, resolved_at,
                resolved_in_release
         FROM issues
         WHERE project_id = ?1 AND (fingerprint = ?2
               OR id = (SELECT issue_id FROM issue_aliases WHERE project_id = ?1 AND fingerprint = ?2))
         ORDER BY fingerprint = ?2 DESC LIMIT 1",
        project.id.0,
        fp
    )
    .fetch_optional(&mut *tx)
    .await?;
    let iso = IsoDate::from_millis(e.at);
    let env = env_bit(e.environment);

    let (issue_id, short, title_type, title, level, change, quiet) = match existing {
        Some(issue) => {
            if let Some(client_id) = &e.client_id {
                let dup = sqlx::query_scalar!(
                    r#"SELECT EXISTS (SELECT 1 FROM events WHERE issue_id = ? AND client_id = ?) AS "x!: bool""#,
                    issue.id,
                    client_id
                )
                .fetch_one(&mut *tx)
                .await?;
                if dup {
                    return Ok(Ingested {
                        change: Change::Duplicate,
                        project_id: project.id.clone(),
                        issue_id: IssueId(issue.id),
                        short_id: issue.short_id,
                        r#type: issue.r#type,
                        message: issue.message,
                        level: e.level,
                        environment: e.environment,
                        release: e.release.clone(),
                        at: e.at,
                        quiet: true,
                    });
                }
            }
            // The issue keeps its worst level.
            let level = if severity(e.level.as_str()) > severity(&issue.level) {
                e.level.as_str().to_owned()
            } else {
                issue.level.clone()
            };
            let lifts = if issue.status != "snoozed" {
                None
            } else if issue.snooze_remaining.is_some_and(|r| r <= 1) {
                Some(UnsnoozeReason::EventThreshold)
            } else if issue.snooze_until.is_some_and(|u| u <= e.at) {
                // The housekeeping worker lifts these too; an event may get there first.
                Some(UnsnoozeReason::DatePassed)
            } else {
                None
            };
            // Resolved "in the next release": the release that was running then is the old
            // code still draining away.
            let old_code = issue.resolved_in_release.is_some() && issue.resolved_in_release == e.release;
            let change = match (issue.status.as_str(), lifts) {
                // Something that happened before the fix, arriving late, isn't a regression.
                ("resolved", _) if !old_code && issue.resolved_at.is_none_or(|r| e.at > r) => Change::Regressed,
                (_, Some(_)) => Change::Unsnoozed,
                _ => Change::Repeat,
            };
            match change {
                Change::Regressed => {
                    sqlx::query!(
                        "UPDATE issues SET status = 'unresolved', regressed_in = ?, regressed_at = ?, resolved_at = NULL,
                                           resolved_in_release = NULL, version = version + 1
                         WHERE id = ?",
                        e.release,
                        e.at,
                        issue.id
                    )
                    .execute(&mut *tx)
                    .await?;
                    add_activity(
                        tx,
                        &issue.id,
                        e.at,
                        &Activity::Regressed { at: iso.clone(), release: e.release.clone() },
                    )
                    .await?;
                }
                Change::Unsnoozed => {
                    sqlx::query!(
                        "UPDATE issues SET status = 'unresolved', snooze_until = NULL, snooze_total = NULL,
                                           snooze_remaining = NULL, version = version + 1
                         WHERE id = ?",
                        issue.id
                    )
                    .execute(&mut *tx)
                    .await?;
                    let reason = lifts.unwrap_or(UnsnoozeReason::EventThreshold);
                    let entry = Activity::Unsnoozed { at: iso.clone(), reason };
                    add_activity(tx, &issue.id, e.at, &entry).await?;
                }
                _ if issue.snooze_remaining.is_some() => {
                    sqlx::query!("UPDATE issues SET snooze_remaining = snooze_remaining - 1 WHERE id = ?", issue.id)
                        .execute(&mut *tx)
                        .await?;
                }
                _ => {}
            }
            sqlx::query!(
                "UPDATE issues SET last_seen = MAX(last_seen, ?), event_count = event_count + 1, level = ?,
                                   environments = environments | ?
                 WHERE id = ?",
                e.at,
                level,
                env,
                issue.id
            )
            .execute(&mut *tx)
            .await?;
            let quiet =
                matches!(change, Change::Repeat) && matches!(issue.status.as_str(), "ignored" | "snoozed" | "resolved");
            let level = Level::parse(&level).unwrap_or(e.level);
            (issue.id, issue.short_id, issue.r#type, issue.message, level, change, quiet)
        }
        None => {
            let seq = sqlx::query_scalar!(
                "UPDATE projects SET next_short_seq = next_short_seq + 1 WHERE id = ? RETURNING next_short_seq - 1",
                project.id.0
            )
            .fetch_one(&mut *tx)
            .await?;
            let id = IssueId::generate();
            let short = short_id(&project.key, seq);
            let level = e.level.as_str();
            sqlx::query!(
                "INSERT INTO issues (id, project_id, short_seq, short_id, fingerprint, type, message, culprit, level,
                                     status, first_seen, last_seen, event_count, environments, first_release)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', ?, ?, 1, ?, ?)",
                id.0,
                project.id.0,
                seq,
                short,
                fp,
                e.r#type,
                e.message,
                e.culprit,
                level,
                e.at,
                e.at,
                env,
                e.release
            )
            .execute(&mut *tx)
            .await?;
            add_activity(tx, &id.0, e.at, &Activity::FirstSeen { at: iso.clone(), release: e.release.clone() }).await?;
            (id.0, short, e.r#type.clone(), e.message.clone(), e.level, Change::New, false)
        }
    };

    let hour = floor_hour(e.at);
    sqlx::query!(
        "INSERT INTO issue_hourly (issue_id, hour, count) VALUES (?, ?, 1)
         ON CONFLICT (issue_id, hour) DO UPDATE SET count = count + 1",
        issue_id,
        hour
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!("INSERT OR IGNORE INTO project_hours (project_id, hour) VALUES (?, ?)", project.id.0, hour)
        .execute(&mut *tx)
        .await?;

    if let Some(user) = e.user_hash {
        let user = user.as_slice();
        let added =
            sqlx::query!("INSERT OR IGNORE INTO issue_users (issue_id, user_hash) VALUES (?, ?)", issue_id, user)
                .execute(&mut *tx)
                .await?
                .rows_affected();
        if added > 0 {
            sqlx::query!("UPDATE issues SET user_count = user_count + 1 WHERE id = ?", issue_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    for (key, value) in &e.tags {
        count_tag(tx, &issue_id, key.as_str(), value).await?;
    }

    if let Some(version) = &e.release {
        // An event from a release no deploy announced: the release starts here.
        let id = ReleaseId::generate();
        let sha = commit_like(version);
        sqlx::query!(
            "INSERT OR IGNORE INTO releases (id, project_id, version, environment, deployed_at, commit_sha, source,
                                             created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'event', ?)",
            id.0,
            project.id.0,
            version,
            env,
            e.at,
            sha,
            e.at
        )
        .execute(&mut *tx)
        .await?;
    }

    let event_id = EventId::generate();
    let payload = to_blob(&e.payload)?;
    let trace_id = e.payload.trace.as_ref().map(|t| t.trace_id.as_str());
    sqlx::query!(
        "INSERT INTO events (id, issue_id, client_id, received_at, trace_id, payload) VALUES (?, ?, ?, ?, ?, ?)",
        event_id.0,
        issue_id,
        e.client_id,
        e.at,
        trace_id,
        payload
    )
    .execute(&mut *tx)
    .await?;

    Ok(Ingested {
        change,
        project_id: project.id.clone(),
        issue_id: IssueId(issue_id),
        short_id: short,
        r#type: title_type,
        message: title,
        level,
        environment: e.environment,
        release: e.release.clone(),
        at: e.at,
        quiet,
    })
}

/// A release named by its full commit sha (40 hex characters, or 64 for SHA-256
/// repositories) is that commit.
fn commit_like(version: &str) -> Option<&str> {
    (matches!(version.len(), 40 | 64) && version.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')))
        .then_some(version)
}

/// Counts one tag value. Past [`TAG_VALUES_PER_KEY`] values, new ones only raise the
/// key's distinct count, so a tag with a value per user can't grow without bound.
async fn count_tag(tx: &mut sqlx::SqliteConnection, issue_id: &str, key: &str, value: &str) -> Result<()> {
    let bumped = sqlx::query!(
        "UPDATE issue_tags SET count = count + 1 WHERE issue_id = ? AND key = ? AND value = ?",
        issue_id,
        key,
        value
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if bumped > 0 {
        return Ok(());
    }
    sqlx::query!(
        "INSERT INTO issue_tags (issue_id, key, value, count)
         SELECT ?1, ?2, ?3, 1
         WHERE (SELECT COUNT(*) FROM issue_tags WHERE issue_id = ?1 AND key = ?2) < ?4",
        issue_id,
        key,
        value,
        TAG_VALUES_PER_KEY
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "INSERT INTO issue_tag_keys (issue_id, key, distinct_count) VALUES (?, ?, 1)
         ON CONFLICT (issue_id, key) DO UPDATE SET distinct_count = distinct_count + 1",
        issue_id,
        key
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}
