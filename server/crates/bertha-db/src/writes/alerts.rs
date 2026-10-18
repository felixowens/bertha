//! Alert rules and destinations. The owner's alone.

use bertha_core::api::{
    AlertRuleInput, DeleteAlertRuleFailure, DestinationInput, Outcome, SaveAlertRuleFailure, SaveDestinationFailure,
};
use bertha_core::domain::{AlertDestination, AlertRule, AlertTrigger, ProjectIds};
use bertha_core::ids::{AlertRuleId, DestinationId};
use bertha_core::validate;

use crate::codec::env_mask;
use crate::scope::Viewer;
use crate::{Db, Error, Result};

const NAME_LIMIT: usize = 200;
/// A spike is at least this many events, within at most a day.
const SPIKE_EVENTS: std::ops::RangeInclusive<u32> = 2..=1_000_000;
const SPIKE_MINUTES: std::ops::RangeInclusive<u32> = 1..=1440;

impl Db {
    pub async fn save_alert_rule(
        &self,
        viewer: &Viewer,
        input: &AlertRuleInput,
    ) -> Result<Outcome<AlertRule, SaveAlertRuleFailure>> {
        viewer.require_owner()?;
        if input.triggers.is_empty() {
            return Ok(Outcome::fail(SaveAlertRuleFailure::NoTrigger));
        }
        if input.destination_ids.is_empty() {
            return Ok(Outcome::fail(SaveAlertRuleFailure::NoDestination));
        }
        let name = input.name.trim();
        if name.is_empty() || name.len() > NAME_LIMIT {
            return Err(Error::Invalid(format!("Give the rule a name of up to {NAME_LIMIT} characters.")));
        }
        let spike = if input.triggers.contains(&AlertTrigger::Spike) {
            match &input.spike {
                Some(s) if SPIKE_EVENTS.contains(&s.events) && SPIKE_MINUTES.contains(&s.within_minutes) => Some(s),
                Some(_) => {
                    return Err(Error::Invalid("A spike is at least 2 events within at most 1440 minutes.".into()));
                }
                None => return Err(Error::Invalid("Say how many events count as a spike.".into())),
            }
        } else {
            None
        };
        if let ProjectIds::Some(ids) = &input.project_ids {
            if ids.is_empty() {
                return Err(Error::Invalid("Pick at least one project, or all of them.".into()));
            }
            if let Some(p) = ids.iter().find(|p| !viewer.can_see(p)) {
                return Err(Error::Invalid(format!("Project {p} no longer exists.")));
            }
        }
        let known: Vec<DestinationId> = self.destinations().await?.into_iter().map(|d| d.id().clone()).collect();
        if let Some(d) = input.destination_ids.iter().find(|d| !known.contains(d)) {
            return Err(Error::Invalid(format!("Destination {d} was deleted.")));
        }

        let mut triggers = input.triggers.clone();
        triggers.sort_by_key(|t| t.as_str());
        triggers.dedup();
        let mut destination_ids = input.destination_ids.clone();
        destination_ids.dedup();
        let project_ids = serde_json::to_string(&input.project_ids)?;
        let triggers = serde_json::to_string(&triggers)?;
        let destination_ids = serde_json::to_string(&destination_ids)?;
        let environments = env_mask(&input.environments);
        let spike_events = spike.map(|s| i64::from(s.events));
        let spike_minutes = spike.map(|s| i64::from(s.within_minutes));
        let enabled = input.enabled;
        let now = self.now();

        let id = match &input.id {
            Some(id) => {
                let done = sqlx::query!(
                    "UPDATE alert_rules SET name = ?, project_ids = ?, environments = ?, triggers = ?,
                            spike_events = ?, spike_minutes = ?, destination_ids = ?, enabled = ?
                     WHERE id = ?",
                    name,
                    project_ids,
                    environments,
                    triggers,
                    spike_events,
                    spike_minutes,
                    destination_ids,
                    enabled,
                    id.0
                )
                .execute(&self.write)
                .await?
                .rows_affected();
                if done == 0 {
                    return Err(Error::Invalid("That rule was deleted. Nothing was saved.".into()));
                }
                id.clone()
            }
            None => {
                let id = AlertRuleId::generate();
                sqlx::query!(
                    "INSERT INTO alert_rules (id, name, project_ids, environments, triggers, spike_events,
                                              spike_minutes, destination_ids, enabled, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id.0,
                    name,
                    project_ids,
                    environments,
                    triggers,
                    spike_events,
                    spike_minutes,
                    destination_ids,
                    enabled,
                    now
                )
                .execute(&self.write)
                .await?;
                id
            }
        };
        match self.alert_rules().await?.into_iter().find(|r| r.id == id) {
            Some(rule) => Ok(Outcome::Ok(rule)),
            None => Err(Error::Corrupt(format!("rule {id} vanished after saving"))),
        }
    }

