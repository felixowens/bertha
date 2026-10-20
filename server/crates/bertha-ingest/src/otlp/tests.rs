use super::pb::any_value::Value;
use super::*;

fn kv(key: &str, v: Value) -> pb::KeyValue {
    pb::KeyValue { key: key.into(), value: Some(pb::AnyValue { value: Some(v) }) }
}

fn s(v: &str) -> Value {
    Value::String(v.into())
}

fn span(name: &str, trace: u8, id: u8, parent: Option<u8>) -> pb::Span {
    pb::Span {
        trace_id: vec![trace; 16],
        span_id: vec![id; 8],
        parent_span_id: parent.map(|p| vec![p; 8]).unwrap_or_default(),
        name: name.into(),
        kind: 2,
        start_time_unix_nano: 1_760_000_000_000_000_000,
        end_time_unix_nano: 1_760_000_000_250_000_000,
        attributes: vec![kv("http.route", s("/book/[practice]")), kv("http.status_code", Value::Int(200))],
        status: None,
    }
}

fn export(resource: Vec<pb::KeyValue>, spans: Vec<pb::Span>) -> Vec<u8> {
    pb::ExportTraceServiceRequest {
        resource_spans: vec![pb::ResourceSpans {
            resource: Some(pb::Resource { attributes: resource }),
            scope_spans: vec![pb::ScopeSpans { spans }],
        }],
    }
    .encode_to_vec()
}

#[test]
fn reads_protobuf() {
    let body = export(
        vec![
            kv("service.name", s("harbour-bookings")),
            kv("host.name", s("web-1")),
            kv("process.command_args", s("--key=x")),
        ],
        vec![span("GET /book/[practice]", 0xab, 1, None), span("prisma slot.findMany", 0xab, 2, Some(1))],
    );
    let p = parse_traces(&body, Encoding::Protobuf, "harbour").unwrap();
    assert_eq!(p.rejected, 0);
    let [a, b] = p.spans.as_slice() else { panic!("two spans") };
    assert_eq!(a.trace_id, "ab".repeat(16));
    assert_eq!(a.span_id, "01".repeat(8));
    assert_eq!(a.parent_id, None);
    assert_eq!(b.parent_id.as_deref(), Some("0101010101010101"));
    assert_eq!(a.service, "harbour-bookings");
    assert_eq!(a.runtime, Runtime::Server);
    assert_eq!(a.kind, SpanKind::Server);
    assert_eq!(a.start_us, 1_760_000_000_000_000);
    assert_eq!(a.duration_us, 250_000);
    assert_eq!(a.status, SpanStatus::Unset);
    assert_eq!(a.attributes["http.status_code"], "200");
    assert_eq!(a.attributes["host.name"], "web-1");
    assert!(!a.attributes.contains_key("process.command_args"));
}

#[test]
fn reads_json_as_exporters_send_it() {
    let body = br#"{"resourceSpans":[{
        "resource":{"attributes":[
            {"key":"service.name","value":{"stringValue":"unknown_service:node"}},
            {"key":"telemetry.sdk.language","value":{"stringValue":"webjs"}}]},
        "scopeSpans":[{"scope":{"name":"@bigbertha/sdk"},"spans":[{
            "traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7",
            "name":"GET /book/whitby/slots","kind":3,
            "startTimeUnixNano":"1760000000000000000","endTimeUnixNano":1760000001500000000,
            "attributes":[
                {"key":"http.status_code","value":{"intValue":"502"}},
                {"key":"retry","value":{"boolValue":false}},
                {"key":"ratio","value":{"doubleValue":0.5}},
                {"key":"tags","value":{"arrayValue":{"values":[{"stringValue":"a"},{"intValue":2}]}}}],
            "status":{"code":2,"message":"502 Bad Gateway"},
            "events":[{"name":"ignored"}]}]}]}]}"#;
    let p = parse_traces(body, Encoding::Json, "harbour").unwrap();
    let [a] = p.spans.as_slice() else { panic!("one span") };
    assert_eq!(a.service, "harbour", "unknown_service falls back to the project");
    assert_eq!(a.runtime, Runtime::Browser);
    assert_eq!(a.kind, SpanKind::Client);
    assert_eq!(a.duration_us, 1_500_000);
    assert_eq!(a.status, SpanStatus::Error);
    assert_eq!(a.status_message.as_deref(), Some("502 Bad Gateway"));
    assert_eq!(a.attributes["http.status_code"], "502");
    assert_eq!(a.attributes["retry"], "false");
    assert_eq!(a.attributes["ratio"], "0.5");
    assert_eq!(a.attributes["tags"], "[a, 2]");
}

#[test]
fn json_enums_by_name() {
    let body = br#"{"resourceSpans":[{"scopeSpans":[{"spans":[{
        "traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","parentSpanId":"",
        "name":"x","kind":"SPAN_KIND_PRODUCER","startTimeUnixNano":"5000","endTimeUnixNano":"4000",
        "status":{"code":"STATUS_CODE_OK"}}]}]}]}"#;
    let p = parse_traces(body, Encoding::Json, "kiln").unwrap();
    assert_eq!(p.spans[0].kind, SpanKind::Producer);
    assert_eq!(p.spans[0].status, SpanStatus::Ok);
    assert_eq!(p.spans[0].duration_us, 0, "an end before the start is no time");
    assert_eq!(p.spans[0].service, "kiln");
}

