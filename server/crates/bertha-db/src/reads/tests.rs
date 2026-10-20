//! Reads against the seeded design fixtures, with the clock at the fixtures' own "now",
//! so the numbers can be checked against what the prototype showed.

use std::collections::HashSet;

use bertha_core::domain::{
    IssueFilter, IssueStatus, LevelSeries, MonitorState, ProjectHealth, ProjectIds, StatusFilter, TimeRange,
    TriageState,
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

fn seen_within(fx: &Fixtures, span: Millis) -> usize {
    let now = now_of(fx);
    fx.issues.iter().filter(|i| i.summary.last_seen.millis().is_some_and(|t| t >= now - span)).count()
}

#[tokio::test]
async fn issue_list_filters_sorts_and_counts() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let now = now_of(&fx);

    let all = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };
    let list = db.list_issues(&owner, &all).await.unwrap();
    assert_eq!(list.total as usize, seen_within(&fx, 30 * 24 * HOUR), "the range keeps issues seen in it");
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
    // Calendar days, as the fixtures draw them (the issues list uses rolling days).
    let ids: Vec<String> = fx.issues.iter().map(|i| i.summary.id.0.clone()).collect();
    let shape = crate::reads::issues::SummaryShape::month(now_of(&fx), TimeRange::Month);
    let summaries = db.summaries_of(&ids, shape).await.unwrap();
    assert_eq!(summaries.len(), fx.issues.len());
    for s in &summaries {
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

    let recent = db.recent_events(&owner, id, 500).await.unwrap().expect("recent");
    assert_eq!(recent.len() as u32, detail.cursor.total.min(500));
    assert_eq!(recent.first().map(|e| &e.id), Some(&detail.event.id), "newest first");
    assert_eq!(recent.last().map(|e| &e.id), Some(&oldest.event.id));
    assert_eq!(db.recent_events(&owner, id, 1).await.unwrap().expect("one").len(), 1);

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
    let o = db.overview(&owner, TimeRange::Day, None).await.unwrap().expect("overview");
    assert_eq!(o.projects.len(), fx.projects.len());
    assert_eq!(o.projects[0].health, ProjectHealth::Down, "worst first");
    assert!(!o.attention.is_empty() && o.attention.len() <= 8);
    assert!(o.attention.iter().all(|i| i.status == IssueStatus::Unresolved));
    assert_eq!(o.kpis.events.trend.len(), 12);
    assert!(o.kpis.events.value > 0.0);
    assert!(o.kpis.uptime.value > 0.0 && o.kpis.uptime.value <= 100.0);
    assert_eq!(o.events.by_level.fatal.len(), 24, "hourly at 24h");
    assert_eq!(o.monitors_attention[0].id.0, "mon-harbour", "down before degraded");
    assert!(o.monitors_attention.iter().all(|m| m.state != MonitorState::Up));
    assert_eq!(o.project_events.len(), fx.projects.len());
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
    assert!(!s.monitors.is_empty());

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

    let o = db.overview(&priya, TimeRange::Month, None).await.unwrap().expect("overview");
    assert!(o.projects.iter().all(|p| ok(&p.id)));
    assert!(o.attention.iter().all(|i| ok(&i.project_id)));
    assert!(o.releases.iter().all(|r| ok(&r.project_id)));
    assert!(o.monitors_attention.iter().all(|m| ok(&m.project_id)));
    assert!(o.project_events.keys().all(|id| ok(&ProjectId(id.clone()))));
    assert!(db.overview(&priya, TimeRange::Month, Some("p-moss")).await.unwrap().is_none());
    let kiln = db.overview(&priya, TimeRange::Month, Some("p-kiln")).await.unwrap().expect("their project");
    assert_eq!(kiln.project.as_ref().map(|p| p.id.0.as_str()), Some("p-kiln"));
    assert!(kiln.attention.iter().all(|i| i.project_id.0 == "p-kiln"));
    let listed = db.list_projects(&priya, TimeRange::Month).await.unwrap();
    assert!(!listed.projects.is_empty() && listed.projects.iter().all(|p| ok(&p.id)));

    // Labels count only their issues; briefs and triages out of reach read as missing.
    assert!(list.labels.iter().all(|l| l.name != "forms"), "forms is only on a moss issue");
    assert!(list.labels.iter().any(|l| l.name == "checkout"));
    let moss = ProjectId("p-moss".into());
    assert!(db.project_brief(&priya, &moss).await.unwrap().is_none());
    assert!(db.project_brief(&priya, &ProjectId("p-kiln".into())).await.unwrap().is_some());
    assert_eq!(db.briefed_projects(&priya).await.unwrap(), vec!["p-kiln".to_owned()]);
    assert!(kiln.brief.is_some(), "a project home has its brief");
    assert!(db.overview(&priya, TimeRange::Month, None).await.unwrap().unwrap().brief.is_none());
    assert!(db.triage_row(&priya, "tr-moss-fixed").await.unwrap().is_none());
    assert!(db.triage_row(&priya, "tr-cart-now").await.unwrap().is_some());

    // The totals are theirs too: their projects' share, not everyone's.
    let owner = viewer(&db, "m-owner").await;
    let all_o = db.overview(&owner, TimeRange::Month, None).await.unwrap().expect("overview");
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
        assert!(db.recent_events(&priya, &i.summary.id.0, 10).await.unwrap().is_none());
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

#[tokio::test]
async fn releases_link_both_ways_and_count_only_hours_that_passed() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let mid = db.release_detail(&owner, "r-kiln-1").await.unwrap().expect("release");
    assert_eq!(mid.next.as_ref().map(|r| r.id.0.as_str()), Some("r-kiln-0"));
    assert_eq!(mid.previous.as_ref().map(|r| r.id.0.as_str()), Some("r-kiln-2"));
    assert_eq!(mid.after_hours, 24, "a day old");
    assert_eq!(mid.held_fixes.len() as u32, mid.release.quiet_since_deploy);
    assert!(mid.held_fixes.iter().all(|i| i.project_id.0 == "p-kiln" && i.status == IssueStatus::Resolved));

    let newest = db.release_detail(&owner, "r-kiln-0").await.unwrap().expect("release");
    assert!(newest.next.is_none(), "staging isn't the next production deploy");
    let deployed = newest.release.deployed_at.millis().unwrap();
    assert_eq!(i64::from(newest.after_hours), (now_of(&fx) - deployed) / HOUR);
    assert!(newest.after_hours < 24);
}

