//! Mutations against the seeded fixtures: each named failure, and what each change
//! leaves behind.

use bertha_core::api::{
    AddIssueNoteFailure, AlertRuleInput, CreateProjectFailure, CreateProjectInput, DeleteAlertRuleFailure,
    DeleteDestinationFailure, DeleteMonitorFailure, DeleteProjectFailure, DestinationInput, InviteMemberFailure,
    IssueChange, MonitorInput, Outcome, ProjectInput, RemoveMemberFailure, ResendInviteFailure, RotateIngestKeyFailure,
    SaveAlertRuleFailure, SaveDestinationFailure, SaveMonitorFailure, SeenIssue, UpdateIssuesFailure,
    UpdateMemberAccessFailure, UpdateProjectFailure,
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

    let out = ok(db
        .update_issues(&owner, &ids(&["i-noisy", "i-cart-map"]), &IssueChange::Resolve { in_next_release: None }, None)
        .await
        .unwrap());
    assert_eq!(out.len(), 2);
    assert!(out.iter().all(|s| s.status == IssueStatus::Resolved && !s.is_regression));
    let (status, _, activity) = status_of(&db, &owner, "i-noisy").await;
    assert_eq!(status, IssueStatus::Resolved);
    assert_eq!(activity.len(), before.len() + 1);
    assert!(matches!(&activity[0], Activity::Resolved { by, .. } if by.id.0 == "m-owner"));

    // Resolving again changes nothing and writes nothing.
    ok(db
        .update_issues(&owner, &ids(&["i-noisy"]), &IssueChange::Resolve { in_next_release: None }, None)
        .await
        .unwrap());
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
    let change = if status == IssueStatus::Ignored {
        IssueChange::Resolve { in_next_release: None }
    } else {
        IssueChange::Ignore
    };
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
        repo_url: None,
        runtimes: vec![Runtime::Browser, Runtime::Server],
        environments: vec![],
        key: None,
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
    assert!(created.setup.snippets[0].code.contains(&created.setup.ingest_key));
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
        log_match: None,
        destination_ids: destinations,
        enabled: true,
    }
}

#[tokio::test]
async fn alert_rules_and_destinations() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let email = DestinationInput::Email { id: None, address: "alerts@sundial.dev".into() };
    let dest = ok(db.save_destination(&owner, &email).await.unwrap());
    let bad = DestinationInput::Email { id: None, address: "alerts@".into() };
    assert_eq!(failure(db.save_destination(&owner, &bad).await.unwrap()), SaveDestinationFailure::InvalidEmail);
    let hook = DestinationInput::Webhook { id: None, label: String::new(), url: "http://hooks.slack.com/x".into() };
    assert_eq!(failure(db.save_destination(&owner, &hook).await.unwrap()), SaveDestinationFailure::InvalidWebhook);
    let hook =
        DestinationInput::Webhook { id: None, label: " ".into(), url: "https://hooks.slack.com/services/T/B/x".into() };
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

