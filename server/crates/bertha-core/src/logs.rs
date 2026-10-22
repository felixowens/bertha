//! Log lines: the limits bertha keeps them to, how a message becomes a pattern's
//! template, and how a search is read. No IO.

use std::sync::LazyLock;

use regex::{Captures, Regex};
use sha2::{Digest, Sha256};

use crate::domain::Environment;

pub mod limits {
    /// A message longer than this many characters is cut.
    pub const MESSAGE_CHARS: usize = 16 * 1024;
    /// Fields kept per line, and the characters kept of each value and key.
    pub const FIELDS: usize = 50;
    pub const VALUE_CHARS: usize = 2_000;
    pub const KEY_CHARS: usize = 128;
    /// Lines a project may send a minute; past it they're dropped and counted.
    pub const LINES_PER_MINUTE: u32 = 2_000;
    /// Lines a project keeps at most, in bytes; past it the oldest go first.
    pub const PROJECT_BYTES: i64 = 1024 * 1024 * 1024;
    /// A page of lines, and how far `total` counts.
    pub const PAGE: u32 = 200;
    pub const TOTAL_COUNTED: u32 = 10_000;
    /// Patterns listed.
    pub const PATTERNS: u32 = 100;
    /// Retention a project may choose, in days.
    pub const RETENTION_DAYS: std::ops::RangeInclusive<u32> = 1..=90;
}

/// The attribute naming the issue event a line was also reported as. It links the
/// line; it isn't shown as a field.
pub const EVENT_ATTRIBUTE: &str = "bertha.event_id";

