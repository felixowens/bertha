//! OTLP/HTTP traces: what OpenTelemetry exporters send to `/ingest/v1/traces`, as
//! protobuf or JSON, turned into the spans bertha stores.
//!
//! Only the fields bertha shows are decoded; the rest (span events, links, scopes) are
//! skipped. Values are scrubbed like the SDK scrubs events, since these spans never
//! pass through it.

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::sync::LazyLock;

use bertha_core::domain::{Runtime, SpanKind, SpanStatus};
use bertha_db::writes::spans::NewSpan;
use prost::Message as _;
use regex::Regex;

use crate::cut;

pub mod limits {
    /// Compressed request body. An exporter's batch is at most a few hundred spans.
    pub const BODY_BYTES: usize = 4 * 1024 * 1024;
    pub const DECOMPRESSED_BYTES: usize = 16 * 1024 * 1024;
    pub const SPANS_PER_REQUEST: usize = 2_000;
    pub const ATTRIBUTES: usize = 64;
    pub const NAME_CHARS: usize = 256;
    pub const VALUE_CHARS: usize = 1_024;
    pub const KEY_CHARS: usize = 128;
}

/// What the body was sent as, from its `Content-Type`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Encoding {
    Protobuf,
    /// Also what a browser's `sendBeacon` sends, as `text/plain`.
    Json,
}

impl Encoding {
    pub fn from_content_type(ct: Option<&str>) -> Encoding {
        if ct.is_some_and(|c| c.to_ascii_lowercase().contains("protobuf")) {
            Encoding::Protobuf
        } else {
            Encoding::Json
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum Malformed {
    #[error("The body isn't an OTLP trace export in protobuf: {0}")]
    Protobuf(String),
    #[error("The body isn't an OTLP trace export in JSON: {0}")]
    Json(String),
}

/// The spans worth storing, and how many were turned away (bad ids, over the limit).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Parsed {
    pub spans: Vec<NewSpan>,
    pub rejected: usize,
}

/// Decodes an export. `project` names the service when the app didn't set
/// `service.name`.
pub fn parse_traces(body: &[u8], encoding: Encoding, project: &str) -> Result<Parsed, Malformed> {
    let request = match encoding {
        Encoding::Protobuf => {
            pb::ExportTraceServiceRequest::decode(body).map_err(|e| Malformed::Protobuf(e.to_string()))?
        }
        Encoding::Json => {
            let j: json::Request = serde_json::from_slice(body).map_err(|e| Malformed::Json(e.to_string()))?;
            j.into_pb().map_err(Malformed::Json)?
        }
    };
    Ok(normalize(request, project))
}

/// The answer an exporter expects: empty when everything was taken, otherwise a
/// partial success saying how many spans weren't.
pub fn response(encoding: Encoding, rejected: usize, message: &str) -> Vec<u8> {
    match encoding {
        Encoding::Protobuf => {
            let partial_success = (rejected > 0).then(|| pb::PartialSuccess {
                rejected_spans: i64::try_from(rejected).unwrap_or(i64::MAX),
                error_message: message.to_owned(),
            });
            pb::ExportTraceServiceResponse { partial_success }.encode_to_vec()
        }
        Encoding::Json if rejected == 0 => b"{}".to_vec(),
        Encoding::Json => serde_json::json!({
            "partialSuccess": { "rejectedSpans": rejected.to_string(), "errorMessage": message }
        })
        .to_string()
        .into_bytes(),
    }
}

/// Resource attributes copied onto each span: where it ran, never what it ran with
/// (`process.command_args` and the like can hold secrets).
const RESOURCE_KEPT: [&str; 9] = [
    "host.name",
    "service.version",
    "service.instance.id",
    "deployment.environment",
    "deployment.environment.name",
    "cloud.region",
    "faas.name",
    "faas.instance",
    "vercel.region",
];

fn normalize(request: pb::ExportTraceServiceRequest, project: &str) -> Parsed {
    let mut out = Parsed::default();
    for rs in request.resource_spans {
        let resource: Vec<(String, String)> = rs
            .resource
            .map(|r| r.attributes)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|kv| Some((kv.key, text(&kv.value?))))
            .collect();
        let attr = |k: &str| resource.iter().find(|(key, _)| key == k).map(|(_, v)| v.as_str());
        let service = attr("service.name")
            .map(str::trim)
            .filter(|s| !s.is_empty() && !s.starts_with("unknown_service"))
            .unwrap_or(project);
        let service = cut(service, limits::KEY_CHARS);
        let runtime = runtime(&attr);
        let kept: Vec<&(String, String)> =
            resource.iter().filter(|(k, _)| RESOURCE_KEPT.contains(&k.as_str())).collect();

        for span in rs.scope_spans.into_iter().flat_map(|s| s.spans) {
            if out.spans.len() >= limits::SPANS_PER_REQUEST {
                out.rejected += 1;
                continue;
            }
            match to_span(span, &service, runtime, &kept) {
                Some(s) => out.spans.push(s),
                None => out.rejected += 1,
            }
        }
    }
    out
}

/// Browser spans say `webjs`; Vercel's and Next's edge runtime say `edge`.
fn runtime<'a>(attr: &impl Fn(&str) -> Option<&'a str>) -> Runtime {
    if attr("telemetry.sdk.language") == Some("webjs") {
        return Runtime::Browser;
    }
    let edge = ["vercel.runtime", "next.runtime", "process.runtime.name"]
        .iter()
        .any(|k| attr(k).is_some_and(|v| matches!(v, "edge" | "vercel-edge" | "workerd")));
    if edge { Runtime::Edge } else { Runtime::Server }
}

