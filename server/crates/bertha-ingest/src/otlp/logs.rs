//! OTLP/HTTP logs: what `@bigbertha/sdk`, `bigbertha` and OpenTelemetry exporters send
//! to `/ingest/v1/logs`, as protobuf or JSON, turned into the lines bertha stores.
//!
//! The resource says which service, release and environment; each record's attributes
//! become its fields, except `bertha.event_id`, which links it to an event. Messages and
//! values are scrubbed like spans', since a collector forwarding stdout never ran the SDK.

use std::collections::BTreeMap;

use bertha_core::domain::LogLevel;
use bertha_core::ingest::environment_from;
use bertha_core::logs::{EVENT_ATTRIBUTE, limits};
use bertha_core::time::Millis;
use bertha_db::writes::logs::NewLog;
use prost::Message as _;

use super::{Encoding, id, pb, scrub, secret_key, text};
use crate::cut;

/// Records read from one request; past it they're turned away.
pub const LINES_PER_REQUEST: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum Malformed {
    #[error("The body isn't an OTLP logs export in protobuf: {0}")]
    Protobuf(String),
    #[error("The body isn't an OTLP logs export in JSON: {0}")]
    Json(String),
}

/// The lines worth storing, and how many were turned away.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Parsed {
    pub lines: Vec<NewLog>,
    pub rejected: usize,
}

/// Decodes an export. `now` dates records that carry no time at all.
pub fn parse_logs(body: &[u8], encoding: Encoding, now: Millis) -> Result<Parsed, Malformed> {
    let request = match encoding {
        Encoding::Protobuf => {
            proto::ExportLogsServiceRequest::decode(body).map_err(|e| Malformed::Protobuf(e.to_string()))?
        }
        Encoding::Json => {
            let j: json::Request = serde_json::from_slice(body).map_err(|e| Malformed::Json(e.to_string()))?;
            j.into_pb()
        }
    };
    Ok(normalize(request, now))
}

/// The answer an exporter expects: empty when every record was taken, otherwise a
/// partial success saying how many weren't.
pub fn response(encoding: Encoding, rejected: usize, message: &str) -> Vec<u8> {
    match encoding {
        Encoding::Protobuf => {
            let partial_success = (rejected > 0).then(|| proto::PartialSuccess {
                rejected_log_records: i64::try_from(rejected).unwrap_or(i64::MAX),
                error_message: message.to_owned(),
            });
            proto::ExportLogsServiceResponse { partial_success }.encode_to_vec()
        }
        Encoding::Json if rejected == 0 => b"{}".to_vec(),
        Encoding::Json => serde_json::json!({
            "partialSuccess": { "rejectedLogRecords": rejected.to_string(), "errorMessage": message }
        })
        .to_string()
        .into_bytes(),
    }
}

fn normalize(request: proto::ExportLogsServiceRequest, now: Millis) -> Parsed {
    let mut out = Parsed::default();
    for rl in request.resource_logs {
        let resource: Vec<(String, String)> = rl
            .resource
            .map(|r| r.attributes)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|kv| Some((kv.key, text(&kv.value?))))
            .collect();
        let attr = |k: &str| resource.iter().find(|(key, _)| key == k).map(|(_, v)| v.trim()).filter(|v| !v.is_empty());
        let service =
            attr("service.name").filter(|s| !s.starts_with("unknown_service")).map(|s| cut(s, limits::KEY_CHARS));
        let release = attr("service.version").map(|s| cut(s, limits::KEY_CHARS));
        let environment = environment_from(attr("deployment.environment.name").or(attr("deployment.environment")));

        for record in rl.scope_logs.into_iter().flat_map(|s| s.log_records) {
            if out.lines.len() >= LINES_PER_REQUEST {
                out.rejected += 1;
                continue;
            }
            let (fields, event_ref) = fields(record.attributes);
            out.lines.push(NewLog {
                at: time(record.time_unix_nano).or(time(record.observed_time_unix_nano)).unwrap_or(now),
                level: LogLevel::from_severity(record.severity_number)
                    .or_else(|| LogLevel::from_text(&record.severity_text))
                    .unwrap_or(LogLevel::Info),
                message: cut(&scrub(&body(record.body)), limits::MESSAGE_CHARS),
                fields,
                service: service.clone(),
                release: release.clone(),
                environment,
                trace_id: id(&record.trace_id, 16),
                span_id: id(&record.span_id, 8),
                event_ref,
            });
        }
    }
    out
}

/// Nanoseconds to milliseconds; `None` when unset.
fn time(ns: u64) -> Option<Millis> {
    (ns > 0).then(|| Millis::try_from(ns / 1_000_000).ok()).flatten()
}

