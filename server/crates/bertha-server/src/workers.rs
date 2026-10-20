//! Background work in the same process: checking monitors, delivering queued alerts,
//! following fixes and housekeeping. Each loop is one pass function on a timer, so tests can run a
//! pass against a fixed clock without waiting.

use std::collections::BTreeMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::time::Duration;

use bertha_core::domain::FixState;
use bertha_core::fixes::{GithubRepo, github_repo};
use bertha_core::ids::{IssueId, ProjectId};
use bertha_core::live::LiveEvent;
use bertha_core::time::{DAY, HOUR, MINUTE, Millis, SECOND};
use bertha_db::Db;
use bertha_db::writes::fixes::{Shipped, WatchedFix};
use bertha_db::writes::housekeeping::Swept;
use bertha_db::writes::outbox::Delivery;
use bertha_db::writes::uptime::{DueMonitor, Transition};
use futures_util::StreamExt;
use tokio::sync::watch;
use tokio::task::JoinHandle;

use crate::alerts::{Alerter, Notice, deliver};
use crate::github::{Forge, Unread};
use crate::live::Live;
use crate::mail::Mailer;
use crate::uptime::Checker;

/// How often the uptime loop looks for due monitors.
const UPTIME_TICK: Duration = Duration::from_secs(5);
/// Checks in flight at once. Each waits on the network, not the CPU.
const CHECKS_AT_ONCE: usize = 16;
/// Monitors taken per pass; the rest are still due on the next tick.
const CHECKS_PER_PASS: i64 = 200;
/// Longest a monitor's check drifts from its interval, to spread checks out.
const MAX_JITTER: Millis = 15 * SECOND;

/// Deliveries taken per pass, and the longest the outbox sleeps with nothing due.
const DELIVERIES_PER_PASS: i64 = 50;
const OUTBOX_IDLE: Millis = 30 * SECOND;
/// Waits before each retry; after the last, the delivery is given up on.
const RETRY_AFTER: [Millis; 5] = [30 * SECOND, 2 * MINUTE, 10 * MINUTE, 30 * MINUTE, 2 * HOUR];

/// How often fixes are looked up on GitHub. A new release wakes the loop sooner.
const FIXES_TICK: Duration = Duration::from_secs(5 * 60);
/// GitHub's and bertha's clocks can disagree: a release first seen this soon before the
/// merge is still checked.
const CLOCK_SKEW: Millis = 5 * MINUTE;

const HOUSEKEEPING_TICK: Duration = Duration::from_secs(10 * 60);
const VACUUM_EVERY: Millis = 7 * DAY;

/// Everything the workers need, cloned into each loop.
#[derive(Clone)]
pub struct Context {
    pub db: Db,
    pub checker: Checker,
    pub alerter: Alerter,
    pub mailer: Mailer,
    pub http: reqwest::Client,
    pub live: Live,
    /// Events, checks and source maps older than this are deleted.
    pub retention: Millis,
    /// Check every monitor this often instead of its own interval. Tests only.
    pub check_every: Option<Millis>,
    /// Where fixes are followed; `None` without a GitHub token.
    pub forge: Option<Forge>,
}

/// The running loops. [`Workers::stop`] lets each finish the pass it's in.
pub struct Workers {
    stop: watch::Sender<bool>,
    handles: Vec<JoinHandle<()>>,
}

impl Workers {
    pub fn start(ctx: Context) -> Workers {
        let (stop, rx) = watch::channel(false);
        let handles = vec![
            tokio::spawn(uptime_loop(ctx.clone(), rx.clone())),
            tokio::spawn(outbox_loop(ctx.clone(), rx.clone())),
            tokio::spawn(fixes_loop(ctx.clone(), rx.clone())),
            tokio::spawn(housekeeping_loop(ctx, rx)),
        ];
        Workers { stop, handles }
    }

    pub async fn stop(self) {
        let _ = self.stop.send(true);
        for h in self.handles {
            if let Err(e) = h.await {
                tracing::error!(error = %e, "a worker panicked");
            }
        }
    }
}

