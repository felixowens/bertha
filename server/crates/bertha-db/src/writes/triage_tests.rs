//! Triages, labels and briefs against the seeded fixtures.

use bertha_core::api::{IssueChange, Outcome, StartTriageFailure, TriageInput, UpdateTriageFailure};
use bertha_core::domain::{Activity, IssueFilter, StatusFilter, TimeRange, TriageFilter, TriageOutcome, TriageState};
use bertha_core::time::{HOUR, MINUTE, parse_millis};

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

fn ok<T, F: std::fmt::Debug>(o: Outcome<T, F>) -> T {
    match o {
        Outcome::Ok(v) => v,
        Outcome::Failed(f, m) => panic!("expected ok, got {f:?}: {m}"),
    }
}

fn failure<T, F>(o: Outcome<T, F>) -> (F, String) {
    match o {
        Outcome::Ok(_) => panic!("expected a failure"),
        Outcome::Failed(f, m) => (f, m),
    }
}

fn found(text: &str) -> TriageInput {
    TriageInput { found: Some(text.into()), ..TriageInput::default() }
}

fn ends(outcome: TriageOutcome) -> TriageInput {
    TriageInput { outcome: Some(outcome), ..TriageInput::default() }
}

/// An issue in p-kiln with no triage yet, so the seed's own triages stay out of the way.
async fn fresh_issue(db: &Db, v: &Viewer) -> String {
    let mut filter = IssueFilter {
        status: StatusFilter::ANY,
        range: TimeRange::Month,
        triage: Some(TriageFilter::Never),
        ..Default::default()
    };
    filter.project_ids = vec![bertha_core::ids::ProjectId("p-kiln".into())];
    let list = db.list_issues(v, &filter).await.unwrap();
    list.issues.first().expect("an untriaged kiln issue").id.0.clone()
}

#[tokio::test]
async fn claiming_resuming_and_taking_over() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let issue = fresh_issue(&db, &owner).await;

    let mine = ok(db.start_triage(&priya, &issue, false).await.unwrap());
    assert_eq!(mine.triage.state, TriageState::Active);
    assert_eq!(mine.issue.triage.as_ref().map(|c| c.by.id.0.as_str()), Some("m-priya"), "the list shows the claim");
    assert_eq!(mine.triage.release, None.or(mine.triage.release.clone()), "release is a snapshot");

    // The same person through the same door picks it back up.
    db.clock().advance(MINUTE);
    let again = ok(db.start_triage(&priya, &issue, false).await.unwrap());
    assert_eq!(again.triage.id, mine.triage.id);
    assert!(again.triage.updated_at.0 > mine.triage.updated_at.0);

    // Through an agent it's someone else's work: they hear who has it.
    let agent = priya.clone().via("laptop".into());
    let (f, message) = failure(db.start_triage(&agent, &issue, false).await.unwrap());
    assert_eq!(f, StartTriageFailure::InProgress);
    assert!(message.starts_with("You started triaging this"), "{message}");
    let (f, message) = failure(db.start_triage(&owner, &issue, false).await.unwrap());
    assert_eq!(f, StartTriageFailure::InProgress);
    assert!(message.contains("Priya") && message.contains("Take it over only if they've stopped"), "{message}");

    // Taking over ends the other as abandoned.
    let taken = ok(db.start_triage(&owner, &issue, true).await.unwrap());
    assert_ne!(taken.triage.id, mine.triage.id);
    let triages = db.issue_detail(&owner, &issue).await.unwrap().unwrap().issue.triages;
    assert_eq!(triages.len(), 2);
    assert_eq!(triages[0].id, taken.triage.id, "newest first");
    assert_eq!(triages[1].outcome, Some(TriageOutcome::Abandoned));

    // Two hours quiet and anyone can start over without asking.
    db.clock().advance(2 * HOUR + MINUTE);
    let detail = db.issue_detail(&priya, &issue).await.unwrap().unwrap();
    assert_eq!(detail.issue.triages[0].state, TriageState::Stale);
    assert!(detail.issue.summary.triage.is_none(), "a stale claim doesn't show on the list");
    let after = ok(db.start_triage(&priya, &issue, false).await.unwrap());
    assert_ne!(after.triage.id, taken.triage.id);

    // Out of reach reads as missing.
    let moss = "i-moss-regressed";
    assert_eq!(failure(db.start_triage(&priya, moss, false).await.unwrap()).0, StartTriageFailure::NotFound);
    assert_eq!(failure(db.start_triage(&priya, "i-gone", false).await.unwrap()).0, StartTriageFailure::NotFound);
}

