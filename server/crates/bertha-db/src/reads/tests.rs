//! Reads against the seeded design fixtures, with the clock at the fixtures' own "now",
//! so the numbers can be checked against what the prototype showed.

use std::collections::HashSet;

use bertha_core::domain::{
    IssueFilter, IssueStatus, LevelSeries, MonitorState, ProjectHealth, ProjectIds, StatusFilter, TimeRange,
};
use bertha_core::ids::ProjectId;
use bertha_core::time::{HOUR, Millis, parse_millis};

use crate::seed::{FIXTURES, Fixtures, SeedOptions};
use crate::{Clock, Db, Error, EventWhich, Viewer};

async fn seeded() -> (Db, Fixtures, tempfile::TempDir) {
    let fx = Fixtures::parse(FIXTURES).expect("fixtures parse");
    let now = parse_millis(&fx.now.0).expect("now");
    let dir = tempfile::tempdir().expect("tempdir");
    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(now)).await.expect("open");
    let report = db.seed(&fx, SeedOptions { dev_invite_tokens: true }).await.expect("seed");
    assert_eq!(report.projects, fx.projects.len());
    assert_eq!(report.issues, fx.issues.len());
    (db, fx, dir)
}

async fn viewer(db: &Db, id: &str) -> Viewer {
    db.viewer_unchecked(id).await.expect("load").expect("member exists")
}

fn now_of(fx: &Fixtures) -> Millis {
    parse_millis(&fx.now.0).unwrap()
}

#[tokio::test]
async fn seeding_twice_is_refused() {
    let (db, fx, _dir) = seeded().await;
    assert!(matches!(db.seed(&fx, SeedOptions { dev_invite_tokens: false }).await, Err(Error::Invalid(_))));
}

#[tokio::test]
async fn shell_counts_match_the_fixtures() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let shell = db.shell(&owner).await.unwrap();
    assert_eq!(shell.viewer.id.0, "m-owner");
    assert_eq!(shell.projects.len(), fx.projects.len());
    let unresolved = fx.issues.iter().filter(|i| i.summary.status == IssueStatus::Unresolved).count();
    assert_eq!(shell.counts.unresolved as usize, unresolved);
    let mine = fx
        .issues
        .iter()
        .filter(|i| i.summary.status == IssueStatus::Unresolved)
        .filter(|i| i.summary.assignee.as_ref().is_some_and(|a| a.id.0 == "m-owner"))
        .count();
    assert_eq!(shell.counts.assigned_to_me as usize, mine);
    let down = fx.monitors.iter().filter(|m| m.state == MonitorState::Down).count();
    assert_eq!(shell.counts.monitors_down as usize, down);
    let views: Vec<&str> = shell.saved_views.iter().map(|v| v.id.as_str()).collect();
    assert_eq!(views, ["v-mine", "v-new", "v-clients-fatal"]);
    assert_eq!(shell.saved_views[0].count, shell.counts.assigned_to_me);
}

#[tokio::test]
async fn projects_keep_their_fixture_state() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let projects = db.projects(&owner).await.unwrap();
    let ids: Vec<&str> = projects.iter().map(|p| p.id.0.as_str()).collect();
    let want: Vec<&str> = fx.projects.iter().map(|p| p.id.0.as_str()).collect();
    assert_eq!(ids, want, "fixture order");
    for (got, want) in projects.iter().zip(&fx.projects) {
        assert_eq!(got.key, want.key, "{}", want.id.0);
        assert_eq!(got.last_event_at.is_none(), want.last_event_at.is_none(), "{}", want.id.0);
    }
    let recipes = projects.iter().find(|p| p.id.0 == "p-recipes").unwrap();
    assert_eq!(recipes.health, ProjectHealth::AwaitingFirstEvent);
    let harbour = projects.iter().find(|p| p.id.0 == "p-harbour").unwrap();
    assert_eq!(harbour.health, ProjectHealth::Down);

    let setup = db.project_setup(&owner, "p-kiln").await.unwrap().unwrap();
    let fixture = fx.project_setups.iter().find(|s| s.project_id.0 == "p-kiln").unwrap();
    assert_eq!(setup.ingest_key, fixture.ingest_key);
    assert!(setup.snippet.contains(&setup.ingest_key));
}