#[test]
fn edge_runtime() {
    let body = export(vec![kv("vercel.runtime", s("edge"))], vec![span("middleware", 1, 1, None)]);
    assert_eq!(parse_traces(&body, Encoding::Protobuf, "p").unwrap().spans[0].runtime, Runtime::Edge);
}

#[test]
fn turns_away_bad_ids() {
    let mut zero = span("zero trace", 0, 1, None);
    zero.trace_id = vec![0; 16];
    let mut short = span("short id", 1, 1, None);
    short.span_id = vec![1; 4];
    let mut unstarted = span("no start", 1, 2, None);
    unstarted.start_time_unix_nano = 0;
    let body = export(vec![], vec![zero, short, unstarted, span("fine", 1, 3, None)]);
    let p = parse_traces(&body, Encoding::Protobuf, "p").unwrap();
    assert_eq!(p.rejected, 3);
    assert_eq!(p.spans.len(), 1);
}

#[test]
fn caps_spans_and_attributes() {
    let mut big = span("big", 1, 1, None);
    big.attributes = (0..100).map(|i| kv(&format!("k{i}"), s(&"v".repeat(5_000)))).collect();
    let mut spans = vec![big];
    spans.extend((0..limits::SPANS_PER_REQUEST).map(|i| span("more", 1, (i % 250) as u8 + 2, None)));
    let p = parse_traces(&export(vec![], spans), Encoding::Protobuf, "p").unwrap();
    assert_eq!(p.spans.len(), limits::SPANS_PER_REQUEST);
    assert_eq!(p.rejected, 1);
    assert_eq!(p.spans[0].attributes.len(), limits::ATTRIBUTES);
    assert!(p.spans[0].attributes.values().all(|v| v.chars().count() <= limits::VALUE_CHARS));
}

#[test]
fn scrubs_credentials() {
    let mut sp = span("GET /cart?token=abc123&page=2", 1, 1, None);
    sp.attributes = vec![
        kv("http.request.header.authorization", s("Bearer abc")),
        kv("db.password", s("hunter2")),
        kv("api_key", s("k")),
        kv("gen_ai.usage.input_tokens", Value::Int(12)),
        kv("url.full", s("https://x.test/a?session_id=s3cr3t&q=shoes")),
        kv("db.statement", s("SELECT * FROM users WHERE email = 'ana@example.com'")),
    ];
    sp.status = Some(pb::Status { message: "auth failed with Bearer eyJhbGciOi".into(), code: 2 });
    let p = parse_traces(&export(vec![], vec![sp]), Encoding::Protobuf, "p").unwrap();
    let a = &p.spans[0];
    assert_eq!(a.name, "GET /cart?token=[redacted]&page=2");
    assert_eq!(a.attributes["http.request.header.authorization"], "[redacted]");
    assert_eq!(a.attributes["db.password"], "[redacted]");
    assert_eq!(a.attributes["api_key"], "[redacted]");
    assert_eq!(a.attributes["gen_ai.usage.input_tokens"], "12");
    assert_eq!(a.attributes["url.full"], "https://x.test/a?session_id=[redacted]&q=shoes");
    assert_eq!(a.attributes["db.statement"], "SELECT * FROM users WHERE email = '[email]'");
    assert_eq!(a.status_message.as_deref(), Some("auth failed with Bearer [redacted]"));
}

#[test]
fn malformed_bodies() {
    assert!(matches!(parse_traces(b"\xff\xff\xff", Encoding::Protobuf, "p"), Err(Malformed::Protobuf(_))));
    assert!(matches!(parse_traces(b"{nope", Encoding::Json, "p"), Err(Malformed::Json(_))));
    // An empty export is fine: some exporters send them on shutdown.
    assert_eq!(parse_traces(b"", Encoding::Protobuf, "p").unwrap(), Parsed::default());
    assert_eq!(parse_traces(b"{}", Encoding::Json, "p").unwrap(), Parsed::default());
}

#[test]
fn encoding_from_content_type() {
    assert_eq!(Encoding::from_content_type(Some("application/x-protobuf")), Encoding::Protobuf);
    assert_eq!(Encoding::from_content_type(Some("application/json")), Encoding::Json);
    assert_eq!(Encoding::from_content_type(Some("text/plain;charset=UTF-8")), Encoding::Json);
    assert_eq!(Encoding::from_content_type(None), Encoding::Json);
}

#[test]
fn responses() {
    assert!(response(Encoding::Protobuf, 0, "").is_empty());
    let partial =
        pb::ExportTraceServiceResponse::decode(response(Encoding::Protobuf, 3, "Over the limit.").as_slice()).unwrap();
    assert_eq!(partial.partial_success.unwrap().rejected_spans, 3);
    assert_eq!(response(Encoding::Json, 0, ""), b"{}");
    let j: serde_json::Value = serde_json::from_slice(&response(Encoding::Json, 2, "Over the limit.")).unwrap();
    assert_eq!(j["partialSuccess"]["rejectedSpans"], "2");
}