#[tokio::test]
async fn uptime_by_day_covers_ninety_days() {
    let (db, _fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let harbour = db.monitor_detail(&owner, "mon-harbour").await.unwrap().expect("monitor");
    let days = &harbour.uptime_by_day.counts;
    assert_eq!(days.len(), 90);
    assert!(days.iter().flatten().all(|p| (0.0..=100.0).contains(p)));
    assert!(days.last().unwrap().is_some_and(|p| p < 100.0), "down today");
    assert!(days.first().unwrap().is_none(), "no checks that long ago are no data, not 0%");
}

#[tokio::test]
async fn projects_index_is_worst_first() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let list = db.list_projects(&owner, TimeRange::Week).await.unwrap();
    assert_eq!(list.projects.len(), fx.projects.len());
    assert_eq!(list.projects[0].health, ProjectHealth::Down);
    assert_eq!(list.project_events.len(), fx.projects.len(), "quiet projects are 0, not missing");
    assert_eq!(list.monitors.len(), fx.monitors.len());
    let kiln = list.projects.iter().find(|p| p.id.0 == "p-kiln").unwrap();
    assert_eq!(kiln.monitor_ids.len(), 2);
}

#[tokio::test]
async fn searching_tags_and_narrowing_to_ids_or_new() {
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let any = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };

    // A user tag value finds its issue though the message doesn't mention it.
    let (issue, user) = fx
        .issues
        .iter()
        .find_map(|i| {
            let t = i.tags.iter().find(|t| t.key == bertha_core::domain::TagKey::User)?;
            Some((i.summary.id.clone(), t.values.first()?.value.clone()))
        })
        .expect("an issue with a user tag");
    let q = IssueFilter { query: user.clone(), ..any.clone() };
    let found = db.list_issues(&owner, &q).await.unwrap();
    assert!(found.issues.iter().any(|i| i.id == issue), "{user:?} finds {}", issue.0);

    let picked: Vec<_> = fx.issues.iter().take(3).map(|i| i.summary.id.clone()).collect();
    let only = IssueFilter { ids: Some(picked.clone()), ..any.clone() };
    let list = db.list_issues(&owner, &only).await.unwrap();
    assert_eq!(list.total, 3);
    assert!(list.issues.iter().all(|i| picked.contains(&i.id)));

    let week = IssueFilter { range: TimeRange::Week, new_in_range: Some(true), ..any.clone() };
    let list = db.list_issues(&owner, &week).await.unwrap();
    let start = now_of(&fx) - 7 * 24 * HOUR;
    assert!(list.total > 0);
    assert!(list.issues.iter().all(|i| i.first_seen.millis().unwrap() >= start));
    for s in &list.issues {
        assert_eq!(s.trend.counts.len(), 7);
        let start = s.trend.start.millis().unwrap();
        assert!(start - (now_of(&fx) - 7 * 24 * HOUR) <= HOUR, "the trend spans the range");
        // The count also takes the part-hour before the trend's first whole one.
        assert!(s.events_in_range >= s.trend.counts.iter().flatten().sum::<u32>(), "{}", s.id.0);
    }
}

