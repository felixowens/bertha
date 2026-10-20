//! Issues: the list, the detail page and stepping through events.

use std::collections::{HashMap, HashSet};

use bertha_core::domain::{
    Activity, AssigneeFilter, EnvironmentFilter, Event, EventContext, EventCursor, EventException, FixClaim, FixState,
    Issue, IssueFilter, IssueSort, IssueStatus, IssueSummary, LabelCount, Level, Person, RelatedEvent, Snooze,
    StackFrame, StatusFilter, TRIAGE_STALE_MS, TagBreakdown, TagKey, TagValue, TimeRange, TriageClaim, TriageFilter,
    normalize_label,
};
use bertha_core::fixes::fix_watching;
use bertha_core::ids::{EventId, IssueId, MemberId, ProjectId};
use bertha_core::pages::{EventAt, IssueDetail, IssueList};
use bertha_core::time::{IsoDate, Millis, floor_hour};

use crate::codec::{env_bit, envs, from_blob, parse};
use crate::reads::triages::shown_state;
use crate::scope::{Viewer, ids_json};
use crate::series::{Grid, Hourly};
use crate::stored::{EVENT_PAYLOAD_LIMIT, StoredEvent};
use crate::{Db, Error, Result};

/// The list shows at most this many issues; `total` still counts them all.
pub const LIST_LIMIT: i64 = 200;
/// Tag values shown per key on the detail page.
const TAG_VALUES: usize = 4;
/// Issues listed as sharing an event's trace.
const RELATED_LIMIT: i64 = 10;

/// Which event of an issue to show.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventWhich {
    Latest,
    Oldest,
    Id(EventId),
}

#[derive(Debug, Clone)]
pub(crate) struct IssueRow {
    pub id: String,
    pub short_id: String,
    pub project_id: String,
    pub kind: String,
    pub message: String,
    pub culprit: Option<String>,
    pub level: String,
    pub status: String,
    pub snooze_until: Option<i64>,
    pub snooze_total: Option<i64>,
    pub snooze_remaining: Option<i64>,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub assignee_email: Option<String>,
    pub first_seen: i64,
    pub last_seen: i64,
    pub event_count: i64,
    pub user_count: i64,
    pub environments: i64,
    pub first_release: Option<String>,
    pub regressed_in: Option<String>,
    pub regressed_at: Option<i64>,
}

impl IssueRow {
    fn snooze(&self) -> Option<Snooze> {
        if let Some(until) = self.snooze_until {
            return Some(Snooze::Until { until: IsoDate::from_millis(until) });
        }
        let total = self.snooze_total?;
        Some(Snooze::Events { total: total as u32, remaining: self.snooze_remaining.unwrap_or(total).max(0) as u32 })
    }

    fn assignee(&self) -> Option<Person> {
        Some(Person {
            id: MemberId(self.assignee_id.clone()?),
            name: self.assignee_name.clone()?,
            email: self.assignee_email.clone()?,
        })
    }

    pub fn level(&self) -> Result<Level> {
        parse(&self.level, Level::parse)
    }

    pub fn status(&self) -> Result<IssueStatus> {
        parse(&self.status, IssueStatus::parse)
    }
}

/// How a page draws issue trends and what counts as "new" on it.
#[derive(Debug, Clone, Copy)]
pub(crate) struct SummaryShape {
    pub grid: Grid,
    pub new_since: Millis,
}

impl SummaryShape {
    /// The trend spans the range, ending with the current hour: 24 hours, or 7 or 30
    /// rolling days (not calendar days, which would leave most of the first one out).
    /// The range also says what "new" means.
    pub fn for_range(now: Millis, range: TimeRange) -> Self {
        let grid = match range {
            TimeRange::Day => Grid::hours_ending(now, 24),
            TimeRange::Week => Grid::split(now, range.millis(), 7),
            TimeRange::Month => Grid::split(now, range.millis(), 30),
        };
        SummaryShape { grid, new_since: now - range.millis() }
    }

    /// Summaries embedded in other pages: 30 daily buckets.
    pub fn month(now: Millis, range: TimeRange) -> Self {
        SummaryShape { grid: Grid::days_ending(now, 30), new_since: now - range.millis() }
    }
}

