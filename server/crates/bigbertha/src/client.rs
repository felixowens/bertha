// The client: enriches captures, queues them and sends them in batches from its own
// thread, so reporting needs no async runtime and works from a panic hook. It
// behaves like `@bigbertha/sdk`: a 1s debounce, batches of 100, at most 100 events a
// minute, a pause when bertha says to slow down, and three retries when it can't
// reach bertha.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, VecDeque};
use std::panic::AssertUnwindSafe;
use std::sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError, RwLock};
use std::thread;
use std::time::{Duration, Instant};

use crate::options::Options;
use crate::scope::Scope;
use crate::transport::{Outcome, Transport};
use crate::wire::{
    IngestBreadcrumb, IngestContext, IngestEvent, IngestHeartbeat, IngestLevel, IngestMechanism, IngestRequest,
    IngestSdk, IngestTrace, IngestUser,
};
use crate::{env, random, scrub, time};

pub(crate) const MAX_BREADCRUMBS: usize = 100;
pub(crate) const BATCH: usize = 100;
const DEBOUNCE: Duration = Duration::from_secs(1);
const PER_MINUTE: u32 = 100;
const RETRIES: u32 = 3;
const HEARTBEAT_EVERY: Duration = Duration::from_secs(20 * 60);
/// How long a report from a dying process (a panic, the guard dropping) may wait.
pub(crate) const EXIT_FLUSH: Duration = Duration::from_secs(2);

static HUB: RwLock<Option<Arc<Client>>> = RwLock::new(None);

thread_local! {
    /// Set while the SDK runs on this thread, so a panic inside it (in `before_send`,
    /// say) isn't reported through the SDK again.
    static BUSY: Cell<bool> = const { Cell::new(false) };
    /// What was captured here recently, so a log of an error already captured by hand
    /// isn't a second event.
    static RECENT: RefCell<VecDeque<(String, Instant)>> = const { RefCell::new(VecDeque::new()) };
}

pub(crate) fn hub() -> Option<Arc<Client>> {
    HUB.read().unwrap_or_else(PoisonError::into_inner).clone()
}

pub(crate) fn busy() -> bool {
    BUSY.with(Cell::get)
}

struct Busy(bool);

impl Busy {
    fn enter() -> Self {
        Self(BUSY.with(|b| b.replace(true)))
    }
}

impl Drop for Busy {
    fn drop(&mut self) {
        BUSY.with(|b| b.set(self.0));
    }
}

/// Whether an error with this message was captured on this thread in the last second.
#[cfg_attr(not(feature = "tracing"), allow(dead_code))]
pub(crate) fn recently_captured(message: &str) -> bool {
    RECENT.with(|r| r.borrow().iter().any(|(m, at)| m == message && at.elapsed() < Duration::from_secs(1)))
}

fn remember(message: &str) {
    RECENT.with(|r| {
        let mut r = r.borrow_mut();
        r.retain(|(_, at)| at.elapsed() < Duration::from_secs(1));
        if r.len() >= 16 {
            r.pop_front();
        }
        r.push_back((message.to_owned(), Instant::now()));
    });
}

/// How a capture differs from the defaults. Every field is optional.
#[derive(Debug, Clone, Default)]
pub struct Capture {
    pub(crate) level: Option<IngestLevel>,
    pub(crate) tags: BTreeMap<String, String>,
    pub(crate) fingerprint: Option<Vec<String>>,
    pub(crate) request: Option<IngestRequest>,
    pub(crate) status: Option<u32>,
    pub(crate) user: Option<IngestUser>,
    pub(crate) trace: Option<IngestTrace>,
    pub(crate) mechanism: Option<IngestMechanism>,
    pub(crate) message: Option<String>,
}

impl Capture {
    pub fn new() -> Self {
        Self::default()
    }

    /// `Error` for errors and `Warning` for messages unless set.
    pub fn level(mut self, level: IngestLevel) -> Self {
        self.level = Some(level);
        self
    }

    pub fn tag(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.tags.insert(key.into(), value.into());
        self
    }

    /// Groups the event by these values instead of by its stack and type.
    pub fn fingerprint<I: IntoIterator<Item = S>, S: Into<String>>(mut self, parts: I) -> Self {
        self.fingerprint = Some(parts.into_iter().map(Into::into).collect());
        self
    }

    /// The request it happened in, instead of the scope's.
    pub fn request(mut self, request: IngestRequest) -> Self {
        self.request = Some(request);
        self
    }

    /// The response status the request ended with.
    pub fn status(mut self, status: u16) -> Self {
        self.status = Some(u32::from(status));
        self
    }

