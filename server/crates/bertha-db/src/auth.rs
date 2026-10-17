//! Sign-in links, invitations and sessions. Only SHA-256 hashes of secrets are stored,
//! so a copy of the database can't be used to sign in.

use bertha_core::api::{AcceptInviteFailure, Outcome};
use bertha_core::domain::{InviteStatus, Member, Person, Role};
use bertha_core::ids::MemberId;
use bertha_core::pages::InviteData;
use bertha_core::random;
use bertha_core::time::{DAY, HOUR, MINUTE, Millis};

use crate::scope::Viewer;
use crate::{Db, Error, Result};

pub const SIGN_IN_TTL: Millis = 15 * MINUTE;
pub const INVITE_TTL: Millis = 7 * DAY;
pub const SESSION_TTL: Millis = 30 * DAY;
/// A session's expiry slides forward at most this often, so reads don't write.
const SESSION_TOUCH: Millis = HOUR;

const SESSION_PREFIX: &str = "bs_";
const SIGN_IN_PREFIX: &str = "bt_";
#[expect(dead_code, reason = "team mutations issue invites")]
const INVITE_PREFIX: &str = "bi_";

/// A fresh session: the cookie value and who it belongs to.
pub struct NewSession {
    pub token: String,
    pub viewer: Viewer,
    pub expires_at: Millis,
}

#[derive(Debug, PartialEq, Eq)]
pub enum LinkProblem {
    /// Never issued, or for a member who no longer exists.
    Invalid,
    Expired,
    Used,
}

/// Same-site paths only, so a link can't bounce someone to another site.
pub fn safe_next(next: Option<&str>) -> String {
    match next {
        Some(p) if p.starts_with('/') && !p.starts_with("//") && !p.contains('\\') && p.len() <= 512 => p.to_owned(),
        _ => "/".to_owned(),
    }
}

impl Db {
    /// `bertha owner create`. Fails if there is already an owner.
    pub async fn create_owner(&self, email: &str, name: &str) -> Result<Member> {
        let now = self.now();
        let id = MemberId::generate();
        let email = email.trim();
        sqlx::query!(
            "INSERT INTO members (id, name, email, role, all_projects, joined_at, created_at)
             VALUES (?, ?, ?, 'owner', 1, ?, ?)",
            id.0,
            name,
            email,
            now,
            now
        )
        .execute(&self.write)
        .await?;
        self.member(&id.0).await?.ok_or_else(|| Error::Corrupt("owner vanished".into()))
    }

    pub async fn owner(&self) -> Result<Option<Member>> {
        let id = sqlx::query_scalar!("SELECT id FROM members WHERE role = 'owner'").fetch_optional(&self.read).await?;
        match id {
            Some(id) => self.member(&id).await,
            None => Ok(None),
        }
    }

    pub async fn member_by_email(&self, email: &str) -> Result<Option<Member>> {
        let email = email.trim();
        let id = sqlx::query_scalar!("SELECT id FROM members WHERE email = ?", email).fetch_optional(&self.read).await?;
        match id {
            Some(id) => self.member(&id).await,
            None => Ok(None),
        }
    }

    /// A one-time sign-in link token for this email, or `None` if nobody has that email.
    pub async fn issue_sign_in(&self, email: &str, next: Option<&str>) -> Result<Option<(String, Member)>> {
        let Some(member) = self.member_by_email(email).await? else { return Ok(None) };
        let token = random::secret(SIGN_IN_PREFIX);
        let hash = random::hash(&token);
        let now = self.now();
        let expires = now + SIGN_IN_TTL;
        let next = safe_next(next);
        sqlx::query!(
            "INSERT INTO tokens (hash, kind, member_id, next_path, expires_at, created_at)
             VALUES (?, 'sign_in', ?, ?, ?, ?)",
            hash,
            member.id.0,
            next,
            expires,
            now
        )
        .execute(&self.write)
        .await?;
        Ok(Some((token, member)))
    }

