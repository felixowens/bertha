//! `GET /api/v1/live`: server-sent events telling open pages what changed.
//!
//! One broadcast channel for the whole process; each stream filters it down to the
//! viewer's projects. Streams re-check their session every minute, so removing a
//! member or signing out ends theirs, and they all end when bertha shuts down.

use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::sse::{Event, Sse};
use bertha_core::live::LiveEvent;
use bertha_db::{Db, Viewer};
use futures_util::Stream;
use futures_util::stream::unfold;
use tokio::sync::{broadcast, watch};
use tokio::time::{Interval, MissedTickBehavior, interval};

use crate::app::AppState;
use crate::session::{Session, session_token};

/// Events buffered per stream before it falls behind and gets a `resync`.
const BUFFER: usize = 256;
/// A comment this often keeps proxies from closing an idle stream.
const KEEPALIVE: Duration = Duration::from_secs(15);
/// Every this many keepalives, the session is checked again.
const RECHECK_EVERY: u32 = 4;

#[derive(Clone)]
pub struct Live {
    tx: broadcast::Sender<Arc<LiveEvent>>,
    closed: Arc<watch::Sender<bool>>,
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
        Live { tx, closed: Arc::new(closed) }
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