    /// Merged over the global and scope user.
    pub fn user(mut self, user: IngestUser) -> Self {
        self.user = Some(user);
        self
    }

    pub fn trace(mut self, trace: IngestTrace) -> Self {
        self.trace = Some(trace);
        self
    }

    /// What reported it, and whether the app handled it.
    pub fn mechanism(mut self, handler: impl Into<String>, handled: bool) -> Self {
        self.mechanism = Some(IngestMechanism { handler: handler.into(), handled });
        self
    }

    /// The event's own message, beside the error's (a log line's text, say).
    pub fn message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }
}

pub(crate) struct Client {
    pub(crate) options: Options,
    sdk: IngestSdk,
    release: Option<String>,
    commit: Option<String>,
    context: IngestContext,
    transport: Transport,
    state: Mutex<State>,
    changed: Condvar,
}

#[derive(Default)]
struct State {
    queue: VecDeque<IngestEvent>,
    /// When the oldest queued event arrived, for the debounce.
    since: Option<Instant>,
    flush_now: bool,
    sending: bool,
    paused_until: Option<Instant>,
    closed: bool,
    warned: bool,
    crumbs: VecDeque<IngestBreadcrumb>,
    user: Option<IngestUser>,
    tags: BTreeMap<String, String>,
    window: Option<(Instant, u32)>,
    next_heartbeat: Option<Instant>,
}

impl Client {
    pub(crate) fn new(options: Options) -> Option<Arc<Client>> {
        let (Some(key), Some(url)) = (options.key.clone(), options.url.clone()) else {
            eprintln!("[bertha] Set BERTHA_KEY and BERTHA_URL (or pass key and url). Nothing will be sent.");
            return None;
        };
        let commit = options.commit.as_deref().map(str::trim).filter(|c| env::is_sha(c)).map(str::to_ascii_lowercase);
        let built = options.app.and_then(|a| a.release).map(str::trim).filter(|r| !r.is_empty());
        let release = (options.release.clone().or_else(|| built.map(str::to_owned)))
            .or_else(|| commit.clone())
            .or_else(|| options.app.map(|a| a.version.to_owned()));
        let rustc = env!("BIGBERTHA_RUSTC");
        let mut versions = BTreeMap::new();
        if !rustc.is_empty() {
            versions.insert("rust".to_owned(), rustc.to_owned());
        }
        versions.extend(options.versions.clone());
        let context = IngestContext {
            runtime: Some(if rustc.is_empty() { "Rust".to_owned() } else { format!("Rust {rustc}") }),
            os: Some(format!("{} {}", std::env::consts::OS, std::env::consts::ARCH)),
            host: env::var("DYNO").or_else(|| hostname::get().ok().and_then(|h| h.into_string().ok())),
            versions: Some(versions),
            ..IngestContext::default()
        };
        let state = State {
            tags: options.tags.clone(),
            next_heartbeat: options.heartbeat.then(Instant::now),
            ..State::default()
        };
        let client = Arc::new(Client {
            sdk: IngestSdk { name: "bertha.rust".to_owned(), version: crate::VERSION.to_owned() },
            release,
            commit,
            context,
            transport: Transport::new(&url, &key),
            state: Mutex::new(state),
            changed: Condvar::new(),
            options,
        });
        let sender = Arc::clone(&client);
        let spawned = thread::Builder::new().name("bertha".to_owned()).spawn(move || sender.run());
        if spawned.is_err() {
            eprintln!("[bertha] Couldn't start the thread that sends reports. Nothing will be sent.");
            return None;
        }
        Some(client)
    }

    pub(crate) fn install(client: &Arc<Client>) {
        let old = HUB.write().unwrap_or_else(PoisonError::into_inner).replace(Arc::clone(client));
        if let Some(old) = old {
            old.close();
        }
    }

