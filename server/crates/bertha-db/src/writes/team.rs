//! Inviting people, changing what they see, and removing them. The owner's alone.

use bertha_core::api::{
    InviteMemberFailure, Outcome, RemoveMemberFailure, ResendInviteFailure, UpdateMemberAccessFailure,
};
use bertha_core::domain::{Member, Role};
use bertha_core::ids::{MemberId, ProjectId};

use crate::scope::Viewer;
use crate::{Db, Error, Result};

/// A new or refreshed invitation, with what the email needs.
pub struct Invitation {
    pub member: Member,
    /// The secret for the `/invite/{token}` link. Only its hash is stored.
    pub token: String,
    pub project_names: Vec<String>,
}

impl Db {
    /// Invites someone to some projects. Inviting a pending member again sends a fresh
    /// link with the new projects; the old link stops working.
    pub async fn invite_member(
        &self,
        viewer: &Viewer,
        email: &str,
        project_ids: &[ProjectId],
    ) -> Result<Outcome<Invitation, InviteMemberFailure>> {
        viewer.require_owner()?;
        let Some(email) = bertha_core::validate::email(email) else {
            return Ok(Outcome::fail(InviteMemberFailure::InvalidEmail));
        };
        let projects = self.chosen_projects(viewer, project_ids)?;
        let project_json = serde_json::to_string(&projects)?;
        let now = self.now();

        let mut tx = self.write.begin().await?;
        let existing =
            sqlx::query!("SELECT id, joined_at FROM members WHERE email = ?", email).fetch_optional(&mut *tx).await?;
        let member_id = match existing {
            Some(m) if m.joined_at.is_some() => return Ok(Outcome::fail(InviteMemberFailure::AlreadyMember)),
            Some(m) => {
                sqlx::query!("DELETE FROM tokens WHERE member_id = ? AND kind = 'invite'", m.id)
                    .execute(&mut *tx)
                    .await?;
                m.id
            }
            None => {
                let id = MemberId::generate();
                let name = name_from_email(&email);
                let by = viewer.id().as_str();
                sqlx::query!(
                    "INSERT INTO members (id, name, email, role, all_projects, invited_by, created_at)
                     VALUES (?, ?, ?, 'collaborator', 0, ?, ?)",
                    id.0,
                    name,
                    email,
                    by,
                    now
                )
                .execute(&mut *tx)
                .await?;
                id.0
            }
        };
        set_projects(&mut tx, &member_id, &project_json).await?;
        let token = self.issue_invite_token(&mut tx, &member_id).await?;
        tx.commit().await?;

        let member = self.member(&member_id).await?.ok_or_else(|| Error::Corrupt("invited member vanished".into()))?;
        let project_names = sqlx::query_scalar!(
            "SELECT name FROM projects WHERE id IN (SELECT value FROM json_each(?)) ORDER BY created_at",
            project_json
        )
        .fetch_all(&self.read)
        .await?;
        Ok(Outcome::Ok(Invitation { member, token, project_names }))
    }

    /// A fresh link for a pending invitation; the old one stops working.
    pub async fn resend_invite(
        &self,
        viewer: &Viewer,
        member_id: &str,
    ) -> Result<Outcome<Invitation, ResendInviteFailure>> {
        viewer.require_owner()?;
        let mut tx = self.write.begin().await?;
        let Some(m) =
            sqlx::query!("SELECT joined_at FROM members WHERE id = ?", member_id).fetch_optional(&mut *tx).await?
        else {
            return Ok(Outcome::fail(ResendInviteFailure::NotFound));
        };
        if m.joined_at.is_some() {
            return Ok(Outcome::fail(ResendInviteFailure::AlreadyMember));
        }
        sqlx::query!("DELETE FROM tokens WHERE member_id = ? AND kind = 'invite'", member_id).execute(&mut *tx).await?;
        let token = self.issue_invite_token(&mut tx, member_id).await?;
        tx.commit().await?;

        let member = self.member(member_id).await?.ok_or_else(|| Error::Corrupt("invited member vanished".into()))?;
        let project_names = sqlx::query_scalar!(
            "SELECT p.name FROM member_projects mp JOIN projects p ON p.id = mp.project_id
             WHERE mp.member_id = ? ORDER BY p.created_at",
            member_id
        )
        .fetch_all(&self.read)
        .await?;
        Ok(Outcome::Ok(Invitation { member, token, project_names }))
    }

