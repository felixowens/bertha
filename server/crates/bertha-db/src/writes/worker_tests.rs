//! What the background workers write: monitor transitions and incidents, the alert
//! outbox, and housekeeping.

use bertha_core::api::{AlertRuleInput, DestinationInput, IssueChange, MonitorInput, Outcome};
use bertha_core::domain::{
    Activity, AlertTrigger, Environment, IssueStatus, MonitorState, ProjectIds, Snooze, UnsnoozeReason,
};
use bertha_core::ids::{MonitorId, ProjectId};
use bertha_core::time::{DAY, HOUR, IsoDate, MINUTE, Millis, parse_millis};

use super::monitors::CheckResult;
use crate::seed::{FIXTURES, Fixtures, SeedOptions};
use crate::{Clock, Db, Viewer};

const URL: &str = "https://invoice.example.dev";

async fn seeded() -> (Db, Viewer, tempfile::TempDir) {
    let fx = Fixtures::parse(FIXTURES).expect("fixtures parse");
    let now = parse_millis(&fx.now.0).expect("now");
    let dir = tempfile::tempdir().expect("tempdir");
    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(now)).await.expect("open");
    db.seed(&fx, SeedOptions { dev_invite_tokens: false }).await.expect("seed");
    let owner = db.viewer_unchecked("m-owner").await.expect("load").expect("owner");
    (db, owner, dir)
}

fn check(at: Millis, ok: bool) -> CheckResult {
    CheckResult {
        at,
        ok,
        degraded: false,
        http_status: ok.then_some(200),
        response_ms: ok.then_some(200),
        error: (!ok).then(|| "Connection refused".into()),
        region: "Frankfurt".into(),
    }
}

async fn invoice_monitor(db: &Db, owner: &Viewer) -> MonitorId {
    let input = MonitorInput {
        id: None,
        project_id: ProjectId("p-invoice".into()),
        name: "Invoice site".into(),
        url: URL.into(),
        interval_seconds: 60,
        paused: false,
    };
    let Outcome::Ok(m) = db.save_monitor(owner, &input, Some(&check(db.now(), true))).await.expect("save") else {
        panic!("saved")
    };
    m.id
}

#[tokio::test]
async fn two_failures_open_an_incident_and_a_good_check_closes_it() {
    let (db, owner, _d) = seeded().await;
    let id = invoice_monitor(&db, &owner).await;
    let t = db.now();

    assert!(db.due_monitors(10).await.unwrap().iter().all(|m| m.id != id), "not due until its interval passes");
    db.clock().advance(MINUTE);
    assert!(db.due_monitors(10).await.unwrap().iter().any(|m| m.id == id && m.interval == MINUTE));

    // One failure is not down.
    let first_fail = t + MINUTE;
    assert_eq!(db.record_check(&id, URL, &check(first_fail, false), first_fail + MINUTE).await.unwrap(), None);
    let m = db.monitor_detail(&owner, &id.0).await.unwrap().unwrap().monitor;
    assert_eq!(m.state, MonitorState::Up);

    let down = db.record_check(&id, URL, &check(t + 2 * MINUTE, false), t + 3 * MINUTE).await.unwrap().expect("moved");
    assert_eq!((down.from, down.to), (MonitorState::Up, MonitorState::Down));
    assert_eq!(down.cause.as_deref(), Some("Connection refused"));
    assert_eq!(down.project_name, "Invoice runner");
    let detail = db.monitor_detail(&owner, &id.0).await.unwrap().unwrap();
    assert_eq!(detail.monitor.state, MonitorState::Down);
    assert_eq!(detail.monitor.since, IsoDate::from_millis(t + 2 * MINUTE));
    let incident = &detail.incidents[0];
    assert_eq!(incident.started_at, IsoDate::from_millis(first_fail), "dated from the first failure");
    assert_eq!((incident.resolved_at.as_ref(), incident.failed_checks), (None, 2));

    // Still failing: counted on the open incident, no new transition.
    assert_eq!(db.record_check(&id, URL, &check(t + 3 * MINUTE, false), t + 4 * MINUTE).await.unwrap(), None);

    let up = db.record_check(&id, URL, &check(t + 4 * MINUTE, true), t + 5 * MINUTE).await.unwrap().expect("moved");
    assert_eq!((up.from, up.to), (MonitorState::Down, MonitorState::Up));
    assert_eq!(up.down_for, Some(3 * MINUTE));
    assert_eq!(up.incident_id, down.incident_id);
    let detail = db.monitor_detail(&owner, &id.0).await.unwrap().unwrap();
    let incident = &detail.incidents[0];
    assert_eq!(incident.resolved_at, Some(IsoDate::from_millis(t + 4 * MINUTE)));
    assert_eq!(incident.failed_checks, 3);

    // Slow answers are degraded, and that's a transition too.
    let slow = CheckResult { degraded: true, ..check(t + 5 * MINUTE, true) };
    let moved = db.record_check(&id, URL, &slow, t + 6 * MINUTE).await.unwrap().expect("moved");
    assert_eq!(moved.to, MonitorState::Degraded);
    assert_eq!(moved.incident_id, None);
}

