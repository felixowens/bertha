//! Error reporting for [bertha](https://github.com/felixowens/bertha) from Rust.
//!
//! ```no_run
//! // BERTHA_KEY and BERTHA_URL from the environment; the release is the crate version.
//! let _bertha = bigbertha::init(bigbertha::options!());
//!
//! if let Err(e) = std::fs::read("orders.db") {
//!     bigbertha::capture_error(&e);
//! }
//! ```
//!
//! Panics are reported by default. [`log`] sends log lines. The `tracing` feature turns
//! ERROR events into reports and sends events as log lines, `tower` attaches each request (and turns panics in handlers into 500s),
//! `anyhow` sends anyhow's backtrace, and `opentelemetry` joins the active span's trace.
//! See the README for each.

pub mod wire;

#[cfg(feature = "client")]
mod client;
#[cfg(feature = "client")]
mod deploy;
#[cfg(feature = "client")]
mod env;
#[cfg(feature = "client")]
mod exception;
#[cfg(feature = "client")]
pub mod log;
#[cfg(feature = "client")]
mod options;
#[cfg(feature = "client")]
mod otel;
#[cfg(feature = "panic")]
mod panic;
#[cfg(feature = "client")]
mod random;
#[cfg(feature = "client")]
mod scope;
#[cfg(feature = "client")]
mod scrub;
#[cfg(feature = "client")]
mod stack;
#[cfg(feature = "client")]
mod time;
#[cfg(feature = "client")]
pub mod trace;
#[cfg(feature = "client")]
mod transport;

#[cfg(feature = "anyhow")]
mod anyhow_support;
#[cfg(feature = "tower")]
pub mod tower;
#[cfg(feature = "tracing")]
pub mod tracing;

#[cfg(feature = "client")]
pub use client_api::*;

/// This crate's version, sent with every batch.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(feature = "client")]
mod client_api {
    use std::error::Error;
    use std::sync::Arc;
    use std::time::Duration;

    pub use crate::client::Capture;
    pub use crate::deploy::{DeployError, record_deploy};
    pub use crate::log::LogLevel;
    pub use crate::options::{App, BeforeSend, Options};
    pub use crate::scope::{Bound, Scope, ScopeGuard};
    pub use crate::wire::IngestLevel as Level;
    pub use crate::wire::{IngestBreadcrumb, IngestEvent, IngestRequest, IngestTrace, IngestUser};

    #[cfg(feature = "anyhow")]
    pub use crate::anyhow_support::{capture_anyhow, capture_anyhow_with};

    use crate::client::{Client, EXIT_FLUSH, hub};
    use crate::exception::{dyn_type, from_error, short_type};
    use crate::wire::IngestMechanism;

    /// Starts reporting. Keep the guard until the process ends: dropping it sends what's
    /// left (waiting up to 2s) and stops. `None`, after a warning, when there's no key
    /// or URL.
    pub fn init(options: Options) -> Option<Guard> {
        #[cfg(feature = "panic")]
        let panics = options.panics;
        let client = Client::new(options)?;
        Client::install(&client);
        #[cfg(feature = "panic")]
        if panics {
            crate::panic::install();
        }
        #[cfg(feature = "anyhow")]
        if client.options.debug
            && crate::env::var("RUST_LIB_BACKTRACE").is_none()
            && crate::env::var("RUST_BACKTRACE").is_none()
        {
            client.log(
                "RUST_LIB_BACKTRACE isn't set, so anyhow errors arrive without a stack. Set RUST_LIB_BACKTRACE=1.",
            );
        }
        Some(Guard { client })
    }

    /// Returned by [`init`]. Sends what's queued when dropped, for up to 2s.
    #[must_use = "reporting stops as soon as the guard drops; keep it in main"]
    pub struct Guard {
        client: Arc<Client>,
    }

    impl Guard {
        /// Sends what's queued, waiting up to `timeout`. True when nothing is left.
        pub fn flush(&self, timeout: Duration) -> bool {
            self.client.flush(timeout)
        }
    }

