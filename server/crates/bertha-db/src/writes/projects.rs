//! Creating, re-keying and deleting projects. All of it is the owner's alone.

use bertha_core::api::{
    CreateProjectFailure, CreateProjectInput, DeleteProjectFailure, Outcome, ProjectInput, RotateIngestKeyFailure,
    UpdateProjectFailure,
};
use bertha_core::domain::{Environment, Project, ProjectIds, ProjectSetup, Runtime};
use bertha_core::ids::ProjectId;
use bertha_core::pages::CreatedProject;
use bertha_core::random;
use bertha_core::validate;

use crate::codec::{env_mask, key_from_name, normalize_name, runtime_mask};
use crate::scope::{Viewer, ids_json};
use crate::{Db, Error, Result};

/// Names, clients and URLs longer than this are refused.
const FIELD_LIMIT: usize = 200;
/// A project brief is at most this long.
pub const BRIEF_LIMIT: usize = 4000;

pub(crate) const INGEST_PREFIX: &str = "bk_";
pub(crate) const UPLOAD_PREFIX: &str = "bu_";

fn optional(field: &Option<String>, what: &str) -> Result<Option<String>> {
    let v = field.as_deref().map(str::trim).filter(|s| !s.is_empty());
    if v.is_some_and(|s| s.len() > FIELD_LIMIT) {
        return Err(Error::Invalid(format!("The {what} can be at most {FIELD_LIMIT} characters.")));
    }
    Ok(v.map(str::to_owned))
}

