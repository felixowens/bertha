//! What `@bertha/sdk` sends. Generated into `sdk/src/generated/ingest.ts`, so the
//! SDK and the server can't disagree about the wire format.
//!
//! The SDK is lenient about what it collects; the server is strict about what it
//! keeps: everything here is bounded by [`limits`] before it is stored.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Hard caps applied at ingest. Anything longer is truncated, not rejected.
pub mod limits {
    /// Compressed request body.
    pub const BODY_BYTES: usize = 1024 * 1024;
    /// After decompression: guards against zip bombs.
    pub const DECOMPRESSED_BYTES: usize = 8 * 1024 * 1024;
    pub const EVENTS_PER_BATCH: usize = 100;
    pub const FRAMES: usize = 100;
    pub const CAUSES: usize = 5;
    pub const BREADCRUMBS: usize = 100;
    pub const TAGS: usize = 50;
    pub const MESSAGE_CHARS: usize = 8 * 1024;
    pub const SHORT_CHARS: usize = 512;
    pub const URL_CHARS: usize = 2048;
    pub const FINGERPRINT_PARTS: usize = 10;
    /// One uploaded source map, compressed.
    pub const SOURCEMAP_BYTES: usize = 32 * 1024 * 1024;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub enum IngestLevel {
    Fatal,
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestSdk {
    pub name: String,
    pub version: String,
}

/// `POST /ingest/v1/events`, gzip or plain JSON, `Authorization: Bearer <ingest key>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestBatch {
    pub sdk: IngestSdk,
    pub events: Vec<IngestEvent>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestEvent {
    /// Client-generated id; repeats are dropped, so retries are safe.
    #[serde(default)]
    #[ts(optional)]
    pub id: Option<String>,
    /// When it happened, ISO 8601. Clamped to the last 7 days and now.
    pub timestamp: String,
    #[serde(default)]
    #[ts(optional)]
    pub level: Option<IngestLevel>,
    /// Free text; mapped to production, staging or development.
    #[serde(default)]
    #[ts(optional)]
    pub environment: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub release: Option<String>,
    /// The error, with its `cause` chain.
    #[serde(default)]
    #[ts(optional)]
    pub exception: Option<IngestException>,
    /// For reports without an error object (`captureMessage`).
    #[serde(default)]
    #[ts(optional)]
    pub message: Option<String>,
    /// Oldest first.
    #[serde(default)]
    #[ts(optional)]
    pub breadcrumbs: Option<Vec<IngestBreadcrumb>>,
    #[serde(default)]
    #[ts(optional)]
    pub request: Option<IngestRequest>,
    #[serde(default)]
    #[ts(optional)]
    pub user: Option<IngestUser>,
    #[serde(default)]
    #[ts(optional)]
    pub context: Option<IngestContext>,
    #[serde(default)]
    #[ts(optional)]
    pub tags: Option<BTreeMap<String, String>>,
    /// Overrides grouping: events with the same fingerprint are one issue.
    #[serde(default)]
    #[ts(optional)]
    pub fingerprint: Option<Vec<String>>,
    /// Bundle file URL → debug id, for source maps.
    #[serde(default)]
    #[ts(optional)]
    pub debug_ids: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestException {
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
    /// Innermost (where it was thrown) first.
    pub frames: Vec<IngestFrame>,
    #[serde(default)]
    #[ts(optional)]
    pub cause: Option<Box<IngestException>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestFrame {
    pub file: String,
    #[serde(default)]
    #[ts(optional)]
    pub function: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub line: Option<u32>,
    #[serde(default)]
    #[ts(optional)]
    pub column: Option<u32>,
    /// The SDK's guess; the server decides from the file path when absent.
    #[serde(default)]
    #[ts(optional)]
    pub in_app: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestBreadcrumb {
    pub timestamp: String,
    pub category: String,
    #[serde(default)]
    #[ts(optional)]
    pub level: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    #[ts(optional)]
    pub status: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestUser {
    #[serde(default)]
    #[ts(optional)]
    pub id: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub email: Option<String>,
    /// `"auto"` = use the address the report came from.
    #[serde(default)]
    #[ts(optional)]
    pub ip: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestContext {
    #[serde(default)]
    #[ts(optional)]
    pub browser: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub os: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub runtime: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestResponse {
    pub accepted: u32,
    pub rejected: u32,
    /// Seconds to wait before sending again, when throttled.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub retry_after: Option<u32>,
}

/// `POST /ingest/v1/heartbeat`: a long-running process saying it is alive, so
/// bertha can tell "no errors" (0) from "no data" (a gap) in charts.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestHeartbeat {
    #[serde(default)]
    #[ts(optional)]
    pub environment: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub release: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestCommit {
    pub sha: String,
    pub message: String,
    pub author: String,
}

/// `POST /ingest/v1/deploys`, from CI after a deploy.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestDeploy {
    pub release: String,
    #[serde(default)]
    #[ts(optional)]
    pub environment: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub commit: Option<IngestCommit>,
    /// Defaults to now.
    #[serde(default)]
    #[ts(optional)]
    pub deployed_at: Option<String>,
}

/// Answer to `POST /ingest/v1/sourcemaps?debugId=…&file=…&release=…`
/// (body: the raw map, gzip or plain).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct SourceMapUploaded {
    pub debug_id: String,
    pub sources: u32,
}

/// Errors from ingest endpoints: `{ error: "…" }` with a 4xx status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sdk/src/generated/ingest.ts")]
pub struct IngestError {
    pub error: String,
}

/// Maps whatever the app calls its environment onto bertha's three.
pub fn environment_from(s: Option<&str>) -> crate::domain::Environment {
    use crate::domain::Environment::*;
    let Some(s) = s else { return Production };
    let s = s.to_ascii_lowercase();
    if s.contains("prod") || s == "live" {
        Production
    } else if s.contains("stag") || s.contains("preview") || s.contains("test") || s.contains("uat") || s.contains("qa")
    {
        Staging
    } else if s.contains("dev") || s.contains("local") {
        Development
    } else {
        Production
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Environment;

    #[test]
    fn environments() {
        assert_eq!(environment_from(None), Environment::Production);
        assert_eq!(environment_from(Some("Preview")), Environment::Staging);
        assert_eq!(environment_from(Some("development")), Environment::Development);
        assert_eq!(environment_from(Some("localhost")), Environment::Development);
        assert_eq!(environment_from(Some("eu-west")), Environment::Production);
    }

    #[test]
    fn minimal_event_parses() {
        let e: IngestEvent =
            serde_json::from_str(r#"{"timestamp":"2026-10-13T09:12:00Z","message":"hi"}"#).expect("parses");
        assert_eq!(e.message.as_deref(), Some("hi"));
    }
}
