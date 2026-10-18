//! Alerts: matching rules against what just happened, queueing the matches in the
//! outbox, and delivering them by email or as a webhook shaped for Slack, Discord or
//! anything else.

use std::collections::HashSet;
use std::sync::Arc;

use bertha_core::domain::{AlertDestination, AlertRule, AlertTrigger, Environment, MonitorState};
use bertha_core::ids::{AlertRuleId, ProjectId};
use bertha_core::time::{DAY, HOUR, MINUTE, Millis};
use bertha_db::Db;
use bertha_db::writes::ingest::{Change, Ingested, KeyedProject};
use bertha_db::writes::uptime::Transition;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::Notify;

use crate::mail::{Mail, Mailer};

/// The same new issue alerts once; a flapping regression at most hourly.
const NEW_ISSUE_COOLDOWN: Millis = DAY;
const REGRESSION_COOLDOWN: Millis = HOUR;
/// A spike alerts again only after this long, or the rule's window if longer.
const SPIKE_COOLDOWN: Millis = HOUR;
/// A site that flaps down and up sends one pair of alerts per this long.
const MONITOR_COOLDOWN: Millis = 15 * MINUTE;

/// An alert as people read it, whatever carries it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Notice {
    /// What kind of alert, for webhook consumers: `test`, `new_issue`, `monitor_down`…
    pub kind: String,
    pub title: String,
    pub body: String,
    /// Where to look in bertha.
    pub link: String,
}

impl Notice {
    pub fn test(public_url: &str) -> Notice {
        Notice {
            kind: "test".into(),
            title: "Test alert from bertha".into(),
            body: "This destination works. Real alerts will arrive here.".into(),
            link: format!("{public_url}/settings/alerts"),
        }
    }
}

/// Matches rules against ingested events and monitor transitions, and queues what
/// matched. The outbox worker delivers; [`Alerter::wake`] tells it there's work.
#[derive(Clone)]
pub struct Alerter {
    db: Db,
    wake: Arc<Notify>,
}

impl Alerter {
    pub fn new(db: Db) -> Alerter {
        Alerter { db, wake: Arc::new(Notify::new()) }
    }

    /// Resolves when something was queued since the last call.
    pub async fn queued(&self) {
        self.wake.notified().await;
    }

    async fn enqueue(&self, rule: &AlertRule, subject: &str, cooldown: Millis, notice: &Notice) -> bool {
        let alert = match serde_json::to_string(notice) {
            Ok(a) => a,
            Err(e) => {
                tracing::error!(error = %e, "alert didn't serialise");
                return false;
            }
        };
        match self.db.enqueue_alert(&rule.id, subject, cooldown, &rule.destination_ids, &alert).await {
            Ok(true) => {
                tracing::info!(rule = %rule.id, subject, kind = notice.kind, "alert queued");
                self.wake.notify_one();
                true
            }
            Ok(false) => false,
            Err(e) => {
                tracing::error!(error = %e, rule = %rule.id, "queueing an alert failed");
                false
            }
        }
    }

    async fn rules(&self) -> Vec<AlertRule> {
        self.db.enabled_alert_rules().await.unwrap_or_else(|e| {
            tracing::error!(error = %e, "loading alert rules failed");
            vec![]
        })
    }

    /// New issues, regressions and spikes in one stored batch. Ignored and snoozed
    /// issues stay quiet.
    pub async fn ingested(&self, project: &KeyedProject, done: &[Ingested]) {
        let loud: Vec<&Ingested> = done.iter().filter(|d| d.change != Change::Duplicate && !d.quiet).collect();
        if loud.is_empty() {
            return;
        }
        let rules = self.rules().await;
        let url = self.db.public_url();
        let mut spikes_checked: HashSet<(AlertRuleId, &str)> = HashSet::new();
        for d in loud {
            let env = Some(d.environment);
            let edge = match d.change {
                Change::New => Some((AlertTrigger::NewIssue, "issue", NEW_ISSUE_COOLDOWN)),
                Change::Regressed => Some((AlertTrigger::Regression, "regressed", REGRESSION_COOLDOWN)),
                _ => None,
            };
            if let Some((trigger, prefix, cooldown)) = edge {
                let notice = issue_notice(url, &project.name, d, trigger, None);
                for rule in rules.iter().filter(|r| applies(r, trigger, &project.id, env)) {
                    self.enqueue(rule, &format!("{prefix}:{}", d.issue_id), cooldown, &notice).await;
                }
            }
            for rule in rules.iter().filter(|r| applies(r, AlertTrigger::Spike, &project.id, env)) {
                let Some(spike) = &rule.spike else { continue };
                if !spikes_checked.insert((rule.id.clone(), d.issue_id.as_str())) {
                    continue;
                }
                let window = i64::from(spike.within_minutes) * MINUTE;
                let n = match self.db.events_since(&d.issue_id, self.db.now() - window).await {
                    Ok(n) => n,
                    Err(e) => {
                        tracing::error!(error = %e, "counting events for a spike failed");
                        continue;
                    }
                };
                if n >= i64::from(spike.events) {
                    let notice =
                        issue_notice(url, &project.name, d, AlertTrigger::Spike, Some((n, spike.within_minutes)));
                    let cooldown = SPIKE_COOLDOWN.max(window);
                    self.enqueue(rule, &format!("spike:{}", d.issue_id), cooldown, &notice).await;
                }
            }
        }
    }

