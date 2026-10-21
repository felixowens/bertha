// Frames from `std::backtrace::Backtrace`, parsed from its Display format (the only
// stable view of it):
//
//    3: beauty_barn::orders::load::{closure#0}
//              at ./src/orders.rs:41:20
//
// The capture machinery above the error (the backtrace itself, the panic runtime,
// anyhow, bigbertha) is dropped, and so is the runtime below `main` or the thread's
// closure. Paths become stable across machines: the app's relative to its crate,
// dependencies as `<crate>/src/…`, the standard library as `/rustc/library/…`.

use std::sync::LazyLock;

use regex::Regex;

use crate::options::App;
use crate::wire::IngestFrame;

const MAX_FRAMES: usize = 100;

/// A frame's function and its `at` location (file, line, column).
type Raw = (Option<String>, Option<(String, Option<u32>, Option<u32>)>);

static REGISTRY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"/registry/src/[^/]+/([^/]+?)-\d+\.\d+\.\d+[^/]*/(.*)$").expect("valid regex"));
static GIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"/git/checkouts/([^/]+?)-[0-9a-f]+/[^/]+/(.*)$").expect("valid regex"));
static RUSTC: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/rustc/[0-9a-f]+/").expect("valid regex"));

/// The frames of a backtrace's Display output, innermost first.
pub(crate) fn parse(text: &str, app: Option<&App>) -> Vec<IngestFrame> {
    let mut raw: Vec<Raw> = Vec::new();
    for line in text.lines() {
        let t = line.trim();
        if let Some(at) = t.strip_prefix("at ") {
            if let Some(last) = raw.last_mut().filter(|f| f.1.is_none()) {
                last.1 = Some(location(at));
            }
        } else if let Some((n, name)) = t.split_once(": ")
            && !n.is_empty()
            && n.bytes().all(|b| b.is_ascii_digit())
        {
            let name = name.trim();
            raw.push(((!name.is_empty() && name != "<unknown>").then(|| name.to_owned()), None));
        }
    }

    let name = |f: &Raw| f.0.clone().unwrap_or_default();
    let file = |f: &Raw| f.1.as_ref().map(|l| l.0.clone()).unwrap_or_default();

    // Above the error: the panic runtime ends at `__rust_end_short_backtrace`, as in
    // std's own short backtraces; otherwise the capture itself.
    let start = match raw.iter().position(|f| name(f).contains("__rust_end_short_backtrace")) {
        Some(i) => i + 1,
        None => raw.iter().position(|f| !is_capture(&name(f), &file(f))).unwrap_or(raw.len()),
    };
    let mut frames = &raw[start..];
    while let Some(f) = frames.first() {
        let (n, p) = (name(f), file(f));
        if is_capture(&n, &p) || is_panic_runtime(&n, &p) || is_reporter(&n, &p) {
            frames = &frames[1..];
        } else {
            break;
        }
    }
    // Below the app: the runtime that started `main` or the thread.
    if let Some(end) = frames.iter().position(|f| name(f).contains("__rust_begin_short_backtrace")) {
        frames = &frames[..end];
    }

    frames
        .iter()
        .take(MAX_FRAMES)
        .map(|(function, loc)| {
            let function = function.as_deref().map(clean_function);
            match loc {
                Some((path, line, column)) => {
                    let (file, in_app) = clean_file(path, app);
                    IngestFrame { file, function, line: *line, column: *column, in_app, context: None }
                }
                None => {
                    let ours = app.is_some_and(|a| {
                        let krate = a.name.replace('-', "_");
                        function.as_deref().is_some_and(|f| f.strip_prefix(&krate).is_some_and(|r| r.starts_with("::")))
                    });
                    IngestFrame {
                        file: String::new(),
                        function,
                        line: None,
                        column: None,
                        in_app: Some(ours),
                        context: None,
                    }
                }
            }
        })
        .collect()
}

fn location(at: &str) -> (String, Option<u32>, Option<u32>) {
    let mut parts = at.rsplitn(3, ':');
    let (c, l, f) = (parts.next(), parts.next(), parts.next());
    match (f, l.and_then(|l| l.parse().ok()), c.and_then(|c| c.parse().ok())) {
        (Some(f), Some(l), Some(c)) => (f.to_owned(), Some(l), Some(c)),
        _ => match at.rsplit_once(':') {
            Some((f, l)) if l.parse::<u32>().is_ok() => (f.to_owned(), l.parse().ok(), None),
            _ => (at.to_owned(), None, None),
        },
    }
}