#[tokio::test]
async fn editing_a_project_and_choosing_its_key() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let edit = ProjectInput {
        name: " Kiln and Clay ".into(),
        client: Some("Kiln & Clay Ltd".into()),
        url: Some("https://kilnandclay.co.uk".into()),
        repo_url: Some("https://github.com/sundial/kiln/".into()),
        runtimes: vec![Runtime::Browser],
        environments: vec![Environment::Production, Environment::Staging],
        brief: Some("  Vite app on Netlify. Ignore ResizeObserver noise.  ".into()),
        watch_fixes: None,
        logs: None,
    };
    let p = ok(db.update_project(&owner, "p-kiln", &edit).await.unwrap().expect("visible"));
    let settings = db.project_settings(&owner, "p-kiln").await.unwrap().expect("visible");
    assert_eq!(settings.brief.as_deref(), Some("Vite app on Netlify. Ignore ResizeObserver noise."), "trimmed");
    assert_eq!(p.name, "Kiln and Clay");
    assert_eq!(p.key, "KILN", "the key never changes");
    assert_eq!(p.repo_url.as_deref(), Some("https://github.com/sundial/kiln"), "trailing slash dropped");
    assert_eq!(p.runtimes, vec![Runtime::Browser]);
    assert_eq!(p.monitor_ids.len(), 2, "monitors stay");
    // Keeping its own name is fine; taking another's is not.
    ok(db.update_project(&owner, "p-kiln", &edit).await.unwrap().unwrap());
    let taken = ProjectInput { name: "recipe BOX".into(), ..edit.clone() };
    assert_eq!(
        failure(db.update_project(&owner, "p-kiln", &taken).await.unwrap().unwrap()),
        UpdateProjectFailure::NameTaken
    );
    let blank = ProjectInput { name: " — ".into(), ..edit.clone() };
    assert_eq!(
        failure(db.update_project(&owner, "p-kiln", &blank).await.unwrap().unwrap()),
        UpdateProjectFailure::InvalidName
    );
    let repo = ProjectInput { repo_url: Some("git@github.com:sundial/kiln".into()), ..edit.clone() };
    assert!(matches!(db.update_project(&owner, "p-kiln", &repo).await, Err(Error::Invalid(_))));
    assert!(db.update_project(&owner, "p-gone", &edit).await.unwrap().is_none());

    let priya = viewer(&db, "m-priya").await;
    assert_eq!(
        failure(db.update_project(&priya, "p-kiln", &edit).await.unwrap().unwrap()),
        UpdateProjectFailure::PermissionDenied
    );
    assert!(db.update_project(&priya, "p-moss", &edit).await.unwrap().is_none(), "out of reach reads as missing");

    let keyed = CreateProjectInput { key: Some(" wren ".into()), ..new_project("Wren site") };
    assert_eq!(ok(db.create_project(&owner, &keyed).await.unwrap()).project.key, "WREN");
    let again = CreateProjectInput { key: Some("WREN".into()), ..new_project("Wren shop") };
    assert_eq!(failure(db.create_project(&owner, &again).await.unwrap()), CreateProjectFailure::KeyTaken);
    for bad in ["W", "1ABC", "TOOLONGKEY", "WR-N"] {
        let input = CreateProjectInput { key: Some(bad.into()), ..new_project("Wren shop") };
        assert_eq!(
            failure(db.create_project(&owner, &input).await.unwrap()),
            CreateProjectFailure::InvalidKey,
            "{bad}"
        );
    }
}

#[tokio::test]
async fn several_monitors_per_project_and_deleting_one() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let second = MonitorInput {
        name: "Kiln checkout API".into(),
        url: "https://api.kilnandclay.co.uk".into(),
        ..monitor("p-kiln")
    };
    let first = CheckResult { at: db.now(), ..check(true) };
    let saved = ok(db.save_monitor(&owner, &second, Some(&first)).await.unwrap());
    let s = db.project_settings(&owner, "p-kiln").await.unwrap().expect("settings");
    assert_eq!(s.monitors.len(), 3);
    assert_eq!(s.monitors.last().map(|m| &m.id), Some(&saved.id), "oldest first");

    let priya = viewer(&db, "m-priya").await;
    assert_eq!(
        failure(db.delete_monitor(&priya, saved.id.as_str()).await.unwrap()),
        DeleteMonitorFailure::PermissionDenied
    );
    assert!(db.monitor_to_check(&priya, "mon-moss").await.unwrap().is_none(), "not theirs");
    assert!(db.monitor_to_check(&priya, "mon-kiln").await.unwrap().is_some());

    ok(db.delete_monitor(&owner, saved.id.as_str()).await.unwrap());
    assert_eq!(failure(db.delete_monitor(&owner, saved.id.as_str()).await.unwrap()), DeleteMonitorFailure::NotFound);
    assert!(db.monitor_detail(&owner, saved.id.as_str()).await.unwrap().is_none());
    assert!(db.monitor_to_check(&owner, saved.id.as_str()).await.unwrap().is_none());
    // Editing a deleted monitor doesn't bring it back as a new one.
    let gone = MonitorInput { id: Some(saved.id.clone()), ..second };
    assert!(matches!(db.save_monitor(&owner, &gone, None).await, Err(Error::Invalid(_))));
}

