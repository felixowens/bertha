//! A [`tracing`](https://docs.rs/tracing) layer: ERROR events become reports, WARN and
//! INFO events become breadcrumbs on them, and every event at or above
//! [`log_level`](crate::Options::log_level) (`info` by default) is also sent as a log line,
//! with its fields and the active trace.
//!
//! ```no_run
//! use tracing_subscriber::prelude::*;
//!
//! tracing_subscriber::registry()
//!     .with(tracing_subscriber::fmt::layer())
//!     .with(bigbertha::tracing::layer())
//!     .init();
//! ```
//!
//! An `error` field is the error: `error = &e as &dyn Error` keeps its causes, and
//! `error = ?e` with an anyhow error keeps its causes and backtrace. The event's message
//! is kept beside it, and the other fields become tags.
//!
//! Choose the level by what someone should do about it. ERROR opens an issue, so keep it
//! for what needs fixing. A fallback that worked is a log line: log it at WARN, and it
//! shows in the project's logs and as a breadcrumb on the next error, but opens nothing.
//! An ERROR's line carries the id of the event it was reported as, so the two link up.
//! DEBUG events are sent only when `log_level` is `debug`; TRACE never.

use std::collections::BTreeMap;
use std::fmt;

use tracing_core::field::{Field, Visit};
use tracing_core::{Event, Level, Subscriber};
use tracing_subscriber::layer::Context;

use crate::client::{Capture, hub, recently_captured};
use crate::exception::{dyn_type, from_error, from_messages};
use crate::log::{Line, LogLevel};
use crate::stack;
use crate::wire::{IngestBreadcrumb, IngestEvent, IngestException, IngestLevel};

const TAG_CHARS: usize = 500;
const MAX_TAGS: usize = 20;
const ERROR_FIELDS: [&str; 4] = ["error", "err", "e", "cause"];

/// The layer. ERROR events are reported, WARN and INFO kept as breadcrumbs, and events
/// at or above `log_level` sent as log lines.
pub fn layer() -> Layer {
    Layer { _private: () }
}

/// See [`layer`].
#[derive(Debug, Clone)]
pub struct Layer {
    _private: (),
}

impl<S: Subscriber> tracing_subscriber::Layer<S> for Layer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let level = *event.metadata().level();
        let log_level = match level {
            Level::ERROR => LogLevel::Error,
            Level::WARN => LogLevel::Warning,
            Level::INFO => LogLevel::Info,
            Level::DEBUG => LogLevel::Debug,
            _ => return,
        };
        let Some(client) = hub() else { return };
        let logs = client.logs(log_level);
        if level > Level::INFO && !logs {
            return;
        }
        let mut f = Fields { app: client.options.app, ..Fields::default() };
        event.record(&mut f);
        let target = f.target.take().unwrap_or_else(|| event.metadata().target().to_owned());
        if ["bigbertha", "ureq", "rustls"].iter().any(|t| target.starts_with(t)) {
            return;
        }

        if level != Level::ERROR {
            let message = f.message.unwrap_or_default();
            if level <= Level::INFO {
                let mut crumb = message.clone();
                for (k, v) in &f.tags {
                    crumb.push_str(&format!(" {k}={v}"));
                }
                client.add_breadcrumb(IngestBreadcrumb {
                    timestamp: crate::time::now(),
                    category: target.clone(),
                    level: Some(log_level.as_str().to_owned()),
                    message: crumb,
                });
            }
            if logs {
                let mut fields = f.tags;
                if let Some(e) = f.exception {
                    fields.insert("error".to_owned(), e.message);
                }
                fields.insert("target".to_owned(), target);
                client.log_line(Line::new(log_level, message, fields));
            }
            return;
        }

        // A message that is an anyhow error's `{:?}` is the error.
        let mut message = f.message;
        if f.exception.is_none() && message.as_deref().is_some_and(is_anyhow_debug) {
            f.exception = message.take().map(|m| parse_anyhow_debug(&m, f.app.as_ref()));
        }
        let message = message.filter(|m| !m.trim().is_empty());
        let line = logs.then(|| {
            let mut fields = f.tags.clone();
            if let Some(e) = &f.exception {
                fields.insert("error".to_owned(), e.message.clone());
            }
            fields.insert("target".to_owned(), target.clone());
            let text = message.clone().or_else(|| f.exception.as_ref().map(|e| e.message.clone()));
            Line::new(log_level, text.unwrap_or_else(|| target.clone()), fields)
        });
        if let Some(e) = &f.exception
            && recently_captured(&e.message)
        {
            if let Some(line) = line {
                client.log_line(line);
            }
            return;
        }
        let event = IngestEvent {
            message: if f.exception.is_none() {
                Some(message.clone().unwrap_or_else(|| target.clone()))
            } else {
                message
            },
            exception: f.exception,
            level: Some(IngestLevel::Error),
            ..IngestEvent::default()
        };
        let mut capture = Capture::new().mechanism("tracing", true).tag("target", target);
        for (k, v) in f.tags {
            capture = capture.tag(k, v);
        }
        let id = client.capture(event, capture, true);
        if let Some(mut line) = line {
            line.event_id = id;
            client.log_line(line);
        }
    }
}

