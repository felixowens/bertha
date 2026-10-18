//! Mutations against the seeded fixtures: each named failure, and what each change
//! leaves behind.

use bertha_core::api::{
    AddIssueNoteFailure, AlertRuleInput, CreateProjectFailure, CreateProjectInput, DeleteAlertRuleFailure,
    DeleteProjectFailure, DestinationInput, InviteMemberFailure, IssueChange, MonitorInput, Outcome,
    RemoveMemberFailure, RotateIngestKeyFailure, SaveAlertRuleFailure, SaveDestinationFailure, SaveMonitorFailure,
    SeenIssue, UpdateIssuesFailure, UpdateMemberAccessFailure,
};
use bertha_core::domain::{
    Activity, AlertDestination, AlertTrigger, Environment, IssueStatus, MonitorState, ProjectIds, Runtime, Snooze,
    Spike,
};
use bertha_core::ids::{AlertRuleId, DestinationId, IssueId, MemberId, ProjectId};
use bertha_core::time::{HOUR, IsoDate, parse_millis};

use super::monitors::CheckResult;
use crate::seed::{FIXTURES, Fixtures, SeedOptions};
use crate::{Clock, Db, Error, Viewer};

async fn seeded() -> (Db, tempfile::TempDir) {
    let fx = Fixtures::parse(FIXTURES).expect("fixtures parse");
    let now = parse_millis(&fx.now.0).expect("now");
    let dir = tempfile::tempdir().expect("tempdir");
    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(now)).await.expect("open");
    db.seed(&fx, SeedOptions { dev_invite_tokens: true }).await.expect("seed");
    (db, dir)
}

async fn viewer(db: &Db, id: &str) -> Viewer {
    db.viewer_unchecked(id).await.expect("load").expect("member exists")
}

fn ids(v: &[&str]) -> Vec<String> {
    v.iter().map(|s| (*s).to_owned()).collect()
}

fn ok<T, F: std::fmt::Debug>(o: Outcome<T, F>) -> T {
    match o {
        Outcome::Ok(v) => v,
        Outcome::Failed(f, m) => panic!("expected ok, got {f:?}: {m}"),
    }
}

fn failure<T, F>(o: Outcome<T, F>) -> F {
    match o {
        Outcome::Ok(_) => panic!("expected a failure"),
        Outcome::Failed(f, _) => f,
    }
}

async fn status_of(db: &Db, v: &Viewer, id: &str) -> (IssueStatus, Option<MemberId>, Vec<Activity>) {
    let d = db.issue_detail(v, id).await.unwrap().expect("visible");
    (d.issue.summary.status, d.issue.summary.assignee.map(|a| a.id), d.issue.activity)
}

#[tokio::test]
async fn resolving_and_reopening_write_activity() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    db.update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Reopen, None).await.unwrap();
    let (_, _, before) = status_of(&db, &owner, "i-noisy").await;

    let out =
        ok(db.update_issues(&owner, &ids(&["i-noisy", "i-cart-map"]), &IssueChange::Resolve, None).await.unwrap());
    assert_eq!(out.len(), 2);
    assert!(out.iter().all(|s| s.status == IssueStatus::Resolved && !s.is_regression));
    let (status, _, activity) = status_of(&db, &owner, "i-noisy").await;
    assert_eq!(status, IssueStatus::Resolved);
    assert_eq!(activity.len(), before.len() + 1);
    assert!(matches!(&activity[0], Activity::Resolved { by, .. } if by.id.0 == "m-owner"));

    // Resolving again changes nothing and writes nothing.
    ok(db.update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Resolve, None).await.unwrap());
    assert_eq!(status_of(&db, &owner, "i-noisy").await.2.len(), activity.len());

    ok(db.update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Reopen, None).await.unwrap());
    let (status, _, activity) = status_of(&db, &owner, "i-noisy").await;
    assert_eq!(status, IssueStatus::Unresolved);
    assert!(matches!(activity[0], Activity::Reopened { .. }));
}

