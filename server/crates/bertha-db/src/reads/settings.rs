//! Project settings, alerts and the team. Alerts and the team are the owner's alone.

use bertha_core::domain::{
    AlertDelivery, AlertDestination, AlertRule, AlertTrigger, Environment, LogLevel, ProjectIds, ProjectLogSettings,
    Spike,
};
use bertha_core::fixes::fix_watching;
use bertha_core::ids::{AlertRuleId, DestinationId, ProjectId};
use bertha_core::pages::{AlertsData, ProjectSettings, TeamData};
use bertha_core::time::IsoDate;

use crate::codec::envs;
use crate::scope::Viewer;
use crate::{Db, Error, Result};

/// Deliveries shown on the alerts page.
const DELIVERIES_LISTED: i64 = 50;

impl Db {
    pub async fn project_settings(&self, viewer: &Viewer, project_id: &str) -> Result<Option<ProjectSettings>> {
        let Some(project) = self.project(viewer, project_id).await? else { return Ok(None) };
        let Some(setup) = self.setup_of(project_id).await? else { return Ok(None) };
        let pid = ProjectId(project_id.to_owned());
        let members = self.all_members().await?.into_iter().filter(|m| m.project_ids.contains(&pid)).collect();
        let brief = self.project_brief(viewer, &pid).await?;
        let kept = sqlx::query!(
            r#"SELECT watch_fixes AS "watch_fixes: bool", log_min_level, log_retention_days AS "days: i64"
               FROM projects WHERE id = ?"#,
            project_id
        )
        .fetch_one(&self.read)
        .await?;
        let watch_fixes = kept.watch_fixes;
        let logs = ProjectLogSettings {
            min_level: LogLevel::parse(&kept.log_min_level).unwrap_or(LogLevel::Info),
            retention_days: u32::try_from(kept.days).unwrap_or(14),
        };
        Ok(Some(ProjectSettings {
            fix_watching: fix_watching(project.repo_url.as_deref(), watch_fixes, self.watches_github()),
            watch_fixes,
            project,
            brief,
            setup,
            monitors: self.monitors_of_project(project_id).await?,
            members,
            logs,
            log_usage: self.log_usage(&pid).await?,
        }))
    }

    pub async fn alerts(&self, viewer: &Viewer) -> Result<AlertsData> {
        viewer.require_owner()?;
        Ok(AlertsData {
            rules: self.alert_rules().await?,
            destinations: self.destinations().await?,
            deliveries: self.deliveries().await?,
            projects: self.projects(viewer).await?,
            environments: Environment::ALL.to_vec(),
        })
    }

    pub(crate) async fn alert_rules(&self) -> Result<Vec<AlertRule>> {
        let rows = sqlx::query!(
            "SELECT id, name, project_ids, environments, triggers, spike_events, spike_minutes, log_match,
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
                    log_match: r.log_match.as_deref().map(serde_json::from_str).transpose()?,
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

    /// The last [`DELIVERIES_LISTED`] alerts that went out or were tried, newest first.
    pub(crate) async fn deliveries(&self) -> Result<Vec<AlertDelivery>> {
        let rows = sqlx::query!(
            r#"SELECT o.id, o.tried_at AS "tried_at!: i64", o.rule_id AS "rule_id!: String", o.destination_id,
                      o.status, o.last_error, json_extract(o.alert, '$.title') AS "title?: String"
               FROM alert_deliveries o
               WHERE o.tried_at IS NOT NULL AND o.rule_id IS NOT NULL
               ORDER BY o.tried_at DESC, o.id DESC LIMIT ?"#,
            DELIVERIES_LISTED
        )
        .fetch_all(&self.read)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| {
                let error = match r.status.as_str() {
                    "sent" => None,
                    "pending" => Some(format!("{} Trying again.", r.last_error.as_deref().unwrap_or("It failed."))),
                    _ => Some(format!("{} Gave up.", r.last_error.as_deref().unwrap_or("It failed."))),
                };
                AlertDelivery {
                    id: r.id.to_string(),
                    at: IsoDate::from_millis(r.tried_at),
                    rule_id: AlertRuleId(r.rule_id),
                    destination_id: DestinationId(r.destination_id),
                    ok: error.is_none(),
                    error,
                    summary: r.title.unwrap_or_default(),
                }
            })
            .collect())
    }

    pub async fn team(&self, viewer: &Viewer) -> Result<TeamData> {
        viewer.require_owner()?;
        Ok(TeamData { members: self.all_members().await?, projects: self.projects(viewer).await? })
    }
}