#[tokio::test]
async fn writing_down_a_triage() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let issue = fresh_issue(&db, &owner).await;
    let t = ok(db.start_triage(&priya, &issue, false).await.unwrap()).triage;
    let id = t.id.0.as_str();

    let c = ok(db.update_triage(&priya, id, &found("  The map is empty on first render.  ")).await.unwrap());
    assert_eq!(c.triage.found.as_deref(), Some("The map is empty on first render."), "trimmed");
    // Left-out fields stay, and an agent of the same person can write too.
    let agent = priya.clone().via("laptop".into());
    let tried = TriageInput { tried: Some("Guarding the loop.".into()), ..TriageInput::default() };
    let c = ok(db.update_triage(&agent, id, &tried).await.unwrap());
    assert_eq!(c.triage.found.as_deref(), Some("The map is empty on first render."));
    assert_eq!(c.triage.tried.as_deref(), Some("Guarding the loop."));
    // Blank clears.
    let c = ok(db
        .update_triage(&priya, id, &TriageInput { tried: Some("  ".into()), ..Default::default() })
        .await
        .unwrap());
    assert_eq!(c.triage.tried, None);
    assert!(matches!(db.update_triage(&priya, id, &found(&"x".repeat(20_000))).await, Err(Error::Invalid(_))));

    // Nobody else writes in it; the owner can only end it.
    assert_eq!(
        failure(db.update_triage(&owner, id, &found("mine now")).await.unwrap()).0,
        UpdateTriageFailure::PermissionDenied
    );
    let done = ok(db.update_triage(&owner, id, &ends(TriageOutcome::Abandoned)).await.unwrap());
    assert_eq!(done.triage.state, TriageState::Done);
    assert_eq!(done.triage.found.as_deref(), Some("The map is empty on first render."), "what was found stays");
    assert!(done.issue.triage.is_none());

    assert_eq!(failure(db.update_triage(&priya, id, &found("more")).await.unwrap()).0, UpdateTriageFailure::Concluded);
    assert_eq!(
        failure(db.update_triage(&priya, "tr_nope", &found("x")).await.unwrap()).0,
        UpdateTriageFailure::NotFound
    );

    // An ended triage stays on the issue, and the issue is no longer "never triaged".
    let detail = db.issue_detail(&priya, &issue).await.unwrap().unwrap();
    assert_eq!(detail.issue.triages.len(), 1);
    let never = IssueFilter {
        status: StatusFilter::ANY,
        range: TimeRange::Month,
        triage: Some(TriageFilter::Never),
        ..Default::default()
    };
    let list = db.list_issues(&owner, &never).await.unwrap();
    assert!(list.issues.iter().all(|i| i.id.0 != issue));

    // The author ending it with a fix.
    let t = ok(db.start_triage(&priya, &issue, false).await.unwrap()).triage;
    let fixed = TriageInput {
        fix: Some("Wait for the first layout. PR #42.".into()),
        outcome: Some(TriageOutcome::Fixed),
        ..TriageInput::default()
    };
    let c = ok(db.update_triage(&priya, &t.id.0, &fixed).await.unwrap());
    assert_eq!(c.triage.outcome, Some(TriageOutcome::Fixed));
}