/// Sleeps for `d`, or returns false at once when asked to stop.
async fn sleep_or_stop(d: Duration, stop: &mut watch::Receiver<bool>) -> bool {
    if *stop.borrow() {
        return false;
    }
    tokio::select! {
        () = tokio::time::sleep(d) => true,
        _ = stop.changed() => false,
    }
}

async fn uptime_loop(ctx: Context, mut stop: watch::Receiver<bool>) {
    loop {
        if let Some(every) = ctx.check_every
            && let Err(e) = ctx.db.pull_checks_forward(every).await
        {
            tracing::error!(error = ?e, "pulling checks forward failed");
        }
        match check_due(&ctx).await {
            Ok(n) if n > 0 => tracing::debug!(checks = n, "uptime pass"),
            Ok(_) => {}
            Err(e) => tracing::error!(error = ?e, "uptime pass failed"),
        }
        let tick = match ctx.check_every {
            Some(every) => UPTIME_TICK.min(Duration::from_millis(every as u64)),
            None => UPTIME_TICK,
        };
        if !sleep_or_stop(tick, &mut stop).await {
            break;
        }
    }
    tracing::debug!("uptime worker stopped");
}

/// Checks every monitor that's due, a few at a time. Transitions go to open pages and
/// to the alert rules. Returns how many checks ran.
pub async fn check_due(ctx: &Context) -> anyhow::Result<usize> {
    let due = ctx.db.due_monitors(CHECKS_PER_PASS).await?;
    let n = due.len();
    futures_util::stream::iter(due)
        .for_each_concurrent(CHECKS_AT_ONCE, |m| async move {
            if let Err(e) = check_one(ctx, &m).await {
                tracing::error!(error = ?e, monitor = %m.id, "recording a check failed");
            }
        })
        .await;
    Ok(n)
}

async fn check_one(ctx: &Context, m: &DueMonitor) -> anyhow::Result<()> {
    let at = ctx.db.now();
    let result = ctx.checker.check(&m.url, at).await;
    // Timed from the check's start, so a slow site doesn't push its own schedule back.
    let next = match ctx.check_every {
        Some(every) => at + every,
        None => at + m.interval + jitter(m),
    };
    if let Some(t) = ctx.db.record_check(&m.id, &m.url, &result, next).await? {
        changed(&ctx.live, &ctx.alerter, &t).await;
    }
    Ok(())
}

/// A monitor moved: open pages hear it, and the alert rules decide who else does.
pub async fn changed(live: &Live, alerter: &Alerter, t: &Transition) {
    tracing::info!(monitor = %t.monitor_id, from = t.from.as_str(), to = t.to.as_str(), "monitor changed state");
    live.send(LiveEvent::Monitor { project_id: t.project_id.clone(), monitor_id: t.monitor_id.clone(), state: t.to });
    alerter.monitor(t).await;
}

/// The same small offset for a monitor every time, so monitors added together don't
/// all check in the same second, and one monitor's checks stay evenly spaced.
fn jitter(m: &DueMonitor) -> Millis {
    let span = (m.interval / 10).min(MAX_JITTER);
    if span <= 0 {
        return 0;
    }
    let mut h = DefaultHasher::new();
    m.id.as_str().hash(&mut h);
    (h.finish() % span as u64) as Millis
}

async fn outbox_loop(ctx: Context, mut stop: watch::Receiver<bool>) {
    loop {
        if let Err(e) = deliver_due(&ctx).await {
            tracing::error!(error = ?e, "outbox pass failed");
        }
        let wait = match ctx.db.next_delivery_at().await {
            Ok(Some(at)) => (at - ctx.db.now()).clamp(0, OUTBOX_IDLE),
            Ok(None) => OUTBOX_IDLE,
            Err(e) => {
                tracing::error!(error = ?e, "reading the outbox failed");
                OUTBOX_IDLE
            }
        };
        if *stop.borrow() {
            break;
        }
        tokio::select! {
            () = tokio::time::sleep(Duration::from_millis(wait as u64)) => {}
            () = ctx.alerter.queued() => {}
            _ = stop.changed() => break,
        }
    }
    tracing::debug!("outbox worker stopped");
}

