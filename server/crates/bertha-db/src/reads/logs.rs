//! Log lines: the logs page's list, volume and patterns, and the lines around an event.
//! They live in their own file, whose queries are built at run time; the projects and
//! events they name are read from the main one, in the viewer's scope.

use std::collections::{BTreeMap, HashMap, HashSet};

use bertha_core::domain::{
    Environment, EventLogs, LogByLevel, LogDrop, LogEventRef, LogFilter, LogLevel, LogLine, LogList, LogMatch,
    LogPattern, LogPatternList, LogScope, LogUsage, LogVolume,
};
use bertha_core::ids::{EventId, IssueId, ProjectId};
use bertha_core::logs::{Cursor, Search, limits, line_id};
use bertha_core::time::{DAY, IsoDate, Millis, SECOND};
use sqlx::{AssertSqlSafe, QueryBuilder, Sqlite};

use crate::scope::{Viewer, ids_json};
use crate::{Db, Result};

/// The lines shown around an event without a trace: from this long before it…
const NEARBY_BEFORE: Millis = 2 * 60 * SECOND;
/// …to this long after.
const NEARBY_AFTER: Millis = 30 * SECOND;

const COLUMNS: &str = "l.id, l.project_id, l.at, l.level, l.message, l.fields, l.service, l.release,
                       l.environment, l.trace_id, l.span_id, l.event_ref";

#[derive(sqlx::FromRow)]
struct Row {
    id: i64,
    project_id: String,
    at: i64,
    level: i64,
    message: String,
    fields: String,
    service: Option<String>,
    release: Option<String>,
    environment: String,
    trace_id: Option<String>,
    span_id: Option<String>,
    event_ref: Option<String>,
}

/// A filter read against what the viewer may see.
struct Plan {
    /// The projects searched, as a JSON array.
    projects: String,
    project_ids: Vec<ProjectId>,
    min: i64,
    search: Search,
    pattern: Option<String>,
    /// The range: `start` ≤ at ≤ `end`.
    start: Millis,
    end: Millis,
    now: Millis,
    /// The volume's buckets: `buckets` of `bucket` from `volume_start`.
    volume_start: Millis,
    bucket: Millis,
    buckets: usize,
}

impl Plan {
    fn new(viewer: &Viewer, filter: &LogFilter, now: Millis) -> Plan {
        let project_ids: Vec<ProjectId> = if filter.project_ids.is_empty() {
            viewer.projects().to_vec()
        } else {
            filter.project_ids.iter().filter(|p| viewer.can_see(p)).cloned().collect()
        };
        let end = filter.until.as_ref().and_then(IsoDate::millis).unwrap_or(now);
        let bucket = i64::from(filter.range.bucket_seconds()) * SECOND;
        let buckets = (filter.range.millis() / bucket) as usize;
        let volume_start = end.div_euclid(bucket) * bucket - (buckets as i64 - 1) * bucket;
        Plan {
            projects: ids_json(&project_ids),
            project_ids,
            min: filter.min_level.rank(),
            search: Search::parse(&filter.query),
            pattern: filter.pattern_id.clone(),
            start: end - filter.range.millis(),
            end,
            now,
            volume_start,
            bucket,
            buckets,
        }
    }

    /// Whether the per-minute counts answer it: nothing to match but level and pattern.
    fn counted(&self) -> bool {
        self.search.is_empty()
    }

    /// The conditions on `lines l`, after a `WHERE`, without the time range.
    fn matching(&self, q: &mut QueryBuilder<Sqlite>) {
        q.push(" l.project_id IN (SELECT value FROM json_each(").push_bind(self.projects.clone()).push("))");
        q.push(" AND l.level >= ").push_bind(self.min);
        if let Some(id) = &self.pattern {
            q.push(" AND l.pattern_id = ").push_bind(id.clone());
        }
        matching_search(q, &self.search);
    }

    fn in_range(&self, q: &mut QueryBuilder<Sqlite>) {
        q.push(" AND l.at >= ").push_bind(self.start).push(" AND l.at <= ").push_bind(self.end);
    }

