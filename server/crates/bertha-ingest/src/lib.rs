//! From what an SDK sent to what bertha stores: bounded, symbolicated and grouped.
//!
//! Pure apart from source map parsing: the server loads the maps an event needs
//! ([`debug_ids`]), then [`normalize`] does the rest without touching the database.

use std::collections::BTreeMap;
use std::net::IpAddr;
use std::sync::Arc;

use bertha_core::domain::{
    AffectedUser, Breadcrumb, BreadcrumbCategory, BreadcrumbLevel, EventContext, EventException, FrameContext, Level,
    Mechanism, Navigation, RequestInfo, StackFrame, TagKey, Trace,
};
use bertha_core::grouping::{GroupingFrame, GroupingInput, fingerprint, guess_in_app, module, short_file};
use bertha_core::ingest::{
    IngestBreadcrumb, IngestEvent, IngestException, IngestFrame, IngestLevel, environment_from, limits,
};
use bertha_core::time::{IsoDate, Millis, parse_millis};
use bertha_db::stored::StoredEvent;
use bertha_db::writes::ingest::NewEvent;
use sha2::{Digest, Sha256};
pub use sourcemap::SourceMap;

/// Events older than this are stored as if they happened this long ago.
const MAX_AGE_MS: Millis = 7 * 24 * 60 * 60 * 1000;
/// Source lines shown either side of a frame's line.
const CONTEXT_LINES: u32 = 5;
/// Context lines longer than this are cut (minified sources inlined in maps).
const CONTEXT_LINE_CHARS: usize = 300;

/// Why an event was turned away. Counted as `rejected`, never stored.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum Rejected {
    #[error("An event needs an exception or a message.")]
    Empty,
}

/// What the server knows about a request that the event doesn't say.
#[derive(Debug, Clone, Copy)]
pub struct Context {
    pub received_at: Millis,
    /// Where the report came from; used when the SDK sends `user.ip: "auto"`.
    pub client_ip: Option<IpAddr>,
}

/// Cheap checks, done before an event is queued.
pub fn check(e: &IngestEvent) -> Result<(), Rejected> {
    let has_message = e.message.as_deref().is_some_and(|m| !m.trim().is_empty());
    if e.exception.is_none() && !has_message {
        return Err(Rejected::Empty);
    }
    Ok(())
}

/// The debug ids of bundles this event's frames point into: the maps to load.
pub fn debug_ids(e: &IngestEvent) -> Vec<String> {
    let Some(ids) = e.debug_ids.as_ref().filter(|m| !m.is_empty()) else { return vec![] };
    let mut out: Vec<String> = chain(e.exception.as_ref())
        .flat_map(|x| x.frames.iter().take(limits::FRAMES))
        .filter_map(|f| debug_id_for(ids, &f.file))
        .map(str::to_owned)
        .collect();
    out.sort();
    out.dedup();
    out
}

fn chain(top: Option<&IngestException>) -> impl Iterator<Item = &IngestException> {
    std::iter::successors(top, |x| x.cause.as_deref()).take(1 + limits::CAUSES)
}

fn debug_id_for<'a>(ids: &'a BTreeMap<String, String>, file: &str) -> Option<&'a str> {
    let bare = file.split(['?', '#']).next().unwrap_or(file);
    ids.get(file).or_else(|| ids.get(bare)).map(String::as_str)
}

/// Parses an uploaded map. Index maps (sections) are flattened.
pub fn parse_map(bytes: &[u8]) -> Result<SourceMap, sourcemap::Error> {
    match sourcemap::decode_slice(bytes)? {
        sourcemap::DecodedMap::Regular(sm) => Ok(sm),
        sourcemap::DecodedMap::Index(ix) => ix.flatten(),
        sourcemap::DecodedMap::Hermes(h) => Ok((*h).clone()),
    }
}

