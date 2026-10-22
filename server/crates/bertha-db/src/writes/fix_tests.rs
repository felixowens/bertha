//! Fixes that ship: recording a fixed triage's PR or commit, following it to a release,
//! marking it shipped by hand, and what old builds do afterwards.

use bertha_core::api::{
    CreateProjectInput, IssueChange, Outcome, ProjectInput, TriageInput, UpdateIssuesFailure, UpdateProjectFailure,
};
use bertha_core::domain::{
    Activity, Environment, FixState, IssueFilter, IssueStatus, Level, Runtime, StatusFilter, TimeRange, TriageFilter,
    TriageOutcome,
};
use bertha_core::time::{HOUR, MINUTE, parse_millis};

use super::fixes::Candidate;
use super::ingest::{Change, KeyedProject, NewEvent};
use crate::seed::{FIXTURES, Fixtures, SeedOptions};
use crate::stored::StoredEvent;
use crate::{Clock, Db, Error, Viewer};

const REPO: &str = "https://github.com/felixowens/lantern";

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
        repo_url: Some(REPO.into()),
        url: None,
        runtimes: vec![Runtime::Browser],
        environments: vec![],
    };
    let Outcome::Ok(created) = db.create_project(&owner, &input).await.expect("create") else { panic!("created") };
    let project = db.project_by_ingest_key(&created.setup.ingest_key).await.expect("lookup").expect("found");
    let owner = db.viewer_unchecked("m-owner").await.expect("load").expect("owner");
    db.set_watches_github(true);
    (db, owner, project, dir)
}

fn event(db: &Db, fp: u8, release: &str) -> NewEvent {
    NewEvent {
        client_id: None,
        at: db.now() - 1,
        fingerprint: [fp; 16],
        r#type: "TypeError".into(),
        message: "basket is undefined".into(),
        culprit: Some("src/cart.ts in sumLines".into()),
        level: Level::Error,
        environment: Environment::Production,
        release: Some(release.into()),
        user_hash: None,
        tags: vec![],
        payload: StoredEvent {
            release: Some(release.into()),
            environment: Environment::Production,
            level: Level::Error,
            exception: None,
            mechanism: None,
            trace: None,
            breadcrumbs: vec![],
            request: None,
            user: None,
            context: Default::default(),
            tags: Default::default(),
        },
    }
}

fn ok<T, F: std::fmt::Debug>(o: Outcome<T, F>) -> T {
    match o {
        Outcome::Ok(v) => v,
        Outcome::Failed(f, m) => panic!("expected ok, got {f:?}: {m}"),
    }
}

/// Triages `issue` to the end, fixed, with this fix text and these explicit refs.
async fn fixed(db: &Db, v: &Viewer, issue: &str, fix: &str, pr: Option<u32>, commit: Option<&str>) -> String {
    db.clock().advance(1000);
    let t = ok(db.start_triage(v, issue, true).await.unwrap()).triage;
    let input = TriageInput {
        fix: Some(fix.into()),
        outcome: Some(TriageOutcome::Fixed),
        pr,
        commit: commit.map(str::to_owned),
        ..TriageInput::default()
    };
    ok(db.update_triage(v, &t.id.0, &input).await.unwrap()).triage.id.0
}

fn waiting() -> IssueFilter {
    IssueFilter {
        status: StatusFilter::ANY,
        range: TimeRange::Month,
        triage: Some(TriageFilter::FixWaiting),
        ..Default::default()
    }
}