    pub(crate) fn uninstall(client: &Arc<Client>) {
        let mut hub = HUB.write().unwrap_or_else(PoisonError::into_inner);
        if hub.as_ref().is_some_and(|c| Arc::ptr_eq(c, client)) {
            *hub = None;
        }
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub(crate) fn log(&self, what: &str) {
        if self.options.debug {
            eprintln!("[bertha] {what}");
        }
    }

    /// Fills in the event from the options, the scope and the capture, then queues it
    /// (or holds it for the scope's response). Returns its id, unless it was dropped.
    pub(crate) fn capture(&self, mut event: IngestEvent, cap: Capture, hold: bool) -> Option<String> {
        let _busy = Busy::enter();
        if self.options.sample_rate < 1.0 && random::unit() >= self.options.sample_rate {
            self.log("dropped by sample_rate");
            return None;
        }
        let scope = Scope::current();
        {
            let mut s = self.lock();
            let now = Instant::now();
            let window = match s.window {
                Some((start, n)) if now.duration_since(start) < Duration::from_secs(60) => (start, n + 1),
                _ => (now, 1),
            };
            s.window = Some(window);
            if window.1 > PER_MINUTE {
                drop(s);
                self.log("dropped: over 100 events this minute");
                return None;
            }
            event.breadcrumbs = Some(s.crumbs.iter().cloned().collect());
            let mut tags = s.tags.clone();
            let mut user = s.user.clone();
            let (mut request, mut trace) = (None, None);
            if let Some(scope) = &scope {
                let d = scope.lock();
                tags.extend(d.tags.clone());
                user = merge_user(user, d.user.clone());
                request = d.request.clone();
                trace = d.trace.clone();
            }
            tags.extend(cap.tags);
            event.tags = Some(tags);
            event.user = merge_user(user, cap.user);
            event.request = cap.request.or(request);
            event.trace = cap.trace.or_else(|| choose_trace(crate::otel::active(), trace));
        }
        if let (Some(r), Some(status)) = (&mut event.request, cap.status) {
            r.status = Some(status);
        }
        let id = random::uuid();
        event.id = Some(id.clone());
        event.timestamp = time::now();
        event.level = cap.level.or(event.level);
        event.mechanism = cap.mechanism.or(event.mechanism);
        event.fingerprint = cap.fingerprint;
        if cap.message.is_some() {
            event.message = cap.message;
        }
        event.release.clone_from(&self.release);
        event.environment.clone_from(&self.options.environment);
        event.context = Some(self.context.clone());
        if let Some(e) = &event.exception {
            remember(&e.message);
        }

        let event = match scope.filter(|_| hold) {
            Some(scope) => match scope.keep(event) {
                Some(event) => event,
                None => {
                    self.log("held until the response is ready");
                    return Some(id);
                }
            },
            None => event,
        };
        self.send(event);
        Some(id)
    }

    /// Scrubs, runs `before_send` and queues.
    pub(crate) fn send(&self, mut event: IngestEvent) {
        let _busy = Busy::enter();
        if self.options.scrub {
            scrub::event(&mut event);
        }
        let event = match &self.options.before_send {
            Some(f) => {
                let original = event.clone();
                match std::panic::catch_unwind(AssertUnwindSafe(|| f(event))) {
                    Ok(Some(e)) => e,
                    Ok(None) => {
                        self.log("dropped by before_send");
                        return;
                    }
                    Err(_) => {
                        self.log("before_send panicked; sending the event as it was");
                        original
                    }
                }
            }
            None => event,
        };
        if self.options.debug {
            self.log(&format!("queued {}", serde_json::to_string(&event).unwrap_or_default()));
        }
        let mut s = self.lock();
        if s.closed {
            return;
        }
        s.queue.push_back(event);
        s.since.get_or_insert_with(Instant::now);
        drop(s);
        self.changed.notify_all();
    }

    pub(crate) fn add_breadcrumb(&self, crumb: IngestBreadcrumb) {
        let mut s = self.lock();
        s.crumbs.push_back(crumb);
        while s.crumbs.len() > MAX_BREADCRUMBS {
            s.crumbs.pop_front();
        }
    }

    pub(crate) fn set_user(&self, user: Option<IngestUser>) {
        self.lock().user = user;
    }

    pub(crate) fn set_tag(&self, key: String, value: String) {
        self.lock().tags.insert(key, value);
    }

    /// Sends everything queued, waiting up to `timeout`. True when nothing is left.
    pub(crate) fn flush(&self, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        let mut s = self.lock();
        s.flush_now = true;
        self.changed.notify_all();
        while !s.queue.is_empty() || s.sending {
            let now = Instant::now();
            if now >= deadline {
                return false;
            }
            s = self.changed.wait_timeout(s, deadline - now).unwrap_or_else(PoisonError::into_inner).0;
        }
        true
    }

    pub(crate) fn close(&self) {
        self.lock().closed = true;
        self.changed.notify_all();
    }

    /// The sender thread.
    fn run(&self) {
        let mut s = self.lock();
        loop {
            let now = Instant::now();
            if s.next_heartbeat.is_some_and(|t| t <= now) && !s.closed {
                s.next_heartbeat = Some(now + HEARTBEAT_EVERY);
                drop(s);
                self.heartbeat();
                s = self.lock();
                continue;
            }
            let paused = s.paused_until.filter(|t| *t > now && !s.closed);
            let due = s.flush_now || s.closed || s.queue.len() >= BATCH || s.since.is_some_and(|t| now >= t + DEBOUNCE);
            if !s.queue.is_empty() && due && paused.is_none() {
                let n = s.queue.len().min(BATCH);
                let batch: Vec<IngestEvent> = s.queue.drain(..n).collect();
                s.since = if s.queue.is_empty() { None } else { Some(now) };
                s.sending = true;
                let last = s.closed;
                drop(s);
                let requeue = self.deliver(&batch, last);
                s = self.lock();
                s.sending = false;
                if let Some(pause) = requeue {
                    s.paused_until = Some(Instant::now() + pause);
                    if !s.closed {
                        for e in batch.into_iter().rev() {
                            s.queue.push_front(e);
                        }
                        s.since.get_or_insert_with(Instant::now);
                    }
                }
                if s.queue.is_empty() {
                    s.flush_now = false;
                }
                self.changed.notify_all();
                continue;
            }
            if s.queue.is_empty() {
                s.flush_now = false;
                if s.closed {
                    self.changed.notify_all();
                    return;
                }
            }
            let wake = [paused, s.since.filter(|_| paused.is_none()).map(|t| t + DEBOUNCE), s.next_heartbeat]
                .into_iter()
                .flatten()
                .min();
            s = match wake {
                Some(t) => {
                    self.changed
                        .wait_timeout(s, t.saturating_duration_since(now))
                        .unwrap_or_else(PoisonError::into_inner)
                        .0
                }
                None => self.changed.wait(s).unwrap_or_else(PoisonError::into_inner),
            };
        }
    }

    /// Sends one batch. Returns how long to pause, when bertha asked to slow down.
    fn deliver(&self, batch: &[IngestEvent], last: bool) -> Option<Duration> {
        let mut attempt = 0;
        loop {
            match self.transport.send_events(&self.sdk, batch) {
                Outcome::Sent => {
                    self.log(&format!("sent {} events", batch.len()));
                    return None;
                }
                Outcome::Offline(why) => {
                    attempt += 1;
                    if last || attempt > RETRIES {
                        self.log(&format!("couldn't reach bertha ({why}); dropped {} events", batch.len()));
                        return None;
                    }
                    thread::sleep(Duration::from_millis(500 * 2u64.pow(attempt)));
                }
                Outcome::Throttled(after) => {
                    self.log(&format!("bertha asked to wait {}s", after.as_secs()));
                    return Some(after);
                }
                Outcome::Refused(status) => {
                    let mut s = self.lock();
                    if !s.warned {
                        s.warned = true;
                        eprintln!("[bertha] bertha refused the events (HTTP {status}). Check the key and URL.");
                    }
                    return None;
                }
            }
        }
    }

    fn heartbeat(&self) {
        let body = IngestHeartbeat {
            environment: self.options.environment.clone(),
            release: self.release.clone(),
            commit: self.commit.clone(),
        };
        if !self.transport.send_heartbeat(&body) {
            self.log("heartbeat failed");
        }
    }
}

fn merge_user(base: Option<IngestUser>, over: Option<IngestUser>) -> Option<IngestUser> {
    match (base, over) {
        (Some(b), Some(o)) => Some(IngestUser { id: o.id.or(b.id), email: o.email.or(b.email), ip: o.ip.or(b.ip) }),
        (b, o) => o.or(b),
    }
}

/// The active span names where in the request it happened, but only when it's on the
/// request's own trace: another tracer's span would cut the error off from the page
/// that sent the request.
pub(crate) fn choose_trace(span: Option<IngestTrace>, request: Option<IngestTrace>) -> Option<IngestTrace> {
    match (span, request) {
        (Some(s), None) => Some(s),
        (Some(s), Some(r)) if s.trace_id == r.trace_id => Some(s),
        (_, r) => r,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trace(id: &str, span: &str) -> IngestTrace {
        IngestTrace { trace_id: id.repeat(32), span_id: Some(span.repeat(16)) }
    }

    #[test]
    fn the_active_span_only_wins_on_the_request_trace() {
        assert_eq!(choose_trace(Some(trace("a", "1")), None), Some(trace("a", "1")));
        assert_eq!(choose_trace(Some(trace("a", "2")), Some(trace("a", "1"))), Some(trace("a", "2")));
        assert_eq!(choose_trace(Some(trace("b", "2")), Some(trace("a", "1"))), Some(trace("a", "1")));
        assert_eq!(choose_trace(None, Some(trace("a", "1"))), Some(trace("a", "1")));
        assert_eq!(choose_trace(None, None), None);
    }
}