/// A string body as it is; anything else as JSON.
fn body(v: Option<pb::AnyValue>) -> String {
    use pb::any_value::Value;
    match v.and_then(|v| v.value) {
        None => String::new(),
        Some(Value::String(s)) => s,
        Some(other) => to_json(&pb::AnyValue { value: Some(other) }).to_string(),
    }
}

fn to_json(v: &pb::AnyValue) -> serde_json::Value {
    use pb::any_value::Value;
    use serde_json::Value as J;
    match &v.value {
        None => J::Null,
        Some(Value::String(s)) => J::String(s.clone()),
        Some(Value::Bool(b)) => J::Bool(*b),
        Some(Value::Int(i)) => J::from(*i),
        Some(Value::Double(d)) => serde_json::Number::from_f64(*d).map_or(J::Null, J::Number),
        Some(Value::Bytes(b)) => J::String(format!("{} bytes", b.len())),
        Some(Value::Array(a)) => J::Array(a.values.iter().map(to_json).collect()),
        Some(Value::Kvlist(l)) => {
            J::Object(l.values.iter().map(|kv| (kv.key.clone(), kv.value.as_ref().map_or(J::Null, to_json))).collect())
        }
    }
}

/// The record's attributes as fields, and the event it names.
fn fields(attributes: Vec<pb::KeyValue>) -> (BTreeMap<String, String>, Option<String>) {
    let mut fields = BTreeMap::new();
    let mut event = None;
    for kv in attributes {
        let key = kv.key.trim();
        let Some(value) = kv.value else { continue };
        if key == EVENT_ATTRIBUTE {
            event = Some(cut(text(&value).trim(), limits::KEY_CHARS)).filter(|e| !e.is_empty());
            continue;
        }
        if key.is_empty() || fields.len() >= limits::FIELDS {
            continue;
        }
        let value =
            if secret_key(key) { "[redacted]".to_owned() } else { cut(&scrub(&text(&value)), limits::VALUE_CHARS) };
        fields.insert(cut(key, limits::KEY_CHARS), value);
    }
    (fields, event)
}