#[tokio::test]
async fn checks_on_a_changed_monitor_are_dropped() {
    let (db, owner, _d) = seeded().await;
    let id = invoice_monitor(&db, &owner).await;
    let t = db.now();
    // The URL changed while the check ran.
    db.record_check(&id, "https://old.example.dev", &check(t, false), t).await.unwrap();
    db.record_check(&id, "https://old.example.dev", &check(t + 1, false), t).await.unwrap();
    let m = db.monitor_detail(&owner, &id.0).await.unwrap().unwrap();
    assert_eq!(m.monitor.state, MonitorState::Up);
    assert!(m.incidents.is_empty());
    assert_eq!(db.record_check(&MonitorId("mon_gone".into()), URL, &check(t, false), t).await.unwrap(), None);
}

async fn rule_with_destination(
    db: &Db,
    owner: &Viewer,
) -> (bertha_core::ids::AlertRuleId, Vec<bertha_core::ids::DestinationId>) {
    let Outcome::Ok(dest) = db
        .save_destination(owner, &DestinationInput::Webhook { label: "Ops".into(), url: "https://ops.dev/hook".into() })
        .await
        .unwrap()
    else {
        panic!("saved")
    };
    let input = AlertRuleInput {
        id: None,
        name: "Everything".into(),
        project_ids: ProjectIds::All,
        environments: vec![Environment::Production],
        triggers: vec![AlertTrigger::NewIssue],
        spike: None,
        destination_ids: vec![dest.id().clone()],
        enabled: true,
    };
    let Outcome::Ok(rule) = db.save_alert_rule(owner, &input).await.unwrap() else { panic!("saved") };
    (rule.id, rule.destination_ids)
}

#[tokio::test]
async fn the_outbox_queues_once_per_cooldown_and_retries() {
    let (db, owner, _d) = seeded().await;
    let (rule, dests) = rule_with_destination(&db, &owner).await;
    let alert = r#"{"title":"x"}"#;

    assert!(db.enqueue_alert(&rule, "issue:1", HOUR, &dests, alert).await.unwrap());
    assert!(!db.enqueue_alert(&rule, "issue:1", HOUR, &dests, alert).await.unwrap(), "cooling down");
    assert!(db.enqueue_alert(&rule, "issue:2", HOUR, &dests, alert).await.unwrap(), "another subject");
    let fired = db.enabled_alert_rules().await.unwrap().into_iter().find(|r| r.id == rule).unwrap();
    assert_eq!(fired.last_fired_at, Some(IsoDate::from_millis(db.now())));

    let due = db.due_deliveries(10).await.unwrap();
    assert_eq!(due.len(), 2);
    assert_eq!(due[0].alert, alert);
    assert_eq!(due[0].attempts, 0);

    // One fails and comes back later; the other is given up on.
    db.delivery_failed(due[0].id, "It answered 500.", Some(db.now() + MINUTE)).await.unwrap();
    db.delivery_failed(due[1].id, "It answered 410.", None).await.unwrap();
    assert!(db.due_deliveries(10).await.unwrap().is_empty());
    assert_eq!(db.next_delivery_at().await.unwrap(), Some(db.now() + MINUTE));
    db.clock().advance(MINUTE);
    let again = db.due_deliveries(10).await.unwrap();
    assert_eq!((again.len(), again[0].attempts), (1, 1));
    db.delivery_sent(again[0].id).await.unwrap();
    assert_eq!(db.next_delivery_at().await.unwrap(), None);

    db.clock().advance(HOUR);
    assert!(db.enqueue_alert(&rule, "issue:1", HOUR, &dests, alert).await.unwrap(), "cooldown over");

    // A switched-off rule queues nothing.
    sqlx::query("UPDATE alert_rules SET enabled = 0").execute(db.writer()).await.unwrap();
    assert!(!db.enqueue_alert(&rule, "issue:3", HOUR, &dests, alert).await.unwrap());
    assert!(db.enabled_alert_rules().await.unwrap().iter().all(|r| r.id != rule));
}

