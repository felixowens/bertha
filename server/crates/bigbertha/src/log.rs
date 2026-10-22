//! Log lines, for what happened that isn't an error: a fallback that worked, a slow
//! upstream, a job that finished. They go to the project's logs, not its issues, and
//! carry the active trace, so a request's lines sit beside its spans.
//!
//! ```no_run
//! # let _bertha = bigbertha::init(bigbertha::options!());
//! bigbertha::log::warn("TikWM failed; used the fallback", &[("video", &"7301"), ("status", &502)]);
//! bigbertha::log::info("Synced orders", &[]);
//! ```
//!
//! Lines below [`Options::log_level`](crate::Options::log_level) (`info` by default) are
//! dropped. `log::error` writes a line and opens no issue: use
//! [`capture_error`](crate::capture_error) for that. With the `tracing` feature, the
//! layer sends tracing events as lines too, so most apps never call these.

use std::collections::BTreeMap;
use std::fmt::Display;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{Value, json};

use crate::client::hub;
use crate::wire::{IngestBreadcrumb, IngestTrace};

/// How bad a log line is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Fatal,
}

impl LogLevel {
    /// The OpenTelemetry severity number.
    fn number(self) -> u8 {
        match self {
            Self::Debug => 5,
            Self::Info => 9,
            Self::Warning => 13,
            Self::Error => 17,
            Self::Fatal => 21,
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
            Self::Fatal => "fatal",
        }
    }
}

impl FromStr for LogLevel {
    type Err = String;

    /// `debug`, `info`, `warn` or `warning`, `error`, `fatal`, in any case.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "debug" | "trace" => Ok(Self::Debug),
            "info" => Ok(Self::Info),
            "warn" | "warning" => Ok(Self::Warning),
            "error" => Ok(Self::Error),
            "fatal" => Ok(Self::Fatal),
            _ => Err(format!("{s:?} isn't a log level. Use off, debug, info, warn, error or fatal.")),
        }
    }
}

/// A field on a line: `("order", &41)`.
pub type Field<'a> = (&'a str, &'a dyn Display);

