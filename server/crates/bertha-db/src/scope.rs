//! Who is asking, and which projects they may see.
//!
//! A [`Viewer`] can only be built inside this crate, from a verified session (see
//! [`crate::auth`]). Every read takes one and filters by a [`Scope`], which only a
//! Viewer hands out, so a collaborator query can't forget its project filter.
//!
//! A query that filters by project binds `scope.json()` to
//! `project_id IN (SELECT value FROM json_each(?))`. Helpers take `&Scope`, never a
//! string or a list of ids. Get one from [`Viewer::scope`], [`Viewer::scope_of`] or
//! [`Viewer::project_scope`]. [`Scope::checked`] is for the few callers with no viewer
//! that checked access themselves; `scope_tests.rs` lists them.

use bertha_core::domain::{Member, Person, ProjectIds, Role};
use bertha_core::ids::{MemberId, ProjectId};
use bertha_core::time::IsoDate;

use crate::codec::parse;
use crate::{Db, Error, Result};

#[derive(Debug, Clone)]
pub struct Viewer {
    member: Member,
    /// The projects visible to this viewer, resolved (the owner's "all" becomes a list).
    scope: Scope,
    /// The access token's name when an agent is asking; `None` in a browser session.
    via: Option<String>,
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

    /// The access token's name when an agent is asking, recorded in issue activity.
    pub fn agent(&self) -> Option<&str> {
        self.via.as_deref()
    }

    /// The same viewer, acting through the access token with this name.
    pub(crate) fn via(self, token_name: String) -> Viewer {
        Viewer { via: Some(token_name), ..self }
    }

    pub fn is_owner(&self) -> bool {
        self.member.role == Role::Owner
    }

    pub fn can_see(&self, project: &ProjectId) -> bool {
        self.scope.ids.contains(project)
    }

    pub fn projects(&self) -> &[ProjectId] {
        &self.scope.ids
    }

    /// Every project the viewer can see.
    pub(crate) fn scope(&self) -> &Scope {
        &self.scope
    }

    /// The projects a filter names that the viewer can see; all they can see when it
    /// names none.
    pub(crate) fn scope_of(&self, wanted: &[ProjectId]) -> Scope {
        if wanted.is_empty() {
            return self.scope.clone();
        }
        Scope::new(wanted.iter().filter(|p| self.can_see(p)).cloned().collect())
    }

    /// One project, when the viewer can see it.
    pub(crate) fn project_scope(&self, project: &ProjectId) -> Option<Scope> {
        self.can_see(project).then(|| Scope::new(vec![project.clone()]))
    }

    /// For owner-only pages and operations that have no contract failure kind.
    pub fn require_owner(&self) -> Result<()> {
        if self.is_owner() { Ok(()) } else { Err(Error::Forbidden) }
    }
}

/// Projects a query may read, as handed out by a [`Viewer`].
#[derive(Debug, Clone)]
pub(crate) struct Scope {
    ids: Vec<ProjectId>,
    /// `ids` as a JSON array, for `IN (SELECT value FROM json_each(?))`.
    json: String,
}

impl Scope {
    fn new(ids: Vec<ProjectId>) -> Scope {
        let json = serde_json::to_string(&ids).unwrap_or_else(|_| "[]".into());
        Scope { ids, json }
    }

    /// Projects whose access the caller already checked, or a path with no viewer
    /// (workers, the owner's own writes). Each use is listed in
    /// `scope_tests.rs` with why it's safe; prefer a Viewer's scope.
    pub(crate) fn checked(ids: Vec<ProjectId>) -> Scope {
        Scope::new(ids)
    }

    pub(crate) fn ids(&self) -> &[ProjectId] {
        &self.ids
    }

    /// The value to bind to `json_each(?)`.
    pub(crate) fn json(&self) -> &str {
        &self.json
    }
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
        Ok(Some(Viewer { member, scope: Scope::new(projects), via: None }))
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