/// Sends every delivery that's due. A failure waits longer each time, then gives up.
/// Returns how many went out.
pub async fn deliver_due(ctx: &Context) -> anyhow::Result<usize> {
    let mut sent = 0;
    loop {
        let due = ctx.db.due_deliveries(DELIVERIES_PER_PASS).await?;
        let full = due.len() as i64 == DELIVERIES_PER_PASS;
        for d in due {
            if send_one(ctx, &d).await? {
                sent += 1;
            }
        }
        if !full {
            return Ok(sent);
        }
    }
}

async fn send_one(ctx: &Context, d: &Delivery) -> anyhow::Result<bool> {
    let notice: Notice = match serde_json::from_str(&d.alert) {
        Ok(n) => n,
        Err(e) => {
            ctx.db.delivery_failed(d.id, &format!("Unreadable alert: {e}"), None).await?;
            return Ok(false);
        }
    };
    match deliver(&d.destination, &notice, &ctx.mailer, &ctx.http).await {
        Ok(()) => {
            ctx.db.delivery_sent(d.id).await?;
            Ok(true)
        }
        Err(why) => {
            let retry_at = RETRY_AFTER.get(d.attempts as usize).map(|wait| ctx.db.now() + wait);
            if retry_at.is_none() {
                tracing::warn!(delivery = d.id, error = %why, "alert given up on");
            } else {
                tracing::info!(delivery = d.id, error = %why, "alert delivery failed; will retry");
            }
            ctx.db.delivery_failed(d.id, &why.0, retry_at).await?;
            Ok(false)
        }
    }
}

async fn fixes_loop(ctx: Context, mut stop: watch::Receiver<bool>) {
    if ctx.forge.is_none() {
        return;
    }
    let tick = match ctx.check_every {
        Some(every) => Duration::from_millis(every as u64),
        None => FIXES_TICK,
    };
    loop {
        match follow_fixes(&ctx).await {
            Ok(n) if n > 0 => tracing::info!(shipped = n, "fixes pass"),
            Ok(_) => {}
            Err(e) => tracing::error!(error = ?e, "fixes pass failed"),
        }
        if *stop.borrow() {
            break;
        }
        tokio::select! {
            () = tokio::time::sleep(tick) => {}
            () = ctx.db.new_release() => {}
            _ = stop.changed() => break,
        }
    }
    tracing::debug!("fixes worker stopped");
}

/// Looks up every fix waiting to merge or ship. A fix found in a release resolves its
/// issue, and open pages hear it. Returns how many shipped.
pub async fn follow_fixes(ctx: &Context) -> anyhow::Result<usize> {
    let Some(forge) = &ctx.forge else { return Ok(0) };
    let mut shipped = 0;
    for fix in ctx.db.watched_fixes().await? {
        let Some(repo) = github_repo(&fix.repo_url) else { continue };
        match follow(ctx, forge, &repo, fix.clone()).await {
            Ok(Some(s)) => {
                shipped += 1;
                ctx.live.send(LiveEvent::IssuesChanged { project_id: s.project_id, issue_ids: vec![s.issue_id] });
            }
            Ok(None) => {}
            Err(Unread::Problem(p)) => {
                tracing::warn!(triage = fix.triage_id, problem = p, "can't follow a fix");
                ctx.db.fix_problem(&fix.triage_id, Some(&p)).await?;
            }
            Err(Unread::Later(why)) => tracing::info!(triage = fix.triage_id, why, "fix lookup will retry"),
        }
    }
    Ok(shipped)
}