/// The backtrace capturing itself.
fn is_capture(name: &str, file: &str) -> bool {
    name.contains("backtrace_rs::")
        || name.contains("std::backtrace::Backtrace")
        || file.contains("/backtrace/src/backtrace/")
        || file.ends_with("/std/src/backtrace.rs")
}

/// Between the panic and the code that panicked.
fn is_panic_runtime(name: &str, file: &str) -> bool {
    name.starts_with("__rustc::")
        || name.starts_with("rust_begin_unwind")
        || file.ends_with("/core/src/panicking.rs")
        || file.ends_with("/std/src/panicking.rs")
}

/// Code that made the report rather than the error: anyhow building its error (and the
/// `?` that converted into it), and bigbertha.
fn is_reporter(name: &str, file: &str) -> bool {
    let crate_path = |c: &str| {
        name.starts_with(&format!("{c}::"))
            || name.starts_with(&format!("<{c}::"))
            || file.contains(&format!("/{c}-"))
            || file.contains(&format!("/{c}/src/"))
    };
    crate_path("anyhow")
        || crate_path("bigbertha")
        || (name.contains("from_residual") && file.ends_with("/core/src/result.rs"))
}

/// Drops the per-build symbol hash and generic arguments, which change between builds
/// and would split an issue: `load::<u32>::{closure#0}` is `load::{closure#0}`, and
/// release builds' `index<u32>` is `index`.
fn clean_function(f: &str) -> String {
    let f = match f.rsplit_once("::h") {
        Some((name, hash)) if hash.len() == 16 && hash.bytes().all(|b| b.is_ascii_hexdigit()) => name,
        _ => f,
    };
    let mut out = String::with_capacity(f.len());
    let bytes = f.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        // `::<…>` anywhere, or `<…>` closing out the name.
        let turbofish = f[i..].starts_with("::<");
        let trailing = bytes[i] == b'<' && i > 0 && closing(f, i).is_some_and(|end| end + 1 == f.len());
        if turbofish || trailing {
            let open = if turbofish { i + 2 } else { i };
            if let Some(end) = closing(f, open) {
                i = end + 1;
                continue;
            }
        }
        let ch = f[i..].chars().next().unwrap_or_default();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// The `>` matching the `<` at `open`.
fn closing(f: &str, open: usize) -> Option<usize> {
    let mut depth = 0usize;
    for (i, b) in f.bytes().enumerate().skip(open) {
        match b {
            b'<' => depth += 1,
            b'>' if i > 0 && f.as_bytes()[i - 1] == b'-' => {}
            b'>' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

/// A stable path, and whether it's the app's (`None` when it can't tell).
fn clean_file(path: &str, app: Option<&App>) -> (String, Option<bool>) {
    let path = path.replace('\\', "/");
    if let Some(m) = RUSTC.find(&path) {
        return (format!("/rustc/{}", &path[m.end()..]), Some(false));
    }
    if let Some(c) = REGISTRY.captures(&path).or_else(|| GIT.captures(&path)) {
        return (format!("{}/{}", &c[1], &c[2]), Some(false));
    }
    if let Some(rel) = path.strip_prefix("./") {
        return (rel.to_owned(), Some(true));
    }
    if !path.starts_with('/') && !path.get(1..3).is_some_and(|s| s == ":/") {
        return (path, Some(true));
    }
    // Under the crate, or the workspace it's in (up to two levels up).
    if let Some(app) = app {
        let dir = app.dir.replace('\\', "/");
        let mut root = dir.trim_end_matches('/');
        for _ in 0..3 {
            if root.matches('/').count() >= 2
                && let Some(rel) = path.strip_prefix(root).and_then(|r| r.strip_prefix('/'))
            {
                return (rel.to_owned(), Some(true));
            }
            match root.rsplit_once('/') {
                Some((parent, _)) => root = parent,
                None => break,
            }
        }
    }
    (path, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    const APP: App = App { name: "beauty-barn", version: "1.0.0", release: None, dir: "/build/server/crates/api" };

    fn summary(frames: &[IngestFrame]) -> Vec<String> {
        frames
            .iter()
            .map(|f| {
                let app = match f.in_app {
                    Some(true) => "app",
                    Some(false) => "lib",
                    None => "?",
                };
                format!("{app} {} {}:{}", f.function.as_deref().unwrap_or("-"), f.file, f.line.unwrap_or(0))
            })
            .collect()
    }

    const PANIC_DEBUG_MACOS: &str = "   0: std::backtrace_rs::backtrace::libunwind::trace
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/../../backtrace/src/backtrace/libunwind.rs:117:9
   1: std::backtrace_rs::backtrace::trace_unsynchronized::<<std::backtrace::Backtrace>::create::{closure#0}>
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/../../backtrace/src/backtrace/mod.rs:66:14
   2: <std::backtrace::Backtrace>::create
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/backtrace.rs:331:13
   3: bigbertha::panic::hook
             at /Users/me/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/bigbertha-0.9.0/src/panic.rs:40:9
   4: <alloc::boxed::Box<dyn for<'a, 'b> core::ops::function::Fn<(&'a std::panic::PanicHookInfo<'b>,), Output = ()> + core::marker::Send + core::marker::Sync> as core::ops::function::Fn<(&std::panic::PanicHookInfo,)>>::call
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/alloc/src/boxed.rs:2334:9
   5: std::panicking::panic_with_hook
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/panicking.rs:823:13
   6: std::panicking::panic_handler::{closure#0}
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/panicking.rs:688:13
   7: std::sys::backtrace::__rust_end_short_backtrace::<std::panicking::panic_handler::{closure#0}, !>
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/sys/backtrace.rs:182:18
   8: __rustc::rust_begin_unwind
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/panicking.rs:679:5
   9: core::panicking::panic_fmt
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/core/src/panicking.rs:80:14
  10: core::panicking::panic_bounds_check
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/core/src/panicking.rs:271:5
  11: <usize as core::slice::index::SliceIndex<[u32]>>::index
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/core/src/slice/index.rs:238:10
  12: beauty_barn::orders::load::<u32>::{closure#0}
             at ./src/orders.rs:12:41
  13: tokio::runtime::task::harness::poll_future
             at /usr/local/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tokio-1.47.1/src/runtime/task/harness.rs:473:19
  14: std::sys::backtrace::__rust_begin_short_backtrace::<beauty_barn::main::{closure#1}, u32>
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/sys/backtrace.rs:166:18
  15: ___rust_try
";

    #[test]
    fn panics_start_where_the_code_panicked() {
        assert_eq!(
            summary(&parse(PANIC_DEBUG_MACOS, Some(&APP))),
            [
                "lib <usize as core::slice::index::SliceIndex<[u32]>>::index /rustc/library/core/src/slice/index.rs:238",
                "app beauty_barn::orders::load::{closure#0} src/orders.rs:12",
                "lib tokio::runtime::task::harness::poll_future tokio/src/runtime/task/harness.rs:473",
            ]
        );
    }

    const CAPTURE_RELEASE_LINUX: &str = "   0: std::backtrace_rs::backtrace::libunwind::trace
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/../../backtrace/src/backtrace/libunwind.rs:117:9
   1: std::backtrace_rs::backtrace::trace_unsynchronized
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/../../backtrace/src/backtrace/mod.rs:66:14
   2: <std::backtrace::Backtrace>::create
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/backtrace.rs:331:13
   3: anyhow::error::<impl anyhow::Error>::msg
             at /root/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/anyhow-1.0.98/src/error.rs:83:36
   4: from_residual<(), anyhow::Error>
             at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/core/src/result.rs:2177:27
   5: {closure#0}
             at /build/server/crates/api/src/orders.rs:41:20
   6: load<u32>
             at /build/server/crates/core/src/store.rs:9:5
   7: <unknown>
   8: beauty_barn::main
   9: __libc_start_main
";

    #[test]
    fn release_frames_keep_their_files() {
        assert_eq!(
            summary(&parse(CAPTURE_RELEASE_LINUX, Some(&APP))),
            [
                "app {closure#0} src/orders.rs:41",
                "app load core/src/store.rs:9",
                "lib - :0",
                "app beauty_barn::main :0",
                "lib __libc_start_main :0",
            ]
        );
    }

    #[test]
    fn cleans_function_names() {
        assert_eq!(clean_function("beauty_barn::orders::load::h3f9c0a1b2c3d4e5f"), "beauty_barn::orders::load");
        assert_eq!(clean_function("std::rt::lang_start::<()>::{closure#0}"), "std::rt::lang_start::{closure#0}");
        assert_eq!(clean_function("call_once<fn(), ()>"), "call_once");
        assert_eq!(
            clean_function("<alloc::vec::Vec<u32> as core::ops::Index<usize>>::index"),
            "<alloc::vec::Vec<u32> as core::ops::Index<usize>>::index"
        );
        assert_eq!(clean_function("f::<fn() -> u32>"), "f");
    }

    #[test]
    fn disabled_backtraces_have_no_frames() {
        assert!(parse("disabled backtrace", Some(&APP)).is_empty());
        assert!(parse("unsupported backtrace", None).is_empty());
    }
}
