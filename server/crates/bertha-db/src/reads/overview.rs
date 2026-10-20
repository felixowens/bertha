//! The overview page and the app shell around every page.

use bertha_core::domain::{
    AssigneeFilter, ByLevel, IssueFilter, IssueFilterPatch, IssueSort, IssueStatus, Kpi, Level, LevelSeries, SavedView,
    StatusFilter, TimeRange,
};
use std::collections::BTreeMap;

use bertha_core::ids::ProjectId;
use bertha_core::pages::{OverviewData, OverviewKpis, ShellCounts, ShellData};
use bertha_core::time::{DAY, HOUR, IsoDate, Millis, floor_hour};

use crate::codec::parse;
use crate::reads::issues::SummaryShape;
use crate::reads::projects::health_rank;
use crate::scope::{Viewer, ids_json};
use crate::series::Grid;
use crate::{Db, Result};

/// Cells in a KPI's sparkline.
const KPI_CELLS: usize = 12;
/// Issues in "needs attention".
const ATTENTION: i64 = 8;
/// An issue is spiking when its last day has at least this many events…
const SPIKE_DAY_MIN: i64 = 20;
/// …and is this many times its daily average over the week before.
const SPIKE_FACTOR: i64 = 3;

impl Db {
    /// Every project the viewer sees, or one project's home. `None` when that project
    /// isn't theirs (or no longer exists).
    pub async fn overview(
        &self,
        viewer: &Viewer,
        range: TimeRange,
        project_id: Option<&str>,
    ) -> Result<Option<OverviewData>> {
        let now = self.now();
        let span = range.millis();
        let (scope, project) = match project_id {
            Some(id) => {
                let Some(project) = self.project(viewer, id).await? else { return Ok(None) };
                (ids_json(std::slice::from_ref(&project.id)), Some(project))
            }
            None => (viewer.scope_json().to_owned(), None),
        };
        let mut projects = self.projects_in(&scope).await?;
        projects.sort_by_key(|p| health_rank(p.health));

        let brief = match &project {
            Some(p) => self.project_brief(viewer, &p.id).await?,
            None => None,
        };
        let attention_ids = self.attention(&scope, now - span).await?;
        let attention = self.summaries_of(&attention_ids, SummaryShape::for_range(now, range)).await?;

        Ok(Some(OverviewData {
            range,
            project,
            brief,
            kpis: self.kpis(&scope, span).await?,
            project_events: self.project_events(&scope, now - span).await?,
            projects,
            attention,
            events: self.level_series(&scope, range).await?,
            releases: self.release_rows_in(&scope, now - span).await?,
            monitors_attention: self.monitors_attention(&scope).await?,
        }))
    }

    /// Events per project from `since` on, with 0 for quiet projects.
    pub(crate) async fn project_events(&self, scope: &str, since: Millis) -> Result<BTreeMap<String, u32>> {
        let ids: Vec<String> = serde_json::from_str(scope)?;
        let rows = sqlx::query!(
            r#"SELECT i.project_id, SUM(h.count) AS "n!: i64" FROM issue_hourly h JOIN issues i ON i.id = h.issue_id
               WHERE i.project_id IN (SELECT value FROM json_each(?1)) AND h.hour >= ?2 GROUP BY i.project_id"#,
            scope,
            since
        )
        .fetch_all(&self.read)
        .await?;
        let mut out: BTreeMap<String, u32> = ids.into_iter().map(|id| (id, 0)).collect();
        for r in rows {
            out.insert(r.project_id, r.n.clamp(0, u32::MAX as i64) as u32);
        }
        Ok(out)
    }