#[tokio::test]
async fn agents_find_issues_by_link_id_or_short_id_only_in_their_projects() {
    let (db, fx, _dir) = seeded().await;
    let priya = viewer(&db, "m-priya").await;
    let owner = viewer(&db, "m-owner").await;
    let theirs = fx.issues.iter().find(|i| i.summary.project_id.0 == "p-kiln").expect("a kiln issue");
    let foreign = fx.issues.iter().find(|i| i.summary.project_id.0 == "p-moss").expect("a moss issue");
    let id = theirs.summary.id.0.as_str();
    let short = theirs.summary.short_id.as_str();

    for r in [
        id.to_owned(),
        format!("https://bertha.bishop.example/issues/{id}"),
        format!("http://localhost:3000/issues/{id}?event=latest#stack"),
        short.to_owned(),
        short.to_lowercase(),
        format!(" {short} "),
    ] {
        assert_eq!(db.find_issue(&priya, &r).await.unwrap().as_deref(), Some(id), "{r}");
    }
    for r in [foreign.summary.id.0.clone(), foreign.summary.short_id.clone(), "NOPE-1".into(), "".into()] {
        assert_eq!(db.find_issue(&priya, &r).await.unwrap(), None, "{r}");
    }
    let foreign_id = foreign.summary.id.0.as_str();
    assert_eq!(db.find_issue(&owner, &foreign.summary.short_id).await.unwrap().as_deref(), Some(foreign_id));
}

#[tokio::test]
async fn access_tokens_act_as_their_member_and_stop_when_revoked() {
    use bertha_core::api::{CreateAccessTokenFailure, Outcome, RevokeAccessTokenFailure};

    let (db, fx, _dir) = seeded().await;
    let priya = viewer(&db, "m-priya").await;
    let owner = viewer(&db, "m-owner").await;

    let Outcome::Ok(made) = db.create_access_token(&priya, "  claude on laptop ").await.unwrap() else {
        panic!("created")
    };
    assert!(made.secret.starts_with("ba_"));
    assert_eq!(made.token.name, "claude on laptop");
    assert!(made.token.last_used_at.is_none());
    for bad in ["", "   ", "--", &"x".repeat(61)] {
        let out = db.create_access_token(&priya, bad).await.unwrap();
        assert!(matches!(out, Outcome::Failed(CreateAccessTokenFailure::InvalidName, _)), "{bad:?}");
    }

    let agent = db.viewer_for_access_token(&made.secret).await.unwrap().expect("token works");
    assert_eq!(agent.id(), priya.id());
    assert_eq!(agent.agent(), Some("claude on laptop"));
    assert_eq!(agent.member().project_ids, priya.member().project_ids);
    let all = IssueFilter { status: StatusFilter::ANY, range: TimeRange::Month, ..Default::default() };
    let list = db.list_issues(&agent, &all).await.unwrap();
    assert!(list.issues.iter().all(|i| i.project_id.0 == "p-kiln" || i.project_id.0 == "p-harbour"));
    let used = db.access_tokens(&priya).await.unwrap();
    assert_eq!(used.len(), 1);
    assert!(used[0].last_used_at.is_some(), "the first use is recorded");

    // Session tokens and look-alikes are not access tokens.
    assert!(db.viewer_for_access_token("ba_nope").await.unwrap().is_none());
    assert!(db.viewer_for_access_token(&made.secret.replacen("ba_", "bs_", 1)).await.unwrap().is_none());

    // Each member sees and revokes only their own.
    assert!(db.access_tokens(&owner).await.unwrap().is_empty());
    let out = db.revoke_access_token(&owner, &made.token.id.0).await.unwrap();
    assert!(matches!(out, Outcome::Failed(RevokeAccessTokenFailure::NotFound, _)));
    assert!(db.viewer_for_access_token(&made.secret).await.unwrap().is_some());
    assert!(matches!(db.revoke_access_token(&priya, &made.token.id.0).await.unwrap(), Outcome::Ok(())));
    assert!(db.viewer_for_access_token(&made.secret).await.unwrap().is_none());
    assert!(db.access_tokens(&priya).await.unwrap().is_empty());

    // The CLI makes one for a joined member by email, and none for anyone else.
    let email = &fx.members.iter().find(|m| m.id.0 == "m-priya").unwrap().email;
    let cli = db.create_access_token_for(email, "codex").await.unwrap().expect("joined member");
    assert_eq!(db.viewer_for_access_token(&cli.secret).await.unwrap().unwrap().id(), priya.id());
    assert!(db.create_access_token_for("nobody@example.com", "codex").await.unwrap().is_none());
}