/// The OTLP logs messages, cut down to the fields read. Values are the traces' own.
mod proto {
    use super::pb::{AnyValue, KeyValue, Resource};

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ExportLogsServiceRequest {
        #[prost(message, repeated, tag = "1")]
        pub resource_logs: Vec<ResourceLogs>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ExportLogsServiceResponse {
        #[prost(message, optional, tag = "1")]
        pub partial_success: Option<PartialSuccess>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct PartialSuccess {
        #[prost(int64, tag = "1")]
        pub rejected_log_records: i64,
        #[prost(string, tag = "2")]
        pub error_message: String,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ResourceLogs {
        #[prost(message, optional, tag = "1")]
        pub resource: Option<Resource>,
        #[prost(message, repeated, tag = "2")]
        pub scope_logs: Vec<ScopeLogs>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ScopeLogs {
        #[prost(message, repeated, tag = "2")]
        pub log_records: Vec<LogRecord>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct LogRecord {
        #[prost(fixed64, tag = "1")]
        pub time_unix_nano: u64,
        #[prost(int32, tag = "2")]
        pub severity_number: i32,
        #[prost(string, tag = "3")]
        pub severity_text: String,
        #[prost(message, optional, tag = "5")]
        pub body: Option<AnyValue>,
        #[prost(message, repeated, tag = "6")]
        pub attributes: Vec<KeyValue>,
        #[prost(bytes = "vec", tag = "9")]
        pub trace_id: Vec<u8>,
        #[prost(bytes = "vec", tag = "10")]
        pub span_id: Vec<u8>,
        #[prost(fixed64, tag = "11")]
        pub observed_time_unix_nano: u64,
    }
}

/// OTLP's JSON encoding of the same, read into the protobuf messages.
mod json {
    use serde::Deserialize;
    use serde_json::Value;

    use super::super::json::{AnyValue, KeyValue, Resource, hex, number, pairs, signed, value};
    use super::{pb, proto};

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    pub struct Request {
        resource_logs: Vec<ResourceLogs>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct ResourceLogs {
        resource: Option<Resource>,
        scope_logs: Vec<ScopeLogs>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct ScopeLogs {
        log_records: Vec<LogRecord>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct LogRecord {
        time_unix_nano: Value,
        observed_time_unix_nano: Value,
        severity_number: Value,
        severity_text: String,
        body: Option<AnyValue>,
        attributes: Vec<KeyValue>,
        trace_id: String,
        span_id: String,
    }

    impl Request {
        pub fn into_pb(self) -> proto::ExportLogsServiceRequest {
            let resource_logs = self
                .resource_logs
                .into_iter()
                .map(|rl| proto::ResourceLogs {
                    resource: rl.resource.map(|r| pb::Resource { attributes: pairs(r.attributes) }),
                    scope_logs: vec![proto::ScopeLogs {
                        log_records: rl
                            .scope_logs
                            .into_iter()
                            .flat_map(|s| s.log_records)
                            .map(LogRecord::into_pb)
                            .collect(),
                    }],
                })
                .collect();
            proto::ExportLogsServiceRequest { resource_logs }
        }
    }

    impl LogRecord {
        fn into_pb(self) -> proto::LogRecord {
            proto::LogRecord {
                time_unix_nano: number(&self.time_unix_nano).unwrap_or(0),
                observed_time_unix_nano: number(&self.observed_time_unix_nano).unwrap_or(0),
                severity_number: severity(&self.severity_number),
                severity_text: self.severity_text,
                body: self.body.map(value),
                attributes: pairs(self.attributes),
                trace_id: hex(&self.trace_id),
                span_id: hex(&self.span_id),
            }
        }
    }

    /// A number, or its enum name: `SEVERITY_NUMBER_WARN2` is 14.
    fn severity(v: &Value) -> i32 {
        const NAMES: [&str; 6] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
        if let Value::String(s) = v
            && let Some(rest) = s.strip_prefix("SEVERITY_NUMBER_")
        {
            let digits = rest.trim_start_matches(|c: char| c.is_ascii_alphabetic());
            let name = &rest[..rest.len() - digits.len()];
            let step: i32 = if digits.is_empty() { 1 } else { digits.parse().unwrap_or(1) };
            return match NAMES.iter().position(|n| *n == name) {
                Some(i) if (1..=4).contains(&step) => i as i32 * 4 + step,
                _ => 0,
            };
        }
        signed(v).and_then(|n| i32::try_from(n).ok()).unwrap_or(0)
    }

    #[cfg(test)]
    mod tests {
        use serde_json::json;

        #[test]
        fn severity_names_are_their_numbers() {
            assert_eq!(super::severity(&json!("SEVERITY_NUMBER_INFO")), 9);
            assert_eq!(super::severity(&json!("SEVERITY_NUMBER_WARN2")), 14);
            assert_eq!(super::severity(&json!("SEVERITY_NUMBER_FATAL4")), 24);
            assert_eq!(super::severity(&json!(17)), 17);
            assert_eq!(super::severity(&json!("17")), 17);
            assert_eq!(super::severity(&json!("SEVERITY_NUMBER_UNSPECIFIED")), 0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::pb::any_value::Value;
    use super::*;

    fn kv(key: &str, v: Value) -> pb::KeyValue {
        pb::KeyValue { key: key.into(), value: Some(pb::AnyValue { value: Some(v) }) }
    }

    fn s(v: &str) -> Value {
        Value::String(v.into())
    }

    fn record(severity: i32, body: Value, attributes: Vec<pb::KeyValue>) -> proto::LogRecord {
        proto::LogRecord {
            time_unix_nano: 1_760_000_000_123_000_000,
            severity_number: severity,
            body: Some(pb::AnyValue { value: Some(body) }),
            attributes,
            trace_id: vec![0xab; 16],
            span_id: vec![1; 8],
            ..Default::default()
        }
    }

    fn export(resource: Vec<pb::KeyValue>, records: Vec<proto::LogRecord>) -> Vec<u8> {
        proto::ExportLogsServiceRequest {
            resource_logs: vec![proto::ResourceLogs {
                resource: Some(pb::Resource { attributes: resource }),
                scope_logs: vec![proto::ScopeLogs { log_records: records }],
            }],
        }
        .encode_to_vec()
    }

    #[test]
    fn reads_protobuf() {
        let body = export(
            vec![
                kv("service.name", s("harbour-api")),
                kv("service.version", s("1.4.0")),
                kv("deployment.environment.name", s("staging")),
            ],
            vec![
                record(
                    13,
                    s("Slot sync slow for ana@example.com"),
                    vec![kv("practice", s("north")), kv(EVENT_ATTRIBUTE, s("evt_1")), kv("api_key", s("abc"))],
                ),
                record(0, Value::Int(4), vec![]),
            ],
        );
        let p = parse_logs(&body, Encoding::Protobuf, 5).unwrap();
        assert_eq!(p.rejected, 0);
        let [a, b] = p.lines.as_slice() else { panic!("two lines") };
        assert_eq!(a.at, 1_760_000_000_123);
        assert_eq!(a.level, LogLevel::Warning);
        assert_eq!(a.message, "Slot sync slow for [email]");
        assert_eq!(a.service.as_deref(), Some("harbour-api"));
        assert_eq!(a.release.as_deref(), Some("1.4.0"));
        assert_eq!(a.environment.as_str(), "staging");
        assert_eq!(a.trace_id.as_deref(), Some("ab".repeat(16).as_str()));
        assert_eq!(a.span_id.as_deref(), Some("0101010101010101"));
        assert_eq!(a.event_ref.as_deref(), Some("evt_1"));
        assert_eq!(a.fields.len(), 2, "the event link isn't a field");
        assert_eq!(a.fields["api_key"], "[redacted]");
        assert_eq!(b.level, LogLevel::Info, "no severity at all is info");
        assert_eq!(b.message, "4", "a body that isn't a string is JSON");
    }

    #[test]
    fn reads_json_as_the_sdks_send_it() {
        let body = serde_json::json!({ "resourceLogs": [{
            "resource": { "attributes": [{ "key": "service.name", "value": { "stringValue": "unknown_service:node" } }] },
            "scopeLogs": [{ "logRecords": [
                { "timeUnixNano": "1760000000000000000", "severityNumber": 17, "severityText": "ERROR",
                  "body": { "stringValue": "Payment failed" },
                  "attributes": [{ "key": "bertha.dropped", "value": { "stringValue": "12" } }] },
                { "observedTimeUnixNano": "1760000001000000000", "severityText": "debug",
                  "body": { "kvlistValue": { "values": [{ "key": "a", "value": { "intValue": "1" } }] } } },
                { "severityNumber": "SEVERITY_NUMBER_FATAL", "body": { "stringValue": "Out of memory" } }
            ] }]
        }] });
        let p = parse_logs(body.to_string().as_bytes(), Encoding::Json, 42).unwrap();
        let [a, b, c] = p.lines.as_slice() else { panic!("three lines") };
        assert_eq!(a.service, None, "unknown_service is no service");
        assert_eq!(a.environment.as_str(), "production");
        assert_eq!(a.level, LogLevel::Error);
        assert_eq!(a.fields["bertha.dropped"], "12");
        assert_eq!(a.trace_id, None);
        assert_eq!(b.at, 1_760_000_001_000, "the observed time when there's no time");
        assert_eq!(b.level, LogLevel::Debug, "the text when there's no number");
        assert_eq!(b.message, r#"{"a":1}"#);
        assert_eq!(c.at, 42, "now when there's neither");
        assert_eq!(c.level, LogLevel::Fatal);
    }

    #[test]
    fn bounds_lines_and_fields() {
        let many: Vec<_> = (0..80).map(|i| kv(&format!("k{i:02}"), s(&"v".repeat(3_000)))).collect();
        let body = export(vec![], vec![record(9, s(&"x".repeat(20_000)), many)]);
        let p = parse_logs(&body, Encoding::Protobuf, 0).unwrap();
        let line = &p.lines[0];
        assert_eq!(line.fields.len(), limits::FIELDS);
        assert!(line.fields.values().all(|v| v.chars().count() <= limits::VALUE_CHARS));
        assert!(line.message.chars().count() <= limits::MESSAGE_CHARS);

        let records = (0..LINES_PER_REQUEST + 3).map(|_| record(9, s("tick"), vec![])).collect();
        let p = parse_logs(&export(vec![], records), Encoding::Protobuf, 0).unwrap();
        assert_eq!((p.lines.len(), p.rejected), (LINES_PER_REQUEST, 3));
    }

    #[test]
    fn says_what_was_turned_away() {
        assert!(response(Encoding::Protobuf, 0, "").is_empty());
        assert_eq!(response(Encoding::Json, 0, ""), b"{}");
        let json: serde_json::Value = serde_json::from_slice(&response(Encoding::Json, 3, "Over the cap.")).unwrap();
        assert_eq!(json["partialSuccess"]["rejectedLogRecords"], "3");
        let pb = proto::ExportLogsServiceResponse::decode(response(Encoding::Protobuf, 3, "x").as_slice()).unwrap();
        assert_eq!(pb.partial_success.map(|p| p.rejected_log_records), Some(3));
    }

    #[test]
    fn rejects_what_isnt_an_export() {
        assert!(matches!(parse_logs(b"{", Encoding::Json, 0), Err(Malformed::Json(_))));
        assert!(matches!(parse_logs(&[0xff, 0xff], Encoding::Protobuf, 0), Err(Malformed::Protobuf(_))));
    }
}
