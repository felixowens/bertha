// On by default: no email addresses, bearer tokens or secret-looking query values
// leave the app. The same rules as `@bigbertha/sdk`. Turn off with `scrub(false)`.

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
        x = ex.cause.as_deref_mut();
    }
    for b in e.breadcrumbs.iter_mut().flatten() {
        b.message = text(&b.message);
    }
    if let Some(r) = &mut e.request {
        r.url = url(&r.url);
    }
    // Tags carry log fields from the tracing layer, which can hold anything.
    if let Some(tags) = &mut e.tags {
        tags.retain(|k, _| !SENSITIVE_KEY.is_match(k));
        tags.values_mut().for_each(|v| *v = text(v));
    }
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
}
