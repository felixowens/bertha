//! Checks on what people type: email addresses and URLs.

use url::Url;

/// Addresses longer than this aren't accepted (RFC 5321's limit).
const EMAIL_LIMIT: usize = 254;
const URL_LIMIT: usize = 2000;

/// A plausible email address, trimmed. Not a deliverability check: one `@`, something
/// before it, a dotted domain after it, and no spaces.
pub fn email(s: &str) -> Option<String> {
    let s = s.trim();
    if s.len() > EMAIL_LIMIT || s.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return None;
    }
    let (local, domain) = s.split_once('@')?;
    let labels_ok = domain.split('.').all(|l| !l.is_empty() && !l.starts_with('-') && !l.ends_with('-'));
    if local.is_empty() || domain.contains('@') || !domain.contains('.') || !labels_ok {
        return None;
    }
    Some(s.to_owned())
}

/// A URL bertha can check, kept as typed (trimmed): http or https, with a host. Plain http is allowed so a
/// local server can be watched; the form asks for https.
pub fn monitor_url(s: &str) -> Option<String> {
    let url = web_url(s)?;
    matches!(url.scheme(), "http" | "https").then(|| s.trim().to_owned())
}

/// A webhook bertha may post alerts to: https only, since alerts carry error details.
pub fn webhook_url(s: &str) -> Option<String> {
    let url = web_url(s)?;
    (url.scheme() == "https").then(|| s.trim().to_owned())
}

fn web_url(s: &str) -> Option<Url> {
    let s = s.trim();
    if s.len() > URL_LIMIT {
        return None;
    }
    let url = Url::parse(s).ok()?;
    url.host_str().filter(|h| !h.is_empty())?;
    if !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    Some(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emails() {
        assert_eq!(email(" priya@natarajan.studio ").as_deref(), Some("priya@natarajan.studio"));
        for bad in ["", "priya", "priya@", "@x.dev", "priya@studio", "a b@x.dev", "a@b@x.dev", "a@x..dev", "a@-x.dev"] {
            assert_eq!(email(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn urls() {
        assert_eq!(monitor_url("https://kiln.studio").as_deref(), Some("https://kiln.studio"));
        assert_eq!(monitor_url("http://127.0.0.1:8080/health").as_deref(), Some("http://127.0.0.1:8080/health"));
        assert_eq!(monitor_url("kiln.studio"), None);
        assert_eq!(monitor_url("ftp://kiln.studio"), None);
        assert_eq!(monitor_url("https://user:pw@kiln.studio"), None);
        assert_eq!(webhook_url("http://hooks.slack.com/x"), None);
        assert!(webhook_url("https://hooks.slack.com/services/T0/B0/x").is_some());
    }
}