#[tokio::test]
async fn editing_and_deleting_destinations() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let edit = DestinationInput::Webhook {
        id: Some(DestinationId("d-push".into())),
        label: "Phone".into(),
        url: "https://ntfy.sh/sundial-new".into(),
    };
    let d = ok(db.save_destination(&owner, &edit).await.unwrap());
    assert_eq!(d.id().as_str(), "d-push");
    let alerts = db.alerts(&owner).await.unwrap();
    assert_eq!(alerts.destinations.iter().filter(|d| d.id().as_str() == "d-push").count(), 1, "edited in place");

    // a-spike sends only to d-push and turns off; a-down still has d-chat.
    let out = ok(db.delete_destination(&owner, "d-push").await.unwrap());
    assert_eq!(out.rules_turned_off, vec![AlertRuleId("a-spike".into())]);
    let alerts = db.alerts(&owner).await.unwrap();
    let rule = |id: &str| alerts.rules.iter().find(|r| r.id.as_str() == id).unwrap().clone();
    assert!(!rule("a-spike").enabled && rule("a-spike").destination_ids.is_empty());
    assert!(rule("a-down").enabled);
    assert_eq!(rule("a-down").destination_ids, vec![DestinationId("d-chat".into())]);
    assert_eq!(failure(db.delete_destination(&owner, "d-push").await.unwrap()), DeleteDestinationFailure::NotFound);
    assert!(matches!(db.save_destination(&owner, &edit).await, Err(Error::Invalid(_))), "deleted while editing");

    // A rule that was already off isn't reported as turned off.
    let out = ok(db.delete_destination(&owner, "d-email").await.unwrap());
    assert_eq!(out.rules_turned_off, vec![AlertRuleId("a-new".into()), AlertRuleId("a-tides-feed".into())]);
    let priya = viewer(&db, "m-priya").await;
    assert!(matches!(db.delete_destination(&priya, "d-chat").await, Err(Error::Forbidden)));
}

#[tokio::test]
async fn resending_an_invite() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let team = db.team(&owner).await.unwrap();
    let lapsed = team.members.iter().find(|m| m.id.as_str() == "m-lapsed").expect("lapsed");
    let expired = lapsed.invite_expires_at.as_ref().and_then(|d| d.millis()).expect("expiry");
    assert!(expired < db.now(), "the seed's lapsed invite has expired");

    let inv = ok(db.resend_invite(&owner, "m-lapsed").await.unwrap());
    let fresh = inv.member.invite_expires_at.as_ref().and_then(|d| d.millis()).expect("expiry");
    assert_eq!(fresh, db.now() + crate::auth::INVITE_TTL);
    assert_eq!(inv.member.invited_at.as_ref().and_then(|d| d.millis()), Some(db.now()));
    assert!(db.invite(&inv.token).await.unwrap().is_some());
    let again = ok(db.resend_invite(&owner, "m-lapsed").await.unwrap());
    assert!(db.invite(&inv.token).await.unwrap().is_none(), "the old link stops working");
    assert!(db.invite(&again.token).await.unwrap().is_some());

    assert_eq!(failure(db.resend_invite(&owner, "m-priya").await.unwrap()), ResendInviteFailure::AlreadyMember);
    assert_eq!(failure(db.resend_invite(&owner, "m-gone").await.unwrap()), ResendInviteFailure::NotFound);
    let joined = team.members.iter().find(|m| m.id.as_str() == "m-priya").unwrap();
    assert_eq!((joined.invited_at.as_ref(), joined.invite_expires_at.as_ref()), (None, None));
    let priya = viewer(&db, "m-priya").await;
    assert!(matches!(db.resend_invite(&priya, "m-lapsed").await, Err(Error::Forbidden)));
}

#[tokio::test]
async fn deliveries_are_listed_newest_first() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let alerts = db.alerts(&owner).await.unwrap();
    assert!(alerts.deliveries.windows(2).all(|w| w[0].at.millis() >= w[1].at.millis()));
    assert!(alerts.deliveries.len() <= 50);
    assert!(alerts.deliveries.iter().all(|d| d.ok == d.error.is_none()));
}