    pub async fn delete_alert_rule(&self, viewer: &Viewer, id: &str) -> Result<Outcome<(), DeleteAlertRuleFailure>> {
        viewer.require_owner()?;
        let done = sqlx::query!("DELETE FROM alert_rules WHERE id = ?", id).execute(&self.write).await?.rows_affected();
        if done == 0 {
            return Ok(Outcome::fail(DeleteAlertRuleFailure::NotFound));
        }
        Ok(Outcome::Ok(()))
    }

    pub async fn save_destination(
        &self,
        viewer: &Viewer,
        input: &DestinationInput,
    ) -> Result<Outcome<AlertDestination, SaveDestinationFailure>> {
        viewer.require_owner()?;
        let id = DestinationId::generate();
        let now = self.now();
        let destination = match input {
            DestinationInput::Email { address } => {
                let Some(address) = validate::email(address) else {
                    return Ok(Outcome::fail(SaveDestinationFailure::InvalidEmail));
                };
                AlertDestination::Email { id, address }
            }
            DestinationInput::Webhook { label, url } => {
                let Some(url) = validate::webhook_url(url) else {
                    return Ok(Outcome::fail(SaveDestinationFailure::InvalidWebhook));
                };
                let label = label.trim();
                let label = if label.is_empty() { webhook_label(&url) } else { label.to_owned() };
                if label.len() > NAME_LIMIT {
                    return Err(Error::Invalid(format!("Labels can be at most {NAME_LIMIT} characters.")));
                }
                AlertDestination::Webhook { id, label, url }
            }
        };
        let (kind, address, label, url) = match &destination {
            AlertDestination::Email { address, .. } => ("email", Some(address.as_str()), None, None),
            AlertDestination::Webhook { label, url, .. } => ("webhook", None, Some(label.as_str()), Some(url.as_str())),
        };
        let id = destination.id().as_str();
        sqlx::query!(
            "INSERT INTO alert_destinations (id, kind, address, label, url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            id,
            kind,
            address,
            label,
            url,
            now
        )
        .execute(&self.write)
        .await?;
        Ok(Outcome::Ok(destination))
    }

    /// One destination, for sending a test alert. `None` if it was deleted.
    pub async fn destination(&self, viewer: &Viewer, id: &str) -> Result<Option<AlertDestination>> {
        viewer.require_owner()?;
        Ok(self.destinations().await?.into_iter().find(|d| d.id().as_str() == id))
    }
}

/// "Slack", "Discord", or the host, for a webhook added without a label.
fn webhook_label(url: &str) -> String {
    let host = url.split("://").nth(1).and_then(|r| r.split(['/', ':']).next()).unwrap_or(url);
    if host.ends_with("slack.com") {
        "Slack".into()
    } else if host.ends_with("discord.com") || host.ends_with("discordapp.com") {
        "Discord".into()
    } else {
        host.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webhook_labels() {
        assert_eq!(webhook_label("https://hooks.slack.com/services/T/B/x"), "Slack");
        assert_eq!(webhook_label("https://discord.com/api/webhooks/1/x"), "Discord");
        assert_eq!(webhook_label("https://ops.example.dev:8443/hook"), "ops.example.dev");
    }
}
