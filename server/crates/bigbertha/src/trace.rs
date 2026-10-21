// W3C trace context (`traceparent: 00-<trace id>-<span id>-<flags>`), so a page's
// requests and the server errors they cause share a trace id.

use crate::random;
use crate::wire::IngestTrace;

/// The incoming request's trace: its trace id, and the caller's span. `None` unless the
/// header is a valid `traceparent`.
pub fn parse_traceparent(header: &str) -> Option<IngestTrace> {
    let h = header.trim().to_ascii_lowercase();
    let mut parts = h.split('-');
    let (version, trace, span, flags) = (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
    let hex = |s: &str, n: usize| s.len() == n && s.bytes().all(|b| b.is_ascii_hexdigit());
    let zero = |s: &str| s.bytes().all(|b| b == b'0');
    if parts.next().is_some() || !hex(version, 2) || !hex(trace, 32) || !hex(span, 16) || !hex(flags, 2) {
        return None;
    }
    if zero(trace) || zero(span) {
        return None;
    }
    Some(IngestTrace { trace_id: trace.to_owned(), span_id: Some(span.to_owned()) })
}

/// A `traceparent` header for an outgoing request.
pub fn traceparent(trace_id: &str, span_id: &str) -> String {
    format!("00-{trace_id}-{span_id}-01")
}

/// `n` random lowercase hex characters, never all zeros (the spec's invalid id).
pub fn random_hex(n: usize) -> String {
    let mut out = String::with_capacity(n);
    while out.len() < n {
        out.push_str(&random::hex(&random::bytes::<16>()));
    }
    out.truncate(n);
    if out.bytes().all(|b| b == b'0') {
        out.replace_range(..1, "1");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_traceparents_only() {
        let t = parse_traceparent(" 00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01 ").expect("valid");
        assert_eq!(t.trace_id, "4bf92f3577b34da6a3ce929d0e0e4736");
        assert_eq!(t.span_id.as_deref(), Some("00f067aa0ba902b7"));
        assert!(parse_traceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01").is_none());
        assert!(parse_traceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01").is_none());
        assert!(parse_traceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7").is_none());
        assert!(parse_traceparent("garbage").is_none());
        let id = random_hex(32);
        assert_eq!(id.len(), 32);
        let header = traceparent(&id, &random_hex(16));
        assert_eq!(parse_traceparent(&header).map(|t| t.trace_id), Some(id));
    }
}
