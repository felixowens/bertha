//! Triages: claiming an issue, and writing down what was found, tried and fixed.

use bertha_core::api::{Outcome, StartTriageFailure, TriageInput, UpdateTriageFailure};
use bertha_core::domain::{IssueSummary, TimeRange, Triage, TriageOutcome};
use bertha_core::ids::TriageId;
use bertha_core::time::Millis;

use crate::reads::issues::{EventWhich, SummaryShape};
use crate::reads::triages::TriageRow;
use crate::scope::Viewer;
use crate::writes::fixes::record_fix;
use crate::writes::issues::NOTE_LIMIT;
use crate::{Db, Error, Result};

/// A triage after a change, with its issue as it is now, so open pages can be told.
#[derive(Debug, Clone)]
pub struct TriageChange {
    pub triage: Triage,
    pub issue: IssueSummary,
}

impl Db {
    /// Claims an issue for the viewer. Their own active triage through the same token
    /// resumes. Anyone else's stays, unless it's stale or `take_over` is set; then it
    /// ends as abandoned and this one starts.
    pub async fn start_triage(
        &self,
        viewer: &Viewer,
        issue_id: &str,
        take_over: bool,
    ) -> Result<Outcome<TriageChange, StartTriageFailure>> {
        if self.visible_issue_project(viewer, issue_id).await?.is_none() {
            return Ok(Outcome::fail(StartTriageFailure::NotFound));
        }
        let release = self.event_of(issue_id, &EventWhich::Latest).await?.and_then(|at| at.event.release);
        let now = self.now();
        let via = viewer.agent().map(str::to_owned);

        let mut tx = self.write.begin().await?;
        let exists =
            sqlx::query_scalar!(r#"SELECT EXISTS (SELECT 1 FROM issues WHERE id = ?) AS "x!: bool""#, issue_id)
                .fetch_one(&mut *tx)
                .await?;
        if !exists {
            return Ok(Outcome::fail(StartTriageFailure::NotFound));
        }
        let active = sqlx::query_as!(
            TriageRow,
            "SELECT id, issue_id, member_id, member_name, member_email, via, started_at, updated_at,
                    outcome, found, tried, fix, release, fix_pr, fix_commit, fix_state, fix_release, fix_problem
               FROM triages WHERE issue_id = ? AND outcome IS NULL",
            issue_id
        )
        .fetch_optional(&mut *tx)
        .await?;
        let id = match active {
            Some(t) if t.member_id == viewer.id().as_str() && t.via == via => {
                sqlx::query!("UPDATE triages SET updated_at = ? WHERE id = ?", now, t.id).execute(&mut *tx).await?;
                t.id
            }
            Some(t) if !take_over && !t.is_stale(now) => {
                return Ok(Outcome::fail_with(StartTriageFailure::InProgress, on_it(&t, viewer, now)));
            }
            active => {
                if let Some(t) = active {
                    sqlx::query!("UPDATE triages SET outcome = 'abandoned', updated_at = ? WHERE id = ?", now, t.id)
                        .execute(&mut *tx)
                        .await?;
                }
                let id = TriageId::generate().0;
                let by = viewer.person();
                sqlx::query!(
                    "INSERT INTO triages (id, issue_id, member_id, member_name, member_email, via, started_at,
                                          updated_at, release)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id,
                    issue_id,
                    by.id.0,
                    by.name,
                    by.email,
                    via,
                    now,
                    now,
                    release
                )
                .execute(&mut *tx)
                .await?;
                id
            }
        };
        tx.commit().await?;
        self.triage_change(viewer, &id).await.map(Outcome::Ok)
    }