#[tokio::test]
async fn a_watched_fix_resolves_its_issue_when_it_ships() {
    let (db, owner, project, _d) = setup().await;
    let id = db.ingest(&project, &[event(&db, 1, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    let triage =
        fixed(&db, &owner, &id, "Guard the basket. PR https://github.com/felixowens/lantern/pull/7", None, None).await;

    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    let watch = d.triages[0].watch.clone().expect("a fixed triage is watched");
    assert_eq!((watch.pr, watch.state, watch.problem), (Some(7), FixState::WaitingMerge, None));
    let claim = d.summary.fix.expect("the list shows the fix");
    assert_eq!((claim.pr, claim.state), (Some(7), FixState::WaitingMerge));
    assert!(db.list_issues(&owner, &waiting()).await.unwrap().issues.iter().any(|i| i.id.0 == id));

    // Without a token, it waits for a person.
    db.set_watches_github(false);
    let watch = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue.triages[0].watch.clone().unwrap();
    assert_eq!(watch.state, FixState::Unwatched);
    assert!(watch.problem.as_deref().is_some_and(|p| p.contains("BERTHA_GITHUB_TOKEN")), "{:?}", watch.problem);
    db.set_watches_github(true);

    let fixes = db.watched_fixes().await.unwrap();
    let fix = fixes.iter().find(|f| f.triage_id == triage).expect("followed").clone();
    assert_eq!(fix.pr, Some(7));

    // It merges; releases from before the merge can't have it.
    db.clock().advance(HOUR);
    db.record_deploy(&project.id, "1.0.1", Environment::Production, db.now(), Some(("0aaaaa1", "Other", "Ana")))
        .await
        .unwrap();
    db.clock().advance(MINUTE);
    db.fix_merged(&triage, "a1b2c3d4", db.now()).await.unwrap();
    let fix = db.watched_fixes().await.unwrap().into_iter().find(|f| f.triage_id == triage).unwrap();
    assert_eq!((fix.state, fix.commit.as_deref()), (FixState::WaitingRelease, Some("a1b2c3d4")));
    assert!(db.fix_candidates(&fix).await.unwrap().is_empty());

    // A staging release isn't production.
    db.clock().advance(HOUR);
    db.record_deploy(&project.id, "1.1.0-rc", Environment::Staging, db.now(), Some(("b2c3d4e5", "Rc", "Ana")))
        .await
        .unwrap();
    db.record_deploy(&project.id, "1.1.0", Environment::Production, db.now(), Some(("c3d4e5f6", "Ship", "Ana")))
        .await
        .unwrap();
    let candidates = db.fix_candidates(&fix).await.unwrap();
    assert_eq!(candidates.iter().map(|c| c.version.as_str()).collect::<Vec<_>>(), vec!["1.1.0"]);

    // Checked and found wanting, it isn't offered again.
    db.fix_checked(&triage, candidates[0].first_seen).await.unwrap();
    let fix = db.watched_fixes().await.unwrap().into_iter().find(|f| f.triage_id == triage).unwrap();
    assert!(db.fix_candidates(&fix).await.unwrap().is_empty());

    db.clock().advance(HOUR);
    db.record_deploy(&project.id, "1.2.0", Environment::Production, db.now(), Some(("d4e5f6a7", "Ship", "Ana")))
        .await
        .unwrap();
    let release = db.fix_candidates(&fix).await.unwrap().pop().expect("1.2.0");
    let shipped = db.fix_seen_shipping(&triage, &release).await.unwrap().expect("shipped");
    assert!(shipped.resolved);
    assert_eq!(db.fix_seen_shipping(&triage, &release).await.unwrap(), None, "only once");

    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    assert_eq!(d.summary.status, IssueStatus::Resolved);
    assert_eq!(d.summary.fix, None, "a resolved issue shows no waiting fix");
    let watch = d.triages[0].watch.clone().unwrap();
    assert_eq!((watch.state, watch.release.as_deref()), (FixState::Shipped, Some("1.2.0")));
    match d.activity.first() {
        Some(Activity::FixShipped { by: None, pr: Some(7), release: Some(r), commit: Some(c), .. }) => {
            assert_eq!((r.as_str(), c.as_str()), ("1.2.0", "a1b2c3d4"));
        }
        other => panic!("expected bertha's fix_shipped, got {other:?}"),
    }
    assert!(db.watched_fixes().await.unwrap().iter().all(|f| f.triage_id != triage));
    assert!(db.list_issues(&owner, &waiting()).await.unwrap().issues.iter().all(|i| i.id.0 != id));

    // Old builds draining away don't reopen it; the release with the fix does.
    db.clock().advance(HOUR);
    for old in ["1.0.0", "1.1.0"] {
        let done = db.ingest(&project, &[event(&db, 1, old)]).await.unwrap();
        assert_eq!(done[0].change, Change::Repeat, "{old} is old code");
    }
    let done = db.ingest(&project, &[event(&db, 1, "1.2.0")]).await.unwrap();
    assert_eq!(done[0].change, Change::Regressed, "the fix didn't work");
}

#[tokio::test]
async fn closed_resolved_and_replaced_fixes() {
    let (db, owner, project, _d) = setup().await;
    let id = db.ingest(&project, &[event(&db, 2, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    let first = fixed(&db, &owner, &id, "See #3", None, None).await;
    db.fix_closed(&first).await.unwrap();
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    assert_eq!(d.triages[0].watch.as_ref().map(|w| w.state), Some(FixState::Closed));
    assert!(db.list_issues(&owner, &waiting()).await.unwrap().issues.iter().any(|i| i.id.0 == id), "still waiting");

    // A later fix replaces a waiting one, and explicit refs win over the text.
    let waiting_one = fixed(&db, &owner, &id, "Try #4", None, None).await;
    let second = fixed(&db, &owner, &id, "Fixed in #5", None, Some(" E5F6A7B8 ")).await;
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    let watch = d.triages[0].watch.clone().unwrap();
    assert_eq!((watch.pr, watch.commit.as_deref(), watch.state), (None, Some("e5f6a7b8"), FixState::WaitingRelease));
    let replaced = d.triages.iter().find(|t| t.id.0 == waiting_one).unwrap().watch.clone().unwrap();
    assert_eq!(replaced.state, FixState::Unwatched);
    assert_eq!(replaced.problem.as_deref(), Some("A later triage replaced this fix."));
    let closed = d.triages.iter().find(|t| t.id.0 == first).unwrap().watch.clone().unwrap();
    assert_eq!(closed.state, FixState::Closed, "a closed PR stays closed");

    // Someone resolves it meanwhile: bertha stops following, and its later sighting
    // doesn't touch the issue.
    db.update_issues(&owner, std::slice::from_ref(&id), &IssueChange::Resolve { in_next_release: None }, None)
        .await
        .unwrap();
    assert!(db.watched_fixes().await.unwrap().iter().all(|f| f.triage_id != second));
    let late = Candidate { version: "9.0.0".into(), commit: "f6a7b8c9".into(), first_seen: db.now() };
    assert_eq!(db.fix_seen_shipping(&second, &late).await.unwrap(), None);

    // An ignored issue keeps its status when its fix ships.
    let other = db.ingest(&project, &[event(&db, 3, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    let t = fixed(&db, &owner, &other, "abc1234f", None, None).await;
    db.update_issues(&owner, std::slice::from_ref(&other), &IssueChange::Ignore, None).await.unwrap();
    let shipped = db.fix_seen_shipping(&t, &late).await.unwrap().expect("shipped");
    assert!(!shipped.resolved);
    assert_eq!(db.issue_detail(&owner, &other).await.unwrap().unwrap().issue.summary.status, IssueStatus::Ignored);

    // A commit has to look like one.
    let t = ok(db.start_triage(&owner, &other, true).await.unwrap()).triage;
    let bad =
        TriageInput { outcome: Some(TriageOutcome::Fixed), commit: Some("main".into()), ..TriageInput::default() };
    assert!(
        matches!(db.update_triage(&owner, &t.id.0, &bad).await, Err(Error::Invalid(m)) if m.contains("isn't a commit"))
    );
}

#[tokio::test]
async fn marking_a_fix_shipped_by_hand() {
    let (db, owner, project, _d) = setup().await;
    let id = db.ingest(&project, &[event(&db, 4, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    let ship = IssueChange::FixShipped;
    let ids = std::slice::from_ref(&id);
    match db.update_issues(&owner, ids, &ship, None).await.unwrap() {
        Outcome::Failed(UpdateIssuesFailure::NoFix, m) => assert!(m.contains("Resolve it instead"), "{m}"),
        other => panic!("expected no_fix, got {other:?}"),
    }

    // Nothing to follow: it waits for a person, with why.
    let triage = fixed(&db, &owner, &id, "Guarded the basket.", None, None).await;
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    let watch = d.triages[0].watch.clone().unwrap();
    assert_eq!(watch.state, FixState::Unwatched);
    assert!(watch.problem.as_deref().is_some_and(|p| p.contains("names no PR or commit")), "{:?}", watch.problem);
    assert_eq!(d.summary.fix.map(|f| f.state), Some(FixState::Unwatched));

    db.clock().advance(HOUR);
    db.record_deploy(&project.id, "1.1.0", Environment::Production, db.now(), None).await.unwrap();
    let agent = owner.clone().via("laptop".into());
    let summaries = ok(db.update_issues(&agent, ids, &ship, None).await.unwrap());
    assert_eq!(summaries[0].status, IssueStatus::Resolved);
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    let watch = d.triages.iter().find(|t| t.id.0 == triage).unwrap().watch.clone().unwrap();
    assert_eq!((watch.state, watch.release.as_deref()), (FixState::Shipped, Some("1.1.0")));
    match d.activity.first() {
        Some(Activity::FixShipped { by: Some(by), via: Some(via), release: Some(r), .. }) => {
            assert_eq!((by.id.0.as_str(), via.as_str(), r.as_str()), ("m-owner", "laptop", "1.1.0"));
        }
        other => panic!("expected a fix_shipped by the owner, got {other:?}"),
    }
    // Again is nothing new.
    let count = d.activity.len();
    ok(db.update_issues(&owner, ids, &ship, None).await.unwrap());
    assert_eq!(db.issue_detail(&owner, &id).await.unwrap().unwrap().issue.activity.len(), count);

    // 1.0.0 is old code now; 1.1.0 has the fix.
    db.clock().advance(HOUR);
    assert_eq!(db.ingest(&project, &[event(&db, 4, "1.0.0")]).await.unwrap()[0].change, Change::Repeat);
    assert_eq!(db.ingest(&project, &[event(&db, 4, "1.1.0")]).await.unwrap()[0].change, Change::Regressed);
}

#[tokio::test]
async fn resolving_in_the_next_release_ignores_builds_seen_before() {
    let (db, owner, project, _d) = setup().await;
    let id = db.ingest(&project, &[event(&db, 5, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    db.clock().advance(HOUR);
    db.ingest(&project, &[event(&db, 6, "1.0.1")]).await.unwrap();
    let change = IssueChange::Resolve { in_next_release: Some(true) };
    db.update_issues(&owner, std::slice::from_ref(&id), &change, None).await.unwrap();

    // Both builds were running already: an old tab on 1.0.0 is old code too.
    db.clock().advance(HOUR);
    for old in ["1.0.0", "1.0.1"] {
        assert_eq!(db.ingest(&project, &[event(&db, 5, old)]).await.unwrap()[0].change, Change::Repeat, "{old}");
    }
    assert_eq!(db.ingest(&project, &[event(&db, 5, "1.0.2")]).await.unwrap()[0].change, Change::Regressed);
}

#[tokio::test]
async fn watching_can_be_turned_off_by_the_owner() {
    let (db, owner, project, _d) = setup().await;
    let id = db.ingest(&project, &[event(&db, 7, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    let triage = fixed(&db, &owner, &id, "#9", None, None).await;
    assert!(db.watched_fixes().await.unwrap().iter().any(|f| f.triage_id == triage));

    let settings = db.project_settings(&owner, &project.id.0).await.unwrap().unwrap();
    assert!(settings.watch_fixes);
    assert_eq!(settings.fix_watching, bertha_core::domain::FixWatching::On);
    let mut edit = ProjectInput {
        name: "Lantern".into(),
        client: None,
        url: None,
        repo_url: Some(REPO.into()),
        runtimes: vec![Runtime::Browser],
        environments: vec![],
        brief: None,
        watch_fixes: Some(false),
        logs: None,
    };
    ok(db.update_project(&owner, &project.id.0, &edit).await.unwrap().unwrap());
    assert!(db.watched_fixes().await.unwrap().iter().all(|f| f.triage_id != triage));
    let settings = db.project_settings(&owner, &project.id.0).await.unwrap().unwrap();
    assert_eq!(settings.fix_watching, bertha_core::domain::FixWatching::Off);
    let watch = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue.triages[0].watch.clone().unwrap();
    assert_eq!(watch.state, FixState::Unwatched);
    assert!(watch.problem.as_deref().is_some_and(|p| p.starts_with("Fix watching is off")), "{:?}", watch.problem);

    // Left out, it stays as it was.
    edit.watch_fixes = None;
    ok(db.update_project(&owner, &project.id.0, &edit).await.unwrap().unwrap());
    assert!(!db.project_settings(&owner, &project.id.0).await.unwrap().unwrap().watch_fixes);

    // A collaborator can't turn it back on.
    let priya = db.viewer_unchecked("m-priya").await.unwrap().unwrap();
    let kiln = db.project_settings(&owner, "p-kiln").await.unwrap().unwrap();
    let back_on = ProjectInput {
        name: kiln.project.name.clone(),
        client: kiln.project.client.clone(),
        url: kiln.project.url.clone(),
        repo_url: kiln.project.repo_url.clone(),
        runtimes: kiln.project.runtimes.clone(),
        environments: kiln.project.environments.clone(),
        brief: None,
        watch_fixes: Some(true),
        logs: None,
    };
    match db.update_project(&priya, "p-kiln", &back_on).await.unwrap() {
        Some(Outcome::Failed(UpdateProjectFailure::PermissionDenied, _)) => {}
        other => panic!("expected permission_denied, got {other:?}"),
    }
}

#[tokio::test]
async fn fixes_from_before_are_read_once() {
    let (db, owner, project, dir) = setup().await;
    let id = db.ingest(&project, &[event(&db, 8, "1.0.0")]).await.unwrap()[0].issue_id.0.clone();
    let older = fixed(&db, &owner, &id, "#1", None, None).await;
    db.clock().advance(MINUTE);
    let latest =
        fixed(&db, &owner, &id, "Drop the fetch. PR #196 (https://github.com/felixowens/lantern/pull/196)", None, None)
            .await;
    // As they were before 0008.
    sqlx::query!("UPDATE triages SET fix_pr = NULL, fix_commit = NULL, fix_state = NULL, fix_problem = NULL")
        .execute(db.writer())
        .await
        .unwrap();
    let now = db.now();
    drop(db);

    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(now)).await.expect("reopen");
    db.set_watches_github(true);
    let d = db.issue_detail(&owner, &id).await.unwrap().unwrap().issue;
    let latest = d.triages.iter().find(|t| t.id.0 == latest).unwrap().watch.clone().unwrap();
    assert_eq!((latest.pr, latest.state), (Some(196), FixState::WaitingMerge));
    let older = d.triages.iter().find(|t| t.id.0 == older).unwrap().watch.clone().unwrap();
    assert_eq!(older.state, FixState::Unwatched);
    assert_eq!(older.problem.as_deref(), Some("Ended before bertha followed fixes."));
    // Seeded fixed triages were read too: none is left unparsed.
    let left = sqlx::query_scalar!("SELECT COUNT(*) FROM triages WHERE outcome = 'fixed' AND fix_state IS NULL")
        .fetch_one(db.reader())
        .await
        .unwrap();
    assert_eq!(left, 0);
}