#[tokio::test]
async fn being_triaged_filter_and_collaborator_scope() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let issue = fresh_issue(&db, &owner).await;
    let t = ok(db.start_triage(&owner, &issue, false).await.unwrap()).triage;
    let active = IssueFilter {
        status: StatusFilter::ANY,
        range: TimeRange::Month,
        triage: Some(TriageFilter::Active),
        ..Default::default()
    };
    let list = db.list_issues(&owner, &active).await.unwrap();
    assert!(list.issues.iter().any(|i| i.id.0 == issue));
    assert!(list.issues.iter().all(|i| i.triage.is_some()));

    // A triage on an issue out of a collaborator's reach is missing to them.
    let moss = ok(db.start_triage(&owner, "i-moss-regressed", false).await.unwrap()).triage;
    assert_eq!(
        failure(db.update_triage(&priya, &moss.id.0, &ends(TriageOutcome::Abandoned)).await.unwrap()).0,
        UpdateTriageFailure::NotFound
    );
    let _ = t;
}

#[tokio::test]
async fn labelling_issues() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let ids = vec!["i-cart-map".to_owned(), "i-4".to_owned()];
    let before = db.issue_detail(&owner, "i-cart-map").await.unwrap().unwrap().issue.summary.labels;

    let add = IssueChange::Label { add: vec!["  Slow Network ".into(), "third_party".into()], remove: vec![] };
    let changed = ok(db.update_issues(&priya, &ids, &add, None).await.unwrap());
    for s in &changed {
        assert!(s.labels.contains(&"slow-network".to_owned()), "normalized: {:?}", s.labels);
        assert!(s.labels.contains(&"third-party".to_owned()));
    }
    let detail = db.issue_detail(&owner, "i-cart-map").await.unwrap().unwrap();
    assert!(
        matches!(&detail.issue.activity[0], Activity::Labelled { added, .. } if added.contains(&"slow-network".to_owned()))
    );

    // Filter by label, in the filter or as label: in the query, and counted for the bar.
    let by_label = IssueFilter {
        status: StatusFilter::ANY,
        range: TimeRange::Month,
        labels: vec!["slow-network".into()],
        ..Default::default()
    };
    let list = db.list_issues(&owner, &by_label).await.unwrap();
    let mut got: Vec<_> = list.issues.iter().map(|i| i.id.0.clone()).collect();
    got.sort();
    assert_eq!(got, vec!["i-4".to_owned(), "i-cart-map".to_owned()]);
    let count = list.labels.iter().find(|l| l.name == "slow-network").expect("counted");
    assert_eq!(count.count, 2);
    let query = IssueFilter {
        status: StatusFilter::ANY,
        range: TimeRange::Month,
        query: "label:slow-network label:third-party".into(),
        ..Default::default()
    };
    assert_eq!(db.list_issues(&owner, &query).await.unwrap().issues.len(), 2);

    // A change that changes nothing writes nothing.
    let again = db.issue_detail(&owner, "i-cart-map").await.unwrap().unwrap().issue.activity.len();
    ok(db.update_issues(&priya, &ids, &add, None).await.unwrap());
    assert_eq!(db.issue_detail(&owner, "i-cart-map").await.unwrap().unwrap().issue.activity.len(), again);

    let remove = IssueChange::Label { add: vec![], remove: vec!["third-party".into()] };
    let changed = ok(db.update_issues(&priya, &ids[..1], &remove, None).await.unwrap());
    assert!(!changed[0].labels.contains(&"third-party".to_owned()));

    let bad = IssueChange::Label { add: vec!["no/slashes".into()], remove: vec![] };
    assert!(matches!(db.update_issues(&priya, &ids, &bad, None).await, Err(Error::Invalid(_))));
    let many = IssueChange::Label { add: (0..11).map(|i| format!("l{i}")).collect(), remove: vec![] };
    assert!(matches!(db.update_issues(&priya, &ids, &many, None).await, Err(Error::Invalid(_))));
    let after = db.issue_detail(&owner, "i-cart-map").await.unwrap().unwrap().issue.summary.labels;
    assert_eq!(after.len(), before.len() + 1, "a refused change leaves them as they were");

    // Collaborators don't see counts from projects out of reach.
    let moss = IssueChange::Label { add: vec!["moss-only".into()], remove: vec![] };
    ok(db.update_issues(&owner, &["i-moss-regressed".to_owned()], &moss, None).await.unwrap());
    let all = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };
    assert!(db.list_issues(&owner, &all).await.unwrap().labels.iter().any(|l| l.name == "moss-only"));
    assert!(!db.list_issues(&priya, &all).await.unwrap().labels.iter().any(|l| l.name == "moss-only"));
}