impl Db {
    /// Issue rows by id, in the order given. Ids that don't exist are skipped.
    pub(crate) async fn issue_rows(&self, ids: &[String]) -> Result<Vec<IssueRow>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let json = serde_json::to_string(ids)?;
        let rows = sqlx::query_as!(
            IssueRow,
            r#"SELECT i.id, i.short_id, i.project_id, i.type AS kind, i.message, i.culprit, i.level, i.status,
                      i.snooze_until, i.snooze_total, i.snooze_remaining, i.assignee_id,
                      m.name AS "assignee_name?", m.email AS "assignee_email?",
                      i.first_seen, i.last_seen, i.event_count, i.user_count, i.environments,
                      i.first_release, i.regressed_in, i.regressed_at
               FROM issues i LEFT JOIN members m ON m.id = i.assignee_id
               WHERE i.id IN (SELECT value FROM json_each(?))"#,
            json
        )
        .fetch_all(&self.read)
        .await?;
        let mut by_id: HashMap<String, IssueRow> = rows.into_iter().map(|r| (r.id.clone(), r)).collect();
        Ok(ids.iter().filter_map(|id| by_id.remove(id)).collect())
    }

    /// Hourly counts for these issues from `since` on.
    pub(crate) async fn issue_hourly(&self, ids: &[String], since: Millis) -> Result<Hourly> {
        let json = serde_json::to_string(ids)?;
        let rows = sqlx::query!(
            "SELECT issue_id, hour, count FROM issue_hourly
             WHERE issue_id IN (SELECT value FROM json_each(?1)) AND hour >= ?2",
            json,
            since
        )
        .fetch_all(&self.read)
        .await?;
        let mut h = Hourly::default();
        for r in rows {
            h.counts.entry(r.issue_id).or_default().push((r.hour, r.count));
        }
        Ok(h)
    }

    pub(crate) async fn summaries(&self, rows: &[IssueRow], shape: SummaryShape) -> Result<Vec<IssueSummary>> {
        if rows.is_empty() {
            return Ok(vec![]);
        }
        let ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
        let range_start = floor_hour(shape.new_since);
        let hourly = self.issue_hourly(&ids, shape.grid.start.min(range_start)).await?;
        let projects: Vec<ProjectId> = {
            let set: HashSet<&str> = rows.iter().map(|r| r.project_id.as_str()).collect();
            set.into_iter().map(|p| ProjectId(p.to_owned())).collect()
        };
        let alive = self.alive_hours(&ids_json(&projects), shape.grid.start).await?;
        let mut claims = self.triage_claims(&ids).await?;
        let mut labels = self.labels_of(&ids).await?;
        let mut fixes = self.fixes_of(&ids).await?;
        let empty = HashSet::new();
        rows.iter()
            .map(|r| {
                let alive = alive.get(&r.project_id).unwrap_or(&empty);
                let counts = shape.grid.fill(hourly.of(&r.id), alive);
                let status = r.status()?;
                Ok(IssueSummary {
                    id: IssueId(r.id.clone()),
                    short_id: r.short_id.clone(),
                    project_id: ProjectId(r.project_id.clone()),
                    r#type: r.kind.clone(),
                    message: r.message.clone(),
                    culprit: r.culprit.clone(),
                    level: r.level()?,
                    status,
                    snooze: r.snooze(),
                    assignee: r.assignee(),
                    first_seen: IsoDate::from_millis(r.first_seen),
                    last_seen: IsoDate::from_millis(r.last_seen),
                    event_count: r.event_count.clamp(0, u32::MAX as i64) as u32,
                    events_in_range: hourly
                        .of(&r.id)
                        .filter(|(h, _)| *h >= range_start)
                        .map(|(_, c)| c)
                        .sum::<i64>()
                        .clamp(0, u32::MAX as i64) as u32,
                    user_count: r.user_count.clamp(0, u32::MAX as i64) as u32,
                    environments: envs(r.environments),
                    trend: shape.grid.series(counts),
                    is_new: r.first_seen >= shape.new_since,
                    is_regression: r.regressed_at.is_some(),
                    triage: claims.remove(&r.id),
                    labels: labels.remove(&r.id).unwrap_or_default(),
                    fix: if status == IssueStatus::Resolved { None } else { fixes.remove(&r.id) },
                })
            })
            .collect()
    }

    /// Who is on each of these issues now: active triages that aren't stale.
    async fn triage_claims(&self, ids: &[String]) -> Result<HashMap<String, TriageClaim>> {
        let json = serde_json::to_string(ids)?;
        let fresh = self.now() - TRIAGE_STALE_MS;
        let rows = sqlx::query!(
            "SELECT issue_id, member_id, member_name, member_email, via, started_at FROM triages
              WHERE outcome IS NULL AND updated_at >= ?2 AND issue_id IN (SELECT value FROM json_each(?1))",
            json,
            fresh
        )
        .fetch_all(&self.read)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| {
                let by = Person { id: MemberId(r.member_id), name: r.member_name, email: r.member_email };
                (r.issue_id, TriageClaim { by, via: r.via, since: IsoDate::from_millis(r.started_at) })
            })
            .collect())
    }

    /// Each unresolved issue's latest triage's fix, when it ended fixed.
    async fn fixes_of(&self, ids: &[String]) -> Result<HashMap<String, FixClaim>> {
        let json = serde_json::to_string(ids)?;
        let rows = sqlx::query!(
            r#"SELECT t.issue_id, t.fix_pr, t.fix_state AS "fix_state!", t.fix_problem, p.repo_url,
                      p.watch_fixes AS "watch_fixes: bool"
                 FROM triages t JOIN issues i ON i.id = t.issue_id JOIN projects p ON p.id = i.project_id
                WHERE t.issue_id IN (SELECT value FROM json_each(?)) AND t.outcome = 'fixed'
                  AND t.fix_state IS NOT NULL AND i.status != 'resolved'
                  AND t.id = (SELECT l.id FROM triages l WHERE l.issue_id = t.issue_id
                               ORDER BY l.started_at DESC, l.id DESC LIMIT 1)"#,
            json
        )
        .fetch_all(&self.read)
        .await?;
        let github = self.watches_github();
        rows.into_iter()
            .map(|r| {
                let watching = fix_watching(r.repo_url.as_deref(), r.watch_fixes, github);
                let state = shown_state(parse(&r.fix_state, FixState::parse)?, r.fix_problem.is_some(), watching);
                Ok((r.issue_id, FixClaim { pr: r.fix_pr.and_then(|n| u32::try_from(n).ok()), state }))
            })
            .collect()
    }

    /// Each issue's labels, sorted.
    async fn labels_of(&self, ids: &[String]) -> Result<HashMap<String, Vec<String>>> {
        let json = serde_json::to_string(ids)?;
        let rows = sqlx::query!(
            "SELECT issue_id, label FROM issue_labels WHERE issue_id IN (SELECT value FROM json_each(?))
              ORDER BY label",
            json
        )
        .fetch_all(&self.read)
        .await?;
        let mut out: HashMap<String, Vec<String>> = HashMap::new();
        for r in rows {
            out.entry(r.issue_id).or_default().push(r.label);
        }
        Ok(out)
    }

    /// Labels in use on issues in these projects, most used first.
    async fn label_counts(&self, projects: &[ProjectId]) -> Result<Vec<LabelCount>> {
        let scope = ids_json(projects);
        let rows = sqlx::query!(
            r#"SELECT l.label, COUNT(*) AS "count!: i64" FROM issue_labels l JOIN issues i ON i.id = l.issue_id
                WHERE i.project_id IN (SELECT value FROM json_each(?))
                GROUP BY l.label ORDER BY COUNT(*) DESC, l.label"#,
            scope
        )
        .fetch_all(&self.read)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| LabelCount { name: r.label, count: r.count.clamp(0, u32::MAX as i64) as u32 })
            .collect())
    }

    /// Summaries for issues by id, in the order given.
    pub(crate) async fn summaries_of(&self, ids: &[String], shape: SummaryShape) -> Result<Vec<IssueSummary>> {
        let rows = self.issue_rows(ids).await?;
        self.summaries(&rows, shape).await
    }

    /// Ids of issues matching a filter, sorted, and how many match in all.
    pub(crate) async fn matching_issues(
        &self,
        viewer: &Viewer,
        filter: &IssueFilter,
        limit: i64,
    ) -> Result<(Vec<String>, u32)> {
        let scope = ids_json(&wanted_projects(viewer, filter));
        let status = match filter.status {
            StatusFilter::Is(s) => Some(s.as_str()),
            StatusFilter::All(_) => None,
        };
        let levels = if filter.levels.is_empty() { None } else { Some(serde_json::to_string(&filter.levels)?) };
        let env = match filter.environment {
            EnvironmentFilter::Is(e) => Some(env_bit(e)),
            EnvironmentFilter::All(_) => None,
        };
        let assignee = match filter.assignee {
            AssigneeFilter::Me => Some(viewer.id().as_str()),
            AssigneeFilter::Unassigned => Some(""),
            AssigneeFilter::Anyone => None,
        };
        let Search { text, mut labels, tags } = split_query(&filter.query);
        labels.extend(filter.labels.iter().map(|l| normalize_label(l).unwrap_or_else(|| l.to_lowercase())));
        labels.sort();
        labels.dedup();
        let query = if text.is_empty() { None } else { Some(text) };
        let labels = if labels.is_empty() { None } else { Some(serde_json::to_string(&labels)?) };
        let tags = if tags.is_empty() { None } else { Some(serde_json::to_string(&tags)?) };
        let triage = filter.triage.map(|t| match t {
            TriageFilter::Active => 1_i64,
            TriageFilter::Never => 2,
            TriageFilter::FixWaiting => 3,
        });
        let fresh = self.now() - TRIAGE_STALE_MS;
        let since = self.now() - filter.range.millis();
        let range_hour = floor_hour(since);
        let ids = filter.ids.as_ref().map(serde_json::to_string).transpose()?;
        let new_only = filter.new_in_range();
        let sort = match filter.sort {
            IssueSort::LastSeen => 0_i64,
            IssueSort::FirstSeen => 1,
            IssueSort::Events => 2,
            IssueSort::Users => 3,
        };
        let rows = sqlx::query!(
            r#"SELECT i.id, COUNT(*) OVER () AS "total!: i64"
               FROM issues i
               WHERE i.project_id IN (SELECT value FROM json_each(?1))
                 AND (?2 IS NULL OR i.status = ?2)
                 AND (?3 IS NULL OR i.level IN (SELECT value FROM json_each(?3)))
                 AND (?4 IS NULL OR (i.environments & ?4) != 0)
                 AND (?5 IS NULL OR (?5 = '' AND i.assignee_id IS NULL) OR i.assignee_id = ?5)
                 AND (?6 IS NULL
                      OR instr(lower(i.type), ?6) > 0 OR instr(lower(i.message), ?6) > 0
                      OR instr(lower(COALESCE(i.culprit, '')), ?6) > 0 OR instr(lower(i.short_id), ?6) > 0
                      OR EXISTS (SELECT 1 FROM issue_tags t WHERE t.issue_id = i.id
                                 AND t.key IN ('user', 'url', 'release') AND instr(lower(t.value), ?6) > 0))
                 AND i.last_seen >= ?9
                 AND (?10 = 0 OR i.first_seen >= ?9)
                 AND (?11 IS NULL OR i.id IN (SELECT value FROM json_each(?11)))
                 AND (?13 IS NULL OR (SELECT COUNT(*) FROM issue_labels l WHERE l.issue_id = i.id
                                      AND l.label IN (SELECT value FROM json_each(?13))) = json_array_length(?13))
                 AND (?14 IS NULL
                      OR (?14 = 1 AND EXISTS (SELECT 1 FROM triages t WHERE t.issue_id = i.id
                                              AND t.outcome IS NULL AND t.updated_at >= ?15))
                      OR (?14 = 2 AND NOT EXISTS (SELECT 1 FROM triages t WHERE t.issue_id = i.id))
                      OR (?14 = 3 AND i.status != 'resolved' AND EXISTS (
                          SELECT 1 FROM triages t WHERE t.issue_id = i.id AND t.outcome = 'fixed'
                             AND t.fix_state IS NOT NULL AND t.fix_state != 'shipped'
                             AND t.id = (SELECT l.id FROM triages l WHERE l.issue_id = i.id
                                          ORDER BY l.started_at DESC, l.id DESC LIMIT 1))))
                 AND (?16 IS NULL OR NOT EXISTS (
                      SELECT 1 FROM json_each(?16) w
                      WHERE NOT EXISTS (SELECT 1 FROM issue_tags t WHERE t.issue_id = i.id
                                        AND lower(t.key) = json_extract(w.value, '$[0]') AND lower(t.value) = json_extract(w.value, '$[1]'))))
               ORDER BY CASE ?7 WHEN 0 THEN i.last_seen WHEN 1 THEN i.first_seen
                                WHEN 2 THEN (SELECT COALESCE(SUM(h.count), 0) FROM issue_hourly h
                                             WHERE h.issue_id = i.id AND h.hour >= ?12)
                                ELSE i.user_count END DESC,
                        i.last_seen DESC, i.id
               LIMIT ?8"#,
            scope,
            status,
            levels,
            env,
            assignee,
            query,
            sort,
            limit,
            since,
            new_only,
            ids,
            range_hour,
            labels,
            triage,
            fresh,
            tags
        )
        .fetch_all(&self.read)
        .await?;
        let total = rows.first().map(|r| r.total).unwrap_or(0) as u32;
        Ok((rows.into_iter().map(|r| r.id).collect(), total))
    }

    pub async fn list_issues(&self, viewer: &Viewer, filter: &IssueFilter) -> Result<IssueList> {
        let (ids, total) = self.matching_issues(viewer, filter, LIST_LIMIT).await?;
        let rows = self.issue_rows(&ids).await?;
        let shown: Vec<ProjectId> = {
            let mut seen = Vec::new();
            for r in &rows {
                let p = ProjectId(r.project_id.clone());
                if !seen.contains(&p) {
                    seen.push(p);
                }
            }
            seen
        };
        let issues = self.summaries(&rows, SummaryShape::for_range(self.now(), filter.range)).await?;
        let labels = self.label_counts(&wanted_projects(viewer, filter)).await?;
        Ok(IssueList { issues, total, assignable: self.assignable(&shown).await?, labels })
    }

    /// How many issues a filter matches, for saved-view counts.
    pub(crate) async fn count_issues(&self, viewer: &Viewer, filter: &IssueFilter) -> Result<u32> {
        Ok(self.matching_issues(viewer, filter, 1).await?.1)
    }

    /// Joined members who can see every one of these projects.
    pub(crate) async fn assignable(&self, projects: &[ProjectId]) -> Result<Vec<Person>> {
        Ok(self
            .all_members()
            .await?
            .into_iter()
            .filter(|m| m.joined_at.is_some() && projects.iter().all(|p| m.project_ids.contains(p)))
            .map(|m| m.person())
            .collect())
    }

    /// The project an issue belongs to, if the viewer may see it.
    pub(crate) async fn visible_issue_project(&self, viewer: &Viewer, issue_id: &str) -> Result<Option<String>> {
        let project = sqlx::query_scalar!("SELECT project_id FROM issues WHERE id = ?", issue_id)
            .fetch_optional(&self.read)
            .await?;
        Ok(project.filter(|p| viewer.can_see(&ProjectId(p.clone()))))
    }

    /// The issue an agent means: a link to it on any bertha host, its id, or its short
    /// id in any case ("kiln-4f"). `None` when there is no such issue the viewer can see.
    pub async fn find_issue(&self, viewer: &Viewer, reference: &str) -> Result<Option<String>> {
        let key = ref_segment(reference, "issues");
        if key.is_empty() {
            return Ok(None);
        }
        if self.visible_issue_project(viewer, key).await?.is_some() {
            return Ok(Some(key.to_owned()));
        }
        let rows = sqlx::query!("SELECT id, project_id FROM issues WHERE short_id = ? COLLATE NOCASE", key)
            .fetch_all(&self.read)
            .await?;
        Ok(rows.into_iter().find(|r| viewer.can_see(&ProjectId(r.project_id.clone()))).map(|r| r.id))
    }

    pub async fn issue_detail(&self, viewer: &Viewer, issue_id: &str) -> Result<Option<IssueDetail>> {
        let Some(project_id) = self.visible_issue_project(viewer, issue_id).await? else { return Ok(None) };
        let Some(project) = self.project(viewer, &project_id).await? else { return Ok(None) };
        let Some(issue) = self.issue(issue_id).await? else { return Ok(None) };
        let Some(EventAt { event, cursor, .. }) = self.event_of(issue_id, &EventWhich::Latest).await? else {
            return Ok(None);
        };
        let related = self.related(viewer, &event).await?;
        let now = self.now();
        let grid = Grid::days_ending(now, 30);
        let hourly = self.issue_hourly(&[issue_id.to_owned()], grid.start).await?;
        let alive = self.alive_any(&ids_json(&[ProjectId(project_id.clone())]), grid.start).await?;
        let history = grid.series(grid.fill(hourly.of(issue_id), &alive));
        let releases = self.releases_since(&project_id, grid.start).await?;
        let assignable = self.assignable(&[ProjectId(project_id)]).await?;
        Ok(Some(IssueDetail { issue, project, event, cursor, related, history, releases, assignable }))
    }

    /// The full issue, with tags and activity. No scope check: callers check first.
    pub(crate) async fn issue(&self, issue_id: &str) -> Result<Option<Issue>> {
        let rows = self.issue_rows(&[issue_id.to_owned()]).await?;
        let Some(row) = rows.first() else { return Ok(None) };
        let summary = self
            .summaries(&rows, SummaryShape::month(self.now(), TimeRange::Week))
            .await?
            .pop()
            .ok_or_else(|| Error::Corrupt("issue summary missing".into()))?;
        Ok(Some(Issue {
            summary,
            first_release: row.first_release.clone(),
            regressed_in: row.regressed_in.clone(),
            tags: self.tags(issue_id).await?,
            triages: self.triages(issue_id).await?,
            activity: self.activity(issue_id).await?,
        }))
    }

    async fn tags(&self, issue_id: &str) -> Result<Vec<TagBreakdown>> {
        let keys = sqlx::query!("SELECT key, distinct_count FROM issue_tag_keys WHERE issue_id = ?", issue_id)
            .fetch_all(&self.read)
            .await?;
        let values = sqlx::query!(
            "SELECT key, value, count FROM issue_tags WHERE issue_id = ? ORDER BY count DESC, value",
            issue_id
        )
        .fetch_all(&self.read)
        .await?;
        let distinct: HashMap<String, i64> = keys.into_iter().map(|k| (k.key, k.distinct_count)).collect();
        // Built-in keys in their order, then the app's own, by name.
        let mut custom: Vec<&str> =
            values.iter().map(|v| v.key.as_str()).filter(|k| TagKey::parse(k).is_none()).collect();
        custom.sort_unstable();
        custom.dedup();
        let mut out = Vec::new();
        for key in TagKey::ALL.iter().map(|k| k.as_str()).chain(custom) {
            let vals: Vec<TagValue> = values
                .iter()
                .filter(|v| v.key == key)
                .take(TAG_VALUES)
                .map(|v| TagValue { value: v.value.clone(), count: v.count.max(0) as u32 })
                .collect();
            if vals.is_empty() {
                continue;
            }
            let rows = values.iter().filter(|v| v.key == key).count() as i64;
            let d = distinct.get(key).copied().unwrap_or(rows).max(rows);
            out.push(TagBreakdown { key: key.to_owned(), distinct: d as u32, values: vals });
        }
        Ok(out)
    }

    /// Newest first.
    async fn activity(&self, issue_id: &str) -> Result<Vec<Activity>> {
        sqlx::query_scalar!("SELECT data FROM activity WHERE issue_id = ? ORDER BY at DESC, id DESC", issue_id)
            .fetch_all(&self.read)
            .await?
            .iter()
            .map(|d| Ok(serde_json::from_str(d)?))
            .collect()
    }

    pub async fn event_at(&self, viewer: &Viewer, issue_id: &str, which: &EventWhich) -> Result<Option<EventAt>> {
        if self.visible_issue_project(viewer, issue_id).await?.is_none() {
            return Ok(None);
        }
        let Some(mut at) = self.event_of(issue_id, which).await? else { return Ok(None) };
        at.related = self.related(viewer, &at.event).await?;
        Ok(Some(at))
    }

    /// Newest events of other issues the viewer can see that share this event's trace:
    /// usually the server side of a browser error, or the other way round.
    pub(crate) async fn related(&self, viewer: &Viewer, event: &Event) -> Result<Vec<RelatedEvent>> {
        let Some(trace) = &event.trace else { return Ok(vec![]) };
        let scope = viewer.scope_json();
        let rows = sqlx::query!(
            "SELECT e.id, e.issue_id, e.received_at FROM events e JOIN issues i ON i.id = e.issue_id
              WHERE e.trace_id = ?1 AND e.issue_id != ?2
                AND i.project_id IN (SELECT value FROM json_each(?3))
              ORDER BY e.received_at DESC, e.id DESC LIMIT ?4",
            trace.trace_id,
            event.issue_id.0,
            scope,
            RELATED_LIMIT
        )
        .fetch_all(&self.read)
        .await?;
        // One line per issue: its newest event in the trace.
        let mut seen = HashSet::new();
        let rows: Vec<_> = rows.into_iter().filter(|r| seen.insert(r.issue_id.clone())).collect();
        let ids: Vec<String> = rows.iter().map(|r| r.issue_id.clone()).collect();
        let summaries = self.summaries_of(&ids, SummaryShape::month(self.now(), TimeRange::Week)).await?;
        Ok(rows
            .into_iter()
            .zip(summaries)
            .map(|(r, issue)| RelatedEvent {
                issue,
                event_id: EventId(r.id),
                received_at: IsoDate::from_millis(r.received_at),
            })
            .collect())
    }

    /// The issue's newest events, newest first, for comparing them side by side. `None`
    /// when the viewer can't see the issue.
    pub async fn recent_events(&self, viewer: &Viewer, issue_id: &str, limit: u32) -> Result<Option<Vec<Event>>> {
        if self.visible_issue_project(viewer, issue_id).await?.is_none() {
            return Ok(None);
        }
        let limit = i64::from(limit);
        let rows = sqlx::query!(
            "SELECT id, received_at, payload FROM events WHERE issue_id = ?
                 ORDER BY received_at DESC, id DESC LIMIT ?",
            issue_id,
            limit
        )
        .fetch_all(&self.read)
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let stored: StoredEvent = from_blob(&r.payload, EVENT_PAYLOAD_LIMIT)?;
            out.push(stored.into_event(EventId(r.id), IssueId(issue_id.to_owned()), r.received_at));
        }
        Ok(Some(out))
    }

    /// Events are ordered newest first: by when they arrived, then by id.
    pub(crate) async fn event_of(&self, issue_id: &str, which: &EventWhich) -> Result<Option<EventAt>> {
        let total = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "n!: i64" FROM events WHERE issue_id = ?"#, issue_id)
            .fetch_one(&self.read)
            .await?;
        if total == 0 {
            return self.synthetic_event(issue_id).await;
        }
        let row = match which {
            EventWhich::Latest => sqlx::query!(
                "SELECT id, received_at, payload FROM events WHERE issue_id = ?
                     ORDER BY received_at DESC, id DESC LIMIT 1",
                issue_id
            )
            .fetch_optional(&self.read)
            .await?
            .map(|r| (r.id, r.received_at, r.payload)),
            EventWhich::Oldest => sqlx::query!(
                "SELECT id, received_at, payload FROM events WHERE issue_id = ?
                     ORDER BY received_at ASC, id ASC LIMIT 1",
                issue_id
            )
            .fetch_optional(&self.read)
            .await?
            .map(|r| (r.id, r.received_at, r.payload)),
            EventWhich::Id(id) => sqlx::query!(
                "SELECT id, received_at, payload FROM events WHERE issue_id = ? AND id = ?",
                issue_id,
                id.0
            )
            .fetch_optional(&self.read)
            .await?
            .map(|r| (r.id, r.received_at, r.payload)),
        };
        let Some((id, at, payload)) = row else { return Ok(None) };
        let newer = sqlx::query!(
            r#"SELECT id, (SELECT COUNT(*) FROM events WHERE issue_id = ?1
                 AND (received_at > ?2 OR (received_at = ?2 AND id > ?3))) AS "index!: i64"
               FROM events WHERE issue_id = ?1 AND (received_at > ?2 OR (received_at = ?2 AND id > ?3))
               ORDER BY received_at ASC, id ASC LIMIT 1"#,
            issue_id,
            at,
            id
        )
        .fetch_optional(&self.read)
        .await?;
        let older = sqlx::query_scalar!(
            "SELECT id FROM events WHERE issue_id = ?1 AND (received_at < ?2 OR (received_at = ?2 AND id < ?3))
             ORDER BY received_at DESC, id DESC LIMIT 1",
            issue_id,
            at,
            id
        )
        .fetch_optional(&self.read)
        .await?;
        let stored: StoredEvent = from_blob(&payload, EVENT_PAYLOAD_LIMIT)?;
        let index = newer.as_ref().map(|n| n.index).unwrap_or(0);
        Ok(Some(EventAt {
            event: stored.into_event(EventId(id), IssueId(issue_id.to_owned()), at),
            cursor: EventCursor {
                index: index as u32,
                total: total as u32,
                newer_id: newer.map(|n| EventId(n.id)),
                older_id: older.map(EventId),
            },
            related: vec![],
        }))
    }

    /// An issue whose events were all pruned still shows what it was about.
    async fn synthetic_event(&self, issue_id: &str) -> Result<Option<EventAt>> {
        let rows = self.issue_rows(&[issue_id.to_owned()]).await?;
        let Some(r) = rows.first() else { return Ok(None) };
        let environment = envs(r.environments).first().copied().unwrap_or(bertha_core::domain::Environment::Production);
        let exception = r.culprit.as_ref().map(|c| EventException {
            r#type: r.kind.clone(),
            message: r.message.clone(),
            frames: vec![StackFrame {
                file: c.clone(),
                function: None,
                line: None,
                column: None,
                in_app: true,
                mapped: true,
                context: None,
            }],
            data: Default::default(),
            component_stack: None,
        });
        let event = Event {
            id: EventId(format!("{issue_id}~latest")),
            issue_id: IssueId(issue_id.to_owned()),
            received_at: IsoDate::from_millis(r.last_seen),
            release: r.first_release.clone(),
            environment,
            level: r.level()?,
            exception,
            mechanism: None,
            trace: None,
            breadcrumbs: vec![],
            request: None,
            user: None,
            context: EventContext::default(),
            tags: Default::default(),
        };
        Ok(Some(EventAt {
            event,
            cursor: EventCursor { index: 0, total: 1, newer_id: None, older_id: None },
            related: vec![],
        }))
    }
}

