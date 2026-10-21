// The active OpenTelemetry span, when the `opentelemetry` feature is on.

use crate::wire::IngestTrace;

#[cfg(feature = "opentelemetry")]
pub(crate) fn active() -> Option<IngestTrace> {
    use ::opentelemetry::trace::TraceContextExt;
    let cx = ::opentelemetry::Context::current();
    let span = cx.span();
    let sc = span.span_context();
    sc.is_valid().then(|| IngestTrace { trace_id: sc.trace_id().to_string(), span_id: Some(sc.span_id().to_string()) })
}

#[cfg(not(feature = "opentelemetry"))]
pub(crate) fn active() -> Option<IngestTrace> {
    None
}
