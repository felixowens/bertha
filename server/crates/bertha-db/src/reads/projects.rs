//! Projects, their health and their setup.

use std::collections::{HashMap, HashSet};

use bertha_core::domain::{
    ConnectionVia, Project, ProjectConnection, ProjectHealth, ProjectSetup, RunningRelease, SourceMapStatus, TimeRange,
};
use bertha_core::ids::{MonitorId, ProjectId};
use bertha_core::pages::ProjectsData;
use bertha_core::setup::snippets;
use bertha_core::time::{HOUR, IsoDate, Millis, floor_hour};

use crate::codec::{env_from_bit, envs, runtimes};
use crate::scope::{Viewer, ids_json};
use crate::{Db, Result};

/// "New issues" means first seen in the last day.
const FRESH: Millis = 24 * HOUR;

/// A project's keys, for the `bertha project` commands on the server.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectKeys {
    pub id: String,
    pub key: String,
    pub name: String,
    pub ingest_key: String,
    pub upload_key: String,
}

impl Db {
    /// Every project with its keys. No viewer: only someone with a shell on the server
    /// gets here.
    pub async fn project_keys(&self) -> Result<Vec<ProjectKeys>> {
        let rows = sqlx::query_as!(
            ProjectKeys,
            "SELECT id, key, name, ingest_key, upload_key FROM projects ORDER BY created_at, id"
        )
        .fetch_all(&self.read)
        .await?;
        Ok(rows)
    }

    /// The viewer's projects, in the order they were created.
    pub async fn projects(&self, viewer: &Viewer) -> Result<Vec<Project>> {
        self.projects_in(viewer.scope_json()).await
    }

    /// The projects page: every project the viewer sees, worst first, with events in
    /// the range and their monitors.
    pub async fn list_projects(&self, viewer: &Viewer, range: TimeRange) -> Result<ProjectsData> {
        let scope = viewer.scope_json();
        let mut projects = self.projects_in(scope).await?;
        projects.sort_by(|a, b| health_rank(a.health).cmp(&health_rank(b.health)).then_with(|| a.name.cmp(&b.name)));
        Ok(ProjectsData {
            projects,
            project_events: self.project_events(scope, self.now() - range.millis()).await?,
            monitors: self.monitors_in(scope).await?,
        })
    }

    pub(crate) async fn project(&self, viewer: &Viewer, id: &str) -> Result<Option<Project>> {
        if !viewer.can_see(&ProjectId(id.to_owned())) {
            return Ok(None);
        }
        Ok(self.projects_in(&ids_json(&[ProjectId(id.to_owned())])).await?.into_iter().next())
    }