    impl std::fmt::Debug for Guard {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.debug_struct("Guard").finish_non_exhaustive()
        }
    }

    impl Drop for Guard {
        fn drop(&mut self) {
            self.client.flush(EXIT_FLUSH);
            self.client.close();
            Client::uninstall(&self.client);
        }
    }

    /// Reports an error with its `source()` chain. Returns the event id, unless it was
    /// dropped (no client, sampling, the per-minute cap, `before_send`).
    pub fn capture_error<E: Error + 'static>(error: &E) -> Option<String> {
        capture_error_with(error, Capture::default())
    }

    pub fn capture_error_with<E: Error + 'static>(error: &E, capture: Capture) -> Option<String> {
        capture_exception(error, short_type::<E>(), capture)
    }

    /// For a `Box<dyn Error>` or `&dyn Error`, whose type isn't known: `capture_dyn_error(&*e)`.
    pub fn capture_dyn_error(error: &(dyn Error + 'static), capture: Capture) -> Option<String> {
        capture_exception(error, dyn_type(error), capture)
    }

    fn capture_exception(error: &(dyn Error + 'static), r#type: String, capture: Capture) -> Option<String> {
        let client = hub()?;
        let event = IngestEvent {
            exception: Some(from_error(error, r#type, vec![])),
            level: Some(Level::Error),
            mechanism: Some(IngestMechanism { handler: "captureException".to_owned(), handled: true }),
            ..IngestEvent::default()
        };
        client.capture(event, capture, true)
    }

    /// Reports a message, at `Warning` unless the capture says otherwise.
    pub fn capture_message(message: impl Into<String>, capture: Capture) -> Option<String> {
        let client = hub()?;
        let event = IngestEvent {
            message: Some(message.into()),
            level: Some(Level::Warning),
            mechanism: Some(IngestMechanism { handler: "captureMessage".to_owned(), handled: true }),
            ..IngestEvent::default()
        };
        client.capture(event, capture, true)
    }

    /// Something that happened, shown on the next events (the last 100 are kept).
    pub fn add_breadcrumb(category: impl Into<String>, message: impl Into<String>) {
        add_breadcrumb_at(category, message, None);
    }

    /// A breadcrumb with a level: `info`, `warning`, `error` or `debug`.
    pub fn add_breadcrumb_at(category: impl Into<String>, message: impl Into<String>, level: Option<&str>) {
        if let Some(c) = hub() {
            c.add_breadcrumb(IngestBreadcrumb {
                timestamp: crate::time::now(),
                category: category.into(),
                level: level.map(str::to_owned),
                message: message.into(),
            });
        }
    }

    /// The user on every event from now on, under the scope's. `None` clears it.
    pub fn set_user(user: Option<IngestUser>) {
        if let Some(c) = hub() {
            c.set_user(user);
        }
    }

    /// A tag on every event from now on.
    pub fn set_tag(key: impl Into<String>, value: impl Into<String>) {
        if let Some(c) = hub() {
            c.set_tag(key.into(), value.into());
        }
    }

    /// Sends what's queued, waiting up to `timeout`. True when nothing is left.
    pub fn flush(timeout: Duration) -> bool {
        hub().is_none_or(|c| c.flush(timeout))
    }

    /// Settings for an OTLP/HTTP trace exporter that sends spans to bertha, from
    /// `BERTHA_URL` and `BERTHA_KEY`. `None`, after a warning, when either is missing.
    pub fn otlp() -> Option<Otlp> {
        let (Some(key), Some(url)) = (crate::env::var("BERTHA_KEY"), crate::env::var("BERTHA_URL")) else {
            eprintln!("[bertha] Set BERTHA_KEY and BERTHA_URL. No spans will reach bertha.");
            return None;
        };
        Some(Otlp {
            endpoint: crate::transport::endpoint(&url, "traces"),
            headers: vec![("authorization".to_owned(), format!("Bearer {key}"))],
        })
    }

    /// Where an OTLP/HTTP exporter sends spans: `with_endpoint(o.endpoint)` and
    /// `with_headers(o.headers.into_iter().collect())`.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub struct Otlp {
        pub endpoint: String,
        pub headers: Vec<(String, String)>,
    }
}