    /// Which bucket of the volume `at` is in, as SQL over `column`.
    fn bucket_of(&self, q: &mut QueryBuilder<Sqlite>, column: &str) {
        q.push(format!("({column} - ")).push_bind(self.volume_start).push(") / ").push_bind(self.bucket);
    }

    fn volume_end(&self) -> Millis {
        self.volume_start + self.buckets as i64 * self.bucket
    }

    /// For each bucket, whether bertha has logs for it: not before the oldest kept line,
    /// and not still to come.
    fn known(&self, oldest: Option<Millis>) -> Vec<bool> {
        (0..self.buckets)
            .map(|i| {
                let from = self.volume_start + i as i64 * self.bucket;
                oldest.is_some_and(|o| from + self.bucket > o) && from <= self.now
            })
            .collect()
    }
}

fn matching_search(q: &mut QueryBuilder<Sqlite>, s: &Search) {
    if let Some(fts) = s.fts() {
        q.push(" AND l.id IN (SELECT rowid FROM lines_fts WHERE lines_fts MATCH ").push_bind(fts).push(")");
    }
    for literal in s.literals() {
        q.push(" AND instr(lower(l.message), ").push_bind(literal.to_lowercase()).push(") > 0");
    }
    for (key, value) in &s.fields {
        q.push(" AND EXISTS (SELECT 1 FROM json_each(l.fields) f WHERE lower(f.key) = ")
            .push_bind(key.to_lowercase())
            .push(" AND lower(f.value) = ")
            .push_bind(value.to_lowercase())
            .push(")");
    }
    if let Some(release) = &s.release {
        q.push(" AND l.release = ").push_bind(release.clone());
    }
    if let Some(service) = &s.service {
        q.push(" AND lower(l.service) = ").push_bind(service.to_lowercase());
    }
    match s.environment {
        Some(Some(env)) => {
            q.push(" AND l.environment = ").push_bind(env.as_str());
        }
        Some(None) => {
            q.push(" AND 0");
        }
        None => {}
    }
    if let Some(trace) = &s.trace {
        q.push(" AND l.trace_id = ").push_bind(trace.clone());
    }
}

/// `null` where bertha has no logs, so a gap isn't drawn as zero.
fn masked(counts: &[u32], known: &[bool]) -> Vec<Option<u32>> {
    counts.iter().zip(known).map(|(n, k)| k.then_some(*n)).collect()
}

impl Db {
    /// A page of lines matching the filter, oldest first, with the range's volume and
    /// what was dropped. With no page, the newest lines of the range.
    pub async fn list_logs(&self, viewer: &Viewer, filter: &LogFilter, page: Option<&str>) -> Result<LogList> {
        let plan = Plan::new(viewer, filter, self.now());
        let last: Option<i64> = sqlx::query_scalar("SELECT MAX(id) FROM lines").fetch_one(&self.logs.read).await?;
        let last = last.unwrap_or(0);
        let mut q = QueryBuilder::new(format!("SELECT {COLUMNS} FROM lines l WHERE"));
        plan.matching(&mut q);
        let (rows, older, newer) = match page.and_then(Cursor::decode) {
            Some(Cursor::After { id }) => {
                // New arrivals, in the order they came.
                q.push(" AND l.at >= ").push_bind(plan.start).push(" AND l.id > ").push_bind(id);
                q.push(" ORDER BY l.id LIMIT ").push_bind(i64::from(limits::PAGE));
                let rows: Vec<Row> = q.build_query_as().fetch_all(&self.logs.read).await?;
                let newer = rows.last().map_or(id, |r| r.id);
                (rows, None, Cursor::After { id: newer })
            }
            before => {
                plan.in_range(&mut q);
                q.push(" AND l.id <= ").push_bind(last);
                if let Some(Cursor::Before { at, id }) = before {
                    q.push(" AND (l.at, l.id) < (").push_bind(at).push(", ").push_bind(id).push(")");
                }
                q.push(" ORDER BY l.at DESC, l.id DESC LIMIT ").push_bind(i64::from(limits::PAGE) + 1);
                let mut rows: Vec<Row> = q.build_query_as().fetch_all(&self.logs.read).await?;
                let more = rows.len() > limits::PAGE as usize;
                rows.truncate(limits::PAGE as usize);
                rows.reverse();
                let older =
                    more.then(|| rows.first().map(|r| Cursor::Before { at: r.at, id: r.id }.encode())).flatten();
                (rows, older, Cursor::After { id: last })
            }
        };

        let mut q = QueryBuilder::new("SELECT COUNT(*) FROM (SELECT 1 FROM lines l WHERE");
        plan.matching(&mut q);
        plan.in_range(&mut q);
        q.push(" LIMIT ").push_bind(i64::from(limits::TOTAL_COUNTED)).push(")");
        let total: i64 = q.build_query_scalar().fetch_one(&self.logs.read).await?;

        Ok(LogList {
            lines: self.log_lines(viewer, rows).await?,
            older,
            newer: newer.encode(),
            total: total as u32,
            volume: self.log_volume(&plan).await?,
            dropped: self.log_drops(&plan).await?,
        })
    }