#[tokio::test]
async fn issue_list_filters_sorts_and_counts() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let now = now_of(&fx);

    let all = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };
    let list = db.list_issues(&owner, &all).await.unwrap();
    assert_eq!(list.total as usize, fx.issues.len());
    assert!(list.issues.windows(2).all(|w| w[0].last_seen.millis() >= w[1].last_seen.millis()), "last seen first");
    for s in &list.issues {
        assert_eq!(s.trend.counts.len(), 30, "{}", s.id.0);
    }

    let day = IssueFilter { range: TimeRange::Day, ..Default::default() };
    let list = db.list_issues(&owner, &day).await.unwrap();
    for s in &list.issues {
        assert_eq!(s.trend.counts.len(), 24);
        assert_eq!(s.is_new, s.first_seen.millis().unwrap() >= now - 24 * HOUR, "{}", s.id.0);
    }

    let kiln =
        IssueFilter { project_ids: vec![ProjectId("p-kiln".into())], status: StatusFilter::ANY, ..Default::default() };
    let list = db.list_issues(&owner, &kiln).await.unwrap();
    let want = fx.issues.iter().filter(|i| i.summary.project_id.0 == "p-kiln").count();
    assert_eq!(list.total as usize, want);
    assert!(list.issues.iter().all(|i| i.project_id.0 == "p-kiln"));

    let first = &fx.issues[0].summary;
    let word = first.message.split_whitespace().max_by_key(|w| w.len()).unwrap().to_owned();
    let q = IssueFilter { query: word.clone(), status: StatusFilter::ANY, ..Default::default() };
    let list = db.list_issues(&owner, &q).await.unwrap();
    assert!(list.issues.iter().any(|i| i.id == first.id), "search for {word:?} finds {}", first.id.0);
}

/// Each fixture day's count lands in that day's hours, exactly. Days wholly outside an
/// issue's first…last seen are dropped: some fixture trends run past `lastSeen`, and
/// real rollups can't.
#[tokio::test]
async fn hourly_rollups_add_up_to_the_trend() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let filter = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };
    let list = db.list_issues(&owner, &filter).await.unwrap();
    assert_eq!(list.issues.len(), fx.issues.len());
    for s in &list.issues {
        let f = &fx.issues.iter().find(|i| i.summary.id == s.id).unwrap().summary;
        assert_eq!(s.trend.start, f.trend.start, "{}", s.id.0);
        let first = f.first_seen.millis().unwrap();
        let last = bertha_core::time::floor_hour(f.last_seen.millis().unwrap());
        let start = f.trend.start.millis().unwrap();
        for (k, (got, want)) in s.trend.counts.iter().zip(&f.trend.counts).enumerate() {
            let day = start + k as Millis * bertha_core::time::DAY;
            let kept = day + bertha_core::time::DAY > first && day <= last;
            let want = if kept { want.unwrap_or(0) } else { 0 };
            assert_eq!(got.unwrap_or(0), want, "{} day {k}", s.id.0);
        }
    }
}

#[tokio::test]
async fn issue_detail_has_tags_activity_and_an_event() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let with_event = fx.events.first().unwrap();
    let id = &with_event.issue_id.0;
    let detail = db.issue_detail(&owner, id).await.unwrap().expect("detail");
    let fixture = fx.issues.iter().find(|i| &i.summary.id.0 == id).unwrap();
    assert_eq!(detail.issue.summary.short_id, fixture.summary.short_id);
    assert_eq!(detail.issue.activity.len(), fixture.activity.len());
    let keys: Vec<_> = detail.issue.tags.iter().map(|t| t.key).collect();
    let want: HashSet<_> = fixture.tags.iter().map(|t| t.key).collect();
    assert_eq!(keys.iter().copied().collect::<HashSet<_>>(), want);
    assert_eq!(detail.event.issue_id.0, *id);
    assert!(detail.cursor.total >= 1);

    let oldest = db.event_at(&owner, id, &EventWhich::Oldest).await.unwrap().expect("oldest");
    assert_eq!(oldest.cursor.total, detail.cursor.total);

    // An issue without stored events still opens, on a stand-in event.
    let stored: HashSet<&str> = fx.events.iter().map(|e| e.issue_id.0.as_str()).collect();
    let bare = fx.issues.iter().find(|i| !stored.contains(i.summary.id.0.as_str())).unwrap();
    let detail = db.issue_detail(&owner, &bare.summary.id.0).await.unwrap().expect("bare detail");
    assert_eq!(detail.cursor.total, 1);

    assert!(db.issue_detail(&owner, "i-nope").await.unwrap().is_none());
}

