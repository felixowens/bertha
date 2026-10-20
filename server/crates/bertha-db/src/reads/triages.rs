//! Triages: who is on an issue, and what earlier goes at it found.

use bertha_core::domain::{Person, Prose, TRIAGE_STALE_MS, Triage, TriageOutcome, TriageState};
use bertha_core::ids::{MemberId, ProjectId, TriageId};
use bertha_core::time::{IsoDate, Millis};

use crate::codec::parse;
use crate::scope::Viewer;
use crate::{Db, Result};

pub(crate) struct TriageRow {
    pub id: String,
    pub issue_id: String,
    pub member_id: String,
    pub member_name: String,
    pub member_email: String,
    pub via: Option<String>,
    pub started_at: i64,
    pub updated_at: i64,
    pub outcome: Option<String>,
    pub found: Option<String>,
    pub tried: Option<String>,
    pub fix: Option<String>,
    pub release: Option<String>,
}

impl TriageRow {
    pub fn is_active(&self) -> bool {
        self.outcome.is_none()
    }

    pub fn is_stale(&self, now: Millis) -> bool {
        self.is_active() && self.updated_at < now - TRIAGE_STALE_MS
    }

    pub fn by(&self) -> Person {
        Person {
            id: MemberId(self.member_id.clone()),
            name: self.member_name.clone(),
            email: self.member_email.clone(),
        }
    }

    pub fn triage(&self, now: Millis) -> Result<Triage> {
        let outcome = self.outcome.as_deref().map(|o| parse(o, TriageOutcome::parse)).transpose()?;
        let state = match outcome {
            Some(_) => TriageState::Done,
            None if self.is_stale(now) => TriageState::Stale,
            None => TriageState::Active,
        };
        Ok(Triage {
            id: TriageId(self.id.clone()),
            by: self.by(),
            via: self.via.clone(),
            started_at: IsoDate::from_millis(self.started_at),
            updated_at: IsoDate::from_millis(self.updated_at),
            state,
            outcome,
            found: self.found.clone(),
            tried: self.tried.clone(),
            fix: self.fix.clone(),
            release: self.release.clone(),
        })
    }
}

impl Db {
    /// An issue's triages, newest first. No scope check: callers check first.
    pub(crate) async fn triages(&self, issue_id: &str) -> Result<Vec<Triage>> {
        let now = self.now();
        sqlx::query_as!(
            TriageRow,
            "SELECT id, issue_id, member_id, member_name, member_email, via, started_at, updated_at,
                    outcome, found, tried, fix, release
               FROM triages WHERE issue_id = ? ORDER BY started_at DESC, id DESC",
            issue_id
        )
        .fetch_all(&self.read)
        .await?
        .iter()
        .map(|r| r.triage(now))
        .collect()
    }

    /// One triage, if the viewer can see its issue.
    pub(crate) async fn triage_row(&self, viewer: &Viewer, triage_id: &str) -> Result<Option<TriageRow>> {
        let row = sqlx::query_as!(
            TriageRow,
            "SELECT id, issue_id, member_id, member_name, member_email, via, started_at, updated_at,
                    outcome, found, tried, fix, release
               FROM triages WHERE id = ?",
            triage_id
        )
        .fetch_optional(&self.read)
        .await?;
        let Some(row) = row else { return Ok(None) };
        Ok(self.visible_issue_project(viewer, &row.issue_id).await?.map(|_| row))
    }

    /// What anyone triaging the project should know, if it has a brief and the viewer can
    /// see it.
    pub async fn project_brief(&self, viewer: &Viewer, project_id: &ProjectId) -> Result<Option<Prose>> {
        if !viewer.can_see(project_id) {
            return Ok(None);
        }
        let brief = sqlx::query_scalar!("SELECT brief FROM projects WHERE id = ?", project_id.0)
            .fetch_optional(&self.read)
            .await?
            .flatten();
        Ok(brief)
    }

    /// The ids of the projects the viewer can see that have a brief.
    pub async fn briefed_projects(&self, viewer: &Viewer) -> Result<Vec<String>> {
        let scope = viewer.scope_json();
        let ids = sqlx::query_scalar!(
            "SELECT id FROM projects
              WHERE brief IS NOT NULL AND id IN (SELECT value FROM json_each(?)) ORDER BY id",
            scope
        )
        .fetch_all(&self.read)
        .await?;
        Ok(ids)
    }
}
