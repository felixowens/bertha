// Environment variables, and the commit hosts and CI say a process was built from.

/// The variable's value; empty counts as unset.
pub(crate) fn var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

/// Where hosts and CI put the commit a process was built from, most specific first.
const COMMIT_ENV: [&str; 10] = [
    "BERTHA_COMMIT",
    "HEROKU_BUILD_COMMIT",
    "HEROKU_SLUG_COMMIT",
    "SOURCE_VERSION",
    "RENDER_GIT_COMMIT",
    "RAILWAY_GIT_COMMIT_SHA",
    "VERCEL_GIT_COMMIT_SHA",
    "CF_PAGES_COMMIT_SHA",
    "GITHUB_SHA",
    "COMMIT_SHA",
];

/// The commit the environment names, if it looks like one.
pub(crate) fn commit() -> Option<String> {
    COMMIT_ENV.iter().filter_map(|n| var(n)).map(|v| v.trim().to_ascii_lowercase()).find(|v| is_sha(v))
}

pub(crate) fn is_sha(v: &str) -> bool {
    (7..=64).contains(&v.len()) && v.bytes().all(|b| b.is_ascii_hexdigit())
}