#[tokio::test]
async fn snoozing_until_a_time_or_for_some_events() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let later = IsoDate::from_millis(db.now() + 4 * HOUR);
    let out = ok(db
        .update_issues(
            &owner,
            &ids(&["i-noisy"]),
            &IssueChange::Snooze { snooze: Snooze::Until { until: later.clone() } },
            None,
        )
        .await
        .unwrap());
    assert_eq!(out[0].status, IssueStatus::Snoozed);
    assert_eq!(out[0].snooze, Some(Snooze::Until { until: later }));

    let events = Snooze::Events { total: 100, remaining: 3 };
    let out =
        ok(db.update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Snooze { snooze: events }, None).await.unwrap());
    assert_eq!(out[0].snooze, Some(Snooze::Events { total: 100, remaining: 100 }));

    let past = IsoDate::from_millis(db.now() - HOUR);
    let r = db
        .update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Snooze { snooze: Snooze::Until { until: past } }, None)
        .await;
    assert!(matches!(r, Err(Error::Invalid(_))));
    let zero = Snooze::Events { total: 0, remaining: 0 };
    let r = db.update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Snooze { snooze: zero }, None).await;
    assert!(matches!(r, Err(Error::Invalid(_))));
}

#[tokio::test]
async fn assigning_needs_someone_who_can_see_the_project() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = Some(MemberId("m-priya".into()));
    ok(db.update_issues(&owner, &ids(&["i-cart-map"]), &IssueChange::Assign { person_id: None }, None).await.unwrap());
    let out = ok(db
        .update_issues(&owner, &ids(&["i-cart-map"]), &IssueChange::Assign { person_id: priya.clone() }, None)
        .await
        .unwrap());
    assert_eq!(out[0].assignee.as_ref().map(|a| a.id.0.as_str()), Some("m-priya"));
    let (_, _, activity) = status_of(&db, &owner, "i-cart-map").await;
    assert!(matches!(&activity[0], Activity::Assigned { to: Some(p), .. } if p.id.0 == "m-priya"));

    // Priya can't see p-moss, and the pending member hasn't joined.
    let r =
        db.update_issues(&owner, &ids(&["i-moss-regressed"]), &IssueChange::Assign { person_id: priya }, None).await;
    assert!(matches!(r, Err(Error::Invalid(_))));
    let pending = Some(MemberId("m-pending".into()));
    let r = db.update_issues(&owner, &ids(&["i-cart-map"]), &IssueChange::Assign { person_id: pending }, None).await;
    assert!(matches!(r, Err(Error::Invalid(_))));

    let out = ok(db
        .update_issues(&owner, &ids(&["i-cart-map"]), &IssueChange::Assign { person_id: None }, None)
        .await
        .unwrap());
    assert_eq!(out[0].assignee, None);
}

#[tokio::test]
async fn updates_are_all_or_nothing() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let before = status_of(&db, &owner, "i-cart-map").await.0;

    let f =
        failure(db.update_issues(&owner, &ids(&["i-cart-map", "i-gone"]), &IssueChange::Ignore, None).await.unwrap());
    assert_eq!(f, UpdateIssuesFailure::NotFound);
    let f = failure(
        db.update_issues(&priya, &ids(&["i-cart-map", "i-moss-regressed"]), &IssueChange::Ignore, None).await.unwrap(),
    );
    assert_eq!(f, UpdateIssuesFailure::PermissionDenied);
    assert_eq!(status_of(&db, &owner, "i-cart-map").await.0, before);
}

#[tokio::test]
async fn a_stale_view_is_a_conflict() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let (status, assignee, _) = status_of(&db, &owner, "i-cart-map").await;
    let seen = vec![SeenIssue { id: IssueId("i-cart-map".into()), status, assignee_id: assignee }];

    // Priya triages it first; the owner's tab still shows the old state.
    let change = if status == IssueStatus::Ignored { IssueChange::Resolve } else { IssueChange::Ignore };
    ok(db.update_issues(&priya, &ids(&["i-cart-map"]), &change, None).await.unwrap());
    let f = failure(db.update_issues(&owner, &ids(&["i-cart-map"]), &IssueChange::Reopen, Some(&seen)).await.unwrap());
    assert_eq!(f, UpdateIssuesFailure::Conflict);

    // With what's true now, it goes through.
    let (status, assignee, _) = status_of(&db, &owner, "i-cart-map").await;
    let seen = vec![SeenIssue { id: IssueId("i-cart-map".into()), status, assignee_id: assignee }];
    ok(db.update_issues(&owner, &ids(&["i-cart-map"]), &IssueChange::Reopen, Some(&seen)).await.unwrap());
}

#[tokio::test]
async fn notes() {
    let (db, _d) = seeded().await;
    let priya = viewer(&db, "m-priya").await;
    let issue = ok(db.add_issue_note(&priya, "i-cart-map", "  Fixed in the next deploy.  ").await.unwrap());
    assert!(
        matches!(&issue.activity[0], Activity::Note { body, by, .. } if body == "Fixed in the next deploy." && by.id.0 == "m-priya")
    );
    assert_eq!(
        failure(db.add_issue_note(&priya, "i-moss-regressed", "hi").await.unwrap()),
        AddIssueNoteFailure::NotFound
    );
    assert_eq!(failure(db.add_issue_note(&priya, "i-gone", "hi").await.unwrap()), AddIssueNoteFailure::NotFound);
    assert!(matches!(db.add_issue_note(&priya, "i-cart-map", "   ").await, Err(Error::Invalid(_))));
}

