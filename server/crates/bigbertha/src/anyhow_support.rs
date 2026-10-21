// anyhow errors: the context chain as causes, and anyhow's backtrace (captured when
// `RUST_LIB_BACKTRACE=1` or `RUST_BACKTRACE=1`) as the frames.

use std::backtrace::BacktraceStatus;

use crate::client::{Capture, hub};
use crate::exception::{dyn_type, from_messages};
use crate::stack;
use crate::wire::{IngestEvent, IngestLevel, IngestMechanism};

const MAX_CAUSES: usize = 5;

/// Reports an anyhow error: its message, its causes and where it was created.
pub fn capture_anyhow(error: &anyhow::Error) -> Option<String> {
    capture_anyhow_with(error, Capture::default())
}

pub fn capture_anyhow_with(error: &anyhow::Error, capture: Capture) -> Option<String> {
    let client = hub()?;
    let bt = error.backtrace();
    let frames = match bt.status() {
        BacktraceStatus::Captured => stack::parse(&bt.to_string(), client.options.app.as_ref()),
        _ => vec![],
    };
    let mut chain = error.chain();
    let top = chain.next().map(ToString::to_string).unwrap_or_default();
    let causes: Vec<(String, String)> = chain.take(MAX_CAUSES).map(|c| (dyn_type(c), c.to_string())).collect();
    // The context layers on top have no type of their own; the root cause says what failed.
    let r#type = dyn_type(error.root_cause());
    let event = IngestEvent {
        exception: Some(from_messages(r#type, top, frames, causes.into_iter())),
        level: Some(IngestLevel::Error),
        mechanism: Some(IngestMechanism { handler: "captureException".to_owned(), handled: true }),
        ..IngestEvent::default()
    };
    client.capture(event, capture, true)
}