/// A debug line. Dropped unless `log_level` is `Debug`.
pub fn debug(message: impl Display, fields: &[Field<'_>]) {
    at(LogLevel::Debug, message, fields);
}

/// An info line, also kept as a breadcrumb on the next events (even with `log_level`
/// off).
pub fn info(message: impl Display, fields: &[Field<'_>]) {
    at(LogLevel::Info, message, fields);
}

/// A warning line, also kept as a breadcrumb. Something went wrong and was handled.
pub fn warn(message: impl Display, fields: &[Field<'_>]) {
    at(LogLevel::Warning, message, fields);
}

/// An error line, also kept as a breadcrumb. It opens no issue: report the error with
/// [`capture_error`](crate::capture_error) when someone should act on it.
pub fn error(message: impl Display, fields: &[Field<'_>]) {
    at(LogLevel::Error, message, fields);
}

/// A line at any level.
pub fn at(level: LogLevel, message: impl Display, fields: &[Field<'_>]) {
    let Some(client) = hub() else { return };
    let message = message.to_string();
    let fields: BTreeMap<String, String> = fields.iter().map(|(k, v)| ((*k).to_owned(), v.to_string())).collect();
    if level >= LogLevel::Info {
        let mut crumb = message.clone();
        for (k, v) in &fields {
            crumb.push_str(&format!(" {k}={v}"));
        }
        client.add_breadcrumb(IngestBreadcrumb {
            timestamp: crate::time::now(),
            category: "log".to_owned(),
            level: Some(level.as_str().to_owned()),
            message: crumb,
        });
    }
    if client.logs(level) {
        client.log_line(Line::new(level, message, fields));
    }
}

/// One line, waiting to be sent.
#[derive(Debug, Clone)]
pub(crate) struct Line {
    pub(crate) time: SystemTime,
    pub(crate) level: LogLevel,
    pub(crate) message: String,
    pub(crate) fields: BTreeMap<String, String>,
    pub(crate) trace: Option<IngestTrace>,
    /// The event this line was also reported as.
    pub(crate) event_id: Option<String>,
}

impl Line {
    pub(crate) fn new(level: LogLevel, message: String, fields: BTreeMap<String, String>) -> Self {
        Self { time: SystemTime::now(), level, message, fields, trace: None, event_id: None }
    }

    fn record(&self) -> Value {
        let nanos = self.time.duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos().to_string();
        let mut attributes: Vec<Value> = self.fields.iter().map(|(k, v)| attribute(k, v)).collect();
        if let Some(id) = &self.event_id {
            attributes.push(attribute("bertha.event_id", id));
        }
        let mut record = json!({
            "timeUnixNano": nanos,
            "observedTimeUnixNano": nanos,
            "severityNumber": self.level.number(),
            "severityText": self.level.as_str(),
            "body": { "stringValue": self.message },
            "attributes": attributes,
        });
        if let Some(t) = &self.trace {
            record["traceId"] = json!(t.trace_id);
            if let Some(span) = &t.span_id {
                record["spanId"] = json!(span);
            }
        }
        record
    }
}

/// Who sent the lines: the OTLP resource.
pub(crate) struct Resource<'a> {
    pub(crate) service: Option<&'a str>,
    pub(crate) release: Option<&'a str>,
    pub(crate) environment: Option<&'a str>,
}

/// An OTLP/HTTP JSON logs request. `dropped` lines that didn't fit in the buffer become
/// a warning line of their own, so the gap shows where it happened.
pub(crate) fn request(resource: &Resource<'_>, lines: &[Line], dropped: usize) -> Value {
    let named = [
        ("service.name", resource.service),
        ("service.version", resource.release),
        ("deployment.environment.name", resource.environment),
    ];
    let attributes: Vec<Value> = named.iter().filter_map(|(k, v)| v.map(|v| attribute(k, v))).collect();
    let mut records = Vec::with_capacity(lines.len() + 1);
    if dropped > 0 {
        let mut fields = BTreeMap::new();
        fields.insert("bertha.dropped".to_owned(), dropped.to_string());
        let gap = format!("bertha dropped {dropped} log lines: too many were waiting to be sent.");
        records.push(Line::new(LogLevel::Warning, gap, fields).record());
    }
    records.extend(lines.iter().map(Line::record));
    json!({
        "resourceLogs": [{
            "resource": { "attributes": attributes },
            "scopeLogs": [{
                "scope": { "name": "bigbertha", "version": crate::VERSION },
                "logRecords": records,
            }],
        }],
    })
}

fn attribute(key: &str, value: &str) -> Value {
    json!({ "key": key, "value": { "stringValue": value } })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_levels() {
        assert_eq!("WARN".parse(), Ok(LogLevel::Warning));
        assert_eq!(" info ".parse(), Ok(LogLevel::Info));
        assert!("loud".parse::<LogLevel>().is_err());
        assert!(LogLevel::Debug < LogLevel::Info && LogLevel::Error < LogLevel::Fatal);
    }

    #[test]
    fn builds_otlp_json() {
        let mut line =
            Line::new(LogLevel::Error, "charge failed".into(), BTreeMap::from([("order".into(), "41".into())]));
        line.time = UNIX_EPOCH + std::time::Duration::from_millis(1_500);
        line.trace = Some(IngestTrace { trace_id: "a".repeat(32), span_id: Some("b".repeat(16)) });
        line.event_id = Some("e1".into());
        let resource = Resource { service: Some("shop"), release: Some("1.2.0"), environment: None };
        let body = request(&resource, &[line], 3);
        let logs = &body["resourceLogs"][0];
        assert_eq!(
            logs["resource"]["attributes"],
            json!([
                { "key": "service.name", "value": { "stringValue": "shop" } },
                { "key": "service.version", "value": { "stringValue": "1.2.0" } },
            ])
        );
        let records = logs["scopeLogs"][0]["logRecords"].as_array().expect("records");
        assert_eq!(records[0]["severityText"], "warning");
        assert_eq!(records[0]["attributes"][0], json!({ "key": "bertha.dropped", "value": { "stringValue": "3" } }));
        assert_eq!(
            records[1],
            json!({
                "timeUnixNano": "1500000000",
                "observedTimeUnixNano": "1500000000",
                "severityNumber": 17,
                "severityText": "error",
                "body": { "stringValue": "charge failed" },
                "attributes": [
                    { "key": "order", "value": { "stringValue": "41" } },
                    { "key": "bertha.event_id", "value": { "stringValue": "e1" } },
                ],
                "traceId": "a".repeat(32),
                "spanId": "b".repeat(16),
            })
        );
    }
}