#[tokio::test]
async fn overview_is_coherent() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let o = db.overview(&owner, TimeRange::Day).await.unwrap();
    assert_eq!(o.projects.len(), fx.projects.len());
    assert_eq!(o.projects[0].health, ProjectHealth::Down, "worst first");
    assert!(!o.attention.is_empty() && o.attention.len() <= 8);
    assert!(o.attention.iter().all(|i| i.status == IssueStatus::Unresolved));
    assert_eq!(o.kpis.events.trend.len(), 12);
    assert!(o.kpis.events.value > 0.0);
    assert!(o.kpis.uptime.value > 0.0 && o.kpis.uptime.value <= 100.0);
    assert_eq!(o.events.by_level.fatal.len(), 30);
    assert_eq!(o.monitors_down.len(), 1);
    assert_eq!(o.monitors_down[0].id.0, "mon-harbour");
}

#[tokio::test]
async fn releases_and_monitors() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let releases = db.list_releases(&owner, None).await.unwrap();
    assert_eq!(releases.releases.len(), fx.releases.len());
    assert!(releases.releases.windows(2).all(|w| w[0].deployed_at.millis() >= w[1].deployed_at.millis()));
    let first = &releases.releases[0];
    let detail = db.release_detail(&owner, &first.id.0).await.unwrap().expect("release");
    assert_eq!(detail.around.counts.len(), 48);
    assert_eq!(detail.release.id, first.id);

    let uptime = db.list_monitors(&owner).await.unwrap();
    assert_eq!(uptime.monitors.len(), fx.monitors.len());
    for m in &uptime.monitors {
        let want = fx.monitors.iter().find(|f| f.id == m.id).unwrap();
        assert_eq!(m.state, want.state, "{}", m.id.0);
        assert_eq!(m.recent.len(), 48);
        assert!((m.uptime30d - want.uptime30d).abs() < 0.2, "{}: {} vs {}", m.id.0, m.uptime30d, want.uptime30d);
    }
    let harbour = db.monitor_detail(&owner, "mon-harbour").await.unwrap().expect("monitor");
    assert!(harbour.incidents.first().is_some_and(|i| i.resolved_at.is_none()), "open incident");
    assert_eq!(harbour.checks.len(), 30);
    assert_eq!(harbour.response_times.counts.len(), 48);
}

#[tokio::test]
async fn settings_alerts_and_team() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let s = db.project_settings(&owner, "p-harbour").await.unwrap().expect("settings");
    let names: HashSet<&str> = s.members.iter().map(|m| m.id.0.as_str()).collect();
    assert!(names.contains("m-owner") && names.contains("m-priya") && names.contains("m-tomasz"));
    assert!(s.monitor.is_some());

    let alerts = db.alerts(&owner).await.unwrap();
    assert_eq!(alerts.rules.len(), fx.alert_rules.len());
    assert_eq!(alerts.destinations.len(), fx.destinations.len());
    assert_eq!(
        alerts.rules,
        fx.alert_rules
            .iter()
            .map(|r| {
                let mut r = r.clone();
                r.last_fired_at = r.last_fired_at.map(|d| bertha_core::time::IsoDate::from_millis(d.millis().unwrap()));
                r
            })
            .collect::<Vec<_>>()
    );

    let team = db.team(&owner).await.unwrap();
    assert_eq!(team.members[0].id.0, "m-owner");
    assert_eq!(team.members.last().unwrap().joined_at, None, "pending last");
    assert_eq!(team.members.len(), fx.members.len());
}

