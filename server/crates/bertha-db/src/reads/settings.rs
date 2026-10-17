//! Project settings, alerts and the team. Alerts and the team are the owner's alone.

use bertha_core::domain::{AlertDestination, AlertRule, AlertTrigger, Environment, ProjectIds, Spike};
use bertha_core::ids::{AlertRuleId, DestinationId, ProjectId};
use bertha_core::pages::{AlertsData, ProjectSettings, TeamData};
use bertha_core::time::IsoDate;

use crate::codec::envs;
use crate::scope::Viewer;
use crate::{Db, Error, Result};

impl Db {
    pub async fn project_settings(&self, viewer: &Viewer, project_id: &str) -> Result<Option<ProjectSettings>> {
        let Some(project) = self.project(viewer, project_id).await? else { return Ok(None) };
        let Some(setup) = self.setup_of(project_id).await? else { return Ok(None) };
        let pid = ProjectId(project_id.to_owned());
        let members = self.all_members().await?.into_iter().filter(|m| m.project_ids.contains(&pid)).collect();
        Ok(Some(ProjectSettings { project, setup, monitor: self.monitor_of_project(project_id).await?, members }))
    }

    pub async fn alerts(&self, viewer: &Viewer) -> Result<AlertsData> {
        viewer.require_owner()?;
        Ok(AlertsData {
            rules: self.alert_rules().await?,
            destinations: self.destinations().await?,
            projects: self.projects(viewer).await?,
            environments: Environment::ALL.to_vec(),
        })
    }

    pub(crate) async fn alert_rules(&self) -> Result<Vec<AlertRule>> {
        let rows = sqlx::query!(
            "SELECT id, name, project_ids, environments, triggers, spike_events, spike_minutes,
                    destination_ids, enabled, last_fired_at
             FROM alert_rules ORDER BY created_at, id"
        )
        .fetch_all(&self.read)
        .await?;
        rows.into_iter()
            .map(|r| {
                let project_ids: ProjectIds = serde_json::from_str(&r.project_ids)?;
                let triggers: Vec<AlertTrigger> = serde_json::from_str(&r.triggers)?;
                let destination_ids: Vec<DestinationId> = serde_json::from_str(&r.destination_ids)?;
                let spike = match (r.spike_events, r.spike_minutes) {
                    (Some(events), Some(minutes)) => {
                        Some(Spike { events: events as u32, within_minutes: minutes as u32 })
                    }
                    _ => None,
                };
                Ok(AlertRule {
                    id: AlertRuleId(r.id),
                    name: r.name,
                    project_ids,
                    environments: envs(r.environments),
                    triggers,
                    spike,
                    destination_ids,
                    enabled: r.enabled == 1,
                    last_fired_at: r.last_fired_at.map(IsoDate::from_millis),
                })
            })
            .collect()
    }

    pub(crate) async fn destinations(&self) -> Result<Vec<AlertDestination>> {
        let rows = sqlx::query!("SELECT id, kind, address, label, url FROM alert_destinations ORDER BY created_at, id")
            .fetch_all(&self.read)
            .await?;
        rows.into_iter()
            .map(|r| match (r.kind.as_str(), r.address, r.label, r.url) {
                ("email", Some(address), _, _) => Ok(AlertDestination::Email { id: DestinationId(r.id), address }),
                ("webhook", _, Some(label), Some(url)) => {
                    Ok(AlertDestination::Webhook { id: DestinationId(r.id), label, url })
                }
                _ => Err(Error::Corrupt(format!("destination {}", r.id))),
            })
            .collect()
    }

    pub async fn team(&self, viewer: &Viewer) -> Result<TeamData> {
        viewer.require_owner()?;
        Ok(TeamData { members: self.all_members().await?, projects: self.projects(viewer).await? })
    }
}
