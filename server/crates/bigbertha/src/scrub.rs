// On by default: no email addresses, bearer tokens or secret-looking query values
// leave the app. The same rules as `@bigbertha/sdk`. Turn off with `scrub(false)`.

use std::collections::BTreeMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::wire::IngestEvent;

static EMAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+").expect("valid regex"));
static BEARER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\b(Bearer|Basic)\s+[A-Za-z0-9_.~+/=-]+").expect("valid regex"));
static SECRET_PARAM: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)([?&](?:[^=&#]*(?:token|key|secret|password|passwd|auth|session|code|sig)[^=&#]*)=)[^&#\s]*")
        .expect("valid regex")
});

/// Tags whose names say they hold a secret are dropped.
static SENSITIVE_KEY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)password|passwd|secret|token|authorization|cookie|api_?key|credential|session")
        .expect("valid regex")
});

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

    #[test]
    fn redacts_emails_tokens_and_secret_query_values() {
        assert_eq!(text("No account for ana.b+x@example.co.uk"), "No account for [email]");
        assert_eq!(text("Authorization: Bearer eyJhbGciOi.J9x-y_z"), "Authorization: Bearer [redacted]");
        assert_eq!(
            url("https://a.test/cb?code=abc&state=1&api_key=k#x"),
            "https://a.test/cb?code=[redacted]&state=1&api_key=[redacted]#x"
        );
        assert_eq!(url("https://a.test/search?q=shoes&page=2"), "https://a.test/search?q=shoes&page=2");
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