    /// Replaces the projects a collaborator sees. `None` if they were removed.
    pub async fn update_member_access(
        &self,
        viewer: &Viewer,
        member_id: &str,
        project_ids: &[ProjectId],
    ) -> Result<Option<Outcome<Member, UpdateMemberAccessFailure>>> {
        if !viewer.is_owner() {
            return Ok(Some(Outcome::fail(UpdateMemberAccessFailure::PermissionDenied)));
        }
        let projects = self.chosen_projects(viewer, project_ids)?;
        let Some(target) = self.member(member_id).await? else { return Ok(None) };
        if target.role == Role::Owner {
            return Err(Error::Invalid("The owner always sees every project.".into()));
        }
        let mut tx = self.write.begin().await?;
        set_projects(&mut tx, member_id, &serde_json::to_string(&projects)?).await?;
        tx.commit().await?;
        Ok(self.member(member_id).await?.map(Outcome::Ok))
    }

    /// Removes someone: their sessions and links stop working at once. Removing someone
    /// already gone is fine.
    pub async fn remove_member(&self, viewer: &Viewer, member_id: &str) -> Result<Outcome<(), RemoveMemberFailure>> {
        viewer.require_owner()?;
        let mut tx = self.write.begin().await?;
        let role =
            sqlx::query_scalar!("SELECT role FROM members WHERE id = ?", member_id).fetch_optional(&mut *tx).await?;
        match role.as_deref() {
            None => return Ok(Outcome::Ok(())),
            Some("owner") => return Ok(Outcome::fail(RemoveMemberFailure::CannotRemoveOwner)),
            Some(_) => {}
        }
        sqlx::query!("DELETE FROM members WHERE id = ?", member_id).execute(&mut *tx).await?;
        tx.commit().await?;
        tracing::info!(member = member_id, "member removed");
        Ok(Outcome::Ok(()))
    }

    /// The projects picked in a form: at least one, each one the owner can see.
    fn chosen_projects(&self, viewer: &Viewer, ids: &[ProjectId]) -> Result<Vec<ProjectId>> {
        let mut out: Vec<ProjectId> = Vec::with_capacity(ids.len());
        for id in ids {
            if !viewer.can_see(id) {
                return Err(Error::Invalid(format!("Project {id} no longer exists.")));
            }
            if !out.contains(id) {
                out.push(id.clone());
            }
        }
        if out.is_empty() {
            return Err(Error::Invalid("Pick at least one project.".into()));
        }
        Ok(out)
    }
}

async fn set_projects(tx: &mut sqlx::SqliteConnection, member_id: &str, project_json: &str) -> Result<()> {
    sqlx::query!("DELETE FROM member_projects WHERE member_id = ?", member_id).execute(&mut *tx).await?;
    sqlx::query!(
        "INSERT INTO member_projects (member_id, project_id) SELECT ?, value FROM json_each(?)",
        member_id,
        project_json
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

/// A display name until they set one: `priya.natarajan@…` → `Priya Natarajan`.
fn name_from_email(email: &str) -> String {
    let local = email.split(['@', '+']).next().unwrap_or(email);
    let words: Vec<String> = local
        .split(['.', '_', '-'])
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut c = w.chars();
            c.next().map(|f| f.to_uppercase().chain(c).collect()).unwrap_or_default()
        })
        .collect();
    if words.is_empty() { local.to_owned() } else { words.join(" ") }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_from_emails() {
        assert_eq!(name_from_email("priya.natarajan@studio.dev"), "Priya Natarajan");
        assert_eq!(name_from_email("dev@mossgrovehall.co.uk"), "Dev");
        assert_eq!(name_from_email("t_kowalski+bertha@x.dev"), "T Kowalski");
    }
}
