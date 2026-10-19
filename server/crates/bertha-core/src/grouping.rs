//! Grouping events into issues: fingerprints, culprits and message normalisation.
//!
//! Rules, in order:
//! 1. An SDK-provided fingerprint wins.
//! 2. Otherwise: exception type + the in-app frames (module path and function, no
//!    line numbers, no build hashes), so a redeploy doesn't split an issue.
//! 3. With no in-app frames: the top frames, same normalisation.
//! 4. With no stack: type + the message with numbers, ids and hex normalised away.
//! 5. When none of those frames has a function name (a browser's async stack is often
//!    just the throw), the message joins them, so two throws in one file stay apart.

use std::sync::LazyLock;

use regex::Regex;
use sha2::{Digest, Sha256};

/// The parts of an event grouping looks at.
pub struct GroupingInput<'a> {
    pub custom: Option<&'a [String]>,
    pub r#type: &'a str,
    pub message: &'a str,
    /// Innermost first.
    pub frames: &'a [GroupingFrame<'a>],
}

pub struct GroupingFrame<'a> {
    pub file: &'a str,
    pub function: Option<&'a str>,
    pub in_app: bool,
}

/// How many frames take part. Deep framework stacks below this don't split issues.
const FRAMES: usize = 8;

pub fn fingerprint(input: &GroupingInput<'_>) -> [u8; 16] {
    let mut h = Sha256::new();
    let mut part = |s: &str| {
        h.update(s.as_bytes());
        h.update([0]);
    };
    if let Some(custom) = input.custom.filter(|c| !c.is_empty()) {
        part("custom");
        custom.iter().for_each(|c| part(c));
    } else {
        let in_app: Vec<_> = input.frames.iter().filter(|f| f.in_app).take(FRAMES).collect();
        let frames: Vec<_> = if in_app.is_empty() { input.frames.iter().take(FRAMES).collect() } else { in_app };
        part(input.r#type);
        if frames.is_empty() {
            part("message");
            part(&normalize_message(input.message));
        } else {
            part("stack");
            let mut named = false;
            for f in frames {
                let function = f.function.map(normalize_function).unwrap_or_default();
                named |= !function.is_empty();
                part(&module(f.file));
                part(function);
            }
            if !named {
                part("message");
                part(&normalize_message(input.message));
            }
        }
    }
    let digest = h.finalize();
    let mut out = [0u8; 16];
    out.copy_from_slice(&digest[..16]);
    out
}

static HASHED_NAME: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([-.])[0-9a-f]{6,}(\.(?:m?js|css)$)").expect("valid regex"));
static QUERY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[?#].*$").expect("valid regex"));
static ORIGIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:[a-z][a-z0-9+.-]*://[^/]*)?/*").expect("valid regex"));
static PREFIXES: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?:_next/static/|_next/server/|\.next/server/|\.next/static/|webpack-internal:/+(?:\(\w+\)/)?|\./)+")
        .expect("valid regex")
});

/// A stable module path for a frame file: no origin, query, build hash or bundler
/// prefix. `https://x.co/_next/static/chunks/framework-6f3b2c0300b2f4d9.js` →
/// `chunks/framework-*.js`.
pub fn module(file: &str) -> String {
    let file = file.strip_prefix("webpack://").map(|s| s.split_once('/').map_or(s, |(_, p)| p)).unwrap_or(file);
    let file = file.strip_prefix("file://").unwrap_or(file);
    let s = QUERY.replace(file, "");
    let s = ORIGIN.replace(&s, "");
    let s = PREFIXES.replace(&s, "");
    HASHED_NAME.replace(&s, "$1*$2").into_owned()
}

/// Short, readable file for culprits and display: like [`module`] but keeps the
/// real build hash trimmed to 6 characters (`chunks/4410-91be2d.js`).
pub fn short_file(file: &str) -> String {
    static LONG_HASH: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"([-.])([0-9a-f]{6})[0-9a-f]+(\.(?:m?js|css)$)").expect("valid regex"));
    let file = file.strip_prefix("webpack://").map(|s| s.split_once('/').map_or(s, |(_, p)| p)).unwrap_or(file);
    let s = QUERY.replace(file, "");
    let s = ORIGIN.replace(&s, "");
    let s = PREFIXES.replace(&s, "");
    LONG_HASH.replace(&s, "$1$2$3").into_owned()
}

/// Minifiers rename locals (`a`, `t`), so one-letter names carry nothing.
fn normalize_function(f: &str) -> &str {
    let f = f.trim_start_matches("async ").trim_start_matches("Object.").trim_start_matches("Module.");
    if f.len() <= 2 || f == "<anonymous>" { "" } else { f }
}