fn to_span(s: pb::Span, service: &str, runtime: Runtime, resource: &[&(String, String)]) -> Option<NewSpan> {
    let trace_id = id(&s.trace_id, 16)?;
    let span_id = id(&s.span_id, 8)?;
    if s.start_time_unix_nano == 0 {
        return None;
    }
    let start_us = i64::try_from(s.start_time_unix_nano / 1_000).ok()?;
    let duration_us = i64::try_from(s.end_time_unix_nano.saturating_sub(s.start_time_unix_nano) / 1_000).ok()?;
    let kind = match s.kind {
        2 => SpanKind::Server,
        3 => SpanKind::Client,
        4 => SpanKind::Producer,
        5 => SpanKind::Consumer,
        _ => SpanKind::Internal,
    };
    let (status, status_message) = match s.status {
        Some(st) => {
            let status = match st.code {
                1 => SpanStatus::Ok,
                2 => SpanStatus::Error,
                _ => SpanStatus::Unset,
            };
            let message =
                Some(st.message.trim()).filter(|m| !m.is_empty()).map(|m| cut(&scrub(m), limits::VALUE_CHARS));
            (status, message)
        }
        None => (SpanStatus::Unset, None),
    };
    let name = Some(s.name.trim()).filter(|n| !n.is_empty()).unwrap_or("span");

    let mut attributes = BTreeMap::new();
    for kv in s.attributes {
        if attributes.len() >= limits::ATTRIBUTES {
            break;
        }
        let key = kv.key.trim();
        let Some(value) = kv.value else { continue };
        if key.is_empty() {
            continue;
        }
        let value =
            if secret_key(key) { "[redacted]".to_owned() } else { cut(&scrub(&text(&value)), limits::VALUE_CHARS) };
        attributes.insert(cut(key, limits::KEY_CHARS), value);
    }
    for (k, v) in resource {
        if attributes.len() >= limits::ATTRIBUTES {
            break;
        }
        attributes.entry(k.clone()).or_insert_with(|| cut(v, limits::VALUE_CHARS));
    }

    Some(NewSpan {
        trace_id,
        span_id,
        parent_id: id(&s.parent_span_id, 8),
        service: service.to_owned(),
        runtime,
        name: cut(&scrub(name), limits::NAME_CHARS),
        kind,
        start_us,
        duration_us,
        status,
        status_message,
        attributes,
    })
}

