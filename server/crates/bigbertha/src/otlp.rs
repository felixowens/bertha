//! An OTLP/HTTP span exporter that sends to bertha and rides out a network blip.

use std::io::Read;
use std::time::Duration;

use opentelemetry_http::{Bytes, HttpClient, HttpError, Request, Response};
use opentelemetry_otlp::{RetryPolicy, SpanExporter, WithExportConfig, WithHttpConfig};

use crate::client::OUTAGE;

/// The most of a response it reads. bertha's answers are a few bytes.
const MAX_RESPONSE: u64 = 64 * 1024;

/// A span exporter for an OpenTelemetry tracer provider, sending to bertha from
/// `BERTHA_URL` and `BERTHA_KEY`. A batch that can't reach bertha is tried again with
/// backoff for up to 5 minutes, each try waiting at most 10 seconds, so a network blip
/// loses nothing. `None`, after a warning, when either variable is missing or the
/// exporter can't be made.
///
/// It sends from the thread that exports, so use it with the SDK's default batch
/// processor, which exports on a thread of its own.
pub fn span_exporter() -> Option<SpanExporter> {
    let otlp = crate::otlp()?;
    SpanExporter::builder()
        .with_http()
        .with_endpoint(otlp.endpoint)
        .with_headers(otlp.headers.into_iter().collect())
        .with_http_client(Ureq(crate::transport::agent()))
        .with_timeout(OUTAGE)
        .with_retry_policy(retry_policy())
        .build()
        .inspect_err(|e| eprintln!("[bertha] Couldn't make the span exporter: {e}. No spans will reach bertha."))
        .ok()
}

/// Backoff from 1s to 30s; the exporter's timeout (`OUTAGE`) bounds the whole of it.
fn retry_policy() -> RetryPolicy {
    RetryPolicy::recommended()
        .with_max_retries(usize::MAX)
        .with_initial_delay(Duration::from_secs(1))
        .with_max_delay(Duration::from_secs(30))
        .with_max_jitter(Duration::from_secs(1))
}

/// bigbertha's own HTTP client, with its 10 second timeout on each request.
#[derive(Debug)]
struct Ureq(ureq::Agent);

#[async_trait::async_trait]
impl HttpClient for Ureq {
    async fn send_bytes(&self, request: Request<Bytes>) -> Result<Response<Bytes>, HttpError> {
        let (parts, body) = request.into_parts();
        let mut req = self.0.post(parts.uri.to_string());
        for (name, value) in &parts.headers {
            req = req.header(name.as_str(), value.to_str()?);
        }
        let res = req.send(&body[..])?;
        let status = res.status();
        let mut read = Vec::new();
        res.into_body().into_reader().take(MAX_RESPONSE).read_to_end(&mut read)?;
        Ok(Response::builder().status(status).body(Bytes::from(read))?)
    }
}