    /// The patterns with the most lines matching the filter, each with its count per
    /// bucket of the volume.
    pub async fn log_patterns(&self, viewer: &Viewer, filter: &LogFilter) -> Result<LogPatternList> {
        let plan = Plan::new(viewer, filter, self.now());
        let known = self.known(&plan).await?;
        // Pattern → lines per bucket.
        let rows: Vec<(String, i64, i64)> = if plan.counted() {
            let mut q = QueryBuilder::new("SELECT m.pattern_id, ");
            plan.bucket_of(&mut q, "m.minute");
            q.push(" AS b, SUM(m.lines) FROM minutes m WHERE m.project_id IN (SELECT value FROM json_each(")
                .push_bind(plan.projects.clone())
                .push(")) AND m.level >= ")
                .push_bind(plan.min)
                .push(" AND m.minute >= ")
                .push_bind(plan.volume_start)
                .push(" AND m.minute < ")
                .push_bind(plan.volume_end());
            if let Some(id) = &plan.pattern {
                q.push(" AND m.pattern_id = ").push_bind(id.clone());
            }
            q.push(" GROUP BY m.pattern_id, b");
            q.build_query_as().fetch_all(&self.logs.read).await?
        } else {
            let mut q = QueryBuilder::new("SELECT l.pattern_id, ");
            plan.bucket_of(&mut q, "l.at");
            q.push(" AS b, COUNT(*) FROM lines l WHERE");
            plan.matching(&mut q);
            q.push(" AND l.at >= ").push_bind(plan.volume_start).push(" AND l.at < ").push_bind(plan.volume_end());
            q.push(" GROUP BY l.pattern_id, b");
            q.build_query_as().fetch_all(&self.logs.read).await?
        };
        let mut counts: HashMap<String, Vec<u32>> = HashMap::new();
        for (pattern, b, n) in rows {
            let cells = counts.entry(pattern).or_insert_with(|| vec![0; plan.buckets]);
            if let Some(c) = usize::try_from(b).ok().and_then(|b| cells.get_mut(b)) {
                *c += n as u32;
            }
        }
        let mut top: Vec<(String, Vec<u32>, u32)> = counts
            .into_iter()
            .map(|(p, cells)| {
                let n = cells.iter().sum();
                (p, cells, n)
            })
            .filter(|(_, _, n)| *n > 0)
            .collect();
        top.sort_by(|a, b| b.2.cmp(&a.2).then_with(|| a.0.cmp(&b.0)));
        top.truncate(limits::PATTERNS as usize);

        let mut patterns = Vec::with_capacity(top.len());
        for (id, cells, count) in top {
            let found: Option<(String, String, i64, i64, i64)> =
                sqlx::query_as("SELECT project_id, template, level, first_seen, last_seen FROM patterns WHERE id = ?")
                    .bind(&id)
                    .fetch_optional(&self.logs.read)
                    .await?;
            let Some((project_id, template, level, first_seen, last_seen)) = found else { continue };
            let mut q = QueryBuilder::new(format!("SELECT {COLUMNS} FROM lines l WHERE"));
            plan.matching(&mut q);
            q.push(" AND l.pattern_id = ").push_bind(id.clone());
            plan.in_range(&mut q);
            q.push(" ORDER BY l.at DESC, l.id DESC LIMIT 1");
            let sample: Vec<Row> = q.build_query_as().fetch_all(&self.logs.read).await?;
            let Some(sample) = self.log_lines(viewer, sample).await?.pop() else { continue };
            patterns.push(LogPattern {
                id,
                project_id: ProjectId(project_id),
                template,
                level: LogLevel::from_rank(level).unwrap_or(LogLevel::Info),
                count,
                counts: masked(&cells, &known),
                first_seen: IsoDate::from_millis(first_seen),
                last_seen: IsoDate::from_millis(last_seen),
                sample,
            });
        }
        Ok(LogPatternList { patterns, volume: self.log_volume(&plan).await? })
    }