fn new_project(name: &str) -> CreateProjectInput {
    CreateProjectInput {
        name: name.into(),
        client: Some("  ".into()),
        url: Some("https://wren.studio".into()),
        runtimes: vec![Runtime::Browser, Runtime::Server],
        environments: vec![],
    }
}

#[tokio::test]
async fn creating_projects() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let created = ok(db.create_project(&owner, &new_project("Wren & Co")).await.unwrap());
    assert_eq!(created.project.key, "WREN");
    assert_eq!(created.project.client, None);
    assert_eq!(created.project.environments, vec![Environment::Production]);
    assert!(created.setup.ingest_key.starts_with("bk_"));
    assert!(created.setup.snippet.contains(&created.setup.ingest_key));
    assert_eq!(created.setup.first_event_at, None);

    assert_eq!(
        failure(db.create_project(&owner, &new_project("wren co")).await.unwrap()),
        CreateProjectFailure::NameTaken
    );
    assert_eq!(
        failure(db.create_project(&owner, &new_project(" & ")).await.unwrap()),
        CreateProjectFailure::InvalidName
    );
    let second = ok(db.create_project(&owner, &new_project("Wren Two")).await.unwrap());
    assert_eq!(second.project.key, "WREN2");

    // The owner sees new projects at once; collaborators don't.
    let owner = viewer(&db, "m-owner").await;
    assert!(owner.can_see(&created.project.id));
    let priya = viewer(&db, "m-priya").await;
    assert!(matches!(db.create_project(&priya, &new_project("Mine")).await, Err(Error::Forbidden)));
}

#[tokio::test]
async fn rotating_the_ingest_key() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let old = db.project_setup(&owner, "p-kiln").await.unwrap().unwrap().ingest_key;
    let setup = ok(db.rotate_ingest_key(&owner, "p-kiln").await.unwrap().unwrap());
    assert_ne!(setup.ingest_key, old);
    assert_eq!(
        failure(db.rotate_ingest_key(&priya, "p-kiln").await.unwrap().unwrap()),
        RotateIngestKeyFailure::PermissionDenied
    );
    assert!(db.rotate_ingest_key(&priya, "p-moss").await.unwrap().is_none());
    assert!(db.rotate_ingest_key(&owner, "p-gone").await.unwrap().is_none());
}

#[tokio::test]
async fn deleting_a_project_takes_everything_with_it() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let name = db.projects(&owner).await.unwrap().into_iter().find(|p| p.id.0 == "p-kiln").unwrap().name;

    assert_eq!(
        failure(db.delete_project(&priya, "p-kiln", &name).await.unwrap().unwrap()),
        DeleteProjectFailure::PermissionDenied
    );
    assert_eq!(
        failure(db.delete_project(&owner, "p-kiln", "kiln").await.unwrap().unwrap()),
        DeleteProjectFailure::NameMismatch
    );
    ok(db.delete_project(&owner, "p-kiln", &format!(" {name} ")).await.unwrap().unwrap());

    let owner = viewer(&db, "m-owner").await;
    assert!(!owner.can_see(&ProjectId("p-kiln".into())));
    assert!(db.issue_detail(&owner, "i-cart-map").await.unwrap().is_none());
    assert!(db.delete_project(&owner, "p-kiln", &name).await.unwrap().is_none());
    let priya = viewer(&db, "m-priya").await;
    assert_eq!(priya.projects(), [ProjectId("p-harbour".into())]);
    for rule in db.alerts(&owner).await.unwrap().rules {
        assert!(!rule.project_ids.contains(&ProjectId("p-kiln".into())) || rule.project_ids == ProjectIds::All);
    }
}

fn check(ok: bool) -> CheckResult {
    CheckResult {
        at: 0,
        ok,
        degraded: false,
        http_status: ok.then_some(200),
        response_ms: Some(180),
        error: (!ok).then(|| "Timed out after 10s".into()),
        region: "Frankfurt".into(),
    }
}

fn monitor(project: &str) -> MonitorInput {
    MonitorInput {
        id: None,
        project_id: ProjectId(project.into()),
        name: "Invoice site".into(),
        url: "https://invoice.example.dev".into(),
        interval_seconds: 300,
        paused: false,
    }
}

