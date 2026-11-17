// On by default: no email addresses, bearer tokens or secret-looking query values
// leave the app. The same rules as `@bigbertha/sdk`. Turn off with `scrub(false)`.

use std::collections::BTreeMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::policy;
use crate::wire::IngestEvent;

static EMAIL: LazyLock<Regex> = LazyLock::new(|| Regex::new(policy::EMAIL).expect("valid regex"));
static BEARER: LazyLock<Regex> = LazyLock::new(|| insensitive(policy::BEARER));
static SECRET_PARAM: LazyLock<Regex> = LazyLock::new(|| insensitive(policy::SECRET_PARAM));
/// Fields, headers and tags whose names say they hold a secret are dropped.
static SENSITIVE_KEY: LazyLock<Regex> = LazyLock::new(|| insensitive(policy::SENSITIVE_KEY));

fn insensitive(pattern: &str) -> Regex {
    Regex::new(&format!("(?i){pattern}")).expect("valid regex")
}

pub(crate) fn text(s: &str) -> String {
    let s = EMAIL.replace_all(s, "[email]");
    let s = BEARER.replace_all(&s, "${1} [redacted]");
    SECRET_PARAM.replace_all(&s, "${1}[redacted]").into_owned()
}

pub(crate) fn url(s: &str) -> String {
    SECRET_PARAM.replace_all(s, "${1}[redacted]").into_owned()
}

pub(crate) fn event(e: &mut IngestEvent) {
    if let Some(m) = &mut e.message {
        *m = text(m);
    }
    let mut x = e.exception.as_mut();
    while let Some(ex) = x {
        ex.message = text(&ex.message);
        if let Some(d) = &mut ex.data {
            fields(d);
        }
        x = ex.cause.as_deref_mut();
    }
    for b in e.breadcrumbs.iter_mut().flatten() {
        b.message = text(&b.message);
    }
    if let Some(r) = &mut e.request {
        r.url = url(&r.url);
        if let Some(h) = &mut r.headers {
            fields(h);
        }
    }
    // Tags carry log fields from the tracing layer, which can hold anything.
    if let Some(tags) = &mut e.tags {
        fields(tags);
    }
}

/// Fields whose names say they hold a secret are dropped, and the rest scrubbed.
pub(crate) fn fields(f: &mut BTreeMap<String, String>) {
    f.retain(|k, _| !SENSITIVE_KEY.is_match(k));
    f.values_mut().for_each(|v| *v = text(v));
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The cases `@bigbertha/sdk` checks too, so both SDKs scrub alike.
    #[derive(serde::Deserialize)]
    struct Cases {
        text: Vec<(String, String)>,
        url: Vec<(String, String)>,
        fields: Vec<(BTreeMap<String, String>, BTreeMap<String, String>)>,
    }

    #[test]
    fn scrubs_like_the_javascript_sdk() {
        let cases: Cases = serde_json::from_str(include_str!("scrub_cases.json")).expect("valid cases");
        for (input, want) in cases.text {
            assert_eq!(text(&input), want, "text({input:?})");
        }
        for (input, want) in cases.url {
            assert_eq!(url(&input), want, "url({input:?})");
        }
        for (mut input, want) in cases.fields {
            fields(&mut input);
            assert_eq!(input, want);
        }
    }

    #[test]
    fn drops_secret_headers_and_scrubs_the_rest() {
        let headers = [
            ("host", "api.test"),
            ("x-auth-token", "t-123"),
            ("x-session-id", "s-9"),
            ("referer", "https://shop.test/reset?token=abc&step=2"),
            ("x-forwarded-user", "ana@example.com"),
        ];
        let mut e = IngestEvent {
            request: Some(crate::wire::IngestRequest {
                method: "GET".into(),
                url: "http://api.test/cart".into(),
                status: None,
                headers: Some(headers.iter().map(|(k, v)| ((*k).to_owned(), (*v).to_owned())).collect()),
            }),
            ..IngestEvent::default()
        };
        event(&mut e);
        let kept = e.request.unwrap().headers.unwrap();
        let kept: Vec<_> = kept.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
        assert_eq!(
            kept,
            [
                ("host", "api.test"),
                ("referer", "https://shop.test/reset?token=[redacted]&step=2"),
                ("x-forwarded-user", "[email]"),
            ]
        );
    }
}