    /// The lines around an event: those on its trace when it has any, otherwise the
    /// project's from 2 minutes before to 30 seconds after. `None` when the viewer can't
    /// see the event.
    pub async fn event_logs(&self, viewer: &Viewer, issue_id: &str, event_id: &str) -> Result<Option<EventLogs>> {
        let Some(project) = self.visible_issue_project(viewer, issue_id).await? else { return Ok(None) };
        let Some(event) = sqlx::query!(
            "SELECT received_at, trace_id, client_id FROM events WHERE id = ? AND issue_id = ?",
            event_id,
            issue_id
        )
        .fetch_optional(&self.read)
        .await?
        else {
            return Ok(None);
        };
        let has_logs: Option<i64> = sqlx::query_scalar("SELECT 1 FROM lines WHERE project_id = ? LIMIT 1")
            .bind(&project)
            .fetch_optional(&self.logs.read)
            .await?;

        let mut rows: Vec<Row> = Vec::new();
        let mut scope = LogScope::Nearby;
        if let Some(trace) = &event.trace_id {
            let mut q = QueryBuilder::new(format!("SELECT {COLUMNS} FROM lines l WHERE l.trace_id = "));
            q.push_bind(trace.to_ascii_lowercase());
            q.push(" AND l.project_id IN (SELECT value FROM json_each(").push_bind(viewer.scope_json().to_owned());
            q.push(")) ORDER BY l.at, l.id LIMIT ").push_bind(i64::from(limits::PAGE));
            rows = q.build_query_as().fetch_all(&self.logs.read).await?;
            if !rows.is_empty() {
                scope = LogScope::Trace;
            }
        }
        let at = event.received_at;
        let (from, to) = if scope == LogScope::Trace {
            (rows.first().map_or(at, |r| r.at), rows.last().map_or(at, |r| r.at))
        } else {
            // The nearest lines when there are more than a page: most before, as that's
            // where the cause is.
            let after = i64::from(limits::PAGE) / 5;
            let mut before: Vec<Row> = sqlx::query_as(AssertSqlSafe(format!(
                "SELECT {COLUMNS} FROM lines l WHERE l.project_id = ? AND l.at >= ? AND l.at <= ?
                 ORDER BY l.at DESC, l.id DESC LIMIT ?"
            )))
            .bind(&project)
            .bind(at - NEARBY_BEFORE)
            .bind(at)
            .bind(i64::from(limits::PAGE) - after)
            .fetch_all(&self.logs.read)
            .await?;
            before.reverse();
            let later: Vec<Row> = sqlx::query_as(AssertSqlSafe(format!(
                "SELECT {COLUMNS} FROM lines l WHERE l.project_id = ? AND l.at > ? AND l.at <= ?
                 ORDER BY l.at, l.id LIMIT ?"
            )))
            .bind(&project)
            .bind(at)
            .bind(at + NEARBY_AFTER)
            .bind(after)
            .fetch_all(&self.logs.read)
            .await?;
            rows = before;
            rows.extend(later);
            (at - NEARBY_BEFORE, at + NEARBY_AFTER)
        };
        let names: Vec<&str> = std::iter::once(event_id).chain(event.client_id.as_deref()).collect();
        let event_line_id = rows
            .iter()
            .find(|r| r.project_id == project && r.event_ref.as_deref().is_some_and(|e| names.contains(&e)))
            .map(|r| line_id(r.id));
        Ok(Some(EventLogs {
            scope,
            lines: self.log_lines(viewer, rows).await?,
            event_line_id,
            from: IsoDate::from_millis(from),
            to: IsoDate::from_millis(to),
            project_has_logs: has_logs.is_some(),
        }))
    }