#[tokio::test]
async fn dated_snoozes_lift_with_an_entry() {
    let (db, owner, _d) = seeded().await;
    let until = db.now() + HOUR;
    let issue = db
        .list_issues(
            &owner,
            &serde_json::from_value(serde_json::json!({
                "projectIds": [], "status": "unresolved", "levels": [], "environment": "all",
                "assignee": "anyone", "query": "", "sort": "last_seen", "range": "7d"
            }))
            .unwrap(),
        )
        .await
        .unwrap()
        .issues[0]
        .id
        .0
        .clone();
    let snooze = IssueChange::Snooze { snooze: Snooze::Until { until: IsoDate::from_millis(until) } };
    db.update_issues(&owner, std::slice::from_ref(&issue), &snooze, None).await.unwrap();
    let before: Vec<_> = db.lift_expired_snoozes().await.unwrap();
    assert!(before.iter().all(|(_, i)| i.0 != issue), "not yet");

    db.clock().advance(2 * HOUR);
    let lifted = db.lift_expired_snoozes().await.unwrap();
    assert!(lifted.iter().any(|(_, i)| i.0 == issue));
    let d = db.issue_detail(&owner, &issue).await.unwrap().unwrap();
    assert_eq!(d.issue.summary.status, IssueStatus::Unresolved);
    assert_eq!(
        d.issue.activity.first(),
        Some(&Activity::Unsnoozed { at: IsoDate::from_millis(until), reason: UnsnoozeReason::DatePassed })
    );
    assert!(db.lift_expired_snoozes().await.unwrap().is_empty(), "once");
}

#[tokio::test]
async fn sweeping_keeps_uptime_true_and_drops_what_expired() {
    let (db, owner, _d) = seeded().await;
    let id = invoice_monitor(&db, &owner).await;
    // An old hour of checks: 30 good ones and a failure among them.
    let hour = db.now() - 8 * DAY;
    let hour = hour - hour.rem_euclid(HOUR);
    for i in 0..31 {
        let c = check(hour + i * MINUTE, i != 10);
        sqlx::query("INSERT INTO checks (monitor_id, at, ok, response_ms, region) VALUES (?, ?, ?, ?, 'x')")
            .bind(&id.0)
            .bind(c.at)
            .bind(c.ok)
            .bind(100 + i)
            .execute(db.writer())
            .await
            .unwrap();
    }
    let uptime = |db: Db, owner: Viewer, id: MonitorId| async move {
        db.monitor_detail(&owner, &id.0).await.unwrap().unwrap().monitor.uptime30d
    };
    let before = uptime(db.clone(), owner.clone(), id.clone()).await;
    let swept = db.sweep(90 * DAY).await.unwrap();
    assert_eq!(swept.checks_folded, 29, "30 good checks become one row");
    let rows: Vec<(i64, i64)> =
        sqlx::query_as("SELECT ok, samples FROM checks WHERE monitor_id = ? AND at < ? ORDER BY at")
            .bind(&id.0)
            .bind(hour + HOUR)
            .fetch_all(db.reader())
            .await
            .unwrap();
    assert_eq!(rows, vec![(1, 30), (0, 1)]);
    assert_eq!(uptime(db.clone(), owner.clone(), id.clone()).await, before);
    assert_eq!(db.sweep(90 * DAY).await.unwrap().checks_folded, 0, "folding twice changes nothing");

    // Past retention, events and checks go; issues stay.
    let issues_before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM issues").fetch_one(db.reader()).await.unwrap();
    db.clock().advance(100 * DAY);
    let swept = db.sweep(90 * DAY).await.unwrap();
    assert!(swept.events > 0 && swept.checks_removed > 0, "{swept:?}");
    let events: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM events").fetch_one(db.reader()).await.unwrap();
    assert_eq!(events, 0);
    let issues: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM issues").fetch_one(db.reader()).await.unwrap();
    assert_eq!(issues, issues_before);
    db.optimize().await.unwrap();
    db.vacuum().await.unwrap();
}