/// Where it happens: `components/Price.tsx in Price`, or just the file.
pub fn culprit(frames: &[GroupingFrame<'_>]) -> Option<String> {
    let f = frames.iter().find(|f| f.in_app).or_else(|| frames.first())?;
    let file = short_file(f.file);
    Some(match f.function.filter(|n| !n.is_empty() && *n != "<anonymous>") {
        Some(func) => format!("{file} in {}", func.trim_start_matches("async ")),
        None => file,
    })
}

static UUID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b").expect("valid regex")
});
static HEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:0x[0-9a-f]+|[0-9a-f]*[0-9][0-9a-f]*[a-f][0-9a-f]*|[0-9a-f]*[a-f][0-9a-f]*[0-9][0-9a-f]*)\b")
        .expect("valid regex")
});
static EMAIL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\s@<>()]+@[^\s@<>()]+\.\w+").expect("valid regex"));
static NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\d+(?:\.\d+)?").expect("valid regex"));
static URL_QUERY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(https?://[^\s?#]+)[?#]\S*").expect("valid regex"));

/// The message with the parts that vary between occurrences replaced, so
/// "Timeout after 3012ms for order 8f1c…" groups with "Timeout after 2990ms …".
pub fn normalize_message(m: &str) -> String {
    let m = URL_QUERY.replace_all(m, "$1?…");
    let m = UUID.replace_all(&m, "<uuid>");
    let m = EMAIL.replace_all(&m, "<email>");
    let m = HEX.replace_all(&m, |c: &regex::Captures<'_>| {
        // Only long runs or 0x literals: short words like "cafe" stay.
        if c[0].len() >= 8 || c[0].starts_with("0x") { "<hex>".to_owned() } else { c[0].to_owned() }
    });
    NUMBER.replace_all(&m, "<n>").into_owned()
}

/// A frame is the app's own code unless it comes from dependencies or the runtime.
pub fn guess_in_app(file: &str) -> bool {
    let f = file.to_ascii_lowercase();
    !(f.contains("node_modules")
        || f.starts_with("node:")
        || f.starts_with("internal/")
        || f.contains("/chunks/framework-")
        || f.contains("/chunks/main-")
        || f.contains("/chunks/webpack-")
        || f.contains("/chunks/polyfills-")
        || f.contains("next/dist/")
        || f.contains("react-dom")
        || f == "<anonymous>"
        || is_extension(&f))
}