    /// What a project keeps. The caller checks the viewer may see it.
    pub(crate) async fn log_usage(&self, project: &ProjectId) -> Result<LogUsage> {
        let kept: Option<(i64, i64)> = sqlx::query_as("SELECT lines, bytes FROM usage WHERE project_id = ?")
            .bind(&project.0)
            .fetch_optional(&self.logs.read)
            .await?;
        let oldest: Option<i64> = sqlx::query_scalar("SELECT MIN(at) FROM lines WHERE project_id = ?")
            .bind(&project.0)
            .fetch_one(&self.logs.read)
            .await?;
        let dropped: Option<i64> = sqlx::query_scalar("SELECT rate + size FROM drops WHERE project_id = ? AND day = ?")
            .bind(&project.0)
            .bind(self.now().div_euclid(DAY))
            .fetch_optional(&self.logs.read)
            .await?;
        let (lines, bytes) = kept.unwrap_or_default();
        Ok(LogUsage {
            lines: lines.max(0) as u32,
            bytes: bytes.clamp(0, i64::from(u32::MAX)) as u32,
            oldest: oldest.map(IsoDate::from_millis),
            dropped_today: dropped.unwrap_or(0).max(0) as u32,
        })
    }

    /// Lines of one project matching an alert's search since `since`, counted up to
    /// `cap`. For the alerter, which isn't anyone's view.
    pub async fn count_log_matches(
        &self,
        project: &ProjectId,
        m: &LogMatch,
        environments: &[Environment],
        since: Millis,
        cap: u32,
    ) -> Result<u32> {
        let mut q = QueryBuilder::new("SELECT COUNT(*) FROM (SELECT 1 FROM lines l WHERE l.project_id = ");
        q.push_bind(project.0.clone());
        q.push(" AND l.level >= ").push_bind(m.min_level.rank());
        q.push(" AND l.at >= ").push_bind(since);
        if !environments.is_empty() {
            let envs: Vec<&str> = environments.iter().map(|e| e.as_str()).collect();
            q.push(" AND l.environment IN (SELECT value FROM json_each(")
                .push_bind(serde_json::to_string(&envs)?)
                .push("))");
        }
        matching_search(&mut q, &Search::parse(&m.query));
        q.push(" LIMIT ").push_bind(i64::from(cap)).push(")");
        let n: i64 = q.build_query_scalar().fetch_one(&self.logs.read).await?;
        Ok(n as u32)
    }

    /// Lines per bucket and level across the plan's range.
    async fn log_volume(&self, plan: &Plan) -> Result<LogVolume> {
        let known = self.known(plan).await?;
        let rows: Vec<(i64, i64, i64)> = if plan.counted() {
            let mut q = QueryBuilder::new("SELECT ");
            plan.bucket_of(&mut q, "m.minute");
            q.push(" AS b, m.level, SUM(m.lines) FROM minutes m WHERE m.project_id IN (SELECT value FROM json_each(")
                .push_bind(plan.projects.clone())
                .push(")) AND m.level >= ")
                .push_bind(plan.min)
                .push(" AND m.minute >= ")
                .push_bind(plan.volume_start)
                .push(" AND m.minute < ")
                .push_bind(plan.volume_end());
            if let Some(id) = &plan.pattern {
                q.push(" AND m.pattern_id = ").push_bind(id.clone());
            }
            q.push(" GROUP BY b, m.level");
            q.build_query_as().fetch_all(&self.logs.read).await?
        } else {
            let mut q = QueryBuilder::new("SELECT ");
            plan.bucket_of(&mut q, "l.at");
            q.push(" AS b, l.level, COUNT(*) FROM lines l WHERE");
            plan.matching(&mut q);
            q.push(" AND l.at >= ").push_bind(plan.volume_start).push(" AND l.at < ").push_bind(plan.volume_end());
            q.push(" GROUP BY b, l.level");
            q.build_query_as().fetch_all(&self.logs.read).await?
        };
        let mut by_level: BTreeMap<LogLevel, Vec<u32>> =
            LogLevel::ALL.iter().map(|l| (*l, vec![0; plan.buckets])).collect();
        for (b, level, n) in rows {
            let Some(level) = LogLevel::from_rank(level) else { continue };
            if let Some(c) = by_level.get_mut(&level).and_then(|cells| cells.get_mut(usize::try_from(b).ok()?)) {
                *c += n as u32;
            }
        }
        let mut out = LogByLevel::default();
        for (level, cells) in by_level {
            *out.of_mut(level) = masked(&cells, &known);
        }
        Ok(LogVolume {
            start: IsoDate::from_millis(plan.volume_start),
            bucket_seconds: (plan.bucket / SECOND) as u32,
            by_level: out,
        })
    }

