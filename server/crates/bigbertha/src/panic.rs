// Panics as fatal reports, with the backtrace from where they happened. The hook runs
// before the one that was there (which prints the panic), and only waits for the send
// when the process is about to end: a panic on the main thread, or `panic = "abort"`.

use std::backtrace::Backtrace;
use std::cell::Cell;
use std::panic::PanicHookInfo;
use std::sync::Once;

use crate::client::{Capture, EXIT_FLUSH, busy, hub};
use crate::exception::from_messages;
use crate::stack;
use crate::wire::{IngestEvent, IngestFrame, IngestLevel};

thread_local! {
    static REPORTED: Cell<bool> = const { Cell::new(false) };
}

/// Whether the hook reported a panic on this thread since the last call. The tower
/// layer asks, so a panic it catches isn't reported twice.
#[cfg_attr(not(feature = "tower"), allow(dead_code))]
pub(crate) fn take_reported() -> bool {
    REPORTED.with(|r| r.replace(false))
}

pub(crate) fn install() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let reported = report(info);
            previous(info);
            if reported && (cfg!(panic = "abort") || std::thread::current().name() == Some("main")) {
                crate::flush(EXIT_FLUSH);
            }
        }));
    });
}

fn report(info: &PanicHookInfo<'_>) -> bool {
    if busy() {
        return false;
    }
    let Some(client) = hub() else { return false };
    let message = match info.payload().downcast_ref::<&str>() {
        Some(s) => (*s).to_owned(),
        None => info.payload().downcast_ref::<String>().cloned().unwrap_or_else(|| "Box<dyn Any>".to_owned()),
    };
    let mut frames = stack::parse(&Backtrace::force_capture().to_string(), client.options.app.as_ref());
    if frames.is_empty()
        && let Some(at) = info.location()
    {
        frames.push(IngestFrame {
            file: at.file().trim_start_matches("./").to_owned(),
            function: None,
            line: Some(at.line()),
            column: Some(at.column()),
            in_app: None,
            context: None,
        });
    }
    let thread = std::thread::current();
    let event = IngestEvent {
        exception: Some(from_messages("panic".to_owned(), message, frames, std::iter::empty())),
        ..IngestEvent::default()
    };
    let capture = Capture::new()
        .level(IngestLevel::Fatal)
        .mechanism("panic", false)
        .tag("thread", thread.name().unwrap_or("unnamed"));
    // With `abort` there's no unwinding back to the tower layer to release a held event.
    REPORTED.with(|r| r.set(true));
    client.capture(event, capture, !cfg!(panic = "abort")).is_some()
}