/// Bounds, symbolicates and groups one event. `maps` answers with the parsed map for
/// a debug id, or `None` when none was uploaded.
pub fn normalize(e: IngestEvent, ctx: &Context, maps: &dyn Fn(&str) -> Option<Arc<SourceMap>>) -> NewEvent {
    let at =
        parse_millis(&e.timestamp).map_or(ctx.received_at, |t| t.clamp(ctx.received_at - MAX_AGE_MS, ctx.received_at));
    let level = match e.level {
        Some(IngestLevel::Fatal) => Level::Fatal,
        Some(IngestLevel::Warning) => Level::Warning,
        Some(IngestLevel::Error) | None => Level::Error,
    };
    let environment = environment_from(e.environment.as_deref());
    let release = e.release.as_deref().map(str::trim).filter(|r| !r.is_empty()).map(|r| cut(r, limits::SHORT_CHARS));
    let no_ids = BTreeMap::new();
    let ids = e.debug_ids.as_ref().unwrap_or(&no_ids);

    let exception = e.exception.as_ref().map(|top| {
        let mut frames = symbolicate(&top.frames, ids, maps);
        frames.truncate(limits::FRAMES);
        let mut message = cut(&top.message, limits::MESSAGE_CHARS);
        // Causes read as part of the message; grouping looks at the error that was thrown.
        for cause in chain(Some(top)).skip(1) {
            message.push_str(&format!(
                "\n\nCaused by {}: {}",
                cut(&cause.r#type, limits::SHORT_CHARS),
                cut(&cause.message, limits::SHORT_CHARS)
            ));
        }
        EventException {
            r#type: cut(top.r#type.trim(), limits::SHORT_CHARS),
            message,
            frames,
            data: bounded_map(top.data.as_ref(), limits::SHORT_CHARS),
            component_stack: top
                .component_stack
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| cut(s, limits::MESSAGE_CHARS)),
        }
    });
    let mechanism = e
        .mechanism
        .as_ref()
        .map(|m| Mechanism { handler: cut(m.handler.trim(), limits::SHORT_CHARS), handled: m.handled });
    let trace = e.trace.as_ref().and_then(|t| {
        let span_id = t.span_id.as_deref().map(str::to_ascii_lowercase).filter(|s| hex_id(s, 16));
        let trace_id = t.trace_id.to_ascii_lowercase();
        hex_id(&trace_id, 32).then_some(Trace { trace_id, span_id })
    });

    let (r#type, full_message) = match (&exception, e.message.as_deref()) {
        (Some(x), _) => (if x.r#type.is_empty() { "Error".to_owned() } else { x.r#type.clone() }, x.message.clone()),
        (None, m) => ("Message".to_owned(), cut(m.unwrap_or_default().trim(), limits::MESSAGE_CHARS)),
    };
    let title = full_message.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    let message = if title.is_empty() { r#type.clone() } else { cut(title, limits::SHORT_CHARS) };

    let frames: &[StackFrame] = exception.as_ref().map_or(&[], |x| &x.frames);
    let culprit = frames.iter().find(|f| f.in_app).map(|f| {
        let file = if f.mapped { f.file.clone() } else { short_file(&f.file) };
        match f.function.as_deref().filter(|n| !n.is_empty()) {
            Some(func) => format!("{file} in {func}"),
            None => file,
        }
    });
    let custom: Option<Vec<String>> = e
        .fingerprint
        .as_ref()
        .map(|parts| parts.iter().take(limits::FINGERPRINT_PARTS).map(|p| cut(p, limits::SHORT_CHARS)).collect());
    let grouping_frames: Vec<GroupingFrame<'_>> = frames
        .iter()
        .map(|f| GroupingFrame { file: &f.file, function: f.function.as_deref(), in_app: f.in_app })
        .collect();
    let fp = fingerprint(&GroupingInput {
        custom: custom.as_deref(),
        r#type: &r#type,
        message: &full_message,
        frames: &grouping_frames,
    });

    let breadcrumbs = breadcrumbs(e.breadcrumbs.unwrap_or_default(), at);
    let request = e.request.map(|r| RequestInfo {
        method: cut(&r.method.to_ascii_uppercase(), 16),
        url: cut(&r.url, limits::URL_CHARS),
        status: r.status.filter(|s| (100..600).contains(s)),
        headers: headers(r.headers.as_ref()),
    });
    let user = e
        .user
        .map(|u| AffectedUser {
            id: u.id.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(|s| cut(s, limits::SHORT_CHARS)),
            email: u.email.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(|s| cut(s, limits::SHORT_CHARS)),
            ip: match u.ip.as_deref() {
                Some("auto") => ctx.client_ip.map(|ip| ip.to_string()),
                Some(ip) => ip.parse::<IpAddr>().ok().map(|ip| ip.to_string()),
                None => None,
            },
        })
        .filter(|u| u.id.is_some() || u.email.is_some() || u.ip.is_some());
    let c = e.context.unwrap_or_default();
    let context = EventContext {
        browser: c.browser.map(|s| cut(&s, limits::SHORT_CHARS)),
        os: c.os.map(|s| cut(&s, limits::SHORT_CHARS)),
        runtime: c.runtime.map(|s| cut(&s, limits::SHORT_CHARS)),
        user_agent: c.user_agent.map(|s| cut(&s, limits::SHORT_CHARS)),
        viewport: c.viewport.map(|s| cut(&s, 64)),
        online: c.online,
        visible: c.visible,
        navigation: c.navigation.as_deref().and_then(Navigation::parse),
        automated: c.automated,
        page_age_ms: c
            .page_age_ms
            .filter(|ms| ms.is_finite() && *ms >= 0.0)
            .map(|ms| ms.min(f64::from(u32::MAX)) as u32),
        referrer: c.referrer.filter(|s| !s.is_empty()).map(|s| cut(&s, limits::URL_CHARS)),
        language: c.language.map(|s| cut(&s, 64)),
        timezone: c.timezone.map(|s| cut(&s, 64)),
        connection: c.connection.map(|s| cut(&s, 64)),
        host: c.host.map(|s| cut(&s, limits::SHORT_CHARS)),
        versions: bounded_map(c.versions.as_ref(), 64),
    };
    let tags: BTreeMap<String, String> = e
        .tags
        .unwrap_or_default()
        .into_iter()
        .take(limits::TAGS)
        .map(|(k, v)| (cut(&k, 64), cut(&v, limits::SHORT_CHARS)))
        .collect();

    let user_key = user.as_ref().and_then(|u| {
        u.email
            .as_ref()
            .map(|m| format!("email:{}", m.to_lowercase()))
            .or_else(|| u.id.as_ref().map(|i| format!("id:{i}")))
            .or_else(|| u.ip.as_ref().map(|i| format!("ip:{i}")))
    });
    let user_hash = user_key.map(|k| {
        let d = Sha256::digest(k.as_bytes());
        let mut out = [0u8; 16];
        out.copy_from_slice(&d[..16]);
        out
    });

    let mut tag_list: Vec<(TagKey, String)> = Vec::new();
    let page = request.as_ref().map(|r| r.url.clone()).or_else(|| tags.get("url").cloned());
    if let Some(url) = page {
        let bare = url.split(['?', '#']).next().unwrap_or(&url).to_owned();
        tag_list.push((TagKey::Url, bare));
    }
    if let Some(b) = &context.browser {
        tag_list.push((TagKey::Browser, b.clone()));
    }
    if let Some(o) = &context.os {
        tag_list.push((TagKey::Os, o.clone()));
    }
    if let Some(r) = &release {
        tag_list.push((TagKey::Release, r.clone()));
    }
    tag_list.push((TagKey::Environment, environment.as_str().to_owned()));
    if let Some(who) = user.as_ref().and_then(|u| u.email.as_ref().or(u.id.as_ref()).or(u.ip.as_ref())) {
        tag_list.push((TagKey::User, who.clone()));
    }

    NewEvent {
        client_id: e.id.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(|s| cut(s, 64)),
        at,
        fingerprint: fp,
        r#type,
        message,
        culprit,
        level,
        environment,
        release: release.clone(),
        user_hash,
        // The app's own tags count per issue too, so they can be searched and broken down.
        // One named like a built-in is left to the built-in.
        tags: tag_list
            .into_iter()
            .map(|(k, v)| (k.as_str().to_owned(), v))
            .chain(
                tags.iter()
                    .filter(|(k, _)| TagKey::parse(&k.to_lowercase()).is_none())
                    .map(|(k, v)| (k.clone(), v.clone())),
            )
            .collect(),
        payload: StoredEvent {
            release,
            environment,
            level,
            exception,
            mechanism,
            trace,
            breadcrumbs,
            request,
            user,
            context,
            tags,
        },
    }
}

/// Credential headers never stored, whatever the SDK sent.
const CREDENTIAL_HEADERS: [&str; 5] = ["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"];

fn headers(all: Option<&BTreeMap<String, String>>) -> BTreeMap<String, String> {
    let Some(all) = all else { return BTreeMap::new() };
    all.iter()
        .map(|(k, v)| (k.trim().to_ascii_lowercase(), v))
        .filter(|(k, _)| !k.is_empty() && !CREDENTIAL_HEADERS.contains(&k.as_str()))
        .take(limits::MAP_ENTRIES)
        .map(|(k, v)| (cut(&k, 64), cut(v, limits::SHORT_CHARS)))
        .collect()
}

fn bounded_map(all: Option<&BTreeMap<String, String>>, value_chars: usize) -> BTreeMap<String, String> {
    let Some(all) = all else { return BTreeMap::new() };
    all.iter()
        .filter(|(k, _)| !k.trim().is_empty())
        .take(limits::MAP_ENTRIES)
        .map(|(k, v)| (cut(k.trim(), 64), cut(v, value_chars)))
        .collect()
}

/// A W3C trace or span id: lowercase hex of the given length, not all zeros.
fn hex_id(s: &str, len: usize) -> bool {
    s.len() == len && s.bytes().all(|b| b.is_ascii_hexdigit()) && s.bytes().any(|b| b != b'0')
}

/// Newest [`limits::BREADCRUMBS`], oldest first, with unknown categories as `log`.
fn breadcrumbs(all: Vec<IngestBreadcrumb>, at: Millis) -> Vec<Breadcrumb> {
    let skip = all.len().saturating_sub(limits::BREADCRUMBS);
    all.into_iter()
        .skip(skip)
        .map(|b| Breadcrumb {
            at: IsoDate::from_millis(parse_millis(&b.timestamp).unwrap_or(at)),
            // The browser SDK calls clicks "ui", as Sentry does.
            category: match b.category.as_str() {
                "ui" => BreadcrumbCategory::Click,
                c => BreadcrumbCategory::parse(c).unwrap_or(BreadcrumbCategory::Log),
            },
            level: b.level.as_deref().and_then(BreadcrumbLevel::parse).unwrap_or(BreadcrumbLevel::Info),
            message: cut(&b.message, limits::SHORT_CHARS),
        })
        .collect()
}

/// Maps frames through their bundles' source maps where one was uploaded.
///
/// A mapped frame takes its function name from the call site one frame out: the name
/// at a frame's own position is whatever it was calling, but the caller's position
/// names this frame's function.
fn symbolicate(
    frames: &[IngestFrame],
    ids: &BTreeMap<String, String>,
    maps: &dyn Fn(&str) -> Option<Arc<SourceMap>>,
) -> Vec<StackFrame> {
    let mut out = Vec::with_capacity(frames.len().min(limits::FRAMES));
    let mut callee_names: Vec<Option<String>> = Vec::with_capacity(out.capacity());
    for raw in frames.iter().take(limits::FRAMES) {
        // V8 writes an unnamed async frame as `at async /app/x.js:1:2`; SDKs before
        // 0.4 kept the word as part of the file.
        let cleaned;
        let f = match raw.file.strip_prefix("async ") {
            Some(file) => {
                cleaned = IngestFrame { file: file.to_owned(), ..raw.clone() };
                &cleaned
            }
            None => raw,
        };
        let mapped = map_frame(f, ids, maps);
        let (frame, name) = match mapped {
            Some((frame, name)) => (frame, name),
            None => {
                let file = cut(&f.file, limits::URL_CHARS);
                let in_app = f.in_app.unwrap_or_else(|| guess_in_app(&file));
                let frame = StackFrame {
                    function: f.function.as_deref().map(|s| cut(s, limits::SHORT_CHARS)),
                    line: f.line,
                    column: f.column,
                    in_app,
                    mapped: false,
                    context: sent_context(f),
                    file,
                };
                (frame, None)
            }
        };
        out.push(frame);
        callee_names.push(name);
    }
    for i in 0..out.len().saturating_sub(1) {
        if out[i].mapped
            && let Some(name) = callee_names[i + 1].take()
        {
            out[i].function = Some(name);
        }
    }
    out
}

fn map_frame(
    f: &IngestFrame,
    ids: &BTreeMap<String, String>,
    maps: &dyn Fn(&str) -> Option<Arc<SourceMap>>,
) -> Option<(StackFrame, Option<String>)> {
    let sm = maps(debug_id_for(ids, &f.file)?)?;
    let (line, col) = (f.line?.checked_sub(1)?, f.column.unwrap_or(1).saturating_sub(1));
    let token = sm.lookup_token(line, col)?;
    let source = token.get_source()?;
    let file = clean_source(source);
    let src_line = token.get_src_line() + 1;
    let context = sm.get_source_contents(token.get_src_id()).and_then(|text| context_around(text, src_line));
    // Library code stays library code after mapping.
    let in_app = f.in_app.unwrap_or(true) && guess_in_app(source);
    let frame = StackFrame {
        file: cut(&file, limits::URL_CHARS),
        function: f.function.as_deref().filter(|n| !minified(n, &sm)).map(|s| cut(s, limits::SHORT_CHARS)),
        line: Some(src_line),
        column: Some(token.get_src_col() + 1),
        in_app,
        mapped: true,
        context,
    };
    Some((frame, token.get_name().map(|n| cut(n, limits::SHORT_CHARS))))
}

/// A name the runtime reported that the map doesn't know (`Timeout.ce`): the minifier's
/// invention, which would only mislead next to the original source. A map without
/// names (an unminified build) can't tell, so the name stays.
fn minified(name: &str, sm: &SourceMap) -> bool {
    let last = name.rsplit(['.', ' ']).next().unwrap_or(name);
    sm.get_name_count() > 0 && !sm.names().any(|n| n == last)
}

/// `webpack://_N_E/./src/app/page.tsx` → `src/app/page.tsx`; `../../src/main.ts` →
/// `src/main.ts`.
fn clean_source(source: &str) -> String {
    let m = module(source);
    let mut s = m.as_str();
    loop {
        let before = s;
        s = s.trim_start_matches("../").trim_start_matches("./");
        // webpack layers: `(app-pages-browser)/./src/…`
        if s.starts_with('(')
            && let Some((_, rest)) = s.split_once(")/")
        {
            s = rest;
        }
        if s == before {
            break;
        }
    }
    s.to_owned()
}

/// The lines an SDK read from disk, trimmed to the same window a map would give.
/// Lines that don't reach the frame's line belong to some other file.
fn sent_context(f: &IngestFrame) -> Option<FrameContext> {
    let (sent, line) = (f.context.as_ref()?, f.line?);
    let end = sent.start_line.checked_add(u32::try_from(sent.lines.len()).ok()?)?;
    if sent.start_line == 0 || !(sent.start_line..end).contains(&line) {
        return None;
    }
    let start = line.saturating_sub(CONTEXT_LINES).max(sent.start_line);
    let lines = sent
        .lines
        .iter()
        .skip((start - sent.start_line) as usize)
        .take((line - start + 1 + CONTEXT_LINES) as usize)
        .map(|l| cut(l, CONTEXT_LINE_CHARS))
        .collect();
    Some(FrameContext { start_line: start, lines, highlight: line })
}

fn context_around(text: &str, line: u32) -> Option<FrameContext> {
    let start = line.saturating_sub(CONTEXT_LINES).max(1);
    let lines: Vec<String> = text
        .lines()
        .skip(start as usize - 1)
        .take((line - start + 1 + CONTEXT_LINES) as usize)
        .map(|l| cut(l, CONTEXT_LINE_CHARS))
        .collect();
    // A map whose sources don't reach this line is for a different build.
    if lines.len() < (line - start + 1) as usize {
        return None;
    }
    Some(FrameContext { start_line: start, lines, highlight: line })
}

/// At most `max` characters, with an ellipsis when something was cut.
pub fn cut(s: &str, max: usize) -> String {
    match s.char_indices().nth(max) {
        None => s.to_owned(),
        Some((i, _)) => {
            let mut out = s[..i].to_owned();
            out.pop();
            out.push('…');
            out
        }
    }
}

#[cfg(test)]
mod tests;
