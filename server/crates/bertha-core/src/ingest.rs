//! What the SDKs send. The wire types live in the `bigbertha` crate (the Rust SDK) and
//! are generated from there into `sdk/src/generated/ingest.ts`.
//!
//! The SDK is lenient about what it collects; the server is strict about what it
//! keeps: everything here is bounded by [`limits`] before it is stored.

pub use bigbertha::wire::*;

/// Hard caps applied at ingest. Anything longer is truncated, not rejected.
pub mod limits {
    /// Compressed request body.
    pub const BODY_BYTES: usize = 1024 * 1024;
    /// After decompression: guards against zip bombs.
    pub const DECOMPRESSED_BYTES: usize = 8 * 1024 * 1024;
    pub const EVENTS_PER_BATCH: usize = 100;
    pub const FRAMES: usize = 100;
    pub const CAUSES: usize = 5;
    pub const BREADCRUMBS: usize = 100;
    pub const TAGS: usize = 50;
    pub const MESSAGE_CHARS: usize = 8 * 1024;
    pub const SHORT_CHARS: usize = 512;
    pub const URL_CHARS: usize = 2048;
    pub const FINGERPRINT_PARTS: usize = 10;
    /// Entries in an error's `data`, a request's headers or the context's versions.
    pub const MAP_ENTRIES: usize = 30;
    /// One uploaded source map, compressed.
    pub const SOURCEMAP_BYTES: usize = 32 * 1024 * 1024;
}

/// Maps whatever the app calls its environment onto bertha's three.
pub fn environment_from(s: Option<&str>) -> crate::domain::Environment {
    use crate::domain::Environment::*;
    let Some(s) = s else { return Production };
    let s = s.to_ascii_lowercase();
    if s.contains("prod") || s == "live" {
        Production
    } else if s.contains("stag") || s.contains("preview") || s.contains("test") || s.contains("uat") || s.contains("qa")
    {
        Staging
    } else if s.contains("dev") || s.contains("local") {
        Development
    } else {
        Production
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Environment;

    #[test]
    fn environments() {
        assert_eq!(environment_from(None), Environment::Production);
        assert_eq!(environment_from(Some("Preview")), Environment::Staging);
        assert_eq!(environment_from(Some("development")), Environment::Development);
        assert_eq!(environment_from(Some("localhost")), Environment::Development);
        assert_eq!(environment_from(Some("eu-west")), Environment::Production);
    }

    #[test]
    fn minimal_event_parses() {
        let e: IngestEvent =
            serde_json::from_str(r#"{"timestamp":"2026-10-13T09:12:00Z","message":"hi"}"#).expect("parses");
        assert_eq!(e.message.as_deref(), Some("hi"));
    }
}