#[tokio::test]
async fn saving_monitors() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let input = monitor("p-invoice");
    assert!(db.monitor_needs_check(&input).await.unwrap());

    let first = CheckResult { at: db.now(), ..check(false) };
    let f = db.save_monitor(&owner, &input, Some(&first)).await.unwrap();
    assert!(matches!(&f, Outcome::Failed(SaveMonitorFailure::Unreachable, m) if m.contains("Timed out after 10s")));
    assert!(db.list_monitors(&owner).await.unwrap().monitors.iter().all(|m| m.project_id.0 != "p-invoice"));

    let bad = MonitorInput { url: "invoice.example.dev".into(), ..monitor("p-invoice") };
    assert_eq!(failure(db.save_monitor(&owner, &bad, None).await.unwrap()), SaveMonitorFailure::InvalidUrl);

    let first = CheckResult { at: db.now(), ..check(true) };
    let saved = ok(db.save_monitor(&owner, &input, Some(&first)).await.unwrap());
    assert_eq!(saved.state, MonitorState::Up);
    assert_eq!(saved.latest_response_ms, Some(180));
    assert_eq!(saved.recent.iter().flatten().count(), 1);

    // Renaming needs no check; pausing and unpausing move the state.
    let rename = MonitorInput { id: Some(saved.id.clone()), name: "Invoices".into(), ..monitor("p-invoice") };
    assert!(!db.monitor_needs_check(&rename).await.unwrap());
    assert_eq!(ok(db.save_monitor(&owner, &rename, None).await.unwrap()).name, "Invoices");
    let pause = MonitorInput { paused: true, ..rename.clone() };
    assert_eq!(ok(db.save_monitor(&owner, &pause, None).await.unwrap()).state, MonitorState::Paused);
    assert!(db.monitor_needs_check(&rename).await.unwrap());

    let odd = MonitorInput { interval_seconds: 120, ..monitor("p-recipes") };
    assert!(matches!(db.save_monitor(&owner, &odd, None).await, Err(Error::Invalid(_))));
    let priya = viewer(&db, "m-priya").await;
    assert!(matches!(db.save_monitor(&priya, &monitor("p-recipes"), None).await, Err(Error::Forbidden)));
}

fn rule(destinations: Vec<DestinationId>) -> AlertRuleInput {
    AlertRuleInput {
        id: None,
        name: "Spikes on client sites".into(),
        project_ids: ProjectIds::Some(vec![ProjectId("p-kiln".into())]),
        environments: vec![Environment::Production],
        triggers: vec![AlertTrigger::Spike, AlertTrigger::NewIssue],
        spike: Some(Spike { events: 50, within_minutes: 10 }),
        destination_ids: destinations,
        enabled: true,
    }
}

#[tokio::test]
async fn alert_rules_and_destinations() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let email = DestinationInput::Email { address: "alerts@sundial.dev".into() };
    let dest = ok(db.save_destination(&owner, &email).await.unwrap());
    let bad = DestinationInput::Email { address: "alerts@".into() };
    assert_eq!(failure(db.save_destination(&owner, &bad).await.unwrap()), SaveDestinationFailure::InvalidEmail);
    let hook = DestinationInput::Webhook { label: String::new(), url: "http://hooks.slack.com/x".into() };
    assert_eq!(failure(db.save_destination(&owner, &hook).await.unwrap()), SaveDestinationFailure::InvalidWebhook);
    let hook = DestinationInput::Webhook { label: " ".into(), url: "https://hooks.slack.com/services/T/B/x".into() };
    assert!(
        matches!(ok(db.save_destination(&owner, &hook).await.unwrap()), AlertDestination::Webhook { label, .. } if label == "Slack")
    );

    let saved = ok(db.save_alert_rule(&owner, &rule(vec![dest.id().clone()])).await.unwrap());
    assert_eq!(saved.triggers, vec![AlertTrigger::NewIssue, AlertTrigger::Spike]);
    let edited = ok(db
        .save_alert_rule(
            &owner,
            &AlertRuleInput { id: Some(saved.id.clone()), enabled: false, ..rule(vec![dest.id().clone()]) },
        )
        .await
        .unwrap());
    assert!(!edited.enabled);

    assert_eq!(failure(db.save_alert_rule(&owner, &rule(vec![])).await.unwrap()), SaveAlertRuleFailure::NoDestination);
    let none = AlertRuleInput { triggers: vec![], ..rule(vec![dest.id().clone()]) };
    assert_eq!(failure(db.save_alert_rule(&owner, &none).await.unwrap()), SaveAlertRuleFailure::NoTrigger);
    let no_spike = AlertRuleInput { spike: None, ..rule(vec![dest.id().clone()]) };
    assert!(matches!(db.save_alert_rule(&owner, &no_spike).await, Err(Error::Invalid(_))));
    let ghost = rule(vec![DestinationId("d-gone".into())]);
    assert!(matches!(db.save_alert_rule(&owner, &ghost).await, Err(Error::Invalid(_))));

    ok(db.delete_alert_rule(&owner, saved.id.as_str()).await.unwrap());
    assert_eq!(
        failure(db.delete_alert_rule(&owner, saved.id.as_str()).await.unwrap()),
        DeleteAlertRuleFailure::NotFound
    );
    let gone = AlertRuleInput { id: Some(AlertRuleId("a-gone".into())), ..rule(vec![dest.id().clone()]) };
    assert!(matches!(db.save_alert_rule(&owner, &gone).await, Err(Error::Invalid(_))));

    let priya = viewer(&db, "m-priya").await;
    assert!(matches!(db.save_destination(&priya, &email).await, Err(Error::Forbidden)));
    assert!(matches!(db.delete_alert_rule(&priya, "a-x").await, Err(Error::Forbidden)));
}

