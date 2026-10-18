//! Ingest against a fresh project in the seeded database: what each event does to
//! its issue, and what's counted alongside.

use bertha_core::api::{CreateProjectInput, IssueChange, MergeIssuesFailure, Outcome};
use bertha_core::domain::{Activity, Environment, IssueStatus, Level, Runtime, Snooze, TagKey};
use bertha_core::time::{HOUR, floor_hour, parse_millis};

use super::ingest::{Change, KeyedProject, NewEvent};
use crate::seed::{FIXTURES, Fixtures, SeedOptions};
use crate::stored::StoredEvent;
use crate::{Clock, Db, Viewer};

async fn setup() -> (Db, Viewer, KeyedProject, tempfile::TempDir) {
    let fx = Fixtures::parse(FIXTURES).expect("fixtures parse");
    let now = parse_millis(&fx.now.0).expect("now");
    let dir = tempfile::tempdir().expect("tempdir");
    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(now)).await.expect("open");
    db.seed(&fx, SeedOptions { dev_invite_tokens: false }).await.expect("seed");
    let owner = db.viewer_unchecked("m-owner").await.expect("load").expect("owner");
    let input = CreateProjectInput {
        name: "Lantern".into(),
        key: None,
        client: None,
        repo_url: None,
        url: None,
        runtimes: vec![Runtime::Browser],
        environments: vec![],
    };
    let Outcome::Ok(created) = db.create_project(&owner, &input).await.expect("create") else { panic!("created") };
    let key = created.setup.ingest_key.clone();
    let project = db.project_by_ingest_key(&key).await.expect("lookup").expect("found");
    // The new project is visible to a viewer loaded after it exists.
    let owner = db.viewer_unchecked("m-owner").await.expect("load").expect("owner");
    (db, owner, project, dir)
}

fn event(db: &Db, fp: u8) -> NewEvent {
    NewEvent {
        client_id: None,
        at: db.now() - 60_000,
        fingerprint: [fp; 16],
        r#type: "TypeError".into(),
        message: "basket is undefined".into(),
        culprit: Some("src/cart.ts in sumLines".into()),
        level: Level::Error,
        environment: Environment::Production,
        release: Some("1.0.0".into()),
        user_hash: Some([1; 16]),
        tags: vec![(TagKey::Browser, "Safari 18".into()), (TagKey::Environment, "production".into())],
        payload: StoredEvent {
            release: Some("1.0.0".into()),
            environment: Environment::Production,
            level: Level::Error,
            exception: None,
            breadcrumbs: vec![],
            request: None,
            user: None,
            context: Default::default(),
            tags: Default::default(),
        },
    }
}

#[tokio::test]
async fn events_group_into_issues() {
    let (db, owner, project, _dir) = setup().await;
    assert_eq!(db.project_by_ingest_key("bk_nope").await.unwrap(), None);
    let mut second = event(&db, 7);
    second.level = Level::Fatal;
    second.user_hash = Some([2; 16]);
    second.environment = Environment::Staging;
    let done = db.ingest(&project, &[event(&db, 7), second, event(&db, 7), event(&db, 8)]).await.unwrap();
    let changes: Vec<Change> = done.iter().map(|d| d.change).collect();
    assert_eq!(changes, vec![Change::New, Change::Repeat, Change::Repeat, Change::New]);
    assert_eq!(done[0].issue_id, done[1].issue_id);
    assert_eq!(done[0].short_id, "LANT-1");
    assert_eq!(done[3].short_id, "LANT-2");

    let d = db.issue_detail(&owner, &done[0].issue_id.0).await.unwrap().expect("visible");
    let s = &d.issue.summary;
    assert_eq!((s.event_count, s.user_count), (3, 2));
    assert_eq!(s.level, Level::Fatal, "an issue keeps its worst level");
    assert_eq!(s.environments, vec![Environment::Production, Environment::Staging]);
    assert_eq!(s.status, IssueStatus::Unresolved);
    assert!(s.is_new);
    assert_eq!(d.issue.first_release.as_deref(), Some("1.0.0"));
    assert!(matches!(d.issue.activity.last(), Some(Activity::FirstSeen { .. })));
    let browser = d.issue.tags.iter().find(|t| t.key == TagKey::Browser).expect("browser tag");
    assert_eq!((browser.distinct, browser.values[0].count), (1, 3));
    // The hour has three events in the trend.
    assert_eq!(s.trend.counts.iter().flatten().sum::<u32>(), 3);

    // The release started with its first event; the project has seen events.
    let setup = db.project_setup(&owner, &project.id.0).await.unwrap().expect("setup");
    assert!(setup.first_event_at.is_some());
    let releases = db.list_releases(&owner, Some(&project.id.0)).await.unwrap();
    // One per environment the version was seen in.
    let mut envs: Vec<Environment> = releases.releases.iter().map(|r| r.environment).collect();
    envs.sort_by_key(|e| e.as_str());
    assert_eq!(envs, vec![Environment::Production, Environment::Staging]);
    assert!(releases.releases.iter().all(|r| r.version == "1.0.0"));
}

