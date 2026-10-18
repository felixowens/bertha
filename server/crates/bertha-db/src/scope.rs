//! Who is asking, and which projects they may see.
//!
//! A [`Viewer`] can only be built inside this crate, from a verified session (see
//! [`crate::auth`]). Every read takes one and filters by [`Viewer::scope_json`], so a
//! collaborator query can't forget its project filter.

use bertha_core::domain::{Member, Person, ProjectIds, Role};
use bertha_core::ids::{MemberId, ProjectId};
use bertha_core::time::IsoDate;

use crate::codec::parse;
use crate::{Db, Error, Result};

#[derive(Debug, Clone)]
pub struct Viewer {
    member: Member,
    /// The projects visible to this viewer, resolved (the owner's "all" becomes a list).
    projects: Vec<ProjectId>,
    /// `projects` as a JSON array, for `IN (SELECT value FROM json_each(?))`.
    scope_json: String,
}

impl Viewer {
    pub fn member(&self) -> &Member {
        &self.member
    }

    pub fn id(&self) -> &MemberId {
        &self.member.id
    }

    pub fn person(&self) -> Person {
        self.member.person()
    }

    pub fn is_owner(&self) -> bool {
        self.member.role == Role::Owner
    }

    pub fn can_see(&self, project: &ProjectId) -> bool {
        self.projects.contains(project)
    }

    pub fn projects(&self) -> &[ProjectId] {
        &self.projects
    }

    pub(crate) fn scope_json(&self) -> &str {
        &self.scope_json
    }

    /// For owner-only pages and operations that have no contract failure kind.
    pub fn require_owner(&self) -> Result<()> {
        if self.is_owner() { Ok(()) } else { Err(Error::Forbidden) }
    }
}

pub(crate) fn ids_json(ids: &[ProjectId]) -> String {
    serde_json::to_string(ids).unwrap_or_else(|_| "[]".into())
}

impl Db {
    /// Loads a member and their resolved project scope. Crate-private: callers get a
    /// Viewer only through a session or a freshly consumed sign-in link.
    pub(crate) async fn load_viewer(&self, member_id: &str) -> Result<Option<Viewer>> {
        let Some(member) = self.member(member_id).await? else { return Ok(None) };
        let projects = match &member.project_ids {
            ProjectIds::All => sqlx::query_scalar!(r#"SELECT id AS "id!" FROM projects ORDER BY created_at"#)
                .fetch_all(&self.read)
                .await?
                .into_iter()
                .map(ProjectId)
                .collect(),
            ProjectIds::Some(ids) => ids.clone(),
        };
        let scope_json = ids_json(&projects);
        Ok(Some(Viewer { member, projects, scope_json }))
    }

    /// Test and CLI access without a session.
    #[cfg(any(test, feature = "testing"))]
    pub async fn viewer_unchecked(&self, member_id: &str) -> Result<Option<Viewer>> {
        self.load_viewer(member_id).await
    }

    /// Someone who has joined, for email about their work (an assignment). `None` for
    /// an unknown id or an invitation not yet accepted.
    pub async fn joined_member(&self, member_id: &str) -> Result<Option<Member>> {
        Ok(self.member(member_id).await?.filter(|m| m.joined_at.is_some()))
    }

    pub(crate) async fn member(&self, member_id: &str) -> Result<Option<Member>> {
        let Some(row) = sqlx::query!(
            r#"SELECT m.id, m.name, m.email, m.role, m.all_projects, m.joined_at, m.created_at,
                      (SELECT MAX(t.created_at) FROM tokens t WHERE t.member_id = m.id AND t.kind = 'invite') AS "invite_sent?: i64"
               FROM members m WHERE m.id = ?"#,
            member_id
        )
        .fetch_optional(&self.read)
        .await?
        else {
            return Ok(None);
        };
        let role = parse(&row.role, Role::parse)?;
        let project_ids = if role == Role::Owner || row.all_projects == 1 {
            ProjectIds::All
        } else {
            ProjectIds::Some(self.member_projects(&row.id).await?)
        };
        Ok(Some(Member {
            id: MemberId(row.id),
            name: row.name,
            email: row.email,
            role,
            project_ids,
            joined_at: row.joined_at.map(IsoDate::from_millis),
            invited_at: invite_window(row.joined_at, row.invite_sent, row.created_at).map(|w| w.0),
            invite_expires_at: invite_window(row.joined_at, row.invite_sent, row.created_at).map(|w| w.1),
        }))
    }

    pub(crate) async fn member_projects(&self, member_id: &str) -> Result<Vec<ProjectId>> {
        Ok(sqlx::query_scalar!(
            r#"SELECT mp.project_id FROM member_projects mp JOIN projects p ON p.id = mp.project_id
               WHERE mp.member_id = ? ORDER BY p.created_at"#,
            member_id
        )
        .fetch_all(&self.read)
        .await?
        .into_iter()
        .map(ProjectId)
        .collect())
    }

    /// Every member, owner first, then by when they joined (pending invites last).
    pub(crate) async fn all_members(&self) -> Result<Vec<Member>> {
        let rows = sqlx::query!(
            r#"SELECT m.id, m.name, m.email, m.role, m.all_projects, m.joined_at, m.created_at,
                      (SELECT MAX(t.created_at) FROM tokens t WHERE t.member_id = m.id AND t.kind = 'invite') AS "invite_sent?: i64"
               FROM members m
               ORDER BY m.role = 'owner' DESC, m.joined_at IS NULL, m.joined_at, m.created_at"#
        )
        .fetch_all(&self.read)
        .await?;
        let grants = sqlx::query!(
            r#"SELECT mp.member_id, mp.project_id FROM member_projects mp JOIN projects p ON p.id = mp.project_id
               ORDER BY p.created_at"#
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|row| {
                let role = parse(&row.role, Role::parse)?;
                let project_ids = if role == Role::Owner || row.all_projects == 1 {
                    ProjectIds::All
                } else {
                    ProjectIds::Some(
                        grants
                            .iter()
                            .filter(|g| g.member_id == row.id)
                            .map(|g| ProjectId(g.project_id.clone()))
                            .collect(),
                    )
                };
                Ok(Member {
                    id: MemberId(row.id),
                    name: row.name,
                    email: row.email,
                    role,
                    project_ids,
                    joined_at: row.joined_at.map(IsoDate::from_millis),
                    invited_at: invite_window(row.joined_at, row.invite_sent, row.created_at).map(|w| w.0),
                    invite_expires_at: invite_window(row.joined_at, row.invite_sent, row.created_at).map(|w| w.1),
                })
            })
            .collect()
    }
}

/// When a pending member's current invitation went out and when it stops working.
/// Housekeeping deletes long-expired tokens, so with none left the invitation dates
/// from when the member was added.
fn invite_window(joined_at: Option<i64>, sent: Option<i64>, created_at: i64) -> Option<(IsoDate, IsoDate)> {
    if joined_at.is_some() {
        return None;
    }
    let sent = sent.unwrap_or(created_at);
    Some((IsoDate::from_millis(sent), IsoDate::from_millis(sent + crate::auth::INVITE_TTL)))
}