/// The filter's projects the viewer can see; all they can see when it names none.
fn wanted_projects(viewer: &Viewer, filter: &IssueFilter) -> Vec<ProjectId> {
    if filter.project_ids.is_empty() {
        viewer.projects().to_vec()
    } else {
        filter.project_ids.iter().filter(|p| viewer.can_see(p)).cloned().collect()
    }
}

/// A search split into its free text and its `label:x` and `key:value` tokens.
#[derive(Debug, Default, PartialEq)]
pub struct Search {
    pub text: String,
    pub labels: Vec<String>,
    /// Tag key and value, lowercased: an issue must have had each on some event.
    pub tags: Vec<(String, String)>,
}

/// Splits `label:x` and `key:value` tokens out of a search, lowercased:
/// "label:checkout area:cart timeout" gives "timeout", `["checkout"]` and `[("area", "cart")]`.
/// A token whose value starts with `//` is a URL, so `https://…` stays free text.
pub fn split_query(query: &str) -> Search {
    let mut search = Search::default();
    let mut text = Vec::new();
    for word in query.split_whitespace() {
        let Some((key, value)) = word.split_once(':') else {
            text.push(word.to_lowercase());
            continue;
        };
        if key.eq_ignore_ascii_case("label") && !value.is_empty() {
            search.labels.push(normalize_label(value).unwrap_or_else(|| value.to_lowercase()));
        } else if is_tag_key(key) && !value.is_empty() && !value.starts_with("//") {
            search.tags.push((key.to_lowercase(), value.to_lowercase()));
        } else {
            text.push(word.to_lowercase());
        }
    }
    search.text = text.join(" ");
    search
}

