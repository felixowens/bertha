//! The ingest queue. Requests do cheap checks, take from their project's rate limit
//! and hand the batch to one worker; they never wait on the database. The worker
//! loads source maps, normalizes, stores, tells open pages and matches alert rules.

use std::collections::{BTreeSet, HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use bertha_core::ids::{IssueId, ProjectId};
use bertha_core::ingest::{IngestEvent, limits};
use bertha_core::live::LiveEvent;
use bertha_db::Db;
use bertha_db::writes::ingest::{Change, Ingested, KeyedProject};
use bertha_ingest::{Context, SourceMap, debug_ids, normalize, parse_map};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use crate::alerts::Alerter;
use crate::live::Live;

/// Batches waiting for the worker. Past this, senders get a 429.
const QUEUE: usize = 256;
/// Parsed maps kept in memory. A big app's map parses to a few MB.
const MAP_CACHE: usize = 24;
/// Sustained events per second per project, and the burst allowed on top.
const RATE: f64 = 50.0;
const BURST: f64 = 500.0;

pub struct Job {
    pub project: KeyedProject,
    pub events: Vec<IngestEvent>,
    pub ctx: Context,
}

#[derive(Debug, PartialEq, Eq)]
pub struct QueueFull;

#[derive(Clone)]
pub struct Pipeline {
    tx: mpsc::Sender<Job>,
    pub maps: MapCache,
    pub limiter: Limiter,
}

impl Pipeline {
    /// Starts the worker. It runs until every `Pipeline` clone is dropped, then
    /// finishes what's queued.
    pub fn start(db: Db, live: Live, alerter: Alerter) -> (Pipeline, JoinHandle<()>) {
        let (tx, rx) = mpsc::channel(QUEUE);
        let maps = MapCache::new(MAP_CACHE);
        let worker = tokio::spawn(run(rx, db, live, alerter, maps.clone()));
        (Pipeline { tx, maps, limiter: Limiter::new(RATE, BURST) }, worker)
    }

    pub fn submit(&self, job: Job) -> Result<(), QueueFull> {
        self.tx.try_send(job).map_err(|_| QueueFull)
    }
}

async fn run(mut rx: mpsc::Receiver<Job>, db: Db, live: Live, alerter: Alerter, maps: MapCache) {
    while let Some(job) = rx.recv().await {
        let project = job.project.id.clone();
        let n = job.events.len();
        if let Err(e) = process(&db, &live, &alerter, &maps, job).await {
            tracing::error!(error = ?e, %project, events = n, "ingest batch failed");
        }
    }
    tracing::debug!("ingest worker stopped");
}

async fn process(db: &Db, live: &Live, alerter: &Alerter, maps: &MapCache, job: Job) -> anyhow::Result<()> {
    let Job { project, events, ctx } = job;
    let wanted: BTreeSet<String> = events.iter().flat_map(debug_ids).collect();
    let mut loaded: HashMap<String, Arc<SourceMap>> = HashMap::new();
    for id in wanted {
        if let Some(map) = maps.get_or_load(db, &project.id, &id).await {
            loaded.insert(id, map);
        }
    }
    let normalized = tokio::task::spawn_blocking(move || {
        events.into_iter().map(|e| normalize(e, &ctx, &|id: &str| loaded.get(id).cloned())).collect::<Vec<_>>()
    })
    .await?;
    let done = db.ingest(&project, &normalized).await?;
    if let Some(event) = summarize(&project.id, &done) {
        live.send(event);
    }
    alerter.ingested(&project, &done).await;
    Ok(())
}

/// One live nudge per batch, however many events it had.
fn summarize(project: &ProjectId, done: &[Ingested]) -> Option<LiveEvent> {
    let mut new_issues: Vec<IssueId> = vec![];
    let mut regressed: Vec<IssueId> = vec![];
    let mut touched: Vec<IssueId> = vec![];
    let mut events = 0;
    for d in done.iter().filter(|d| d.change != Change::Duplicate) {
        events += 1;
        let list = match d.change {
            Change::New => &mut new_issues,
            Change::Regressed => &mut regressed,
            _ => &mut touched,
        };
        if !list.contains(&d.issue_id) {
            list.push(d.issue_id.clone());
        }
    }
    touched.retain(|id| !new_issues.contains(id) && !regressed.contains(id));
    (events > 0).then(|| LiveEvent::Ingested { project_id: project.clone(), events, new_issues, regressed, touched })
}

type MapKey = (ProjectId, String);

/// Parsed source maps by (project, debug id), least recently used out first. Misses
/// are cached too, until a map with that id is uploaded.
#[derive(Clone)]
pub struct MapCache(Arc<Mutex<Lru>>);

struct Lru {
    cap: usize,
    maps: HashMap<MapKey, Option<Arc<SourceMap>>>,
    order: VecDeque<MapKey>,
}

impl MapCache {
    pub fn new(cap: usize) -> MapCache {
        MapCache(Arc::new(Mutex::new(Lru { cap, maps: HashMap::new(), order: VecDeque::new() })))
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Lru> {
        // A panic while holding this can only leave a stale cache entry.
        self.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn get(&self, key: &MapKey) -> Option<Option<Arc<SourceMap>>> {
        let mut lru = self.lock();
        let hit = lru.maps.get(key).cloned()?;
        lru.order.retain(|k| k != key);
        lru.order.push_back(key.clone());
        Some(hit)
    }

    fn put(&self, key: MapKey, map: Option<Arc<SourceMap>>) {
        let mut lru = self.lock();
        lru.order.retain(|k| k != &key);
        lru.order.push_back(key.clone());
        lru.maps.insert(key, map);
        while lru.order.len() > lru.cap {
            if let Some(old) = lru.order.pop_front() {
                lru.maps.remove(&old);
            }
        }
    }

    /// Forgets a debug id, after an upload replaced or added it.
    pub fn forget(&self, project: &ProjectId, debug_id: &str) {
        let key = (project.clone(), debug_id.to_ascii_lowercase());
        let mut lru = self.lock();
        lru.order.retain(|k| k != &key);
        lru.maps.remove(&key);
    }

    async fn get_or_load(&self, db: &Db, project: &ProjectId, debug_id: &str) -> Option<Arc<SourceMap>> {
        let key = (project.clone(), debug_id.to_ascii_lowercase());
        if let Some(hit) = self.get(&key) {
            return hit;
        }
        let map = match db.sourcemap(project, &key.1, limits::SOURCEMAP_BYTES).await {
            Ok(Some(bytes)) => match tokio::task::spawn_blocking(move || parse_map(&bytes)).await {
                Ok(Ok(map)) => Some(Arc::new(map)),
                Ok(Err(e)) => {
                    tracing::warn!(error = %e, %project, debug_id, "stored source map doesn't parse");
                    None
                }
                Err(e) => {
                    tracing::error!(error = %e, "source map parse panicked");
                    None
                }
            },
            Ok(None) => None,
            Err(e) => {
                // Don't cache: the next event may find the database answering again.
                tracing::error!(error = %e, %project, debug_id, "loading a source map failed");
                return None;
            }
        };
        self.put(key, map.clone());
        map
    }
}

/// A token bucket per project, counted in events.
#[derive(Clone)]
pub struct Limiter {
    rate: f64,
    burst: f64,
    buckets: Arc<Mutex<HashMap<ProjectId, (f64, Instant)>>>,
}

impl Limiter {
    pub fn new(rate: f64, burst: f64) -> Limiter {
        Limiter { rate, burst, buckets: Arc::default() }
    }

    /// Takes up to `n` events' worth. Returns how many were allowed and, when some
    /// weren't, how long until there's room for the rest.
    pub fn take(&self, project: &ProjectId, n: usize, now: Instant) -> (usize, Option<Duration>) {
        let mut buckets = self.buckets.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let (tokens, at) = buckets.entry(project.clone()).or_insert((self.burst, now));
        let elapsed = now.saturating_duration_since(*at).as_secs_f64();
        *tokens = (*tokens + elapsed * self.rate).min(self.burst);
        *at = now;
        // Whole events only; fractional tokens carry over.
        let allowed = (tokens.floor() as usize).min(n);
        *tokens -= allowed as f64;
        let short = n - allowed;
        let wait = (short > 0).then(|| Duration::from_secs_f64((short as f64 - *tokens).max(1.0) / self.rate));
        (allowed, wait)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buckets_refill() {
        let l = Limiter::new(10.0, 20.0);
        let p = ProjectId("p".into());
        let t0 = Instant::now();
        assert_eq!(l.take(&p, 15, t0), (15, None));
        let (allowed, wait) = l.take(&p, 15, t0);
        assert_eq!(allowed, 5);
        assert_eq!(wait, Some(Duration::from_secs(1)));
        assert_eq!(l.take(&p, 5, t0 + Duration::from_secs(1)), (5, None));
        // Other projects have their own bucket.
        assert_eq!(l.take(&ProjectId("q".into()), 20, t0).0, 20);
    }
}