    /// Unresolved issues that are new or regressed in the range, or spiking now.
    async fn attention(&self, scope: &str, since: Millis) -> Result<Vec<String>> {
        let day_ago = floor_hour(self.now()) - 23 * HOUR;
        let week_before = day_ago - 7 * DAY;
        Ok(sqlx::query_scalar!(
            r#"WITH recent AS (
                 SELECT issue_id,
                        SUM(CASE WHEN hour >= ?3 THEN count ELSE 0 END) AS day,
                        SUM(CASE WHEN hour < ?3 THEN count ELSE 0 END) AS week
                 FROM issue_hourly WHERE hour >= ?4 GROUP BY issue_id)
               SELECT i.id FROM issues i LEFT JOIN recent r ON r.issue_id = i.id
               WHERE i.project_id IN (SELECT value FROM json_each(?1)) AND i.status = 'unresolved'
                 AND (i.first_seen >= ?2 OR COALESCE(i.regressed_at, 0) >= ?2
                      OR (COALESCE(r.day, 0) >= ?5 AND r.day * 7 >= ?6 * COALESCE(r.week, 0)))
               ORDER BY CASE i.level WHEN 'fatal' THEN 0 WHEN 'error' THEN 1 ELSE 2 END,
                        i.regressed_at IS NULL, i.last_seen DESC
               LIMIT ?7"#,
            scope,
            since,
            day_ago,
            week_before,
            SPIKE_DAY_MIN,
            SPIKE_FACTOR,
            ATTENTION
        )
        .fetch_all(&self.read)
        .await?)
    }

    /// Each KPI over the range, against the range before it.
    async fn kpis(&self, scope: &str, span: Millis) -> Result<OverviewKpis> {
        let now = self.now();
        let current = Grid::split(now, span, KPI_CELLS);
        // Twice as many cells reaching back one more range: the first half is "previous".
        let both =
            Grid { start: current.start - current.step * KPI_CELLS as Millis, step: current.step, len: 2 * KPI_CELLS };

        let events = sqlx::query!(
            r#"SELECT h.hour, SUM(h.count) AS "n!: i64" FROM issue_hourly h JOIN issues i ON i.id = h.issue_id
               WHERE i.project_id IN (SELECT value FROM json_each(?1)) AND h.hour >= ?2 GROUP BY h.hour"#,
            scope,
            both.start
        )
        .fetch_all(&self.read)
        .await?
        .into_iter()
        .map(|r| (r.hour, r.n));
        let new_issues = sqlx::query!(
            r#"SELECT first_seen AS "at!: i64" FROM issues
               WHERE project_id IN (SELECT value FROM json_each(?1)) AND first_seen >= ?2"#,
            scope,
            both.start
        )
        .fetch_all(&self.read)
        .await?
        .into_iter()
        .map(|r| (r.at, 1));
        let regressions = sqlx::query!(
            r#"SELECT a.at FROM activity a JOIN issues i ON i.id = a.issue_id
               WHERE i.project_id IN (SELECT value FROM json_each(?1)) AND a.at >= ?2
                 AND json_extract(a.data, '$.kind') = 'regressed'"#,
            scope,
            both.start
        )
        .fetch_all(&self.read)
        .await?
        .into_iter()
        .map(|r| (r.at, 1));
        let checks = sqlx::query!(
            r#"SELECT (c.at / 3600000) * 3600000 AS "hour!: i64",
                      SUM(c.ok * c.samples) AS "ok!: i64", SUM(c.samples) AS "n!: i64"
               FROM checks c JOIN monitors m ON m.id = c.monitor_id
               WHERE m.project_id IN (SELECT value FROM json_each(?1)) AND c.at >= ?2
               GROUP BY 1"#,
            scope,
            both.start
        )
        .fetch_all(&self.read)
        .await?;
        let ok = both.sums(checks.iter().map(|c| (c.hour, c.ok)));
        let total = both.sums(checks.iter().map(|c| (c.hour, c.n)));

        Ok(OverviewKpis {
            events: count_kpi(both.sums(events)),
            new_issues: count_kpi(both.sums(new_issues)),
            regressions: count_kpi(both.sums(regressions)),
            uptime: uptime_kpi(&ok, &total),
        })
    }

    /// Events over the range by level: hourly for a day, daily otherwise.
    async fn level_series(&self, scope: &str, range: TimeRange) -> Result<LevelSeries> {
        let grid = SummaryShape::for_range(self.now(), range).grid;
        let rows = sqlx::query!(
            r#"SELECT i.level, h.hour, SUM(h.count) AS "n!: i64" FROM issue_hourly h JOIN issues i ON i.id = h.issue_id
               WHERE i.project_id IN (SELECT value FROM json_each(?1)) AND h.hour >= ?2 GROUP BY i.level, h.hour"#,
            scope,
            grid.start
        )
        .fetch_all(&self.read)
        .await?;
        let alive = self.alive_any(scope, grid.start).await?;
        let mut by: [Vec<(Millis, i64)>; 3] = Default::default();
        for r in rows {
            let i = parse(&r.level, Level::parse)?.rank() as usize;
            by[i].push((r.hour, r.n));
        }
        let [fatal, error, warning] = by;
        Ok(LevelSeries {
            bucket: grid.bucket(),
            start: IsoDate::from_millis(grid.start),
            by_level: ByLevel {
                fatal: grid.fill(fatal, &alive),
                error: grid.fill(error, &alive),
                warning: grid.fill(warning, &alive),
            },
        })
    }

    pub async fn shell(&self, viewer: &Viewer) -> Result<ShellData> {
        let projects = self.projects(viewer).await?;
        let scope = viewer_scope(viewer);
        let me = viewer.id().as_str();
        let counts = sqlx::query!(
            r#"SELECT
                 (SELECT COUNT(*) FROM issues WHERE project_id IN (SELECT value FROM json_each(?1))
                   AND status = 'unresolved') AS "unresolved!: i64",
                 (SELECT COUNT(*) FROM issues WHERE project_id IN (SELECT value FROM json_each(?1))
                   AND status = 'unresolved' AND assignee_id = ?2) AS "mine!: i64",
                 (SELECT COUNT(*) FROM monitors WHERE project_id IN (SELECT value FROM json_each(?1))
                   AND state = 'down') AS "down!: i64""#,
            scope,
            me
        )
        .fetch_one(&self.read)
        .await?;
        Ok(ShellData {
            viewer: viewer.member().clone(),
            saved_views: self
                .saved_views(
                    viewer,
                    &projects.iter().filter(|p| p.client.is_some()).map(|p| p.id.clone()).collect::<Vec<_>>(),
                )
                .await?,
            projects,
            counts: ShellCounts {
                unresolved: counts.unresolved as u32,
                assigned_to_me: counts.mine as u32,
                monitors_down: counts.down as u32,
            },
        })
    }

    /// Built-in views. The owner also gets "new this week" and fatal errors on client sites.
    async fn saved_views(&self, viewer: &Viewer, client_projects: &[ProjectId]) -> Result<Vec<SavedView>> {
        let unresolved = Some(StatusFilter::Is(IssueStatus::Unresolved));
        let mine = IssueFilterPatch { assignee: Some(AssigneeFilter::Me), status: unresolved, ..Default::default() };
        let mut views = vec![SavedView {
            id: "v-mine".into(),
            name: "Assigned to me".into(),
            count: self.count_issues(viewer, &mine.apply(IssueFilter::default())).await?,
            filter: mine,
        }];
        if !viewer.is_owner() {
            return Ok(views);
        }
        // The same definition as the overview's "New issues": first seen in the last 7 days.
        let new = IssueFilterPatch {
            status: Some(StatusFilter::ANY),
            sort: Some(IssueSort::FirstSeen),
            range: Some(TimeRange::Week),
            new_in_range: Some(true),
            ..Default::default()
        };
        views.push(SavedView {
            id: "v-new".into(),
            name: "New this week".into(),
            count: self.count_issues(viewer, &new.apply(IssueFilter::default())).await?,
            filter: new,
        });
        if !client_projects.is_empty() {
            let fatal = IssueFilterPatch {
                levels: Some(vec![Level::Fatal]),
                project_ids: Some(client_projects.to_vec()),
                ..Default::default()
            };
            views.push(SavedView {
                id: "v-clients-fatal".into(),
                name: "Client sites, crashes".into(),
                count: self.count_issues(viewer, &fatal.apply(IssueFilter::default())).await?,
                filter: fatal,
            });
        }
        Ok(views)
    }
}

