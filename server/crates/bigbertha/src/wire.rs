//! What the SDKs send to `/ingest/v1`. The server parses the same types (and, with the
//! `ts` feature, generates `sdk/src/generated/ingest.ts` from them), so the SDKs and the
//! server can't disagree about the wire format.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub enum IngestLevel {
    Fatal,
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestSdk {
    pub name: String,
    pub version: String,
}

/// `POST /ingest/v1/events`, gzip or plain JSON, `Authorization: Bearer <ingest key>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestBatch {
    pub sdk: IngestSdk,
    pub events: Vec<IngestEvent>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestEvent {
    /// Client-generated id; repeats are dropped, so retries are safe.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub id: Option<String>,
    /// When it happened, ISO 8601. Clamped to the last 7 days and now.
    pub timestamp: String,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub level: Option<IngestLevel>,
    /// Free text; mapped to production, staging or development.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub environment: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub release: Option<String>,
    /// The error, with its `cause` chain.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub exception: Option<IngestException>,
    /// For reports without an error object (`captureMessage`).
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub message: Option<String>,
    /// Oldest first.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub breadcrumbs: Option<Vec<IngestBreadcrumb>>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub request: Option<IngestRequest>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub user: Option<IngestUser>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub context: Option<IngestContext>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub tags: Option<BTreeMap<String, String>>,
    /// Overrides grouping: events with the same fingerprint are one issue.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub fingerprint: Option<Vec<String>>,
    /// Bundle file URL → debug id, for source maps.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub debug_ids: Option<BTreeMap<String, String>>,
    /// How the error reached the SDK.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub mechanism: Option<IngestMechanism>,
    /// The W3C trace this happened in: the page load, or the incoming `traceparent`.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub trace: Option<IngestTrace>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestMechanism {
    /// The hook: `onerror`, `onunhandledrejection`, `uncaughtException`, `ErrorBoundary`…
    pub handler: String,
    /// False when nothing in the app caught it.
    pub handled: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestTrace {
    /// 32 lowercase hex characters.
    pub trace_id: String,
    /// 16 lowercase hex characters: the request's span, when there was one.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub span_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct IngestException {
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
    /// Innermost (where it was thrown) first.
    pub frames: Vec<IngestFrame>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub cause: Option<Box<IngestException>>,
    /// The error's own fields (`code`, `status`…), stringified.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub data: Option<BTreeMap<String, String>>,
    /// React's component stack, from an error boundary.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub component_stack: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestFrame {
    pub file: String,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub function: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub line: Option<u32>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub column: Option<u32>,
    /// The SDK's guess; the server decides from the file path when absent.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub in_app: Option<bool>,
    /// Source lines around `line`, read by an SDK that can see the file (Node running
    /// its source as-is). Ignored when the frame maps through a source map.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub context: Option<IngestFrameContext>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestFrameContext {
    /// The file's line number of `lines[0]`, from 1.
    pub start_line: u32,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestBreadcrumb {
    pub timestamp: String,
    pub category: String,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub level: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub status: Option<u32>,
    /// The incoming request's headers. bertha drops credential headers itself too.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub headers: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestUser {
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub id: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub email: Option<String>,
    /// `"auto"` = use the address the report came from.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub ip: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestContext {
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub browser: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub os: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub runtime: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub user_agent: Option<String>,
    /// e.g. "1194×702 @2x".
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub viewport: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub online: Option<bool>,
    /// Whether the page was visible.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub visible: Option<bool>,
    /// `PerformanceNavigationTiming.type`: navigate, reload, back_forward or prerender.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub navigation: Option<String>,
    /// `navigator.webdriver`.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub automated: Option<bool>,
    /// How long the page had been open.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub page_age_ms: Option<f64>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub referrer: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub language: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub timezone: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub connection: Option<String>,
    /// The server host or dyno.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub host: Option<String>,
    /// Framework and runtime versions, e.g. `{ "react": "18.3.1" }`.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub versions: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestResponse {
    pub accepted: u32,
    pub rejected: u32,
    /// Seconds to wait before sending again, when throttled.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub retry_after: Option<u32>,
}

/// `POST /ingest/v1/heartbeat`: a long-running process saying it is alive, so
/// bertha can tell "no errors" (0) from "no data" (a gap) in charts.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestHeartbeat {
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub environment: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub release: Option<String>,
    /// The commit sha the process was built from, when the host says (Heroku, Render,
    /// Vercel…). Fills in the release's commit if no deploy from CI gave one.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub commit: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestCommit {
    pub sha: String,
    pub message: String,
    pub author: String,
}

/// `POST /ingest/v1/deploys`, from CI after a deploy.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestDeploy {
    pub release: String,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub environment: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub commit: Option<IngestCommit>,
    /// Defaults to now.
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub deployed_at: Option<String>,
}

/// Answer to `POST /ingest/v1/deploys`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct DeployRecorded {
    pub release_id: String,
}

/// Answer to `POST /ingest/v1/sourcemaps?debugId=…&file=…&release=…`
/// (body: the raw map, gzip or plain).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct SourceMapUploaded {
    pub debug_id: String,
    pub sources: u32,
}

/// Errors from ingest endpoints: `{ error: "…" }` with a 4xx status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "sdk/src/generated/ingest.ts"))]
pub struct IngestError {
    pub error: String,
}