    /// Writes down what a triage found. Only its author changes it; the owner can also
    /// end anyone's as abandoned. An outcome ends it.
    pub async fn update_triage(
        &self,
        viewer: &Viewer,
        triage_id: &str,
        input: &TriageInput,
    ) -> Result<Outcome<TriageChange, UpdateTriageFailure>> {
        let Some(row) = self.triage_row(viewer, triage_id).await? else {
            return Ok(Outcome::fail(UpdateTriageFailure::NotFound));
        };
        if !row.is_active() {
            return Ok(Outcome::fail(UpdateTriageFailure::Concluded));
        }
        let own = row.member_id == viewer.id().as_str();
        let owner_abandons = viewer.is_owner()
            && input.outcome == Some(TriageOutcome::Abandoned)
            && input.found.is_none()
            && input.tried.is_none()
            && input.fix.is_none()
            && input.pr.is_none()
            && input.commit.is_none();
        if !own && !owner_abandons {
            return Ok(Outcome::fail(UpdateTriageFailure::PermissionDenied));
        }
        let found = field(input.found.as_deref(), row.found, "What was found")?;
        let tried = field(input.tried.as_deref(), row.tried, "What was tried")?;
        let fix = field(input.fix.as_deref(), row.fix, "The fix")?;
        let outcome = input.outcome.map(|o| o.as_str());
        let commit = input.commit.as_deref().map(str::trim).map(str::to_lowercase);
        let now = self.now();
        let mut tx = self.write.begin().await?;
        let changed = sqlx::query!(
            "UPDATE triages SET found = ?, tried = ?, fix = ?, outcome = ?, updated_at = ?
              WHERE id = ? AND outcome IS NULL",
            found,
            tried,
            fix,
            outcome,
            now,
            row.id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if changed > 0 && input.outcome == Some(TriageOutcome::Fixed) {
            record_fix(&mut tx, &row.id, &row.issue_id, fix.as_deref(), input.pr, commit.as_deref()).await?;
        }
        tx.commit().await?;
        if changed == 0 {
            // Ended, or gone with its issue, since it was read.
            return match self.triage_row(viewer, triage_id).await? {
                Some(_) => Ok(Outcome::fail(UpdateTriageFailure::Concluded)),
                None => Ok(Outcome::fail(UpdateTriageFailure::NotFound)),
            };
        }
        self.triage_change(viewer, &row.id).await.map(Outcome::Ok)
    }

    async fn triage_change(&self, viewer: &Viewer, triage_id: &str) -> Result<TriageChange> {
        let row = self
            .triage_row(viewer, triage_id)
            .await?
            .ok_or_else(|| Error::Corrupt(format!("triage {triage_id} vanished after writing it")))?;
        let now = self.now();
        let issue = self
            .summaries_of(std::slice::from_ref(&row.issue_id), SummaryShape::for_range(now, TimeRange::Week))
            .await?
            .pop()
            .ok_or_else(|| Error::Corrupt(format!("issue {} vanished after triaging it", row.issue_id)))?;
        let watching = self.issue_fix_watching(&row.issue_id).await?;
        Ok(TriageChange { triage: row.triage(now, watching)?, issue })
    }
}

/// A triage field after an update: unchanged when left out, cleared when blank.
fn field(given: Option<&str>, current: Option<String>, name: &str) -> Result<Option<String>> {
    let Some(given) = given else { return Ok(current) };
    let given = given.trim();
    if given.chars().count() > NOTE_LIMIT {
        return Err(Error::Invalid(format!("{name} can be at most {NOTE_LIMIT} characters.")));
    }
    Ok((!given.is_empty()).then(|| given.to_owned()))
}

/// "Ada Lovelace started triaging this 25m ago, through claude-laptop." Says "You" for
/// the viewer's own triage through another token.
fn on_it(t: &TriageRow, viewer: &Viewer, now: Millis) -> String {
    let own = t.member_id == viewer.id().as_str();
    let who = if own { "You" } else { t.member_name.as_str() };
    let through = t.via.as_deref().map(|v| format!(", through {v}")).unwrap_or_default();
    let next = if own { "Take it over if that one has stopped." } else { "Take it over only if they've stopped." };
    format!("{who} started triaging this {} ago{through}. {next}", ago(now - t.started_at))
}

/// "45s", "25m", "1h 5m".
fn ago(ms: Millis) -> String {
    let s = ms.max(0) / 1000;
    match s {
        0..60 => format!("{s}s"),
        60..3600 => format!("{}m", s / 60),
        _ if s % 3600 / 60 == 0 => format!("{}h", s / 3600),
        _ => format!("{}h {}m", s / 3600, s % 3600 / 60),
    }
}