    /// Uses a sign-in link: marks it used and starts a session. Returns where to go next.
    pub async fn consume_sign_in(&self, token: &str) -> Result<std::result::Result<(NewSession, String), LinkProblem>> {
        if !token.starts_with(SIGN_IN_PREFIX) {
            return Ok(Err(LinkProblem::Invalid));
        }
        let hash = random::hash(token);
        let now = self.now();
        let mut tx = self.write.begin().await?;
        let Some(row) = sqlx::query!(
            "SELECT member_id, next_path, expires_at, used_at FROM tokens WHERE hash = ? AND kind = 'sign_in'",
            hash
        )
        .fetch_optional(&mut *tx)
        .await?
        else {
            return Ok(Err(LinkProblem::Invalid));
        };
        if row.used_at.is_some() {
            return Ok(Err(LinkProblem::Used));
        }
        if row.expires_at <= now {
            return Ok(Err(LinkProblem::Expired));
        }
        sqlx::query!("UPDATE tokens SET used_at = ? WHERE hash = ?", now, hash).execute(&mut *tx).await?;
        // Signing in proves the address, so a pending invitee becomes a member.
        sqlx::query!("UPDATE members SET joined_at = ? WHERE id = ? AND joined_at IS NULL", now, row.member_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        let session = self.create_session(&row.member_id).await?;
        Ok(match session {
            Some(s) => Ok((s, safe_next(row.next_path.as_deref()))),
            None => Err(LinkProblem::Invalid),
        })
    }

    async fn create_session(&self, member_id: &str) -> Result<Option<NewSession>> {
        let Some(viewer) = self.load_viewer(member_id).await? else { return Ok(None) };
        let token = random::secret(SESSION_PREFIX);
        let hash = random::hash(&token);
        let now = self.now();
        let expires_at = now + SESSION_TTL;
        sqlx::query!(
            "INSERT INTO sessions (hash, member_id, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?)",
            hash,
            member_id,
            expires_at,
            now,
            now
        )
        .execute(&self.write)
        .await?;
        Ok(Some(NewSession { token, viewer, expires_at }))
    }

    /// The viewer behind a session cookie, sliding its expiry forward.
    pub async fn viewer_for_session(&self, token: &str) -> Result<Option<Viewer>> {
        if !token.starts_with(SESSION_PREFIX) {
            return Ok(None);
        }
        let hash = random::hash(token);
        let now = self.now();
        let Some(row) = sqlx::query!("SELECT member_id, expires_at, last_seen_at FROM sessions WHERE hash = ?", hash)
            .fetch_optional(&self.read)
            .await?
        else {
            return Ok(None);
        };
        if row.expires_at <= now {
            return Ok(None);
        }
        if now - row.last_seen_at > SESSION_TOUCH {
            let expires = now + SESSION_TTL;
            sqlx::query!("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE hash = ?", now, expires, hash)
                .execute(&self.write)
                .await?;
        }
        self.load_viewer(&row.member_id).await
    }

    pub async fn end_session(&self, token: &str) -> Result<()> {
        let hash = random::hash(token);
        sqlx::query!("DELETE FROM sessions WHERE hash = ?", hash).execute(&self.write).await?;
        Ok(())
    }

    /// An invitation link token for a pending member.
    #[expect(dead_code, reason = "team mutations issue invites")]
    pub(crate) async fn issue_invite_token(&self, tx: &mut sqlx::SqliteConnection, member_id: &str) -> Result<String> {
        let token = random::secret(INVITE_PREFIX);
        let hash = random::hash(&token);
        let now = self.now();
        let expires = now + INVITE_TTL;
        sqlx::query!(
            "INSERT INTO tokens (hash, kind, member_id, next_path, expires_at, created_at)
             VALUES (?, 'invite', ?, '/', ?, ?)",
            hash,
            member_id,
            expires,
            now
        )
        .execute(&mut *tx)
        .await?;
        Ok(token)
    }

    /// What the invitation page shows before anyone presses Accept.
    pub async fn invite(&self, token: &str) -> Result<Option<InviteData>> {
        let hash = random::hash(token);
        let Some(row) = sqlx::query!(
            r#"SELECT t.expires_at, t.used_at, m.id AS member_id, m.email, m.joined_at,
                      o.id AS "by_id?", o.name AS "by_name?", o.email AS "by_email?"
               FROM tokens t
               JOIN members m ON m.id = t.member_id
               LEFT JOIN members o ON o.id = m.invited_by
               WHERE t.hash = ? AND t.kind = 'invite'"#,
            hash
        )
        .fetch_optional(&self.read)
        .await?
        else {
            return Ok(None);
        };
        let now = self.now();
        let status = if row.used_at.is_some() || row.joined_at.is_some() {
            InviteStatus::Used
        } else if row.expires_at <= now {
            InviteStatus::Expired
        } else {
            InviteStatus::Pending
        };
        let invited_by = match (row.by_id, row.by_name, row.by_email) {
            (Some(id), Some(name), Some(email)) => Person { id: MemberId(id), name, email },
            _ => match self.owner().await? {
                Some(o) => o.person(),
                None => return Ok(None),
            },
        };
        let project_names = sqlx::query_scalar!(
            "SELECT p.name FROM member_projects mp JOIN projects p ON p.id = mp.project_id
             WHERE mp.member_id = ? ORDER BY p.created_at",
            row.member_id
        )
        .fetch_all(&self.read)
        .await?;
        Ok(Some(InviteData { status, invited_by, email: row.email, project_names }))
    }

    /// Accepts an invitation: marks the member joined and signs them in.
    pub async fn accept_invite(&self, token: &str) -> Result<Outcome<NewSession, AcceptInviteFailure>> {
        let hash = random::hash(token);
        let now = self.now();
        let mut tx = self.write.begin().await?;
        let row = sqlx::query!(
            "SELECT t.member_id, t.expires_at, t.used_at, m.joined_at
             FROM tokens t JOIN members m ON m.id = t.member_id
             WHERE t.hash = ? AND t.kind = 'invite'",
            hash
        )
        .fetch_optional(&mut *tx)
        .await?;
        // An unknown token reads as expired: the link is dead either way.
        let Some(row) = row else { return Ok(Outcome::fail(AcceptInviteFailure::InviteExpired)) };
        if row.used_at.is_some() || row.joined_at.is_some() {
            return Ok(Outcome::fail(AcceptInviteFailure::InviteUsed));
        }
        if row.expires_at <= now {
            return Ok(Outcome::fail(AcceptInviteFailure::InviteExpired));
        }
        sqlx::query!("UPDATE tokens SET used_at = ? WHERE hash = ?", now, hash).execute(&mut *tx).await?;
        sqlx::query!("UPDATE members SET joined_at = ? WHERE id = ?", now, row.member_id).execute(&mut *tx).await?;
        tx.commit().await?;
        match self.create_session(&row.member_id).await? {
            Some(s) => Ok(Outcome::Ok(s)),
            None => Ok(Outcome::fail(AcceptInviteFailure::InviteExpired)),
        }
    }

    /// Housekeeping: drops expired sessions and links (used links are kept a day so a
    /// second click says "already used" rather than "invalid").
    pub async fn prune_auth(&self) -> Result<u64> {
        let now = self.now();
        let day_ago = now - DAY;
        let a = sqlx::query!("DELETE FROM sessions WHERE expires_at <= ?", now).execute(&self.write).await?;
        let b = sqlx::query!(
            "DELETE FROM tokens WHERE (used_at IS NOT NULL AND used_at <= ?) OR expires_at <= ?",
            day_ago,
            day_ago
        )
        .execute(&self.write)
        .await?;
        Ok(a.rows_affected() + b.rows_affected())
    }

    /// Whether the member is the owner. Used where only a role is needed.
    pub async fn role_of(&self, member_id: &str) -> Result<Option<Role>> {
        Ok(self.member(member_id).await?.map(|m| m.role))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::*;

    #[tokio::test]
    async fn sign_in_link_is_single_use_and_expires() {
        let (db, _d) = db().await;
        db.create_owner("me@example.com", "Me").await.expect("owner");
        assert!(db.issue_sign_in("nobody@example.com", None).await.expect("ok").is_none());

        let (token, _) = db.issue_sign_in("ME@example.com", Some("/issues")).await.expect("ok").expect("known");
        let (session, next) = db.consume_sign_in(&token).await.expect("ok").expect("valid");
        assert_eq!(next, "/issues");
        assert!(session.viewer.is_owner());
        assert_eq!(db.consume_sign_in(&token).await.expect("ok").err(), Some(LinkProblem::Used));

        let viewer = db.viewer_for_session(&session.token).await.expect("ok").expect("session");
        assert_eq!(viewer.member().email, "me@example.com");

        let (late, _) = db.issue_sign_in("me@example.com", Some("//evil.example")).await.expect("ok").expect("known");
        db.clock().advance(SIGN_IN_TTL + 1);
        assert_eq!(db.consume_sign_in(&late).await.expect("ok").err(), Some(LinkProblem::Expired));
        assert_eq!(db.consume_sign_in("bt_nope").await.expect("ok").err(), Some(LinkProblem::Invalid));

        db.end_session(&session.token).await.expect("ok");
        assert!(db.viewer_for_session(&session.token).await.expect("ok").is_none());
    }

    #[tokio::test]
    async fn sessions_expire_unless_used() {
        let (db, _d) = db().await;
        db.create_owner("me@example.com", "Me").await.expect("owner");
        let (token, _) = db.issue_sign_in("me@example.com", None).await.expect("ok").expect("known");
        let (s, _) = db.consume_sign_in(&token).await.expect("ok").expect("valid");
        db.clock().advance(SESSION_TTL - DAY);
        assert!(db.viewer_for_session(&s.token).await.expect("ok").is_some());
        // That use slid the expiry forward by another 30 days.
        db.clock().advance(2 * DAY);
        assert!(db.viewer_for_session(&s.token).await.expect("ok").is_some());
        db.clock().advance(SESSION_TTL + 1);
        assert!(db.viewer_for_session(&s.token).await.expect("ok").is_none());
    }

    #[test]
    fn next_paths_stay_on_site() {
        assert_eq!(safe_next(Some("/issues?x=1")), "/issues?x=1");
        assert_eq!(safe_next(Some("//evil.example")), "/");
        assert_eq!(safe_next(Some("https://evil.example")), "/");
        assert_eq!(safe_next(Some("/\\evil.example")), "/");
        assert_eq!(safe_next(None), "/");
    }
}