#[derive(Default)]
struct Fields {
    app: Option<crate::App>,
    message: Option<String>,
    exception: Option<IngestException>,
    target: Option<String>,
    tags: BTreeMap<String, String>,
}

impl Fields {
    fn text(&mut self, field: &Field, value: String) {
        let name = field.name();
        if name == "message" {
            self.message = Some(value);
        } else if name == "log.target" {
            self.target = Some(value);
        } else if name.starts_with("log.") {
        } else if ERROR_FIELDS.contains(&name) && self.exception.is_none() {
            self.exception = Some(if is_anyhow_debug(&value) {
                parse_anyhow_debug(&value, self.app.as_ref())
            } else {
                from_messages("Error".to_owned(), value, vec![], std::iter::empty())
            });
        } else if self.tags.len() < MAX_TAGS {
            self.tags.insert(name.to_owned(), truncate(value));
        }
    }
}

impl Visit for Fields {
    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        self.text(field, format!("{value:?}"));
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        self.text(field, value.to_owned());
    }

    fn record_error(&mut self, field: &Field, value: &(dyn std::error::Error + 'static)) {
        if ERROR_FIELDS.contains(&field.name()) && self.exception.is_none() {
            self.exception = Some(from_error(value, dyn_type(value), vec![]));
        } else {
            self.text(field, value.to_string());
        }
    }
}

fn truncate(mut s: String) -> String {
    if s.chars().count() > TAG_CHARS {
        s = s.chars().take(TAG_CHARS - 1).collect();
        s.push('…');
    }
    s
}

const CAUSED_BY: &str = "\n\nCaused by:\n";
const BACKTRACE: &str = "\n\nStack backtrace:\n";

fn is_anyhow_debug(s: &str) -> bool {
    s.contains(CAUSED_BY) || s.contains(BACKTRACE)
}

/// anyhow's `{:?}`: the message, `Caused by:` and its numbered causes, then
/// `Stack backtrace:` when one was captured.
fn parse_anyhow_debug(s: &str, app: Option<&crate::App>) -> IngestException {
    let (head, backtrace) = s.split_once(BACKTRACE).unwrap_or((s, ""));
    let (message, causes) = head.split_once(CAUSED_BY).unwrap_or((head, ""));
    let causes: Vec<(String, String)> = causes
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(|l| match l.split_once(": ") {
            Some((n, rest)) if n.bytes().all(|b| b.is_ascii_digit()) => rest,
            _ => l,
        })
        .map(|l| ("Error".to_owned(), l.to_owned()))
        .collect();
    from_messages("Error".to_owned(), message.trim().to_owned(), stack::parse(backtrace, app), causes.into_iter())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_anyhow_debug_output() {
        let text = "couldn't load order 41\n\nCaused by:\n    0: reading orders.db\n    1: No such file or directory (os error 2)\n\nStack backtrace:\n   0: beauty_barn::orders::load\n             at ./src/orders.rs:12:9\n";
        let e = parse_anyhow_debug(text, None);
        assert_eq!(e.message, "couldn't load order 41");
        assert_eq!(e.frames.len(), 1);
        assert_eq!(e.frames[0].file, "src/orders.rs");
        let c = e.cause.expect("cause");
        assert_eq!(c.message, "reading orders.db");
        assert_eq!(c.cause.expect("cause").message, "No such file or directory (os error 2)");

        let one = parse_anyhow_debug("checkout failed\n\nCaused by:\n    card declined", None);
        assert_eq!(one.cause.expect("cause").message, "card declined");
    }
}