/// Lowercase hex of an id of `len` bytes, or `None` if it's the wrong size or all zeros.
fn id(bytes: &[u8], len: usize) -> Option<String> {
    if bytes.len() != len || bytes.iter().all(|b| *b == 0) {
        return None;
    }
    let mut s = String::with_capacity(len * 2);
    for b in bytes {
        let _ = write!(s, "{b:02x}");
    }
    Some(s)
}

/// An attribute value as one line of text.
fn text(v: &pb::AnyValue) -> String {
    use pb::any_value::Value;
    match &v.value {
        None => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Int(i)) => i.to_string(),
        Some(Value::Double(d)) => d.to_string(),
        Some(Value::Bytes(b)) => format!("{} bytes", b.len()),
        Some(Value::Array(a)) => format!("[{}]", a.values.iter().map(text).collect::<Vec<_>>().join(", ")),
        Some(Value::Kvlist(l)) => {
            let parts: Vec<String> = l
                .values
                .iter()
                .map(|kv| format!("{}: {}", kv.key, kv.value.as_ref().map(text).unwrap_or_default()))
                .collect();
            format!("{{{}}}", parts.join(", "))
        }
    }
}

/// Keys whose values are credentials, whatever they hold: `http.request.header.authorization`,
/// `db.password`, `api_key`. Matched by whole words, so `gen_ai.usage.input_tokens` stays.
fn secret_key(key: &str) -> bool {
    let words: Vec<String> = key.split(['.', '_', '-']).map(str::to_ascii_lowercase).collect();
    let one = |w: &str| {
        matches!(
            w,
            "authorization"
                | "cookie"
                | "password"
                | "passwd"
                | "secret"
                | "token"
                | "apikey"
                | "credential"
                | "credentials"
        )
    };
    words.iter().any(|w| one(w))
        || words
            .windows(2)
            .any(|p| matches!((p[0].as_str(), p[1].as_str()), ("api" | "private" | "secret" | "access", "key")))
}