/// A tag key as the SDKs send them: a letter or `_`, then letters, digits, `_`, `.` or `-`.
fn is_tag_key(key: &str) -> bool {
    let mut chars = key.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

/// The id inside a reference that may be a whole link: for `section` "issues",
/// "https://bertha.example.com/issues/i_x?event=e" gives "i_x". Anything else is
/// returned trimmed, as it was given.
pub fn ref_segment<'a>(reference: &'a str, section: &str) -> &'a str {
    let reference = reference.trim();
    let marker = format!("/{section}/");
    match reference.find(&marker) {
        Some(at) => {
            let rest = &reference[at + marker.len()..];
            let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
            &rest[..end]
        }
        None => reference,
    }
}

#[cfg(test)]
mod ref_tests {
    use super::ref_segment;

    #[test]
    fn links_ids_and_short_ids() {
        assert_eq!(ref_segment("https://bertha.test/issues/i_abc", "issues"), "i_abc");
        assert_eq!(ref_segment(" https://b.dev/issues/i_abc/?event=e_1#x ", "issues"), "i_abc");
        assert_eq!(ref_segment("/issues/i_abc?x", "issues"), "i_abc");
        assert_eq!(ref_segment("KILN-4F", "issues"), "KILN-4F");
        assert_eq!(ref_segment("https://b.dev/releases/r_1", "releases"), "r_1");
        assert_eq!(ref_segment("https://b.dev/issues/", "issues"), "");
    }

    #[test]
    fn label_and_tag_tokens_leave_the_search() {
        use super::{Search, split_query};
        let s = |text: &str, labels: &[&str], tags: &[(&str, &str)]| Search {
            text: text.into(),
            labels: labels.iter().map(|l| l.to_string()).collect(),
            tags: tags.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
        };
        assert_eq!(split_query("label:Checkout  Timeout"), s("timeout", &["checkout"], &[]));
        assert_eq!(split_query("LABEL:a label:b"), s("", &["a", "b"], &[]));
        assert_eq!(split_query("label: x"), s("label: x", &[], &[]));
        assert_eq!(
            split_query("Area:Cart browser:Safari crash"),
            s("crash", &[], &[("area", "cart"), ("browser", "safari")])
        );
        assert_eq!(split_query("https://kiln.dev/cart TypeError:"), s("https://kiln.dev/cart typeerror:", &[], &[]));
        assert_eq!(split_query("node.version:24 9x:y"), s("9x:y", &[], &[("node.version", "24")]));
    }
}
