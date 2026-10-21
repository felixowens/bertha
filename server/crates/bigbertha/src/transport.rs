// HTTP to bertha's ingest API: JSON, gzipped from 1 KB (bertha sniffs the gzip
// header), `text/plain` like the browser SDK's beacons, Bearer auth.

use std::io::Write;
use std::time::Duration;

use flate2::Compression;
use flate2::write::GzEncoder;
use serde::Serialize;
use serde_json::Value;

use crate::wire::{IngestBatch, IngestEvent, IngestHeartbeat, IngestSdk};

const GZIP_FROM: usize = 1024;
const DEFAULT_PAUSE: Duration = Duration::from_secs(60);

pub(crate) enum Outcome {
    Sent,
    /// Not delivered: the network, DNS, a timeout.
    Offline(String),
    /// 429 or 503: wait this long.
    Throttled(Duration),
    /// Any other refusal; retrying won't help.
    Refused(u16),
}

pub(crate) struct Transport {
    agent: ureq::Agent,
    events: String,
    heartbeat: String,
    key: String,
}

pub(crate) fn endpoint(base: &str, path: &str) -> String {
    format!("{}/ingest/v1/{path}", base.trim_end_matches('/'))
}

pub(crate) fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(10)))
        .http_status_as_error(false)
        .user_agent(concat!("bigbertha/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
}

impl Transport {
    pub(crate) fn new(url: &str, key: &str) -> Self {
        Self {
            agent: agent(),
            events: endpoint(url, "events"),
            heartbeat: endpoint(url, "heartbeat"),
            key: key.to_owned(),
        }
    }

    pub(crate) fn send_events(&self, sdk: &IngestSdk, events: &[IngestEvent]) -> Outcome {
        let batch = IngestBatch { sdk: sdk.clone(), events: events.to_vec() };
        let body = json(&batch);
        let body = if body.len() >= GZIP_FROM { gzip(&body).unwrap_or(body) } else { body };
        let res = self
            .agent
            .post(&self.events)
            .header("authorization", &format!("Bearer {}", self.key))
            .header("content-type", "text/plain")
            .send(&body[..]);
        let mut res = match res {
            Ok(r) => r,
            Err(e) => return Outcome::Offline(e.to_string()),
        };
        let status = res.status().as_u16();
        match status {
            200..=299 => Outcome::Sent,
            429 | 503 => {
                let header = res
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.trim().parse::<u64>().ok());
                let body = || {
                    let text = res.body_mut().read_to_string().ok()?;
                    serde_json::from_str::<Value>(&text).ok()?.get("retryAfter")?.as_u64()
                };
                Outcome::Throttled(header.or_else(body).map_or(DEFAULT_PAUSE, Duration::from_secs))
            }
            _ => Outcome::Refused(status),
        }
    }

    pub(crate) fn send_heartbeat(&self, beat: &IngestHeartbeat) -> bool {
        self.agent
            .post(&self.heartbeat)
            .header("authorization", &format!("Bearer {}", self.key))
            .header("content-type", "application/json")
            .send(&json(beat)[..])
            .is_ok_and(|r| r.status().is_success())
    }
}

/// JSON without the `null`s of unset fields.
pub(crate) fn json(value: &impl Serialize) -> Vec<u8> {
    let mut v = serde_json::to_value(value).unwrap_or(Value::Null);
    strip_nulls(&mut v);
    serde_json::to_vec(&v).unwrap_or_default()
}

fn strip_nulls(v: &mut Value) {
    match v {
        Value::Object(m) => {
            m.retain(|_, v| !v.is_null());
            m.values_mut().for_each(strip_nulls);
        }
        Value::Array(a) => a.iter_mut().for_each(strip_nulls),
        _ => {}
    }
}

fn gzip(body: &[u8]) -> Option<Vec<u8>> {
    let mut gz = GzEncoder::new(Vec::with_capacity(body.len() / 4), Compression::default());
    gz.write_all(body).ok()?;
    gz.finish().ok()
}
