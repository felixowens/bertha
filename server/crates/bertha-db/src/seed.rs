//! Loads the design fixtures (`fixtures/`, exported to JSON by
//! `scripts/export-fixtures.ts`) into an empty database, so the real server shows the
//! same data the prototype did.
//!
//! Every timestamp is shifted by `now − fixtures.now`, so "4m ago" stays 4m ago. With
//! a fixed clock at the fixtures' own "now" nothing moves at all. Daily trend counts
//! become hourly rollups, spread over the day with a quiet night; uptime checks are
//! rebuilt from each monitor's recent strip, history and 30-day uptime.

use std::collections::{BTreeMap, HashMap};

use bertha_core::domain::{
    Activity, AlertDestination, AlertRule, Event, EventTrace, Incident, Issue, LogLine, Member, Monitor, MonitorState,
    Project, ProjectIds, ProjectLogSettings, ProjectSetup, Release, Snooze, TimeSeries, UptimeCheck,
};
use bertha_core::ids::ProjectId;
use bertha_core::random;
use bertha_core::time::{DAY, HOUR, IsoDate, Millis, floor_hour, parse_millis};
use serde::Deserialize;

use crate::auth::INVITE_TTL;
use crate::codec::{env_bit, env_mask, key_from_name, normalize_name, runtime_mask, short_seq, to_blob};
use crate::stored::StoredEvent;
use crate::writes::logs::NewLog;
use crate::writes::spans::{NewSpan, insert_span};
use crate::{Db, Error, Result};