#[tokio::test]
async fn agent_reports_are_the_owners_to_read_and_close() {
    use bertha_core::api::{Outcome, SetAgentReportDoneFailure};
    use bertha_core::domain::AgentReportKind;

    use crate::reports::{NewReport, REPORTS_PER_HOUR};

    fn report<'a>(summary: &'a str, issue_id: Option<&'a str>) -> NewReport<'a> {
        NewReport {
            kind: AgentReportKind::Problem,
            summary,
            details: "",
            tool: Some("get_issue"),
            issue_id,
            version: "9.9.9",
        }
    }

    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let Outcome::Ok(made) = db.create_access_token(&priya, "codex").await.unwrap() else { panic!("token") };
    let agent = db.viewer_for_access_token(&made.secret).await.unwrap().unwrap();
    let theirs = fx.issues.iter().find(|i| i.summary.project_id.0 == "p-kiln").unwrap();

    // A browser session isn't an agent.
    assert!(matches!(db.add_agent_report(&priya, &report("x", None)).await, Err(Error::Invalid(_))));
    for bad in ["", "   "] {
        assert!(matches!(db.add_agent_report(&agent, &report(bad, None)).await, Err(Error::Invalid(_))));
    }
    let long = "x".repeat(201);
    assert!(matches!(db.add_agent_report(&agent, &report(&long, None)).await, Err(Error::Invalid(_))));

    let sent = db.add_agent_report(&agent, &report("  no page  ", Some(&theirs.summary.id.0))).await.unwrap();
    assert_eq!(sent.summary, "no page");
    assert_eq!(sent.via, "codex");
    assert_eq!(sent.issue.as_ref().unwrap().short_id, theirs.summary.short_id);

    // Priya reads her own; the owner reads everyone's; nobody else's show to Priya.
    let Outcome::Ok(mine) = db.create_access_token(&owner, "claude").await.unwrap() else { panic!("token") };
    let owners_agent = db.viewer_for_access_token(&mine.secret).await.unwrap().unwrap();
    db.add_agent_report(&owners_agent, &report("owner's", None)).await.unwrap();
    assert_eq!(db.agent_reports(&owner).await.unwrap().len(), 2);
    let hers = db.agent_reports(&priya).await.unwrap();
    assert_eq!(hers.iter().map(|r| r.summary.as_str()).collect::<Vec<_>>(), ["no page"]);

    // Once Priya can't see the project, her report keeps its words but not the issue.
    db.update_member_access(&owner, "m-priya", &[ProjectId("p-harbour".into())]).await.unwrap();
    let priya = viewer(&db, "m-priya").await;
    assert!(db.agent_reports(&priya).await.unwrap()[0].issue.is_none());
    let all = db.agent_reports(&owner).await.unwrap();
    assert!(all.iter().find(|r| r.id == sent.id).unwrap().issue.is_some(), "the owner still sees it");

    // Only the owner closes one.
    let out = db.set_agent_report_done(&priya, &sent.id.0, true).await.unwrap();
    assert!(matches!(out, Outcome::Failed(SetAgentReportDoneFailure::PermissionDenied, _)));
    assert!(matches!(db.set_agent_report_done(&owner, &sent.id.0, true).await.unwrap(), Outcome::Ok(())));
    assert!(db.agent_reports(&priya).await.unwrap()[0].done);
    let out = db.set_agent_report_done(&owner, "ar_nope", true).await.unwrap();
    assert!(matches!(out, Outcome::Failed(SetAgentReportDoneFailure::NotFound, _)));

    // A loop can't bury the list.
    for _ in 1..REPORTS_PER_HOUR {
        db.add_agent_report(&owners_agent, &report("again", None)).await.unwrap();
    }
    assert!(matches!(db.add_agent_report(&owners_agent, &report("again", None)).await, Err(Error::Invalid(_))));
    db.clock().advance(HOUR);
    db.add_agent_report(&owners_agent, &report("later", None)).await.unwrap();
}