impl Db {
    pub async fn create_project(
        &self,
        viewer: &Viewer,
        input: &CreateProjectInput,
    ) -> Result<Outcome<CreatedProject, CreateProjectFailure>> {
        viewer.require_owner()?;
        let name = input.name.trim();
        let norm = normalize_name(name);
        if norm.is_empty() {
            return Ok(Outcome::fail(CreateProjectFailure::InvalidName));
        }
        if name.len() > FIELD_LIMIT {
            return Err(Error::Invalid(format!("Project names can be at most {FIELD_LIMIT} characters.")));
        }
        let client = optional(&input.client, "client")?;
        let url = optional(&input.url, "URL")?;
        let repo_url = repo_url(&input.repo_url)?;
        let (runtimes, environments) = masks(&input.runtimes, &input.environments)?;
        let chosen = match input.key.as_deref().map(str::trim).filter(|k| !k.is_empty()) {
            None => None,
            Some(k) => {
                let k = k.to_ascii_uppercase();
                if !valid_key(&k) {
                    return Ok(Outcome::fail(CreateProjectFailure::InvalidKey));
                }
                Some(k)
            }
        };

        let id = ProjectId::generate();
        let now = self.now();
        let mut tx = self.write.begin().await?;
        let taken =
            sqlx::query_scalar!(r#"SELECT EXISTS (SELECT 1 FROM projects WHERE name_norm = ?) AS "x!: bool""#, norm)
                .fetch_one(&mut *tx)
                .await?;
        if taken {
            return Ok(Outcome::fail(CreateProjectFailure::NameTaken));
        }
        let keys = sqlx::query_scalar!("SELECT key FROM projects").fetch_all(&mut *tx).await?;
        let key = match chosen {
            Some(k) if keys.contains(&k) => return Ok(Outcome::fail(CreateProjectFailure::KeyTaken)),
            Some(k) => k,
            None => unique_key(&key_from_name(name), &keys),
        };
        let ingest_key = random::secret(INGEST_PREFIX);
        let upload_key = random::secret(UPLOAD_PREFIX);
        sqlx::query!(
            "INSERT INTO projects (id, key, name, name_norm, client, url, repo_url, runtimes, environments,
                                   ingest_key, upload_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id.0,
            key,
            name,
            norm,
            client,
            url,
            repo_url,
            runtimes,
            environments,
            ingest_key,
            upload_key,
            now
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        let project = self.projects_in(&ids_json(std::slice::from_ref(&id))).await?.pop();
        let setup = self.setup_of(&id.0).await?;
        match (project, setup) {
            (Some(project), Some(setup)) => Ok(Outcome::Ok(CreatedProject { project, setup })),
            _ => Err(Error::Corrupt(format!("project {id} vanished after creation"))),
        }
    }

    /// Changes a project's details. The key stays: issue ids are made from it.
    /// `None` when the project doesn't exist (or isn't visible).
    pub async fn update_project(
        &self,
        viewer: &Viewer,
        project_id: &str,
        input: &ProjectInput,
    ) -> Result<Option<Outcome<Project, UpdateProjectFailure>>> {
        if !viewer.can_see(&ProjectId(project_id.to_owned())) {
            return Ok(None);
        }
        if !viewer.is_owner() {
            return Ok(Some(Outcome::fail(UpdateProjectFailure::PermissionDenied)));
        }
        let name = input.name.trim();
        let norm = normalize_name(name);
        if norm.is_empty() {
            return Ok(Some(Outcome::fail(UpdateProjectFailure::InvalidName)));
        }
        if name.len() > FIELD_LIMIT {
            return Err(Error::Invalid(format!("Project names can be at most {FIELD_LIMIT} characters.")));
        }
        let client = optional(&input.client, "client")?;
        let url = optional(&input.url, "URL")?;
        let repo_url = repo_url(&input.repo_url)?;
        let (runtimes, environments) = masks(&input.runtimes, &input.environments)?;
        let brief = input.brief.as_deref().map(str::trim).filter(|b| !b.is_empty());
        if brief.is_some_and(|b| b.chars().count() > BRIEF_LIMIT) {
            return Err(Error::Invalid(format!(
                "Briefs can be at most {BRIEF_LIMIT} characters. Keep what an agent needs before it starts."
            )));
        }

        let mut tx = self.write.begin().await?;
        let taken = sqlx::query_scalar!(
            r#"SELECT EXISTS (SELECT 1 FROM projects WHERE name_norm = ? AND id != ?) AS "x!: bool""#,
            norm,
            project_id
        )
        .fetch_one(&mut *tx)
        .await?;
        if taken {
            return Ok(Some(Outcome::fail(UpdateProjectFailure::NameTaken)));
        }
        let done = sqlx::query!(
            "UPDATE projects SET name = ?, name_norm = ?, client = ?, url = ?, repo_url = ?, runtimes = ?,
                                 environments = ?, brief = ?, watch_fixes = COALESCE(?, watch_fixes)
             WHERE id = ?",
            name,
            norm,
            client,
            url,
            repo_url,
            runtimes,
            environments,
            brief,
            input.watch_fixes,
            project_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if done == 0 {
            return Ok(None);
        }
        tx.commit().await?;
        Ok(self.projects_in(&ids_json(&[ProjectId(project_id.to_owned())])).await?.pop().map(Outcome::Ok))
    }

    /// `None` when the project doesn't exist (or isn't visible).
    pub async fn rotate_ingest_key(
        &self,
        viewer: &Viewer,
        project_id: &str,
    ) -> Result<Option<Outcome<ProjectSetup, RotateIngestKeyFailure>>> {
        if !viewer.can_see(&ProjectId(project_id.to_owned())) {
            return Ok(None);
        }
        if !viewer.is_owner() {
            return Ok(Some(Outcome::fail(RotateIngestKeyFailure::PermissionDenied)));
        }
        let key = random::secret(INGEST_PREFIX);
        let done = sqlx::query!("UPDATE projects SET ingest_key = ? WHERE id = ?", key, project_id)
            .execute(&self.write)
            .await?
            .rows_affected();
        if done == 0 {
            return Ok(None);
        }
        Ok(self.setup_of(project_id).await?.map(Outcome::Ok))
    }

    /// Deletes the project with everything in it. `None` when it doesn't exist.
    pub async fn delete_project(
        &self,
        viewer: &Viewer,
        project_id: &str,
        confirm_name: &str,
    ) -> Result<Option<Outcome<(), DeleteProjectFailure>>> {
        if !viewer.can_see(&ProjectId(project_id.to_owned())) {
            return Ok(None);
        }
        if !viewer.is_owner() {
            return Ok(Some(Outcome::fail(DeleteProjectFailure::PermissionDenied)));
        }
        let mut tx = self.write.begin().await?;
        let Some(name) =
            sqlx::query_scalar!("SELECT name FROM projects WHERE id = ?", project_id).fetch_optional(&mut *tx).await?
        else {
            return Ok(None);
        };
        if confirm_name.trim() != name {
            return Ok(Some(Outcome::fail(DeleteProjectFailure::NameMismatch)));
        }
        // Alert rules name projects in JSON, which no foreign key reaches.
        let rules = sqlx::query!("SELECT id, project_ids FROM alert_rules").fetch_all(&mut *tx).await?;
        for rule in rules {
            let ProjectIds::Some(mut ids) = serde_json::from_str::<ProjectIds>(&rule.project_ids)? else { continue };
            let before = ids.len();
            ids.retain(|p| p.0 != project_id);
            if ids.len() != before {
                let json = serde_json::to_string(&ProjectIds::Some(ids))?;
                sqlx::query!("UPDATE alert_rules SET project_ids = ? WHERE id = ?", json, rule.id)
                    .execute(&mut *tx)
                    .await?;
            }
        }
        sqlx::query!("DELETE FROM projects WHERE id = ?", project_id).execute(&mut *tx).await?;
        tx.commit().await?;
        tracing::info!(project = project_id, name, "project deleted");
        Ok(Some(Outcome::Ok(())))
    }
}

/// A link to the code, if one was given: http(s) only, so it's safe to put in a link.
fn repo_url(field: &Option<String>) -> Result<Option<String>> {
    match optional(field, "repository URL")? {
        None => Ok(None),
        Some(u) => match validate::monitor_url(&u) {
            Some(u) => Ok(Some(u.trim_end_matches('/').to_owned())),
            None => Err(Error::Invalid("Repository links start with https://. Nothing was saved.".into())),
        },
    }
}

/// Runtimes (at least one) and environments (production when none) as stored.
fn masks(runtimes: &[Runtime], environments: &[Environment]) -> Result<(i64, i64)> {
    if runtimes.is_empty() {
        return Err(Error::Invalid("Pick at least one runtime.".into()));
    }
    let envs = if environments.is_empty() { vec![Environment::Production] } else { environments.to_vec() };
    Ok((runtime_mask(runtimes), env_mask(&envs)))
}

/// 2 to 6 capital letters or digits, starting with a letter. Matches `KEY_PATTERN` in
/// the app.
fn valid_key(k: &str) -> bool {
    let mut c = k.chars();
    c.next().is_some_and(|f| f.is_ascii_uppercase())
        && (2..=6).contains(&k.len())
        && c.all(|x| x.is_ascii_uppercase() || x.is_ascii_digit())
}

/// `KILN`, or `KILN2`, `KILN3`… when the key is taken.
fn unique_key(base: &str, taken: &[String]) -> String {
    if !taken.iter().any(|k| k == base) {
        return base.to_owned();
    }
    (2..).map(|n| format!("{base}{n}")).find(|k| !taken.contains(k)).unwrap_or_else(|| base.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_stay_unique() {
        assert_eq!(unique_key("KILN", &[]), "KILN");
        assert_eq!(unique_key("KILN", &["KILN".into(), "KILN2".into()]), "KILN3");
    }

    #[test]
    fn keys_are_checked() {
        assert!(valid_key("KILN"));
        assert!(valid_key("P2048"));
        assert!(!valid_key("K"));
        assert!(!valid_key("2KILN"));
        assert!(!valid_key("KILNKILN"));
        assert!(!valid_key("KI-N"));
    }
}
