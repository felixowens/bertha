//! Triage: resolve, ignore, snooze, reopen, assign, and notes.

use std::collections::HashMap;

use bertha_core::api::{AddIssueNoteFailure, IssueChange, Outcome, SeenIssue, UpdateIssuesFailure};
use bertha_core::domain::{Activity, Issue, IssueStatus, IssueSummary, Person, Snooze, TimeRange};
use bertha_core::ids::{MemberId, ProjectId};
use bertha_core::time::{IsoDate, Millis};
use sqlx::SqliteConnection;

use crate::codec::parse;
use crate::reads::issues::SummaryShape;
use crate::scope::Viewer;
use crate::{Db, Error, Result};

/// Notes longer than this are refused rather than truncated.
pub const NOTE_LIMIT: usize = 10_000;
/// "Snooze for N events" accepts at most this many.
const SNOOZE_EVENTS_LIMIT: u32 = 1_000_000;

struct Current {
    id: String,
    project_id: String,
    status: String,
    assignee_id: Option<String>,
}

pub(crate) async fn add_activity(
    tx: &mut SqliteConnection,
    issue_id: &str,
    at: Millis,
    entry: &Activity,
) -> Result<()> {
    let data = serde_json::to_string(entry)?;
    sqlx::query!("INSERT INTO activity (issue_id, at, data) VALUES (?, ?, ?)", issue_id, at, data)
        .execute(&mut *tx)
        .await?;
    Ok(())
}

impl Db {
    /// Applies one change to every issue, or to none of them.
    ///
    /// With `seen`, an issue whose status or assignee moved on since the client saw it
    /// is a `conflict`. Issues outside the viewer's projects are `permission_denied`;
    /// ids that don't exist are `not_found`. Changes that are already true (resolving a
    /// resolved issue) leave that issue and its activity alone.
    pub async fn update_issues(
        &self,
        viewer: &Viewer,
        ids: &[String],
        change: &IssueChange,
        seen: Option<&[SeenIssue]>,
    ) -> Result<Outcome<Vec<IssueSummary>, UpdateIssuesFailure>> {
        let mut ids: Vec<String> = ids.to_vec();
        ids.dedup();
        if ids.is_empty() {
            return Ok(Outcome::Ok(vec![]));
        }
        let now = self.now();
        let snooze_until = validate_change(change, now)?;
        let assignee = match change {
            IssueChange::Assign { person_id: Some(id) } => Some(self.assignee(id).await?),
            _ => None,
        };

        let mut tx = self.write.begin().await?;
        let json = serde_json::to_string(&ids)?;
        let rows = sqlx::query_as!(
            Current,
            "SELECT id, project_id, status, assignee_id FROM issues WHERE id IN (SELECT value FROM json_each(?))",
            json
        )
        .fetch_all(&mut *tx)
        .await?;
        let current: HashMap<&str, &Current> = rows.iter().map(|r| (r.id.as_str(), r)).collect();
        if ids.iter().any(|id| !current.contains_key(id.as_str())) {
            return Ok(Outcome::fail(UpdateIssuesFailure::NotFound));
        }
        if rows.iter().any(|r| !viewer.can_see(&ProjectId(r.project_id.clone()))) {
            return Ok(Outcome::fail(UpdateIssuesFailure::PermissionDenied));
        }
        if let Some(seen) = seen {
            for s in seen {
                let Some(c) = current.get(s.id.as_str()) else { continue };
                if c.status != s.status.as_str()
                    || c.assignee_id.as_deref() != s.assignee_id.as_ref().map(|m| m.as_str())
                {
                    return Ok(Outcome::fail(UpdateIssuesFailure::Conflict));
                }
            }
        }
        if let Some(person) = &assignee {
            for r in &rows {
                if !self.assignable(&[ProjectId(r.project_id.clone())]).await?.iter().any(|p| p.id == person.id) {
                    return Err(Error::Invalid(format!(
                        "{} can't see this project, so can't be assigned.",
                        person.name
                    )));
                }
            }
        }

        let at = IsoDate::from_millis(now);
        let by = viewer.person();
        for r in &rows {
            let status = parse(&r.status, IssueStatus::parse)?;
            let entry = match change {
                IssueChange::Resolve if status != IssueStatus::Resolved => {
                    sqlx::query!(
                        "UPDATE issues SET status = 'resolved', resolved_at = ?, regressed_at = NULL,
                                snooze_until = NULL, snooze_total = NULL, snooze_remaining = NULL,
                                version = version + 1
                         WHERE id = ?",
                        now,
                        r.id
                    )
                    .execute(&mut *tx)
                    .await?;
                    Activity::Resolved { at: at.clone(), by: by.clone() }
                }
                IssueChange::Ignore if status != IssueStatus::Ignored => {
                    sqlx::query!(
                        "UPDATE issues SET status = 'ignored', regressed_at = NULL,
                                snooze_until = NULL, snooze_total = NULL, snooze_remaining = NULL,
                                version = version + 1
                         WHERE id = ?",
                        r.id
                    )
                    .execute(&mut *tx)
                    .await?;
                    Activity::Ignored { at: at.clone(), by: by.clone() }
                }
                IssueChange::Snooze { snooze } => {
                    let total = match snooze {
                        Snooze::Until { .. } => None,
                        Snooze::Events { total, .. } => Some(i64::from(*total)),
                    };
                    sqlx::query!(
                        "UPDATE issues SET status = 'snoozed', snooze_until = ?, snooze_total = ?,
                                snooze_remaining = ?, version = version + 1
                         WHERE id = ?",
                        snooze_until,
                        total,
                        total,
                        r.id
                    )
                    .execute(&mut *tx)
                    .await?;
                    let snooze = match snooze {
                        Snooze::Until { until } => Snooze::Until { until: until.clone() },
                        Snooze::Events { total, .. } => Snooze::Events { total: *total, remaining: *total },
                    };
                    Activity::Snoozed { at: at.clone(), by: by.clone(), snooze }
                }
                IssueChange::Reopen if status != IssueStatus::Unresolved => {
                    sqlx::query!(
                        "UPDATE issues SET status = 'unresolved', resolved_at = NULL,
                                snooze_until = NULL, snooze_total = NULL, snooze_remaining = NULL,
                                version = version + 1
                         WHERE id = ?",
                        r.id
                    )
                    .execute(&mut *tx)
                    .await?;
                    Activity::Reopened { at: at.clone(), by: by.clone() }
                }
                IssueChange::Assign { person_id }
                    if r.assignee_id.as_deref() != person_id.as_ref().map(|m| m.as_str()) =>
                {
                    let to = person_id.as_ref().map(|m| m.as_str());
                    sqlx::query!("UPDATE issues SET assignee_id = ?, version = version + 1 WHERE id = ?", to, r.id)
                        .execute(&mut *tx)
                        .await?;
                    Activity::Assigned { at: at.clone(), by: by.clone(), to: assignee.clone() }
                }
                _ => continue,
            };
            add_activity(&mut tx, &r.id, now, &entry).await?;
        }
        tx.commit().await?;

        let summaries = self.summaries_of(&ids, SummaryShape::for_range(now, TimeRange::Week)).await?;
        Ok(Outcome::Ok(summaries))
    }