/// The exported fixtures, for tests and `bertha seed --fixtures` without a file.
#[cfg(any(test, feature = "testing"))]
pub const FIXTURES: &str = include_str!("../seed/fixtures.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fixtures {
    pub now: IsoDate,
    pub members: Vec<Member>,
    pub projects: Vec<Project>,
    pub project_setups: Vec<ProjectSetup>,
    pub issues: Vec<Issue>,
    pub events: Vec<Event>,
    pub releases: Vec<Release>,
    pub monitors: Vec<Monitor>,
    pub monitor_history: HashMap<String, MonitorHistory>,
    pub alert_rules: Vec<AlertRule>,
    pub destinations: Vec<AlertDestination>,
    /// Invite token → the state it should be in ("pending", "expired" or "used").
    pub invites: BTreeMap<String, String>,
    /// Project id → its brief.
    #[serde(default)]
    pub briefs: BTreeMap<String, String>,
    /// The kept traces, each once.
    #[serde(default)]
    pub traces: Vec<EventTrace>,
    /// Log lines, oldest first.
    #[serde(default)]
    pub logs: Vec<LogLine>,
    /// Project id → what it keeps; the rest keep the default.
    #[serde(default)]
    pub log_settings: BTreeMap<String, ProjectLogSettings>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorHistory {
    pub checks: Vec<UptimeCheck>,
    pub incidents: Vec<Incident>,
    pub response_times: TimeSeries,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct SeedReport {
    pub projects: usize,
    pub issues: usize,
    pub hourly_rows: usize,
    pub checks: usize,
    pub log_lines: usize,
}

#[derive(Debug, Clone, Copy)]
pub struct SeedOptions {
    /// Also store the fixtures' invite links under their literal tokens ("valid",
    /// "expired", "used"), for trying the invite page locally. Never in production.
    pub dev_invite_tokens: bool,
}

impl Fixtures {
    pub fn parse(json: &str) -> Result<Fixtures> {
        Ok(serde_json::from_str(json)?)
    }
}

/// Shifts fixture times to the present.
#[derive(Clone, Copy)]
struct Shift {
    by: Millis,
    now: Millis,
}

impl Shift {
    fn ms(&self, d: &IsoDate) -> Result<Millis> {
        Ok(parse_millis(&d.0).ok_or_else(|| Error::Invalid(format!("bad date {:?}", d.0)))? + self.by)
    }

    fn iso(&self, d: &IsoDate) -> Result<IsoDate> {
        Ok(IsoDate::from_millis(self.ms(d)?))
    }

    fn opt(&self, d: &Option<IsoDate>) -> Result<Option<Millis>> {
        d.as_ref().map(|d| self.ms(d)).transpose()
    }

    fn snooze(&self, s: &Snooze) -> Result<Snooze> {
        Ok(match s {
            Snooze::Until { until } => Snooze::Until { until: self.iso(until)? },
            other => other.clone(),
        })
    }

    fn activity(&self, a: &Activity) -> Result<Activity> {
        use Activity::*;
        Ok(match a.clone() {
            FirstSeen { at, release } => FirstSeen { at: self.iso(&at)?, release },
            Regressed { at, release } => Regressed { at: self.iso(&at)?, release },
            Resolved { at, by, via } => Resolved { at: self.iso(&at)?, by, via },
            Ignored { at, by, via } => Ignored { at: self.iso(&at)?, by, via },
            Reopened { at, by, via } => Reopened { at: self.iso(&at)?, by, via },
            Snoozed { at, by, via, snooze } => Snoozed { at: self.iso(&at)?, by, via, snooze: self.snooze(&snooze)? },
            Unsnoozed { at, reason } => Unsnoozed { at: self.iso(&at)?, reason },
            Assigned { at, by, via, to } => Assigned { at: self.iso(&at)?, by, via, to },
            Note { at, by, via, body } => Note { at: self.iso(&at)?, by, via, body },
            Merged { at, by, via, from } => Merged { at: self.iso(&at)?, by, via, from },
            Labelled { at, by, via, added, removed } => Labelled { at: self.iso(&at)?, by, via, added, removed },
            FixShipped { at, by, via, triage_id, pr, commit, release } => {
                FixShipped { at: self.iso(&at)?, by, via, triage_id, pr, commit, release }
            }
        })
    }
}

fn activity_at(a: &Activity) -> &IsoDate {
    use Activity::*;
    match a {
        FirstSeen { at, .. }
        | Regressed { at, .. }
        | Resolved { at, .. }
        | Ignored { at, .. }
        | Reopened { at, .. }
        | Snoozed { at, .. }
        | Unsnoozed { at, .. }
        | Assigned { at, .. }
        | Note { at, .. }
        | Merged { at, .. }
        | Labelled { at, .. }
        | FixShipped { at, .. } => at,
    }
}

/// A small stable hash, so spreading counts gives the same result every time.
fn mix(s: &str, n: i64) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes().chain(n.to_le_bytes()) {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h ^ (h >> 29)
}

/// Fewer events at night (UTC), with some noise.
fn weight(key: &str, hour: Millis) -> f64 {
    let hod = (hour.rem_euclid(DAY) / HOUR) as u32;
    let base = if hod < 6 {
        0.35
    } else if (9..=18).contains(&hod) {
        1.2
    } else {
        0.8
    };
    base * (0.6 + (mix(key, hour) % 1000) as f64 / 1250.0)
}

/// Splits `total` over `hours` by weight, exactly (largest remainder).
fn spread(key: &str, total: i64, hours: &[Millis]) -> Vec<(Millis, i64)> {
    if total <= 0 || hours.is_empty() {
        return vec![];
    }
    let w: Vec<f64> = hours.iter().map(|h| weight(key, *h)).collect();
    let sum: f64 = w.iter().sum();
    let exact: Vec<f64> = w.iter().map(|x| x / sum * total as f64).collect();
    let mut out: Vec<i64> = exact.iter().map(|x| x.floor() as i64).collect();
    let mut left = total - out.iter().sum::<i64>();
    let mut order: Vec<usize> = (0..hours.len()).collect();
    order.sort_by(|a, b| (exact[*b] - exact[*b].floor()).total_cmp(&(exact[*a] - exact[*a].floor())));
    for i in order {
        if left == 0 {
            break;
        }
        out[i] += 1;
        left -= 1;
    }
    hours.iter().copied().zip(out).filter(|(_, c)| *c > 0).collect()
}

impl Db {
    /// Loads fixtures into an empty database.
    pub async fn seed(&self, fx: &Fixtures, opts: SeedOptions) -> Result<SeedReport> {
        let now = self.now();
        let base = parse_millis(&fx.now.0).ok_or_else(|| Error::Invalid("fixtures have no valid now".into()))?;
        let sh = Shift { by: now - base, now };
        let mut report = SeedReport::default();
        let mut tx = self.write.begin().await?;

        let existing = sqlx::query_scalar!(
            r#"SELECT (SELECT COUNT(*) FROM projects) + (SELECT COUNT(*) FROM members) AS "n!: i64""#
        )
        .fetch_one(&mut *tx)
        .await?;
        if existing > 0 {
            return Err(Error::Invalid("this database already has data; seed an empty one".into()));
        }

        // ── People ──
        for m in &fx.members {
            let all = matches!(m.project_ids, ProjectIds::All) as i64;
            let joined = sh.opt(&m.joined_at)?;
            // Someone still invited was added when the invitation went out; the team page
            // reads its age and expiry from that.
            let created = joined.or(sh.opt(&m.invited_at)?).unwrap_or(now - DAY);
            let invited_by = (m.role != bertha_core::domain::Role::Owner).then_some("m-owner");
            sqlx::query!(
                "INSERT INTO members (id, name, email, role, all_projects, invited_by, joined_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                m.id.0,
                m.name,
                m.email,
                m.role.as_str(),
                all,
                invited_by,
                joined,
                created
            )
            .execute(&mut *tx)
            .await?;
        }

        // ── Projects ──
        let setups: HashMap<&str, &ProjectSetup> =
            fx.project_setups.iter().map(|s| (s.project_id.0.as_str(), s)).collect();
        let mut alive_from: HashMap<&str, Millis> = HashMap::new();
        for (n, p) in fx.projects.iter().enumerate() {
            let setup = setups.get(p.id.0.as_str());
            let ingest_key = setup.map(|s| s.ingest_key.clone()).unwrap_or_else(|| random::secret("bk_"));
            let first = setup.map(|s| sh.opt(&s.first_event_at)).transpose()?.flatten();
            if let Some(f) = first {
                alive_from.insert(p.id.0.as_str(), f);
            }
            let next_seq = fx
                .issues
                .iter()
                .filter(|i| i.summary.project_id == p.id)
                .filter_map(|i| short_seq(&i.summary.short_id))
                .max()
                .unwrap_or(0)
                + 1;
            let key = if p.key.is_empty() { key_from_name(&p.name) } else { p.key.clone() };
            let created = now - 400 * DAY + n as Millis * 1000;
            let brief = fx.briefs.get(&p.id.0);
            sqlx::query!(
                "INSERT INTO projects (id, key, name, name_norm, client, url, repo_url, runtimes, environments,
                                       ingest_key, upload_key, first_event_at, last_event_at, next_short_seq,
                                       created_at, brief)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                p.id.0,
                key,
                p.name,
                normalize_name(&p.name),
                p.client,
                p.url,
                p.repo_url,
                runtime_mask(&p.runtimes),
                env_mask(&p.environments),
                ingest_key,
                random::secret("bu_"),
                first,
                sh.opt(&p.last_event_at)?,
                next_seq,
                created,
                brief
            )
            .execute(&mut *tx)
            .await?;
            report.projects += 1;
        }
        for m in &fx.members {
            if let ProjectIds::Some(ids) = &m.project_ids {
                for p in ids {
                    sqlx::query!("INSERT INTO member_projects (member_id, project_id) VALUES (?, ?)", m.id.0, p.0)
                        .execute(&mut *tx)
                        .await?;
                }
            }
        }

        // Projects are alive every hour from their first event on (the SDK heartbeat
        // does this for real), limited to the 60 days the charts can reach.
        let now_hour = floor_hour(now);
        for (project, from) in &alive_from {
            let mut h = floor_hour((*from).max(now - 60 * DAY));
            while h <= now_hour {
                sqlx::query!("INSERT INTO project_hours (project_id, hour) VALUES (?, ?)", project, h)
                    .execute(&mut *tx)
                    .await?;
                h += HOUR;
            }
        }

        // ── Releases ──
        for r in &fx.releases {
            let at = sh.ms(&r.deployed_at)?;
            let (sha, msg, author) = match &r.commit {
                Some(c) => (Some(c.sha.as_str()), Some(c.message.as_str()), Some(c.author.as_str())),
                None => (None, None, None),
            };
            let source = r.source.as_str();
            sqlx::query!(
                "INSERT INTO releases (id, project_id, version, environment, deployed_at, commit_sha, commit_message,
                                       commit_author, source, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                r.id.0,
                r.project_id.0,
                r.version,
                env_bit(r.environment),
                at,
                sha,
                msg,
                author,
                source,
                at
            )
            .execute(&mut *tx)
            .await?;
        }

        // ── Issues ──
        for issue in &fx.issues {
            let s = &issue.summary;
            let seq = short_seq(&s.short_id).ok_or_else(|| Error::Invalid(format!("short id {}", s.short_id)))?;
            let first_seen = sh.ms(&s.first_seen)?;
            let last_seen = sh.ms(&s.last_seen)?.min(now);
            let activity: Vec<Activity> = issue.activity.iter().map(|a| sh.activity(a)).collect::<Result<_>>()?;
            let latest = |pick: fn(&Activity) -> bool| -> Option<Millis> {
                activity.iter().filter(|a| pick(a)).filter_map(|a| activity_at(a).millis()).max()
            };
            let regressed_at = if s.is_regression {
                Some(latest(|a| matches!(a, Activity::Regressed { .. })).unwrap_or(last_seen))
            } else {
                None
            };
            let resolved_at = match s.status {
                bertha_core::domain::IssueStatus::Resolved => {
                    Some(latest(|a| matches!(a, Activity::Resolved { .. })).unwrap_or(last_seen))
                }
                _ => None,
            };
            let (snooze_until, snooze_total, snooze_remaining) =
                match s.snooze.as_ref().map(|z| sh.snooze(z)).transpose()? {
                    Some(Snooze::Until { until }) => (until.millis(), None, None),
                    Some(Snooze::Events { total, remaining }) => (None, Some(total as i64), Some(remaining as i64)),
                    None => (None, None, None),
                };
            let fingerprint = random::hash(&format!("seed:{}", s.id.0))[..16].to_vec();
            let assignee = s.assignee.as_ref().map(|a| a.id.0.clone());
            sqlx::query!(
                "INSERT INTO issues (id, project_id, short_seq, short_id, fingerprint, type, message, culprit, level, status,
                                     snooze_until, snooze_total, snooze_remaining, assignee_id, first_seen, last_seen,
                                     event_count, user_count, environments, first_release, regressed_in, regressed_at,
                                     resolved_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                s.id.0,
                s.project_id.0,
                seq,
                s.short_id,
                fingerprint,
                s.r#type,
                s.message,
                s.culprit,
                s.level.as_str(),
                s.status.as_str(),
                snooze_until,
                snooze_total,
                snooze_remaining,
                assignee,
                first_seen,
                last_seen,
                s.event_count,
                s.user_count,
                env_mask(&s.environments),
                issue.first_release,
                issue.regressed_in,
                regressed_at,
                resolved_at
            )
            .execute(&mut *tx)
            .await?;

            // Daily trend → hourly rollups, only in hours the issue existed.
            let trend_start = sh.ms(&s.trend.start)?;
            let step = if s.trend.bucket == bertha_core::domain::Bucket::Day { DAY } else { HOUR };
            for (i, c) in s.trend.counts.iter().enumerate() {
                let Some(c) = c else { continue };
                let from = floor_hour(trend_start + i as Millis * step);
                let hours: Vec<Millis> = (0..step / HOUR)
                    .map(|k| from + k * HOUR)
                    .filter(|h| *h + HOUR > first_seen && *h <= floor_hour(last_seen) && *h <= now_hour)
                    .collect();
                for (h, n) in spread(&s.id.0, *c as i64, &hours) {
                    sqlx::query!(
                        "INSERT INTO issue_hourly (issue_id, hour, count) VALUES (?, ?, ?)
                         ON CONFLICT (issue_id, hour) DO UPDATE SET count = count + excluded.count",
                        s.id.0,
                        h,
                        n
                    )
                    .execute(&mut *tx)
                    .await?;
                    report.hourly_rows += 1;
                }
            }

            for t in &issue.tags {
                sqlx::query!(
                    "INSERT INTO issue_tag_keys (issue_id, key, distinct_count) VALUES (?, ?, ?)",
                    s.id.0,
                    t.key.as_str(),
                    t.distinct
                )
                .execute(&mut *tx)
                .await?;
                for v in &t.values {
                    sqlx::query!(
                        "INSERT INTO issue_tags (issue_id, key, value, count) VALUES (?, ?, ?, ?)",
                        s.id.0,
                        t.key.as_str(),
                        v.value,
                        v.count
                    )
                    .execute(&mut *tx)
                    .await?;
                }
            }

            for l in &s.labels {
                sqlx::query!("INSERT INTO issue_labels (issue_id, label) VALUES (?, ?)", s.id.0, l)
                    .execute(&mut *tx)
                    .await?;
            }
            for t in &issue.triages {
                let outcome = t.outcome.map(|o| o.as_str());
                let (started, updated) = (sh.ms(&t.started_at)?.min(now), sh.ms(&t.updated_at)?.min(now));
                let w = t.watch.as_ref();
                let fix_pr = w.and_then(|w| w.pr).map(i64::from);
                let fix_commit = w.and_then(|w| w.commit.clone());
                let fix_state = w.map(|w| w.state.as_str());
                let fix_release = w.and_then(|w| w.release.clone());
                let fix_problem = w.and_then(|w| w.problem.clone());
                // A merged PR: the fix waits for releases after the triage ended.
                let merged_at = w.filter(|w| w.pr.is_some() && w.commit.is_some()).map(|_| updated);
                sqlx::query!(
                    "INSERT INTO triages (id, issue_id, member_id, member_name, member_email, via, started_at,
                                          updated_at, outcome, found, tried, fix, release, fix_pr, fix_commit,
                                          fix_state, fix_release, fix_problem, fix_merged_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    t.id.0,
                    s.id.0,
                    t.by.id.0,
                    t.by.name,
                    t.by.email,
                    t.via,
                    started,
                    updated,
                    outcome,
                    t.found,
                    t.tried,
                    t.fix,
                    t.release,
                    fix_pr,
                    fix_commit,
                    fix_state,
                    fix_release,
                    fix_problem,
                    merged_at
                )
                .execute(&mut *tx)
                .await?;
            }

            // Oldest first, so ids grow with time.
            let mut ordered = activity.clone();
            ordered.sort_by_key(|a| activity_at(a).millis());
            for a in &ordered {
                let at = activity_at(a).millis().unwrap_or(first_seen);
                let data = serde_json::to_string(a)?;
                sqlx::query!("INSERT INTO activity (issue_id, at, data) VALUES (?, ?, ?)", s.id.0, at, data)
                    .execute(&mut *tx)
                    .await?;
            }
            report.issues += 1;
        }

        // ── Events ──
        for e in &fx.events {
            let mut e = e.clone();
            let at = sh.ms(&e.received_at)?.min(now);
            for b in &mut e.breadcrumbs {
                b.at = sh.iso(&b.at)?;
            }
            let (id, issue_id, stored) = StoredEvent::from_event(e);
            let trace_id = stored.trace.as_ref().map(|t| t.trace_id.clone());
            let payload = to_blob(&stored)?;
            sqlx::query!(
                "INSERT INTO events (id, issue_id, received_at, trace_id, payload) VALUES (?, ?, ?, ?, ?)",
                id.0,
                issue_id.0,
                at,
                trace_id,
                payload
            )
            .execute(&mut *tx)
            .await?;
        }

        // ── Traces ── Spans a viewer can't see are only in the fixtures' blanked copies.
        for t in &fx.traces {
            let start_us = sh.ms(&t.started_at)? * 1000;
            for s in &t.spans {
                let Some(project) = &s.project_id else { continue };
                let span = NewSpan {
                    trace_id: t.trace_id.clone(),
                    span_id: s.id.clone(),
                    parent_id: s.parent_id.clone(),
                    service: s.service.clone(),
                    runtime: s.runtime,
                    name: s.name.clone(),
                    kind: s.kind,
                    start_us: start_us + (s.start_ms * 1000.0) as i64,
                    duration_us: (s.duration_ms * 1000.0) as i64,
                    status: s.status,
                    status_message: s.status_message.clone(),
                    attributes: s.attributes.clone(),
                };
                insert_span(&mut tx, project, &span, now).await?;
            }
        }

        // ── Monitors ──
        for m in &fx.monitors {
            let history = fx.monitor_history.get(&m.id.0);
            let interval = m.interval_seconds as i64;
            let paused = (m.state == MonitorState::Paused) as i64;
            let failures = if m.state == MonitorState::Down { 2_i64 } else { 0 };
            let since = sh.ms(&m.since)?;
            let next = now + interval * 1000;
            sqlx::query!(
                "INSERT INTO monitors (id, project_id, name, url, interval_seconds, paused, state, since,
                                       latest_response_ms, consecutive_failures, next_check_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                m.id.0,
                m.project_id.0,
                m.name,
                m.url,
                interval,
                paused,
                m.state.as_str(),
                since,
                m.latest_response_ms,
                failures,
                next,
                since
            )
            .execute(&mut *tx)
            .await?;
            report.checks += self.seed_checks(&mut tx, m, history, sh).await?;
            if let Some(h) = history {
                for inc in &h.incidents {
                    sqlx::query!(
                        "INSERT INTO incidents (id, monitor_id, started_at, resolved_at, cause, failed_checks)
                         VALUES (?, ?, ?, ?, ?, ?)",
                        inc.id.0,
                        m.id.0,
                        sh.ms(&inc.started_at)?,
                        sh.opt(&inc.resolved_at)?,
                        inc.cause,
                        inc.failed_checks
                    )
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }

        // ── Alerts ──
        for (n, d) in fx.destinations.iter().enumerate() {
            let created = now - 300 * DAY + n as Millis * 1000;
            let (kind, address, label, url) = match d {
                AlertDestination::Email { address, .. } => ("email", Some(address.as_str()), None, None),
                AlertDestination::Webhook { label, url, .. } => {
                    ("webhook", None, Some(label.as_str()), Some(url.as_str()))
                }
            };
            sqlx::query!(
                "INSERT INTO alert_destinations (id, kind, address, label, url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                d.id().0,
                kind,
                address,
                label,
                url,
                created
            )
            .execute(&mut *tx)
            .await?;
        }
        for (n, r) in fx.alert_rules.iter().enumerate() {
            let created = now - 300 * DAY + n as Millis * 1000;
            let project_ids = serde_json::to_string(&r.project_ids)?;
            let triggers = serde_json::to_string(&r.triggers)?;
            let destination_ids = serde_json::to_string(&r.destination_ids)?;
            let (se, sm) = r.spike.as_ref().map(|s| (s.events as i64, s.within_minutes as i64)).unzip();
            let log_match = r.log_match.as_ref().map(serde_json::to_string).transpose()?;
            sqlx::query!(
                "INSERT INTO alert_rules (id, name, project_ids, environments, triggers, spike_events, spike_minutes,
                                          log_match, destination_ids, enabled, last_fired_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                r.id.0,
                r.name,
                project_ids,
                env_mask(&r.environments),
                triggers,
                se,
                sm,
                log_match,
                destination_ids,
                r.enabled,
                sh.opt(&r.last_fired_at)?,
                created
            )
            .execute(&mut *tx)
            .await?;
        }

        // ── Invite links ──
        if opts.dev_invite_tokens {
            let pending = fx.members.iter().find(|m| m.joined_at.is_none());
            if let Some(m) = pending {
                let member = m.id.0.clone();
                let sent = sh.opt(&m.invited_at)?.unwrap_or(now);
                for (token, state) in &fx.invites {
                    let (created, expires, used) = match state.as_str() {
                        "expired" => (now - DAY - INVITE_TTL, now - DAY, None),
                        "used" => (sent, sent + INVITE_TTL, Some(now - HOUR)),
                        _ => (sent, sent + INVITE_TTL, None),
                    };
                    let hash = random::hash(token);
                    sqlx::query!(
                        "INSERT INTO tokens (hash, kind, member_id, next_path, expires_at, used_at, created_at)
                         VALUES (?, 'invite', ?, NULL, ?, ?, ?)",
                        hash,
                        member,
                        expires,
                        used,
                        created
                    )
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }

        for (project, kept) in &fx.log_settings {
            let (level, days) = (kept.min_level.as_str(), i64::from(kept.retention_days));
            sqlx::query!(
                "UPDATE projects SET log_min_level = ?, log_retention_days = ? WHERE id = ?",
                level,
                days,
                project
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        // ── Logs ── In their own file, so after the rest is in.
        let mut lines: BTreeMap<&str, Vec<NewLog>> = BTreeMap::new();
        for l in &fx.logs {
            lines.entry(l.project_id.0.as_str()).or_default().push(NewLog {
                at: sh.ms(&l.at)?.min(now),
                level: l.level,
                message: l.message.clone(),
                fields: l.fields.clone(),
                service: l.service.clone(),
                release: l.release.clone(),
                environment: l.environment,
                trace_id: l.trace_id.clone(),
                span_id: l.span_id.clone(),
                event_ref: l.event.as_ref().map(|e| e.event_id.0.clone()),
            });
        }
        for (project, lines) in lines {
            report.log_lines += self.save_logs(&ProjectId(project.to_owned()), &lines).await? as usize;
        }
        Ok(report)
    }

    /// Rebuilds a monitor's checks: the detailed recent ones, the strip of recent
    /// results, and hourly summaries back 30 days that add up to its uptime.
    async fn seed_checks(
        &self,
        tx: &mut sqlx::SqliteConnection,
        m: &Monitor,
        history: Option<&MonitorHistory>,
        sh: Shift,
    ) -> Result<usize> {
        let interval = m.interval_seconds as i64 * 1000;
        let region =
            history.and_then(|h| h.checks.first()).map(|c| c.region.clone()).unwrap_or_else(|| "Frankfurt".into());
        let typical = m.latest_response_ms.unwrap_or(200) as i64;
        let mut rows: BTreeMap<Millis, CheckRow> = BTreeMap::new();

        let response_at = |at: Millis| -> i64 {
            history
                .and_then(|h| {
                    let start = sh.ms(&h.response_times.start).ok()?;
                    let i = (at - start).div_euclid(HOUR);
                    h.response_times.counts.get(usize::try_from(i).ok()?).copied().flatten()
                })
                .map(|v| v as i64)
                .unwrap_or(typical)
        };

        let mut newest = floor_hour(sh.now) + (sh.now - floor_hour(sh.now)) / interval * interval;
        if let Some(h) = history {
            for c in &h.checks {
                let at = sh.ms(&c.at)?.min(sh.now);
                newest = newest.max(at);
                let degraded = c.ok && c.response_ms.is_some_and(|ms| ms as i64 > 2 * typical.max(400));
                rows.insert(
                    at,
                    CheckRow {
                        ok: c.ok,
                        degraded,
                        status: c.http_status.map(i64::from),
                        ms: c.response_ms.map(i64::from),
                        error: c.error.clone(),
                        region: c.region.clone(),
                        samples: 1,
                    },
                );
            }
        }
        let len = m.recent.len() as i64;
        for (j, state) in m.recent.iter().enumerate() {
            let Some(state) = state else { continue };
            let at = newest - (len - 1 - j as i64) * interval;
            if rows.contains_key(&at) {
                continue;
            }
            let ms = response_at(at);
            let row = match state {
                MonitorState::Down => CheckRow::failed(TIMED_OUT, &region, 1),
                MonitorState::Degraded => {
                    CheckRow { degraded: true, ..CheckRow::passed(ms.max(2 * typical), &region, 1) }
                }
                _ => CheckRow::passed(ms, &region, 1),
            };
            rows.insert(at, row);
        }

        // Older history, one row per hour standing for that hour's checks.
        let earliest = rows.keys().next().copied().unwrap_or(sh.now);
        let per_hour = (HOUR / interval).max(1);
        // The first whole hour inside the 30-day uptime window.
        let start = floor_hour(sh.now - 30 * DAY) + HOUR;
        let mut h = start;
        let mut good = 0_i64;
        while h + HOUR <= floor_hour(earliest) {
            rows.insert(h, CheckRow::passed(response_at(h), &region, per_hour));
            good += per_hour;
            h += HOUR;
        }
        let recent_ok: i64 = rows.values().filter(|r| r.ok && r.samples == 1).count() as i64;
        let recent_bad: i64 = rows.values().filter(|r| !r.ok).count() as i64;
        let total = good + recent_ok + recent_bad;
        let want_bad = ((1.0 - m.uptime30d / 100.0) * total as f64).round() as i64;
        let mut missing = (want_bad - recent_bad).max(0);
        // Put the failures where incidents were, then anywhere left.
        if let Some(hist) = history {
            for inc in &hist.incidents {
                let at = sh.ms(&inc.started_at)? + 1000;
                if missing == 0 || at >= earliest || at < start {
                    continue;
                }
                let n = (inc.failed_checks as i64).min(missing);
                rows.insert(at, CheckRow::failed(&inc.cause, &region, n));
                missing -= n;
            }
        }
        if missing > 0 && earliest > start + HOUR {
            rows.insert(start + 1000, CheckRow::failed(TIMED_OUT, &region, missing));
        }

        let n = rows.len();
        for (at, CheckRow { ok, degraded, status, ms, error, region, samples }) in rows {
            sqlx::query!(
                "INSERT INTO checks (monitor_id, at, ok, degraded, http_status, response_ms, error, region, samples)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                m.id.0,
                at,
                ok,
                degraded,
                status,
                ms,
                error,
                region,
                samples
            )
            .execute(&mut *tx)
            .await?;
        }
        Ok(n)
    }
}

const TIMED_OUT: &str = "Timed out after 10s";

/// One `checks` row; `samples` > 1 stands for that many checks at once.
struct CheckRow {
    ok: bool,
    degraded: bool,
    status: Option<i64>,
    ms: Option<i64>,
    error: Option<String>,
    region: String,
    samples: i64,
}

impl CheckRow {
    fn passed(ms: i64, region: &str, samples: i64) -> Self {
        CheckRow {
            ok: true,
            degraded: false,
            status: Some(200),
            ms: Some(ms),
            error: None,
            region: region.into(),
            samples,
        }
    }

    fn failed(error: &str, region: &str, samples: i64) -> Self {
        CheckRow {
            ok: false,
            degraded: false,
            status: None,
            ms: None,
            error: Some(error.into()),
            region: region.into(),
            samples,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spreading_keeps_the_total() {
        let hours: Vec<Millis> = (0..24).map(|h| h * HOUR).collect();
        let s = spread("i-x", 1000, &hours);
        assert_eq!(s.iter().map(|(_, c)| c).sum::<i64>(), 1000);
        assert!(s.iter().all(|(h, _)| hours.contains(h)));
        assert_eq!(spread("i-x", 1000, &hours), s, "stable");
        assert!(spread("i-x", 5, &[]).is_empty());
    }
}