    /// A monitor going down, coming back from down, or turning degraded. Down to
    /// degraded counts as recovered: it answers again.
    pub async fn monitor(&self, t: &Transition) {
        let trigger = match (t.from, t.to) {
            (_, MonitorState::Down) => AlertTrigger::MonitorDown,
            (MonitorState::Down, _) => AlertTrigger::MonitorRecovered,
            (_, MonitorState::Degraded) => AlertTrigger::MonitorDegraded,
            _ => return,
        };
        let notice = monitor_notice(self.db.public_url(), t, trigger);
        for rule in self.rules().await.iter().filter(|r| applies(r, trigger, &t.project_id, None)) {
            let subject = format!("{}:{}", trigger.as_str(), t.monitor_id);
            self.enqueue(rule, &subject, MONITOR_COOLDOWN, &notice).await;
        }
    }
}

/// Whether a rule cares about this trigger here. Monitors have no environment, so
/// only the project counts for them. A rule with no environments listed takes all.
fn applies(rule: &AlertRule, trigger: AlertTrigger, project: &ProjectId, env: Option<Environment>) -> bool {
    rule.enabled
        && rule.triggers.contains(&trigger)
        && rule.project_ids.contains(project)
        && env.is_none_or(|e| rule.environments.is_empty() || rule.environments.contains(&e))
}