#[tokio::test]
async fn retried_sends_are_dropped() {
    let (db, owner, project, _dir) = setup().await;
    let mut e = event(&db, 3);
    e.client_id = Some("evt-1".into());
    let first = db.ingest(&project, &[e.clone()]).await.unwrap();
    let again = db.ingest(&project, &[e]).await.unwrap();
    assert_eq!(again[0].change, Change::Duplicate);
    let d = db.issue_detail(&owner, &first[0].issue_id.0).await.unwrap().unwrap();
    assert_eq!(d.issue.summary.event_count, 1);
}

#[tokio::test]
async fn resolved_issues_regress_and_snoozes_lift() {
    let (db, owner, project, _dir) = setup().await;
    let id = db.ingest(&project, &[event(&db, 4)]).await.unwrap()[0].issue_id.0.clone();
    db.update_issues(&owner, std::slice::from_ref(&id), &IssueChange::Resolve { in_next_release: None }, None)
        .await
        .unwrap();

    // Sent before the resolve, arriving after: still resolved.
    let late = db.ingest(&project, &[event(&db, 4)]).await.unwrap();
    assert_eq!(late[0].change, Change::Repeat);
    assert!(late[0].quiet);
    db.clock().advance(HOUR);
    let mut back = event(&db, 4);
    back.release = Some("1.1.0".into());
    let done = db.ingest(&project, &[back]).await.unwrap();
    assert_eq!(done[0].change, Change::Regressed);
    assert!(!done[0].quiet);
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap();
    assert_eq!(d.issue.summary.status, IssueStatus::Unresolved);
    assert!(d.issue.summary.is_regression);
    assert_eq!(d.issue.regressed_in.as_deref(), Some("1.1.0"));
    assert!(matches!(d.issue.activity.first(), Some(Activity::Regressed { .. })), "{:?}", d.issue.activity);

    // Snoozed for 2 events: the first counts down quietly, the second lifts it.
    let snooze = IssueChange::Snooze { snooze: Snooze::Events { total: 2, remaining: 2 } };
    db.update_issues(&owner, std::slice::from_ref(&id), &snooze, None).await.unwrap();
    let quiet = db.ingest(&project, &[event(&db, 4)]).await.unwrap();
    assert_eq!(quiet[0].change, Change::Repeat);
    assert!(quiet[0].quiet);
    let lifted = db.ingest(&project, &[event(&db, 4)]).await.unwrap();
    assert_eq!(lifted[0].change, Change::Unsnoozed);
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap();
    assert_eq!(d.issue.summary.status, IssueStatus::Unresolved);
    assert_eq!(d.issue.summary.snooze, None);

    // Ignored issues still count, quietly.
    db.update_issues(&owner, std::slice::from_ref(&id), &IssueChange::Ignore, None).await.unwrap();
    let ignored = db.ingest(&project, &[event(&db, 4)]).await.unwrap();
    assert!(ignored[0].quiet);
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap();
    assert_eq!(d.issue.summary.status, IssueStatus::Ignored);
    assert_eq!(d.issue.summary.event_count, 6);
}

#[tokio::test]
async fn rare_tag_values_only_count() {
    let (db, owner, project, _dir) = setup().await;
    let events: Vec<NewEvent> = (0..60)
        .map(|i| {
            let mut e = event(&db, 5);
            e.tags = vec![(TagKey::Url, format!("/p/{i}"))];
            e
        })
        .collect();
    let id = db.ingest(&project, &events).await.unwrap()[0].issue_id.0.clone();
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap();
    let url = d.issue.tags.iter().find(|t| t.key == TagKey::Url).expect("url tag");
    assert_eq!(url.distinct, 60);
}