/// A collaborator sees only their projects, everywhere, and nothing owner-only.
#[tokio::test]
async fn collaborators_see_only_their_projects() {
    let (db, fx, _dir) = seeded().await;
    let priya = viewer(&db, "m-priya").await;
    let mine: HashSet<String> = ["p-kiln".to_owned(), "p-harbour".to_owned()].into();
    let ok = |p: &ProjectId| mine.contains(&p.0);
    assert_eq!(
        priya.member().project_ids,
        ProjectIds::Some(vec![ProjectId("p-kiln".into()), ProjectId("p-harbour".into())])
    );

    let shell = db.shell(&priya).await.unwrap();
    assert!(shell.projects.iter().all(|p| ok(&p.id)));
    assert_eq!(shell.projects.len(), 2);
    assert_eq!(shell.saved_views.len(), 1);

    let all = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };
    let list = db.list_issues(&priya, &all).await.unwrap();
    assert!(list.issues.iter().all(|i| ok(&i.project_id)));
    let want = fx.issues.iter().filter(|i| ok(&i.summary.project_id)).count();
    assert_eq!(list.total as usize, want);

    // Asking for a foreign project by filter yields nothing, not that project's issues.
    let foreign = IssueFilter { project_ids: vec![ProjectId("p-moss".into())], ..all.clone() };
    assert_eq!(db.list_issues(&priya, &foreign).await.unwrap().total, 0);

    let o = db.overview(&priya, TimeRange::Month).await.unwrap();
    assert!(o.projects.iter().all(|p| ok(&p.id)));
    assert!(o.attention.iter().all(|i| ok(&i.project_id)));
    assert!(o.releases.iter().all(|r| ok(&r.project_id)));
    assert!(o.monitors_down.iter().all(|m| ok(&m.project_id)));

    // The totals are theirs too: their projects' share, not everyone's.
    let owner = viewer(&db, "m-owner").await;
    let all_o = db.overview(&owner, TimeRange::Month).await.unwrap();
    let theirs =
        fx.issues.iter().filter(|i| ok(&i.summary.project_id) && i.summary.status == IssueStatus::Unresolved).count();
    assert!(o.kpis.events.value > 0.0 && o.kpis.events.value < all_o.kpis.events.value);
    assert!(o.kpis.new_issues.value <= all_o.kpis.new_issues.value);
    let sum = |s: &LevelSeries| s.by_level.error.iter().flatten().sum::<u32>();
    assert!(sum(&o.events) < sum(&all_o.events));
    assert_eq!(shell.counts.unresolved as usize, theirs, "the sidebar counts only their issues");
    assert!(shell.counts.unresolved < db.shell(&owner).await.unwrap().counts.unresolved);

    let releases = db.list_releases(&priya, None).await.unwrap();
    assert!(releases.releases.iter().all(|r| ok(&r.project_id)));
    let monitors = db.list_monitors(&priya).await.unwrap();
    assert!(monitors.monitors.iter().all(|m| ok(&m.project_id)));

    // Every foreign detail page looks like it doesn't exist.
    for i in fx.issues.iter().filter(|i| !ok(&i.summary.project_id)).take(5) {
        assert!(db.issue_detail(&priya, &i.summary.id.0).await.unwrap().is_none(), "{}", i.summary.id.0);
        assert!(db.event_at(&priya, &i.summary.id.0, &EventWhich::Latest).await.unwrap().is_none());
    }
    for r in fx.releases.iter().filter(|r| !ok(&r.project_id)).take(3) {
        assert!(db.release_detail(&priya, &r.id.0).await.unwrap().is_none());
    }
    for m in fx.monitors.iter().filter(|m| !ok(&m.project_id)) {
        assert!(db.monitor_detail(&priya, &m.id.0).await.unwrap().is_none());
    }
    for p in fx.projects.iter().filter(|p| !ok(&p.id)) {
        assert!(db.project_settings(&priya, &p.id.0).await.unwrap().is_none());
        assert!(db.project_setup(&priya, &p.id.0).await.unwrap().is_none());
    }

    assert!(matches!(db.alerts(&priya).await, Err(Error::Forbidden)));
    assert!(matches!(db.team(&priya).await, Err(Error::Forbidden)));
}

#[tokio::test]
async fn a_fixed_clock_moved_forward_moves_the_seed_with_it() {
    let fx = Fixtures::parse(FIXTURES).unwrap();
    let later = now_of(&fx) + 5 * 24 * HOUR;
    let dir = tempfile::tempdir().unwrap();
    let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(later)).await.unwrap();
    db.seed(&fx, SeedOptions { dev_invite_tokens: false }).await.unwrap();
    let owner = viewer(&db, "m-owner").await;
    let projects = db.projects(&owner).await.unwrap();
    let want =
        fx.projects.iter().find(|p| p.id.0 == "p-kiln").unwrap().last_event_at.as_ref().unwrap().millis().unwrap();
    let got = projects.iter().find(|p| p.id.0 == "p-kiln").unwrap().last_event_at.as_ref().unwrap().millis().unwrap();
    assert_eq!(got - want, 5 * 24 * HOUR);
}