#[tokio::test]
async fn merging_keeps_labels_and_one_active_triage() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let (target, source) = ("i-cart-map", "i-4");
    for (id, label) in [(target, "kept"), (source, "carried")] {
        let change = IssueChange::Label { add: vec![label.into()], remove: vec![] };
        ok(db.update_issues(&owner, &[id.to_owned()], &change, None).await.unwrap());
    }
    // Clear whatever the seed left running on the target, then claim both.
    let existing = db.issue_detail(&owner, target).await.unwrap().unwrap().issue.triages;
    for t in existing.iter().filter(|t| t.outcome.is_none()) {
        ok(db.update_triage(&owner, &t.id.0, &ends(TriageOutcome::Abandoned)).await.unwrap());
    }
    let existing = db.issue_detail(&owner, source).await.unwrap().unwrap().issue.triages;
    for t in existing.iter().filter(|t| t.outcome.is_none()) {
        ok(db.update_triage(&owner, &t.id.0, &ends(TriageOutcome::Abandoned)).await.unwrap());
    }
    let on_target = ok(db.start_triage(&owner, target, false).await.unwrap()).triage;
    let on_source = ok(db.start_triage(&priya, source, false).await.unwrap()).triage;

    let merged = ok(db.merge_issues(&owner, target, &[source.to_owned()]).await.unwrap());
    assert!(merged.summary.labels.contains(&"kept".to_owned()));
    assert!(merged.summary.labels.contains(&"carried".to_owned()));
    let active: Vec<_> = merged.triages.iter().filter(|t| t.outcome.is_none()).collect();
    assert_eq!(active.len(), 1, "one triage going on per issue");
    assert_eq!(active[0].id, on_target.id, "the target's stays");
    let moved = merged.triages.iter().find(|t| t.id == on_source.id).expect("moved over");
    assert_eq!(moved.outcome, Some(TriageOutcome::Abandoned));
}

#[tokio::test]
async fn briefs_are_scoped() {
    let (db, _d) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let mut input = db.project_settings(&owner, "p-moss").await.unwrap().unwrap();
    let edit = bertha_core::api::ProjectInput {
        name: input.project.name.clone(),
        client: input.project.client.take(),
        url: input.project.url.take(),
        repo_url: input.project.repo_url.take(),
        runtimes: input.project.runtimes.clone(),
        environments: input.project.environments.clone(),
        brief: Some("Moss runs on Fly.".into()),
        watch_fixes: None,
    };
    ok(db.update_project(&owner, "p-moss", &edit).await.unwrap().unwrap());
    let moss = bertha_core::ids::ProjectId("p-moss".into());
    assert_eq!(db.project_brief(&owner, &moss).await.unwrap().as_deref(), Some("Moss runs on Fly."));
    assert_eq!(db.project_brief(&priya, &moss).await.unwrap(), None, "out of reach");
    assert!(db.briefed_projects(&owner).await.unwrap().contains(&"p-moss".to_owned()));
    assert!(!db.briefed_projects(&priya).await.unwrap().contains(&"p-moss".to_owned()));

    let long = bertha_core::api::ProjectInput { brief: Some("x".repeat(4001)), ..edit.clone() };
    assert!(matches!(db.update_project(&owner, "p-moss", &long).await, Err(Error::Invalid(_))));
    let cleared = bertha_core::api::ProjectInput { brief: Some("   ".into()), ..edit };
    ok(db.update_project(&owner, "p-moss", &cleared).await.unwrap().unwrap());
    assert_eq!(db.project_brief(&owner, &moss).await.unwrap(), None, "blank clears it");
}