    /// A joined member, for assigning. Unknown or pending members can't be assigned.
    async fn assignee(&self, id: &MemberId) -> Result<Person> {
        match self.member(id.as_str()).await? {
            Some(m) if m.joined_at.is_some() => Ok(m.person()),
            Some(m) => Err(Error::Invalid(format!("{} hasn't accepted their invitation yet.", m.email))),
            None => Err(Error::Invalid("That person no longer has access.".into())),
        }
    }

    pub async fn add_issue_note(
        &self,
        viewer: &Viewer,
        issue_id: &str,
        body: &str,
    ) -> Result<Outcome<Issue, AddIssueNoteFailure>> {
        let body = body.trim();
        if body.is_empty() {
            return Err(Error::Invalid("Write something first.".into()));
        }
        if body.len() > NOTE_LIMIT {
            return Err(Error::Invalid(format!("Notes can be at most {NOTE_LIMIT} characters.")));
        }
        if self.visible_issue_project(viewer, issue_id).await?.is_none() {
            return Ok(Outcome::fail(AddIssueNoteFailure::NotFound));
        }
        let now = self.now();
        let entry = Activity::Note { at: IsoDate::from_millis(now), by: viewer.person(), body: body.to_owned() };
        let mut tx = self.write.begin().await?;
        // The issue may have gone with its project since the check above.
        let exists =
            sqlx::query_scalar!(r#"SELECT EXISTS (SELECT 1 FROM issues WHERE id = ?) AS "x!: bool""#, issue_id)
                .fetch_one(&mut *tx)
                .await?;
        if !exists {
            return Ok(Outcome::fail(AddIssueNoteFailure::NotFound));
        }
        add_activity(&mut tx, issue_id, now, &entry).await?;
        tx.commit().await?;
        match self.issue(issue_id).await? {
            Some(issue) => Ok(Outcome::Ok(issue)),
            None => Ok(Outcome::fail(AddIssueNoteFailure::NotFound)),
        }
    }
}

/// Checks a change before anything is read; returns a snooze's end time.
fn validate_change(change: &IssueChange, now: Millis) -> Result<Option<Millis>> {
    match change {
        IssueChange::Snooze { snooze: Snooze::Until { until } } => match until.millis() {
            Some(t) if t > now => Ok(Some(t)),
            Some(_) => Err(Error::Invalid("Pick a time in the future.".into())),
            None => Err(Error::Invalid(format!("{:?} isn't a date and time.", until.0))),
        },
        IssueChange::Snooze { snooze: Snooze::Events { total, .. } } if *total == 0 || *total > SNOOZE_EVENTS_LIMIT => {
            Err(Error::Invalid(format!("Snooze for between 1 and {SNOOZE_EVENTS_LIMIT} events.")))
        }
        _ => Ok(None),
    }
}