static EMAIL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[\w.+-]+@[\w-]+\.[\w.-]+").expect("valid regex"));
static BEARER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\b(Bearer|Basic)\s+[\w.~+/=-]+").expect("valid regex"));
static SECRET_PARAM: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)([?&](?:[^=&#]*(?:token|key|secret|password|passwd|auth|session|code|sig)[^=&#]*)=)[^&#\s]*")
        .expect("valid regex")
});

/// The SDK's `scrubText`: no email addresses, bearer tokens or secret-looking query values.
pub fn scrub(s: &str) -> String {
    let s = EMAIL.replace_all(s, "[email]");
    let s = BEARER.replace_all(&s, "$1 [redacted]");
    SECRET_PARAM.replace_all(&s, "${1}[redacted]").into_owned()
}

/// The OTLP protobuf messages, cut down to the fields read.
mod pb {
    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ExportTraceServiceRequest {
        #[prost(message, repeated, tag = "1")]
        pub resource_spans: Vec<ResourceSpans>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ExportTraceServiceResponse {
        #[prost(message, optional, tag = "1")]
        pub partial_success: Option<PartialSuccess>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct PartialSuccess {
        #[prost(int64, tag = "1")]
        pub rejected_spans: i64,
        #[prost(string, tag = "2")]
        pub error_message: String,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ResourceSpans {
        #[prost(message, optional, tag = "1")]
        pub resource: Option<Resource>,
        #[prost(message, repeated, tag = "2")]
        pub scope_spans: Vec<ScopeSpans>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct Resource {
        #[prost(message, repeated, tag = "1")]
        pub attributes: Vec<KeyValue>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ScopeSpans {
        #[prost(message, repeated, tag = "2")]
        pub spans: Vec<Span>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct Span {
        #[prost(bytes = "vec", tag = "1")]
        pub trace_id: Vec<u8>,
        #[prost(bytes = "vec", tag = "2")]
        pub span_id: Vec<u8>,
        #[prost(bytes = "vec", tag = "4")]
        pub parent_span_id: Vec<u8>,
        #[prost(string, tag = "5")]
        pub name: String,
        #[prost(int32, tag = "6")]
        pub kind: i32,
        #[prost(fixed64, tag = "7")]
        pub start_time_unix_nano: u64,
        #[prost(fixed64, tag = "8")]
        pub end_time_unix_nano: u64,
        #[prost(message, repeated, tag = "9")]
        pub attributes: Vec<KeyValue>,
        #[prost(message, optional, tag = "15")]
        pub status: Option<Status>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct Status {
        #[prost(string, tag = "2")]
        pub message: String,
        #[prost(int32, tag = "3")]
        pub code: i32,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct KeyValue {
        #[prost(string, tag = "1")]
        pub key: String,
        #[prost(message, optional, tag = "2")]
        pub value: Option<AnyValue>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct AnyValue {
        #[prost(oneof = "any_value::Value", tags = "1, 2, 3, 4, 5, 6, 7")]
        pub value: Option<any_value::Value>,
    }

    pub mod any_value {
        #[derive(Clone, PartialEq, prost::Oneof)]
        pub enum Value {
            #[prost(string, tag = "1")]
            String(String),
            #[prost(bool, tag = "2")]
            Bool(bool),
            #[prost(int64, tag = "3")]
            Int(i64),
            #[prost(double, tag = "4")]
            Double(f64),
            #[prost(message, tag = "5")]
            Array(super::ArrayValue),
            #[prost(message, tag = "6")]
            Kvlist(super::KeyValueList),
            #[prost(bytes = "vec", tag = "7")]
            Bytes(Vec<u8>),
        }
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct ArrayValue {
        #[prost(message, repeated, tag = "1")]
        pub values: Vec<AnyValue>,
    }

    #[derive(Clone, PartialEq, prost::Message)]
    pub struct KeyValueList {
        #[prost(message, repeated, tag = "1")]
        pub values: Vec<KeyValue>,
    }
}

/// OTLP's JSON encoding: camelCase fields, hex ids, 64-bit numbers as strings or numbers,
/// enums as numbers (or their names). Read into the protobuf messages.
mod json {
    use serde::Deserialize;
    use serde_json::Value;

    use super::pb;

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    pub struct Request {
        resource_spans: Vec<ResourceSpans>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct ResourceSpans {
        resource: Option<Resource>,
        scope_spans: Vec<ScopeSpans>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct Resource {
        attributes: Vec<KeyValue>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct ScopeSpans {
        spans: Vec<Span>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct Span {
        trace_id: String,
        span_id: String,
        parent_span_id: String,
        name: String,
        kind: Value,
        start_time_unix_nano: Value,
        end_time_unix_nano: Value,
        attributes: Vec<KeyValue>,
        status: Option<Status>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct Status {
        message: String,
        code: Value,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct KeyValue {
        key: String,
        value: Option<AnyValue>,
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    struct AnyValue {
        string_value: Option<String>,
        bool_value: Option<bool>,
        int_value: Option<Value>,
        double_value: Option<f64>,
        array_value: Option<Values>,
        kvlist_value: Option<Pairs>,
        bytes_value: Option<String>,
    }

    #[derive(Deserialize, Default)]
    #[serde(default)]
    struct Values {
        values: Vec<AnyValue>,
    }

    #[derive(Deserialize, Default)]
    #[serde(default)]
    struct Pairs {
        values: Vec<KeyValue>,
    }

    impl Request {
        pub fn into_pb(self) -> Result<pb::ExportTraceServiceRequest, String> {
            let resource_spans = self
                .resource_spans
                .into_iter()
                .map(|rs| {
                    let mut spans = Vec::new();
                    for s in rs.scope_spans.into_iter().flat_map(|s| s.spans) {
                        spans.push(s.into_pb()?);
                    }
                    Ok(pb::ResourceSpans {
                        resource: rs.resource.map(|r| pb::Resource { attributes: pairs(r.attributes) }),
                        scope_spans: vec![pb::ScopeSpans { spans }],
                    })
                })
                .collect::<Result<_, String>>()?;
            Ok(pb::ExportTraceServiceRequest { resource_spans })
        }
    }

    impl Span {
        fn into_pb(self) -> Result<pb::Span, String> {
            Ok(pb::Span {
                trace_id: hex(&self.trace_id),
                span_id: hex(&self.span_id),
                parent_span_id: hex(&self.parent_span_id),
                name: self.name,
                kind: kind(&self.kind),
                start_time_unix_nano: number(&self.start_time_unix_nano).ok_or("startTimeUnixNano isn't a number")?,
                end_time_unix_nano: number(&self.end_time_unix_nano).unwrap_or(0),
                attributes: pairs(self.attributes),
                status: self.status.map(|s| pb::Status { message: s.message, code: code(&s.code) }),
            })
        }
    }

    fn pairs(all: Vec<KeyValue>) -> Vec<pb::KeyValue> {
        all.into_iter().map(|kv| pb::KeyValue { key: kv.key, value: kv.value.map(value) }).collect()
    }

    fn value(v: AnyValue) -> pb::AnyValue {
        use pb::any_value::Value as V;
        let value = if let Some(s) = v.string_value {
            Some(V::String(s))
        } else if let Some(b) = v.bool_value {
            Some(V::Bool(b))
        } else if let Some(i) = v.int_value.as_ref().and_then(signed) {
            Some(V::Int(i))
        } else if let Some(d) = v.double_value {
            Some(V::Double(d))
        } else if let Some(a) = v.array_value {
            Some(V::Array(pb::ArrayValue { values: a.values.into_iter().map(value).collect() }))
        } else if let Some(l) = v.kvlist_value {
            Some(V::Kvlist(pb::KeyValueList { values: pairs(l.values) }))
        } else {
            // Only a byte value's size is shown, so it isn't decoded.
            v.bytes_value.map(|b| V::Bytes(vec![0; b.trim_end_matches('=').len() * 3 / 4]))
        };
        pb::AnyValue { value }
    }

    /// Ids are hex in OTLP JSON. Anything else decodes to nothing, which drops the span.
    fn hex(s: &str) -> Vec<u8> {
        let s = s.trim();
        if !s.len().is_multiple_of(2) || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
            return vec![];
        }
        (0..s.len()).step_by(2).filter_map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok()).collect()
    }

    fn number(v: &Value) -> Option<u64> {
        match v {
            Value::Number(n) => n.as_u64().or_else(|| n.as_f64().filter(|f| *f >= 0.0).map(|f| f as u64)),
            Value::String(s) => s.trim().parse().ok(),
            _ => None,
        }
    }

    fn signed(v: &Value) -> Option<i64> {
        match v {
            Value::Number(n) => n.as_i64(),
            Value::String(s) => s.trim().parse().ok(),
            _ => None,
        }
    }

    fn kind(v: &Value) -> i32 {
        match v {
            Value::String(s) => match s.as_str() {
                "SPAN_KIND_INTERNAL" => 1,
                "SPAN_KIND_SERVER" => 2,
                "SPAN_KIND_CLIENT" => 3,
                "SPAN_KIND_PRODUCER" => 4,
                "SPAN_KIND_CONSUMER" => 5,
                _ => s.parse().unwrap_or(0),
            },
            v => signed(v).and_then(|n| i32::try_from(n).ok()).unwrap_or(0),
        }
    }

    fn code(v: &Value) -> i32 {
        match v {
            Value::String(s) => match s.as_str() {
                "STATUS_CODE_OK" => 1,
                "STATUS_CODE_ERROR" => 2,
                _ => s.parse().unwrap_or(0),
            },
            v => signed(v).and_then(|n| i32::try_from(n).ok()).unwrap_or(0),
        }
    }
}

#[cfg(test)]
mod tests;