static URL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b[a-zA-Z][a-zA-Z0-9+.-]*://[^\s<>]+").expect("valid regex"));
static QUOTED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""(?:[^"\\]|\\.)*"|(^|[\s=:(\[{,])'[^'\n]*'"#).expect("valid regex"));
static UUID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b").expect("valid regex")
});
static PATH: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(^|[\s=:(\[{,])(?:~|\.{1,2})?(?:/[\w.~%@+-]+)+/?").expect("valid regex"));
static WORD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[0-9A-Za-z_]+(?:[.-][0-9A-Za-z_]+)*").expect("valid regex"));
static NUMBER_UNIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d+(?:\.\d+)*(?:[a-zA-Z]{1,3})?$").expect("valid regex"));
static HEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:0x[0-9a-fA-F]+|[0-9a-fA-F]{8,})$").expect("valid regex"));

/// The message with the parts that vary replaced: URLs, quoted strings, uuids, paths,
/// hex, numbers and ids. "GET /book/42 took 35ms" is "GET <path> took <n>ms".
pub fn template(message: &str) -> String {
    let first_line = message.lines().next().unwrap_or_default();
    let s = URL.replace_all(first_line, "<url>");
    let s = QUOTED.replace_all(&s, |c: &Captures| format!("{}<str>", c.get(1).map_or("", |m| m.as_str())));
    let s = UUID.replace_all(&s, "<uuid>");
    let s = PATH.replace_all(&s, |c: &Captures| format!("{}<path>", c.get(1).map_or("", |m| m.as_str())));
    let s = WORD.replace_all(&s, |c: &Captures| word(&c[0]));
    let t = s.trim();
    let t: String = t.chars().take(500).collect();
    if t.is_empty() { "<empty>".to_owned() } else { t }
}

fn word(w: &str) -> String {
    let placeholder = ["url", "str", "uuid", "path"].contains(&w);
    if placeholder || !w.bytes().any(|b| b.is_ascii_digit()) {
        return w.to_owned();
    }
    if NUMBER_UNIT.is_match(w) {
        let unit = w.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.');
        return format!("<n>{unit}");
    }
    if HEX.is_match(w) {
        return "<hex>".to_owned();
    }
    "<id>".to_owned()
}

/// A pattern's id: the same template in the same project is the same pattern, always.
pub fn pattern_id(project_id: &str, template: &str) -> String {
    let mut h = Sha256::new();
    h.update(project_id.as_bytes());
    h.update([0]);
    h.update(template.as_bytes());
    format!("lp_{}", &hex::encode(h.finalize())[..16])
}

/// A log search, read from `LogFilter.query`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Search {
    /// Words (matched as prefixes) and phrases (matched whole) over the message.
    pub words: Vec<String>,
    pub phrases: Vec<String>,
    /// `key:value`, matched exactly in any case.
    pub fields: Vec<(String, String)>,
    pub release: Option<String>,
    pub service: Option<String>,
    /// A name that isn't an environment matches nothing.
    pub environment: Option<Option<Environment>>,
    pub trace: Option<String>,
}

impl Search {
    pub fn parse(query: &str) -> Search {
        let mut out = Search::default();
        for token in tokens(query) {
            match token {
                Token::Phrase(p) => out.phrases.push(p),
                Token::Pair(k, v) => match k.to_ascii_lowercase().as_str() {
                    "release" => out.release = Some(v),
                    "service" => out.service = Some(v),
                    "environment" | "env" => out.environment = Some(Environment::parse(&v.to_ascii_lowercase())),
                    "trace" => out.trace = Some(v.to_ascii_lowercase()),
                    _ => out.fields.push((k, v)),
                },
                Token::Word(w) => out.words.push(w),
            }
        }
        out
    }

    /// Whether anything is matched against the message.
    pub fn has_text(&self) -> bool {
        !self.words.is_empty() || !self.phrases.is_empty()
    }

    pub fn is_empty(&self) -> bool {
        *self == Search::default()
    }

    /// The words and phrases as an FTS5 query: every one must match. Words are
    /// prefixes, so "tik" finds "TikWM". `None` when nothing in them can be indexed.
    pub fn fts(&self) -> Option<String> {
        let quote = |s: &str| format!("\"{}\"", s.replace('"', "\"\""));
        let indexable = |s: &&String| s.chars().any(char::is_alphanumeric);
        let mut parts: Vec<String> = self.phrases.iter().filter(indexable).map(|p| quote(p)).collect();
        parts.extend(self.words.iter().filter(indexable).map(|w| format!("{}*", quote(w))));
        (!parts.is_empty()).then(|| parts.join(" AND "))
    }

    /// Words and phrases with nothing FTS5 can index (`->`, `!!`), matched as plain text.
    pub fn literals(&self) -> Vec<&str> {
        self.words
            .iter()
            .chain(&self.phrases)
            .filter(|s| !s.chars().any(char::is_alphanumeric))
            .map(|s| s.as_str())
            .collect()
    }
}

enum Token {
    Word(String),
    Phrase(String),
    Pair(String, String),
}

/// Splits on spaces, keeping `"quoted phrases"` and `key:"quoted values"` whole.
fn tokens(query: &str) -> Vec<Token> {
    let mut out = Vec::new();
    let mut chars = query.chars().peekable();
    loop {
        while chars.peek().is_some_and(|c| c.is_whitespace()) {
            chars.next();
        }
        let Some(&c) = chars.peek() else { break };
        if c == '"' {
            chars.next();
            let phrase: String = chars.by_ref().take_while(|c| *c != '"').collect();
            let phrase = phrase.trim().to_owned();
            if !phrase.is_empty() {
                out.push(Token::Phrase(phrase));
            }
            continue;
        }
        let mut word = String::new();
        while let Some(&c) = chars.peek() {
            if c.is_whitespace() {
                break;
            }
            chars.next();
            if c == '"' && word.ends_with(':') {
                word.extend(chars.by_ref().take_while(|c| *c != '"'));
                break;
            }
            word.push(c);
        }
        match word.split_once(':') {
            Some((k, v)) if !k.is_empty() && !v.is_empty() && !v.starts_with("//") => {
                out.push(Token::Pair(k.to_owned(), v.to_owned()))
            }
            _ => out.push(Token::Word(word)),
        }
    }
    out
}

/// Where a page of lines continues: before a line (towards older ones), or after the
/// last line bertha had stored (new arrivals, in the order they came).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cursor {
    Before { at: i64, id: i64 },
    After { id: i64 },
}

impl Cursor {
    pub fn encode(self) -> String {
        match self {
            Cursor::Before { at, id } => format!("o{at}.{id}"),
            Cursor::After { id } => format!("n{id}"),
        }
    }

    pub fn decode(s: &str) -> Option<Cursor> {
        if let Some(rest) = s.strip_prefix('o') {
            let (at, id) = rest.split_once('.')?;
            Some(Cursor::Before { at: at.parse().ok()?, id: id.parse().ok()? })
        } else {
            Some(Cursor::After { id: s.strip_prefix('n')?.parse().ok()? })
        }
    }
}

/// A log line's id on the wire.
pub fn line_id(rowid: i64) -> String {
    format!("l_{rowid}")
}

pub fn line_rowid(id: &str) -> Option<i64> {
    id.strip_prefix("l_")?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn templates_drop_what_varies() {
        assert_eq!(template("TikWM failed, fell back to yt-dlp"), "TikWM failed, fell back to yt-dlp");
        assert_eq!(template("GET /book/42 took 35ms"), "GET <path> took <n>ms");
        assert_eq!(template("charged order ord_8f3k2 for 12.50"), "charged order <id> for <n>");
        assert_eq!(template("fetch https://api.x.dev/v1?id=3 failed: 502"), "fetch <url> failed: <n>");
        assert_eq!(template(r#"user "ana@example.com" signed in"#), "user <str> signed in");
        assert_eq!(template("job 0b5e1f2a-9c3d-4e5f-8a7b-1c2d3e4f5a6b done"), "job <uuid> done");
        assert_eq!(template("commit deadbeef12 deployed"), "commit <hex> deployed");
        assert_eq!(template("can't reach redis, retry 3/5"), "can't reach redis, retry <n>/<n>");
        assert_eq!(template("first line\nsecond line 42"), "first line");
        assert_eq!(template("   "), "<empty>");
        assert_eq!(template("order=41 user='u 7'"), "order=<n> user=<str>");
    }

    #[test]
    fn same_template_same_id() {
        let a = pattern_id("p-1", &template("GET /a took 3ms"));
        assert_eq!(a, pattern_id("p-1", &template("GET /b/c took 120ms")));
        assert_ne!(a, pattern_id("p-2", &template("GET /a took 3ms")));
        assert!(a.starts_with("lp_") && a.len() == 19);
    }

    #[test]
    fn searches_read() {
        let s = Search::parse(r#"tikwm "fell back" order:41 release:1.2.0 user:"Ana B" env:prod trace:ABC -> "#);
        assert_eq!(s.words, ["tikwm", "->"]);
        assert_eq!(s.phrases, ["fell back"]);
        assert_eq!(s.fields, [("order".to_owned(), "41".to_owned()), ("user".to_owned(), "Ana B".to_owned())]);
        assert_eq!(s.release.as_deref(), Some("1.2.0"));
        assert_eq!(s.environment, Some(None));
        assert_eq!(s.trace.as_deref(), Some("abc"));
        assert_eq!(s.fts().as_deref(), Some(r#""fell back" AND "tikwm"*"#));
        assert_eq!(s.literals(), ["->"]);
        assert!(Search::parse("  ").is_empty());
        assert_eq!(Search::parse("environment:staging").environment, Some(Some(Environment::Staging)));
        assert_eq!(Search::parse("http://x").words, ["http://x"]);
    }

    #[test]
    fn cursors_round_trip() {
        for c in [Cursor::Before { at: 1_791_890_000_000, id: 42 }, Cursor::After { id: 7 }] {
            assert_eq!(Cursor::decode(&c.encode()), Some(c));
        }
        assert_eq!(Cursor::decode("x"), None);
        assert_eq!(line_rowid(&line_id(9)), Some(9));
    }
}