#[tokio::test]
async fn inviting_changing_access_and_removing() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let kiln = ProjectId("p-kiln".into());
    let moss = ProjectId("p-moss".into());

    let inv = ok(db.invite_member(&owner, " wren@studio.dev ", &[kiln.clone(), kiln.clone()]).await.unwrap());
    assert_eq!(inv.member.email, "wren@studio.dev");
    assert_eq!(inv.member.joined_at, None);
    assert_eq!(inv.member.project_ids, ProjectIds::Some(vec![kiln.clone()]));
    assert_eq!(inv.project_names.len(), 1);
    assert!(db.invite(&inv.token).await.unwrap().is_some());

    // Inviting again replaces the link and the projects.
    let again = ok(db.invite_member(&owner, "WREN@studio.dev", std::slice::from_ref(&moss)).await.unwrap());
    assert_eq!(again.member.id, inv.member.id);
    assert_eq!(again.member.project_ids, ProjectIds::Some(vec![moss.clone()]));
    assert!(db.invite(&inv.token).await.unwrap().is_none());
    ok(db.accept_invite(&again.token).await.unwrap());

    assert_eq!(
        failure(db.invite_member(&owner, "wren@studio.dev", std::slice::from_ref(&kiln)).await.unwrap()),
        InviteMemberFailure::AlreadyMember
    );
    assert_eq!(
        failure(db.invite_member(&owner, "hello@sundial.dev", std::slice::from_ref(&kiln)).await.unwrap()),
        InviteMemberFailure::AlreadyMember
    );
    assert_eq!(
        failure(db.invite_member(&owner, "wren", std::slice::from_ref(&kiln)).await.unwrap()),
        InviteMemberFailure::InvalidEmail
    );
    assert!(matches!(db.invite_member(&owner, "x@y.dev", &[]).await, Err(Error::Invalid(_))));
    assert!(matches!(db.invite_member(&owner, "x@y.dev", &[ProjectId("p-gone".into())]).await, Err(Error::Invalid(_))));

    let wren = inv.member.id.as_str();
    let m = ok(db.update_member_access(&owner, wren, &[kiln.clone(), moss.clone()]).await.unwrap().unwrap());
    assert_eq!(m.project_ids, ProjectIds::Some(vec![kiln.clone(), moss.clone()]));
    let priya = viewer(&db, "m-priya").await;
    assert_eq!(
        failure(db.update_member_access(&priya, wren, std::slice::from_ref(&kiln)).await.unwrap().unwrap()),
        UpdateMemberAccessFailure::PermissionDenied
    );
    assert!(matches!(
        db.update_member_access(&owner, "m-owner", std::slice::from_ref(&kiln)).await,
        Err(Error::Invalid(_))
    ));
    assert!(db.update_member_access(&owner, "m-gone", &[kiln]).await.unwrap().is_none());

    assert_eq!(failure(db.remove_member(&owner, "m-owner").await.unwrap()), RemoveMemberFailure::CannotRemoveOwner);
    ok(db.remove_member(&owner, wren).await.unwrap());
    ok(db.remove_member(&owner, wren).await.unwrap());
    assert!(db.viewer_unchecked(wren).await.unwrap().is_none());
    assert!(matches!(db.remove_member(&priya, "m-tomasz").await, Err(Error::Forbidden)));
}