fn issue_notice(url: &str, project: &str, d: &Ingested, trigger: AlertTrigger, spike: Option<(i64, u32)>) -> Notice {
    let release = d.release.as_deref().map(|r| format!(", release {r}")).unwrap_or_default();
    let (title, body) = match (trigger, spike) {
        (AlertTrigger::Regression, _) => (
            format!("Regressed in {project}: {}", d.r#type),
            format!(
                "{}: {}
Back in {}{release}.",
                d.short_id,
                d.message,
                d.environment.as_str()
            ),
        ),
        (AlertTrigger::Spike, Some((n, minutes))) => (
            format!("Spike in {project}: {}", d.r#type),
            format!(
                "{}: {n} events in the last {minutes}m.
{}",
                d.short_id, d.message
            ),
        ),
        _ => (
            format!("New issue in {project}: {}", d.r#type),
            format!(
                "{}: {}
First seen in {}{release}.",
                d.short_id,
                d.message,
                d.environment.as_str()
            ),
        ),
    };
    Notice { kind: trigger.as_str().into(), title, body, link: format!("{url}/issues/{}", d.issue_id) }
}

fn monitor_notice(url: &str, t: &Transition, trigger: AlertTrigger) -> Notice {
    let (title, body) = if trigger == AlertTrigger::MonitorDown {
        let cause = t.cause.as_deref().unwrap_or("No response");
        (
            format!("{} is down", t.name),
            format!(
                "{cause}.
{}",
                t.url
            ),
        )
    } else if trigger == AlertTrigger::MonitorDegraded {
        let cause = t.cause.as_deref().unwrap_or("Answering slowly");
        (
            format!("{} is degraded", t.name),
            format!(
                "{cause}. It still answers.
{}",
                t.url
            ),
        )
    } else {
        let down = t.down_for.map(|d| format!("Down for {}.", duration(d))).unwrap_or_else(|| "Back up.".into());
        (
            format!("{} is back up", t.name),
            format!(
                "{down}
{}",
                t.url
            ),
        )
    };
    Notice { kind: trigger.as_str().into(), title, body, link: format!("{url}/uptime/{}", t.monitor_id) }
}

/// "45s", "25m", "2h 5m", "3d 4h".
fn duration(ms: Millis) -> String {
    let s = ms.max(0) / 1000;
    match s {
        0..60 => format!("{s}s"),
        60..3600 => format!("{}m", s / 60),
        3600..86400 if s % 3600 / 60 == 0 => format!("{}h", s / 3600),
        3600..86400 => format!("{}h {}m", s / 3600, s % 3600 / 60),
        _ if s % 86400 / 3600 == 0 => format!("{}d", s / 86400),
        _ => format!("{}d {}h", s / 86400, s % 86400 / 3600),
    }
}

/// Why a delivery failed, in words for the alerts page.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct Undelivered(pub String);

pub async fn deliver(
    to: &AlertDestination,
    notice: &Notice,
    mailer: &Mailer,
    http: &reqwest::Client,
) -> Result<(), Undelivered> {
    match to {
        AlertDestination::Email { address, .. } => {
            let mail = Mail {
                to: address.clone(),
                subject: notice.title.clone(),
                body: format!("{}\n\n{}", notice.body, notice.link),
            };
            mailer.send(mail).await.map_err(|e| {
                tracing::warn!(error = ?e, "alert email failed");
                Undelivered(format!("The mail server refused it: {e}"))
            })
        }
        AlertDestination::Webhook { url, .. } => post_webhook(http, url, notice).await,
    }
}

pub async fn post_webhook(http: &reqwest::Client, url: &str, notice: &Notice) -> Result<(), Undelivered> {
    let res = http.post(url).json(&webhook_body(url, notice)).send().await.map_err(|e| {
        let why = if e.is_timeout() { "It timed out after 10s" } else { "Couldn't connect to it" };
        Undelivered(format!("{why}."))
    })?;
    let status = res.status();
    if status.is_success() { Ok(()) } else { Err(Undelivered(format!("It answered {status}."))) }
}

/// Slack and Discord each want their own field; everyone else gets the parts.
fn webhook_body(url: &str, n: &Notice) -> serde_json::Value {
    let host = url.split("://").nth(1).and_then(|r| r.split(['/', ':']).next()).unwrap_or_default();
    let text = format!("*{}*\n{}\n{}", n.title, n.body, n.link);
    if host.ends_with("slack.com") {
        json!({ "text": text })
    } else if host.ends_with("discord.com") || host.ends_with("discordapp.com") {
        json!({ "content": text.replacen('*', "**", 2) })
    } else {
        json!({ "kind": n.kind, "title": n.title, "text": n.body, "url": n.link })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use axum::Json;
    use axum::http::StatusCode;

    use super::*;

    #[test]
    fn durations_read_short() {
        assert_eq!(duration(45_000), "45s");
        assert_eq!(duration(25 * MINUTE), "25m");
        assert_eq!(duration(2 * HOUR), "2h");
        assert_eq!(duration(2 * HOUR + 5 * MINUTE), "2h 5m");
        assert_eq!(duration(3 * DAY + 4 * HOUR), "3d 4h");
    }

    #[test]
    fn rules_apply_by_trigger_project_and_environment() {
        use bertha_core::domain::ProjectIds;
        let p = ProjectId("p-kiln".into());
        let rule = AlertRule {
            id: AlertRuleId("r".into()),
            name: "r".into(),
            project_ids: ProjectIds::Some(vec![p.clone()]),
            environments: vec![Environment::Production],
            triggers: vec![AlertTrigger::NewIssue, AlertTrigger::MonitorDown],
            spike: None,
            destination_ids: vec![],
            enabled: true,
            last_fired_at: None,
        };
        assert!(applies(&rule, AlertTrigger::NewIssue, &p, Some(Environment::Production)));
        assert!(!applies(&rule, AlertTrigger::NewIssue, &p, Some(Environment::Staging)));
        assert!(!applies(&rule, AlertTrigger::Regression, &p, Some(Environment::Production)));
        assert!(!applies(&rule, AlertTrigger::NewIssue, &ProjectId("p-other".into()), Some(Environment::Production)));
        assert!(applies(&rule, AlertTrigger::MonitorDown, &p, None), "monitors have no environment");
        assert!(!applies(&AlertRule { enabled: false, ..rule.clone() }, AlertTrigger::MonitorDown, &p, None));
        let everywhere = AlertRule { environments: vec![], ..rule };
        assert!(applies(&everywhere, AlertTrigger::NewIssue, &p, Some(Environment::Development)));
    }

    #[test]
    fn webhook_shapes() {
        let n = Notice::test("https://bertha.test");
        assert!(
            webhook_body("https://hooks.slack.com/services/x", &n)["text"].as_str().unwrap_or("").starts_with("*Test")
        );
        assert!(
            webhook_body("https://discord.com/api/webhooks/x", &n)["content"]
                .as_str()
                .unwrap_or("")
                .starts_with("**Test")
        );
        assert_eq!(webhook_body("https://ops.dev/hook", &n)["kind"], "test");
    }

    #[tokio::test]
    async fn webhooks_report_what_happened() {
        let got: Arc<Mutex<Vec<serde_json::Value>>> = Arc::default();
        let sink = got.clone();
        let app = axum::Router::new()
            .route(
                "/ok",
                axum::routing::post(move |Json(v): Json<serde_json::Value>| async move {
                    sink.lock().map(|mut g| g.push(v)).ok();
                    StatusCode::NO_CONTENT
                }),
            )
            .route("/broken", axum::routing::post(|| async { StatusCode::GONE }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        tokio::spawn(async move { axum::serve(listener, app).await });
        let http = crate::uptime::http_client().expect("client");
        let n = Notice::test("https://bertha.test");

        post_webhook(&http, &format!("http://{addr}/ok"), &n).await.expect("delivered");
        assert_eq!(got.lock().expect("lock")[0]["title"], "Test alert from bertha");
        let e = post_webhook(&http, &format!("http://{addr}/broken"), &n).await.expect_err("fails");
        assert_eq!(e.0, "It answered 410 Gone.");
        let e = post_webhook(&http, "http://127.0.0.1:9/", &n).await.expect_err("fails");
        assert_eq!(e.0, "Couldn't connect to it.");
    }
}
