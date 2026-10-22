//! `GET /api/v1/live`: server-sent events telling open pages what changed.
//!
//! One broadcast channel for the whole process; each stream filters it down to the
//! viewer's projects. Streams re-check their session every minute, so removing a
//! member or signing out ends theirs, and they all end when bertha shuts down.

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::sse::{Event, Sse};
use bertha_core::ids::ProjectId;
use bertha_core::live::LiveEvent;
use bertha_db::{Db, Viewer};
use futures_util::Stream;
use futures_util::stream::unfold;
use tokio::sync::{broadcast, watch};
use tokio::time::{Instant, Interval, MissedTickBehavior, interval};

use crate::app::AppState;
use crate::session::{Session, session_token};

/// Events buffered per stream before it falls behind and gets a `resync`.
const BUFFER: usize = 256;
/// A comment this often keeps proxies from closing an idle stream.
const KEEPALIVE: Duration = Duration::from_secs(15);
/// Every this many keepalives, the session is checked again.
const RECHECK_EVERY: u32 = 4;
/// A project's `logs` event goes out at most this often; lines in between add up.
const LOGS_EVERY: Duration = Duration::from_secs(1);

#[derive(Clone)]
pub struct Live {
    tx: broadcast::Sender<Arc<LiveEvent>>,
    closed: Arc<watch::Sender<bool>>,
    logs: Arc<Mutex<HashMap<ProjectId, LogTally>>>,
}

/// Lines not yet told about, when the last `logs` event went, and whether one is due.
#[derive(Default)]
struct LogTally {
    lines: u32,
    sent: Option<Instant>,
    due: bool,
}

impl Default for Live {
    fn default() -> Self {
        Self::new()
    }
}

impl Live {
    pub fn new() -> Live {
        let (tx, _) = broadcast::channel(BUFFER);
        let (closed, _) = watch::channel(false);
        Live { tx, closed: Arc::new(closed), logs: Arc::default() }
    }

    /// Lines were stored in a project. Tells streams now, or once a second has passed
    /// since the last time, with everything that arrived in between.
    pub fn logs_arrived(&self, project: &ProjectId, lines: u32) {
        let now = Instant::now();
        let mut logs = self.logs.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let tally = logs.entry(project.clone()).or_default();
        tally.lines = tally.lines.saturating_add(lines);
        if tally.due {
            return;
        }
        let at = tally.sent.map_or(now, |s| s + LOGS_EVERY);
        if at <= now {
            let lines = std::mem::take(&mut tally.lines);
            tally.sent = Some(now);
            self.send(LiveEvent::Logs { project_id: project.clone(), lines });
            return;
        }
        tally.due = true;
        let (live, project) = (self.clone(), project.clone());
        tokio::spawn(async move {
            tokio::time::sleep_until(at).await;
            let lines = {
                let mut logs = live.logs.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
                let tally = logs.entry(project.clone()).or_default();
                tally.due = false;
                tally.sent = Some(Instant::now());
                std::mem::take(&mut tally.lines)
            };
            live.send(LiveEvent::Logs { project_id: project, lines });
        });
    }

    /// Tells every open stream. Nobody listening is fine.
    pub fn send(&self, event: LiveEvent) {
        let _ = self.tx.send(Arc::new(event));
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Arc<LiveEvent>> {
        self.tx.subscribe()
    }

    /// Ends every stream, so a graceful shutdown doesn't wait on them forever.
    pub fn close(&self) {
        self.closed.send_replace(true);
    }
}

struct Stream_ {
    rx: broadcast::Receiver<Arc<LiveEvent>>,
    closed: watch::Receiver<bool>,
    tick: Interval,
    ticks: u32,
    db: Db,
    token: String,
    viewer: Viewer,
}

pub async fn stream(
    State(s): State<AppState>,
    Session(viewer): Session,
    headers: HeaderMap,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // `require_session` already checked the cookie; it's there.
    let token = session_token(&headers).unwrap_or_default();
    let mut tick = interval(KEEPALIVE);
    tick.set_missed_tick_behavior(MissedTickBehavior::Delay);
    tick.reset();
    let state = Stream_ {
        rx: s.live.subscribe(),
        closed: s.live.closed.subscribe(),
        tick,
        ticks: 0,
        db: s.db.clone(),
        token,
        viewer,
    };
    Sse::new(unfold(state, next))
}

async fn next(mut st: Stream_) -> Option<(Result<Event, Infallible>, Stream_)> {
    loop {
        if *st.closed.borrow() {
            return None;
        }
        tokio::select! {
            got = st.rx.recv() => match got {
                Ok(event) => {
                    // The owner sees every project, including one made after the stream opened.
                    if event.visible_to(|p| st.viewer.is_owner() || st.viewer.can_see(p)) {
                        return Some((Ok(as_sse(&event)), st));
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => return Some((Ok(as_sse(&LiveEvent::Resync)), st)),
                Err(broadcast::error::RecvError::Closed) => return None,
            },
            _ = st.tick.tick() => {
                st.ticks += 1;
                if st.ticks.is_multiple_of(RECHECK_EVERY) {
                    match st.db.viewer_for_session(&st.token).await {
                        // Access may have changed since the stream opened.
                        Ok(Some(v)) => st.viewer = v,
                        Ok(None) => return None,
                        Err(e) => {
                            tracing::warn!(error = %e, "live stream session check failed");
                            return None;
                        }
                    }
                }
                return Some((Ok(Event::default().comment("")), st));
            },
            _ = st.closed.changed() => return None,
        }
    }
}

fn as_sse(event: &LiveEvent) -> Event {
    // A LiveEvent always serialises; fall back to a resync rather than panic.
    Event::default().json_data(event).unwrap_or_else(|_| Event::default().data(r#"{"kind":"resync"}"#))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn logs_events_come_at_most_once_a_second() {
        let live = Live::new();
        let mut rx = live.subscribe();
        let p = ProjectId("p_harbour".into());
        live.logs_arrived(&p, 3);
        live.logs_arrived(&p, 4);
        live.logs_arrived(&p, 5);
        let lines = |e: Arc<LiveEvent>| match &*e {
            LiveEvent::Logs { lines, .. } => *lines,
            other => panic!("{other:?}"),
        };
        assert_eq!(lines(rx.recv().await.unwrap()), 3, "the first goes at once");
        assert!(rx.try_recv().is_err(), "the rest wait");
        let started = Instant::now();
        assert_eq!(lines(rx.recv().await.unwrap()), 9, "and then go together");
        assert!(started.elapsed() >= Duration::from_millis(900));
    }
}