fn traced(at: Millis, fp: u8, trace: Option<&str>) -> crate::writes::ingest::NewEvent {
    use bertha_core::domain::{Environment, EventException, Level, StackFrame, Trace};
    crate::writes::ingest::NewEvent {
        client_id: None,
        at,
        fingerprint: [fp; 16],
        r#type: "Error".into(),
        message: "No response".into(),
        culprit: None,
        level: Level::Error,
        environment: Environment::Production,
        release: None,
        user_hash: None,
        tags: vec![],
        payload: crate::stored::StoredEvent {
            release: None,
            environment: Environment::Production,
            level: Level::Error,
            exception: Some(EventException {
                r#type: "Error".into(),
                message: "No response".into(),
                frames: vec![StackFrame {
                    file: "webkit-masked-url://hidden/".into(),
                    function: Some("r".into()),
                    line: Some(1),
                    column: Some(20),
                    in_app: true,
                    mapped: false,
                    context: None,
                }],
                data: Default::default(),
                component_stack: None,
            }),
            mechanism: None,
            trace: trace.map(|t| Trace { trace_id: t.into(), span_id: None }),
            breadcrumbs: vec![],
            request: None,
            user: None,
            context: Default::default(),
            tags: Default::default(),
        },
    }
}

/// Events sharing a trace list each other, but only across projects the viewer can see.
#[tokio::test]
async fn related_events_stay_in_scope() {
    use crate::writes::ingest::KeyedProject;
    let (db, fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let priya = viewer(&db, "m-priya").await;
    let keyed = |id: &str| KeyedProject { id: ProjectId(id.into()), key: id.into(), name: id.into() };
    let at = now_of(&fx) - HOUR;
    let trace = "0af7651916cd43dd8448eb211c80319c";
    let kiln = db.ingest(&keyed("p-kiln"), &[traced(at, 201, Some(trace))]).await.unwrap().remove(0).issue_id;
    let harbour = db.ingest(&keyed("p-harbour"), &[traced(at + 1, 202, Some(trace))]).await.unwrap().remove(0);
    let moss = db.ingest(&keyed("p-moss"), &[traced(at + 2, 203, Some(trace))]).await.unwrap().remove(0).issue_id;
    db.ingest(&keyed("p-moss"), &[traced(at + 3, 204, None)]).await.unwrap();

    let related = db.issue_detail(&owner, &kiln.0).await.unwrap().unwrap().related;
    let ids: Vec<&str> = related.iter().map(|r| r.issue.id.0.as_str()).collect();
    assert_eq!(ids, [moss.0.as_str(), harbour.issue_id.0.as_str()], "newest first, never itself");

    let theirs = db.issue_detail(&priya, &kiln.0).await.unwrap().unwrap().related;
    assert_eq!(theirs.iter().map(|r| r.issue.id.0.as_str()).collect::<Vec<_>>(), [harbour.issue_id.0.as_str()]);
    let at = db.event_at(&priya, &kiln.0, &EventWhich::Latest).await.unwrap().unwrap();
    assert_eq!(at.related.len(), 1);
    assert!(at.related.iter().all(|r| r.issue.project_id.0 != "p-moss"));

    // Safari hides extension code behind webkit-masked-url: stored as in-app by older
    // builds, it reads as not the app's.
    assert!(at.event.exception.unwrap().frames.iter().all(|f| !f.in_app));
}

#[tokio::test]
async fn seeded_events_in_one_trace_list_each_other() {
    let (db, _fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let detail = db.issue_detail(&owner, "i-harbour-fetch").await.unwrap().unwrap();
    let related: Vec<(&str, &str)> =
        detail.related.iter().map(|r| (r.issue.id.0.as_str(), r.event_id.0.as_str())).collect();
    assert_eq!(related, [("i-7", "e-harbour-hold-1")]);
}

#[tokio::test]
async fn seeded_triages_and_labels_keep_their_state() {
    let (db, _fx, _dir) = seeded().await;
    let owner = viewer(&db, "m-owner").await;
    let cart = db.issue_detail(&owner, "i-cart-map").await.unwrap().unwrap().issue;
    assert_eq!(cart.summary.labels, vec!["checkout".to_owned()]);
    let claim = cart.summary.triage.as_ref().expect("an active triage shows on the list");
    assert_eq!((claim.by.id.0.as_str(), claim.via.as_deref()), ("m-owner", Some("claude-laptop")));
    let states: Vec<_> = cart.triages.iter().map(|t| (t.id.0.as_str(), t.state)).collect();
    assert_eq!(states, vec![("tr-cart-now", TriageState::Active), ("tr-cart-old", TriageState::Done)]);
    let hydration = db.issue_detail(&owner, "i-hydration").await.unwrap().unwrap().issue;
    assert_eq!(hydration.triages[0].state, TriageState::Stale);
    assert!(hydration.summary.triage.is_none(), "a stale triage doesn't claim the issue");
}
