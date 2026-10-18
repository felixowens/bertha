//! Creating, re-keying and deleting projects. All of it is the owner's alone.

use bertha_core::api::{
    CreateProjectFailure, CreateProjectInput, DeleteProjectFailure, Outcome, RotateIngestKeyFailure,
};
use bertha_core::domain::{Environment, ProjectIds, ProjectSetup};
use bertha_core::ids::ProjectId;
use bertha_core::pages::CreatedProject;
use bertha_core::random;

use crate::codec::{env_mask, key_from_name, normalize_name, runtime_mask};
use crate::scope::{Viewer, ids_json};
use crate::{Db, Error, Result};

/// Names, clients and URLs longer than this are refused.
const FIELD_LIMIT: usize = 200;

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
        if input.runtimes.is_empty() {
            return Err(Error::Invalid("Pick at least one runtime.".into()));
        }
        let envs =
            if input.environments.is_empty() { vec![Environment::Production] } else { input.environments.clone() };
        let runtimes = runtime_mask(&input.runtimes);
        let environments = env_mask(&envs);

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
        let key = unique_key(&key_from_name(name), &keys);
        let ingest_key = random::secret(INGEST_PREFIX);
        let upload_key = random::secret(UPLOAD_PREFIX);
        sqlx::query!(
            "INSERT INTO projects (id, key, name, name_norm, client, url, runtimes, environments, ingest_key,
                                   upload_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id.0,
            key,
            name,
            norm,
            client,
            url,
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
}