async fn follow(
    ctx: &Context,
    forge: &Forge,
    repo: &GithubRepo,
    mut fix: WatchedFix,
) -> Result<Option<Shipped>, Unread> {
    let db = |e: bertha_db::Error| Unread::Later(format!("the database failed: {e}"));
    if fix.state == FixState::WaitingMerge {
        let Some(pr) = fix.pr else { return Ok(None) };
        let pull = forge.pull(repo, pr).await?;
        match pull.merged {
            Some((sha, at)) => {
                let since = at - CLOCK_SKEW;
                ctx.db.fix_merged(&fix.triage_id, &sha, since).await.map_err(db)?;
                fix = WatchedFix {
                    state: FixState::WaitingRelease,
                    commit: Some(sha),
                    since,
                    bare: false,
                    checked_to: None,
                    ..fix
                };
            }
            None if pull.closed => {
                ctx.db.fix_closed(&fix.triage_id).await.map_err(db)?;
                return Ok(None);
            }
            None => {
                ctx.db.fix_problem(&fix.triage_id, None).await.map_err(db)?;
                return Ok(None);
            }
        }
    }
    let Some(commit) = fix.commit.clone() else { return Ok(None) };
    for release in ctx.db.fix_candidates(&fix).await.map_err(db)? {
        let same = release.commit.starts_with(&commit) || commit.starts_with(&release.commit);
        let has = same
            || match forge.contains(repo, &commit, &release.commit).await {
                Ok(has) => has,
                // A release whose commit GitHub doesn't know (a rebuilt slug, a fork)
                // can't be compared; the next one may be.
                Err(Unread::Problem(p)) if p.contains(" 404 ") => false,
                Err(e) => return Err(e),
            };
        if has {
            return ctx.db.fix_seen_shipping(&fix.triage_id, &release).await.map_err(db);
        }
        ctx.db.fix_checked(&fix.triage_id, release.first_seen).await.map_err(db)?;
    }
    Ok(None)
}

async fn housekeeping_loop(ctx: Context, mut stop: watch::Receiver<bool>) {
    // The first pass waits a minute, so a restart loop doesn't sweep on every start.
    if !sleep_or_stop(Duration::from_secs(60), &mut stop).await {
        return;
    }
    let mut vacuumed = ctx.db.now();
    loop {
        let vacuum = ctx.db.now() - vacuumed >= VACUUM_EVERY;
        match housekeep(&ctx, vacuum).await {
            Ok(swept) => {
                tracing::info!(?swept, vacuum, "housekeeping pass");
                if vacuum {
                    vacuumed = ctx.db.now();
                }
            }
            Err(e) => tracing::error!(error = ?e, "housekeeping pass failed"),
        }
        if !sleep_or_stop(HOUSEKEEPING_TICK, &mut stop).await {
            break;
        }
    }
    tracing::debug!("housekeeping worker stopped");
}

/// Lifts snoozes whose date passed, deletes what's past keeping, and lets SQLite tidy
/// up. Pages showing a lifted issue hear about it.
pub async fn housekeep(ctx: &Context, vacuum: bool) -> anyhow::Result<Swept> {
    let lifted = ctx.db.lift_expired_snoozes().await?;
    let mut by_project: BTreeMap<ProjectId, Vec<IssueId>> = BTreeMap::new();
    for (project, issue) in lifted {
        by_project.entry(project).or_default().push(issue);
    }
    for (project_id, issue_ids) in by_project {
        ctx.live.send(LiveEvent::IssuesChanged { project_id, issue_ids });
    }
    let swept = ctx.db.sweep(ctx.retention).await?;
    ctx.db.optimize().await?;
    if vacuum {
        ctx.db.vacuum().await?;
    }
    Ok(swept)
}

#[cfg(test)]
mod tests {
    use bertha_core::ids::MonitorId;

    use super::*;

    #[test]
    fn jitter_is_stable_and_bounded() {
        let m = |id: &str, interval| DueMonitor { id: MonitorId(id.into()), url: String::new(), interval };
        let a = jitter(&m("m-a", 60 * SECOND));
        assert_eq!(a, jitter(&m("m-a", 60 * SECOND)));
        assert!((0..6 * SECOND).contains(&a));
        assert!((0..MAX_JITTER).contains(&jitter(&m("m-b", 900 * SECOND))));
        assert_eq!(jitter(&m("m-c", 0)), 0);
    }
}