/// Code a browser extension injected, or that the browser hides: Safari reports both
/// as `webkit-masked-url://hidden/`.
pub fn is_extension(file: &str) -> bool {
    const SCHEMES: [&str; 6] = [
        "chrome-extension://",
        "moz-extension://",
        "safari-extension://",
        "safari-web-extension://",
        "webkit-masked-url://",
        "ms-browser-extension://",
    ];
    let f = file.trim_start();
    SCHEMES.iter().any(|s| f.len() >= s.len() && f[..s.len()].eq_ignore_ascii_case(s))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame<'a>(file: &'a str, function: Option<&'a str>, in_app: bool) -> GroupingFrame<'a> {
        GroupingFrame { file, function, in_app }
    }

    #[test]
    fn module_strips_origin_hash_and_prefix() {
        assert_eq!(
            module("https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c0300b2f4d9.js"),
            "chunks/framework-*.js"
        );
        assert_eq!(
            module("https://x.co/_next/static/chunks/app/(shop)/layout-1be296b83c6c4508.js?v=2"),
            "chunks/app/(shop)/layout-*.js"
        );
        assert_eq!(module("webpack://kiln/./components/Price.tsx"), "components/Price.tsx");
        assert_eq!(module("app/book/[practice]/slots/route.ts"), "app/book/[practice]/slots/route.ts");
    }

    #[test]
    fn redeploy_keeps_the_same_fingerprint() {
        let a = [frame("https://x.co/_next/static/chunks/4410-91be2d11aa.js", Some("submit"), true)];
        let b = [frame("https://x.co/_next/static/chunks/4410-0c0ffee123.js", Some("submit"), true)];
        let fa = fingerprint(&GroupingInput { custom: None, r#type: "TypeError", message: "x", frames: &a });
        let fb = fingerprint(&GroupingInput { custom: None, r#type: "TypeError", message: "y", frames: &b });
        assert_eq!(fa, fb);
    }

    #[test]
    fn different_in_app_frames_split() {
        let a = [frame("components/Price.tsx", Some("Price"), true)];
        let b = [frame("components/Cart.tsx", Some("Cart"), true)];
        let fa = fingerprint(&GroupingInput { custom: None, r#type: "TypeError", message: "x", frames: &a });
        let fb = fingerprint(&GroupingInput { custom: None, r#type: "TypeError", message: "x", frames: &b });
        assert_ne!(fa, fb);
    }

    #[test]
    fn vendor_frames_below_app_code_dont_matter() {
        let a = [
            frame("components/Price.tsx", Some("Price"), true),
            frame("node_modules/react-dom/x.js", Some("a"), false),
        ];
        let b = [
            frame("components/Price.tsx", Some("Price"), true),
            frame("node_modules/react-dom/y.js", Some("b"), false),
        ];
        let fa = fingerprint(&GroupingInput { custom: None, r#type: "E", message: "", frames: &a });
        let fb = fingerprint(&GroupingInput { custom: None, r#type: "E", message: "", frames: &b });
        assert_eq!(fa, fb);
    }

    #[test]
    fn messages_group_without_a_stack() {
        let fa = fingerprint(&GroupingInput {
            custom: None,
            r#type: "Error",
            message: "Timeout after 3012ms for 8f1c2d3e-0000-4000-8000-000000000001",
            frames: &[],
        });
        let fb = fingerprint(&GroupingInput {
            custom: None,
            r#type: "Error",
            message: "Timeout after 2990ms for 11111111-2222-4333-8444-555555555555",
            frames: &[],
        });
        assert_eq!(fa, fb);
    }

    #[test]
    fn unnamed_frames_group_by_message_too() {
        // BEAU-4: the browser's async stack is only the throw, with no function name.
        let f = [frame("https://x.co/_next/static/chunks/pages/checkout-91be2d11aa.js", None, true)];
        let print = |message| fingerprint(&GroupingInput { custom: None, r#type: "Error", message, frames: &f });
        assert_eq!(
            print("Failed to fetch course details (404)"),
            print("Failed to fetch course details (500)"),
            "the status varies"
        );
        assert_ne!(print("Failed to fetch course details (404)"), print("Course not found"), "another throw");

        // A name anywhere in the stack is enough to tell throws apart; the message stays out.
        let named = [frame("pages/checkout.tsx", None, true), frame("pages/checkout.tsx", Some("fetchProduct"), true)];
        let print = |message| fingerprint(&GroupingInput { custom: None, r#type: "Error", message, frames: &named });
        assert_eq!(print("Failed to fetch course details (404)"), print("Course not found"));
    }

    #[test]
    fn custom_fingerprint_wins() {
        let custom = vec!["checkout".to_owned()];
        let a = [frame("a.ts", None, true)];
        let b = [frame("b.ts", None, true)];
        let fa = fingerprint(&GroupingInput { custom: Some(&custom), r#type: "A", message: "", frames: &a });
        let fb = fingerprint(&GroupingInput { custom: Some(&custom), r#type: "B", message: "", frames: &b });
        assert_eq!(fa, fb);
    }

    #[test]
    fn normalizes_messages() {
        assert_eq!(normalize_message("fetch https://a.co/x?id=4 failed: 503"), "fetch https://a.co/x?… failed: <n>");
        assert_eq!(normalize_message("bad token deadbeefcafe1234 for a@b.co"), "bad token <hex> for <email>");
        assert_eq!(
            normalize_message("Cannot read properties of undefined (reading 'map')"),
            "Cannot read properties of undefined (reading 'map')"
        );
    }

    #[test]
    fn culprits() {
        let f = [frame("node_modules/x.js", Some("a"), false), frame("components/Price.tsx", Some("Price"), true)];
        assert_eq!(culprit(&f).as_deref(), Some("components/Price.tsx in Price"));
        let f = [frame("https://x.co/_next/static/chunks/4410-91be2d11aa.js", Some("a"), false)];
        assert_eq!(culprit(&f).as_deref(), Some("chunks/4410-91be2d.js in a"));
        assert_eq!(culprit(&[]), None);
    }

    #[test]
    fn in_app_guess() {
        assert!(guess_in_app("components/Price.tsx"));
        assert!(!guess_in_app("/app/node_modules/next/dist/server.js"));
        assert!(!guess_in_app("node:internal/process"));
        assert!(!guess_in_app("webkit-masked-url://hidden/"));
        assert!(!guess_in_app("safari-web-extension://4F2A/content.js"));
        assert!(is_extension("Chrome-Extension://abc/x.js"));
        assert!(!is_extension("https://www.example.com/_next/static/chunks/app.js"));
    }
}