    pub(crate) async fn projects_in(&self, ids: &str) -> Result<Vec<Project>> {
        let now = self.now();
        let day_ago = floor_hour(now) - 23 * HOUR;
        let fresh = now - FRESH;
        let rows = sqlx::query!(
            r#"SELECT p.id, p.key, p.name, p.client, p.url, p.repo_url, p.runtimes, p.environments,
                      p.connected_at, p.last_event_at,
                      (SELECT json_group_array(id) FROM (SELECT m.id FROM monitors m WHERE m.project_id = p.id
                        ORDER BY m.created_at, m.id)) AS "monitor_ids!: String",
                      EXISTS (SELECT 1 FROM monitors m WHERE m.project_id = p.id AND m.state = 'down') AS "down!: bool",
                      (SELECT COALESCE(SUM(h.count), 0) FROM issue_hourly h JOIN issues i ON i.id = h.issue_id
                        WHERE i.project_id = p.id AND h.hour >= ?2) AS "events24h!: i64",
                      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status = 'unresolved') AS "unresolved!: i64",
                      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status = 'unresolved'
                        AND i.regressed_at IS NOT NULL) AS "regressed!: i64",
                      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status = 'unresolved'
                        AND i.first_seen >= ?3) AS "fresh!: i64"
               FROM projects p
               WHERE p.id IN (SELECT value FROM json_each(?1))
               ORDER BY p.created_at, p.name"#,
            ids,
            day_ago,
            fresh
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|r| {
                let down = r.down;
                let monitor_ids: Vec<MonitorId> = serde_json::from_str(&r.monitor_ids)?;
                let health = if r.connected_at.is_none() && !down {
                    ProjectHealth::AwaitingFirstEvent
                } else if down {
                    ProjectHealth::Down
                } else if r.regressed > 0 {
                    ProjectHealth::Regressed
                } else if r.fresh > 0 {
                    ProjectHealth::NewIssues
                } else {
                    ProjectHealth::Healthy
                };
                Ok(Project {
                    id: ProjectId(r.id),
                    key: r.key,
                    name: r.name,
                    client: r.client,
                    url: r.url,
                    repo_url: r.repo_url,
                    runtimes: runtimes(r.runtimes),
                    environments: envs(r.environments),
                    health,
                    last_event_at: r.last_event_at.map(IsoDate::from_millis),
                    events24h: r.events24h.clamp(0, u32::MAX as i64) as u32,
                    unresolved_issues: r.unresolved as u32,
                    monitor_ids,
                })
            })
            .collect()
    }

    pub async fn project_setup(&self, viewer: &Viewer, id: &str) -> Result<Option<ProjectSetup>> {
        if !viewer.can_see(&ProjectId(id.to_owned())) {
            return Ok(None);
        }
        self.setup_of(id).await
    }

    pub(crate) async fn setup_of(&self, id: &str) -> Result<Option<ProjectSetup>> {
        let Some(p) = sqlx::query!(
            r#"SELECT p.ingest_key, p.upload_key, p.runtimes, p.first_event_at, p.connected_at, p.connected_via,
                      p.running_release, p.running_environment, p.running_seen_at,
                      (SELECT r.version FROM releases r WHERE r.project_id = p.id
                        ORDER BY r.deployed_at DESC LIMIT 1) AS "latest?: String"
               FROM projects p WHERE p.id = ?"#,
            id
        )
        .fetch_optional(&self.read)
        .await?
        else {
            return Ok(None);
        };
        let uploaded =
            match &p.latest {
                Some(v) => sqlx::query_scalar!(
                    r#"SELECT EXISTS (SELECT 1 FROM sourcemaps WHERE project_id = ? AND release = ?) AS "x!: bool""#,
                    id,
                    v
                )
                .fetch_one(&self.read)
                .await?,
                None => false,
            };
        let running = match (p.running_release, p.running_environment, p.running_seen_at) {
            (Some(release), Some(bit), Some(seen)) => Some(RunningRelease {
                release,
                environment: env_from_bit(bit)?,
                last_seen_at: IsoDate::from_millis(seen),
            }),
            _ => None,
        };
        let connection = match (p.connected_at, p.connected_via.as_deref().and_then(ConnectionVia::parse)) {
            (Some(at), Some(via)) => Some(ProjectConnection { at: IsoDate::from_millis(at), via, running }),
            _ => None,
        };
        Ok(Some(ProjectSetup {
            project_id: ProjectId(id.to_owned()),
            snippets: snippets(&runtimes(p.runtimes), &p.ingest_key, &p.upload_key, self.public_url()),
            ingest_key: p.ingest_key,
            first_event_at: p.first_event_at.map(IsoDate::from_millis),
            connection,
            source_maps: SourceMapStatus { latest_release: p.latest, uploaded },
        }))
    }

    /// Hours each project was known to be alive, from `since` on.
    pub(crate) async fn alive_hours(&self, ids: &str, since: Millis) -> Result<HashMap<String, HashSet<Millis>>> {
        let rows = sqlx::query!(
            "SELECT project_id, hour FROM project_hours
             WHERE project_id IN (SELECT value FROM json_each(?1)) AND hour >= ?2",
            ids,
            since
        )
        .fetch_all(&self.read)
        .await?;
        let mut out: HashMap<String, HashSet<Millis>> = HashMap::new();
        for r in rows {
            out.entry(r.project_id).or_default().insert(r.hour);
        }
        Ok(out)
    }

    /// Union of alive hours across projects.
    pub(crate) async fn alive_any(&self, ids: &str, since: Millis) -> Result<HashSet<Millis>> {
        Ok(self.alive_hours(ids, since).await?.into_values().flatten().collect())
    }
}

/// Worst first, for the overview: down, regressed, new issues, healthy, then waiting.
pub(crate) fn health_rank(h: ProjectHealth) -> u8 {
    match h {
        ProjectHealth::Down => 0,
        ProjectHealth::Regressed => 1,
        ProjectHealth::NewIssues => 2,
        ProjectHealth::Healthy => 3,
        ProjectHealth::AwaitingFirstEvent => 4,
    }
}