    /// Which of the plan's buckets bertha has logs for.
    async fn known(&self, plan: &Plan) -> Result<Vec<bool>> {
        let mut oldest: Option<Millis> = None;
        for p in &plan.project_ids {
            let at: Option<i64> = sqlx::query_scalar("SELECT MIN(at) FROM lines WHERE project_id = ?")
                .bind(&p.0)
                .fetch_one(&self.logs.read)
                .await?;
            oldest = match (oldest, at) {
                (Some(a), Some(b)) => Some(a.min(b)),
                (a, b) => a.or(b),
            };
        }
        Ok(plan.known(oldest))
    }

    /// Lines each project sent past its rate cap within the range.
    async fn log_drops(&self, plan: &Plan) -> Result<Vec<LogDrop>> {
        let rows: Vec<(String, i64, Option<i64>)> = sqlx::query_as(
            "SELECT project_id, SUM(rate), MIN(since) FROM drops
             WHERE project_id IN (SELECT value FROM json_each(?)) AND day >= ? AND rate > 0
             GROUP BY project_id ORDER BY project_id",
        )
        .bind(&plan.projects)
        .bind(plan.start.div_euclid(DAY))
        .fetch_all(&self.logs.read)
        .await?;
        Ok(rows
            .into_iter()
            .map(|(project, lines, since)| LogDrop {
                project_id: ProjectId(project),
                lines: lines.max(0) as u32,
                since: IsoDate::from_millis(since.unwrap_or(plan.start)),
            })
            .collect())
    }

    /// Rows as the contract's lines, each linked to the event it names when the viewer
    /// can see that event and it's in the line's own project.
    async fn log_lines(&self, viewer: &Viewer, rows: Vec<Row>) -> Result<Vec<LogLine>> {
        let refs: HashSet<&str> = rows.iter().filter_map(|r| r.event_ref.as_deref()).collect();
        let mut events: HashMap<(String, String), LogEventRef> = HashMap::new();
        if !refs.is_empty() {
            let refs = serde_json::to_string(&refs)?;
            let scope = viewer.scope_json();
            let found = sqlx::query!(
                r#"SELECT e.id AS "id!", e.client_id, e.issue_id, i.project_id
                   FROM events e JOIN issues i ON i.id = e.issue_id
                   WHERE (e.id IN (SELECT value FROM json_each(?1)) OR e.client_id IN (SELECT value FROM json_each(?1)))
                     AND i.project_id IN (SELECT value FROM json_each(?2))"#,
                refs,
                scope
            )
            .fetch_all(&self.read)
            .await?;
            for e in found {
                let link = LogEventRef { issue_id: IssueId(e.issue_id), event_id: EventId(e.id.clone()) };
                if let Some(client) = e.client_id {
                    events.entry((e.project_id.clone(), client)).or_insert_with(|| link.clone());
                }
                events.insert((e.project_id, e.id), link);
            }
        }
        rows.into_iter()
            .map(|r| {
                let event = r.event_ref.as_ref().and_then(|e| events.get(&(r.project_id.clone(), e.clone())).cloned());
                Ok(LogLine {
                    id: line_id(r.id),
                    project_id: ProjectId(r.project_id),
                    at: IsoDate::from_millis(r.at),
                    level: LogLevel::from_rank(r.level).unwrap_or(LogLevel::Info),
                    message: r.message,
                    fields: serde_json::from_str(&r.fields)?,
                    service: r.service,
                    release: r.release,
                    environment: Environment::parse(&r.environment).unwrap_or(Environment::Production),
                    trace_id: r.trace_id,
                    span_id: r.span_id,
                    event,
                })
            })
            .collect()
    }
}