#[tokio::test]
async fn deploys_heartbeats_and_maps() {
    let (db, owner, project, _dir) = setup().await;
    let at = db.now() - HOUR;
    let a = db.record_deploy(&project.id, "2.0.0", Environment::Production, at, None).await.unwrap();
    let b = db
        .record_deploy(&project.id, "2.0.0", Environment::Production, at + 1, Some(("abc123", "Fix cart", "Ana")))
        .await
        .unwrap();
    assert_eq!(a, b, "the same version is the same release");
    let releases = db.list_releases(&owner, Some(&project.id.0)).await.unwrap();
    assert_eq!(releases.releases.len(), 1);

    db.heartbeat(&project.id, at).await.unwrap();
    db.heartbeat(&project.id, at).await.unwrap();
    let hours = sqlx::query_scalar!("SELECT hour FROM project_hours WHERE project_id = ?", project.id.0)
        .fetch_all(db.reader())
        .await
        .unwrap();
    assert_eq!(hours, vec![floor_hour(at)]);

    db.save_sourcemap(&project.id, "dbg-1", "index.js", Some("2.0.0"), br#"{"version":3}"#).await.unwrap();
    db.save_sourcemap(&project.id, "dbg-1", "index.js", Some("2.0.1"), br#"{"version":3,"x":1}"#).await.unwrap();
    let map = db.sourcemap(&project.id, "dbg-1", 1024).await.unwrap().expect("stored");
    assert_eq!(map, br#"{"version":3,"x":1}"#);
    assert_eq!(db.sourcemap(&project.id, "dbg-2", 1024).await.unwrap(), None);
}

#[tokio::test]
async fn resolving_in_the_next_release_waits_for_a_new_version() {
    let (db, owner, project, _dir) = setup().await;
    let id = db.ingest(&project, &[event(&db, 9)]).await.unwrap()[0].issue_id.0.clone();
    let change = IssueChange::Resolve { in_next_release: Some(true) };
    db.update_issues(&owner, std::slice::from_ref(&id), &change, None).await.unwrap();

    // The old code is still running: 1.0.0 keeps sending, quietly.
    db.clock().advance(HOUR);
    let old = db.ingest(&project, &[event(&db, 9)]).await.unwrap();
    assert_eq!(old[0].change, Change::Repeat);
    assert!(old[0].quiet);
    assert_eq!(db.issue_detail(&owner, &id).await.unwrap().unwrap().issue.summary.status, IssueStatus::Resolved);

    let mut fixed = event(&db, 9);
    fixed.release = Some("1.1.0".into());
    assert_eq!(
        db.ingest(&project, &[fixed]).await.unwrap()[0].change,
        Change::Regressed,
        "the new version still has it"
    );
    // Once regressed, the old version counts again after the next plain resolve.
    db.update_issues(&owner, std::slice::from_ref(&id), &IssueChange::Resolve { in_next_release: None }, None)
        .await
        .unwrap();
    db.clock().advance(HOUR);
    assert_eq!(db.ingest(&project, &[event(&db, 9)]).await.unwrap()[0].change, Change::Regressed);
}

#[tokio::test]
async fn merged_issues_take_future_events() {
    let (db, owner, project, _dir) = setup().await;
    let done = db.ingest(&project, &[event(&db, 5), event(&db, 6), event(&db, 6)]).await.unwrap();
    let (target, source) = (done[0].issue_id.0.clone(), done[1].issue_id.0.clone());
    assert_ne!(target, source);

    let Outcome::Ok(merged) = db.merge_issues(&owner, &target, std::slice::from_ref(&source)).await.unwrap() else {
        panic!("merged")
    };
    assert_eq!(merged.summary.event_count, 3);
    assert!(db.issue_detail(&owner, &source).await.unwrap().is_none(), "the source is gone");
    let d = db.issue_detail(&owner, &target).await.unwrap().unwrap();
    assert_eq!(d.issue.summary.trend.counts.iter().flatten().sum::<u32>(), 3, "its hours moved too");

    // A new event with the source's fingerprint lands on the target.
    let later = db.ingest(&project, &[event(&db, 6)]).await.unwrap();
    assert_eq!(later[0].issue_id.0, target);
    assert_eq!(later[0].change, Change::Repeat);
    // So does one merged in a second time, through a merge of a merge.
    let other = db.ingest(&project, &[event(&db, 10)]).await.unwrap()[0].issue_id.0.clone();
    let Outcome::Ok(_) = db.merge_issues(&owner, &other, std::slice::from_ref(&target)).await.unwrap() else {
        panic!("merged again")
    };
    assert_eq!(db.ingest(&project, &[event(&db, 6)]).await.unwrap()[0].issue_id.0, other);

    let kiln = db.list_issues(&owner, &Default::default()).await.unwrap();
    let foreign = kiln.issues.iter().find(|i| i.project_id != project.id).expect("a seeded issue").id.0.clone();
    assert!(matches!(
        db.merge_issues(&owner, &other, &[foreign]).await.unwrap(),
        Outcome::Failed(MergeIssuesFailure::DifferentProjects, _)
    ));
    assert!(matches!(
        db.merge_issues(&owner, &other, &["i-nope".into()]).await.unwrap(),
        Outcome::Failed(MergeIssuesFailure::NotFound, _)
    ));
    assert!(db.merge_issues(&owner, &other, std::slice::from_ref(&other)).await.is_err(), "nothing to merge");
}