fn viewer_scope(viewer: &Viewer) -> &str {
    viewer.scope_json()
}

/// `cells` holds the previous range then the current one.
fn count_kpi(cells: Vec<f64>) -> Kpi {
    let (prev, cur) = cells.split_at(KPI_CELLS);
    Kpi { value: cur.iter().sum(), previous: prev.iter().sum(), trend: cur.to_vec() }
}

/// Percent of checks that passed. A cell with no checks repeats the one before it.
fn uptime_kpi(ok: &[f64], total: &[f64]) -> Kpi {
    let ratio = |o: f64, n: f64| if n > 0.0 { (o * 10_000.0 / n).round() / 100.0 } else { 100.0 };
    let sum = |r: std::ops::Range<usize>| (ok[r.clone()].iter().sum::<f64>(), total[r].iter().sum::<f64>());
    let (po, pn) = sum(0..KPI_CELLS);
    let (co, cn) = sum(KPI_CELLS..2 * KPI_CELLS);
    let mut last = ratio(po, pn);
    let trend = (KPI_CELLS..2 * KPI_CELLS)
        .map(|i| {
            if total[i] > 0.0 {
                last = ratio(ok[i], total[i]);
            }
            last
        })
        .collect();
    Kpi { value: ratio(co, cn), previous: ratio(po, pn), trend }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uptime_carries_gaps() {
        let mut ok = vec![0.0; 24];
        let mut n = vec![0.0; 24];
        ok[12] = 9.0;
        n[12] = 10.0;
        let k = uptime_kpi(&ok, &n);
        assert_eq!(k.value, 90.0);
        assert_eq!(k.previous, 100.0);
        assert_eq!(k.trend[0], 90.0);
        assert_eq!(k.trend[11], 90.0);
    }
}
