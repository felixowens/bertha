//! Following a fix: which PR or commit a triage's fix names, and whether bertha can
//! watch it reach production on GitHub.

use std::sync::LazyLock;

use regex::Regex;

use crate::domain::{FixState, FixWatching};

/// A repository on GitHub, as `owner/name`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubRepo {
    pub owner: String,
    pub name: String,
}

impl GithubRepo {
    pub fn path(&self) -> String {
        format!("{}/{}", self.owner, self.name)
    }

    fn is(&self, owner: &str, name: &str) -> bool {
        self.owner.eq_ignore_ascii_case(owner) && self.name.eq_ignore_ascii_case(name.trim_end_matches(".git"))
    }
}

/// The GitHub repo a project's repo URL points at; `None` for other forges. Same rules as
/// `parseRepo` in the app.
pub fn github_repo(url: &str) -> Option<GithubRepo> {
    let u = url::Url::parse(url.trim()).ok()?;
    if !matches!(u.scheme(), "http" | "https") {
        return None;
    }
    let host = u.host_str()?.to_ascii_lowercase();
    if host != "github.com" && host != "www.github.com" {
        return None;
    }
    let mut parts = u.path_segments()?.filter(|s| !s.is_empty());
    let owner = parts.next()?.to_owned();
    let name = parts.next()?.trim_end_matches(".git").to_owned();
    (!name.is_empty()).then_some(GithubRepo { owner, name })
}

/// What a fix names: its PR, its commit, or both.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FixRef {
    pub pr: Option<u32>,
    pub commit: Option<String>,
}

static PULL_URL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"https?://(?:www\.)?github\.com/([\w.-]+)/([\w.-]+)/pull/(\d+)").expect("valid regex")
});
static PR_REF: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?:^|[^\w/.#-])#(\d+)\b").expect("valid regex"));
static SHA: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\b[0-9a-f]{7,40}\b").expect("valid regex"));

/// Reads the PR and commit out of a fix's text: a pull URL on the project's repo, else the
/// first `#n`; a commit only when there's no PR, since a PR's own commits aren't what ships.
pub fn parse_fix(text: &str, repo: Option<&GithubRepo>) -> FixRef {
    let from_url =
        PULL_URL.captures_iter(text).find(|c| repo.is_some_and(|r| r.is(&c[1], &c[2]))).and_then(|c| c[3].parse().ok());
    let pr = from_url.or_else(|| PR_REF.captures(text).and_then(|c| c[1].parse().ok()));
    let commit = if pr.is_some() {
        None
    } else {
        SHA.find_iter(text).map(|m| m.as_str()).find(|s| is_sha(s)).map(str::to_owned)
    };
    FixRef { pr, commit }
}

/// A PR as an agent gives it: `196`, `#196` or its URL on the project's repo.
pub fn parse_pr(given: &str, repo: Option<&GithubRepo>) -> Option<u32> {
    let given = given.trim();
    if let Some(c) = PULL_URL.captures(given) {
        return repo.is_some_and(|r| r.is(&c[1], &c[2])).then(|| c[3].parse().ok()).flatten();
    }
    given.trim_start_matches('#').parse().ok().filter(|n| *n > 0)
}

/// 7 to 40 lowercase hex characters with at least one letter and one digit, so words
/// like "deadbeef" and numbers like "1234567" aren't taken for commits.
pub fn is_sha(s: &str) -> bool {
    (7..=40).contains(&s.len())
        && s.chars().all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
        && s.chars().any(|c| c.is_ascii_digit())
        && s.chars().any(|c| c.is_ascii_alphabetic())
}

/// Whether bertha follows a project's fixes, from its repo, its switch and the token.
pub fn fix_watching(repo_url: Option<&str>, watch_fixes: bool, has_token: bool) -> FixWatching {
    match repo_url {
        None => FixWatching::NoRepo,
        Some(u) if github_repo(u).is_none() => FixWatching::NotGithub,
        Some(_) if !watch_fixes => FixWatching::Off,
        Some(_) if !has_token => FixWatching::NoToken,
        Some(_) => FixWatching::On,
    }
}

/// Mark it shipped once it's deployed.
pub const BY_HAND: &str = "Mark it shipped once it's deployed.";

/// Why a project's fixes aren't watched; `None` when they are.
pub fn not_watched(w: FixWatching) -> Option<String> {
    let why = match w {
        FixWatching::On => return None,
        FixWatching::Off => "Fix watching is off for this project.",
        FixWatching::NoToken => "Set BERTHA_GITHUB_TOKEN to have bertha watch fixes.",
        FixWatching::NotGithub => "bertha only watches fixes on GitHub repos.",
        FixWatching::NoRepo => "The project has no repo set, so bertha can't watch fixes.",
    };
    Some(format!("{why} {BY_HAND}"))
}

/// Where a newly recorded fix starts.
pub fn first_state(fix: &FixRef) -> (FixState, Option<String>) {
    match fix {
        FixRef { pr: Some(_), .. } => (FixState::WaitingMerge, None),
        FixRef { commit: Some(_), .. } => (FixState::WaitingRelease, None),
        _ => (FixState::Unwatched, Some(format!("The fix names no PR or commit, so bertha can't watch it. {BY_HAND}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo() -> GithubRepo {
        github_repo("https://github.com/felixowens/beauty-barn").expect("repo")
    }

    #[test]
    fn reads_github_repos_only() {
        assert_eq!(repo().path(), "felixowens/beauty-barn");
        assert_eq!(github_repo("https://github.com/a/b.git/").map(|r| r.path()).as_deref(), Some("a/b"));
        assert_eq!(github_repo("https://gitlab.com/a/b"), None);
        assert_eq!(github_repo("https://github.com/a"), None);
    }

    #[test]
    fn finds_the_pr_and_commit() {
        let r = repo();
        let dogfood = "Drop the extra fetch. PR #196 (https://github.com/felixowens/beauty-barn/pull/196)";
        assert_eq!(parse_fix(dogfood, Some(&r)), FixRef { pr: Some(196), commit: None });
        // Another repo's PR isn't this fix.
        assert_eq!(parse_fix("see https://github.com/other/x/pull/9", Some(&r)).pr, None);
        assert_eq!(parse_fix("upstream other/x#9", Some(&r)).pr, None);
        assert_eq!(parse_fix("Fixed in a1b2c3d4", Some(&r)), FixRef { pr: None, commit: Some("a1b2c3d4".into()) });
        assert_eq!(parse_fix("Fixed in deadbeef, 1234567", Some(&r)), FixRef::default());
        assert_eq!(parse_fix("pushed abc1234 in #12", None), FixRef { pr: Some(12), commit: None });
    }

    #[test]
    fn takes_a_pr_as_agents_give_it() {
        let r = repo();
        assert_eq!(parse_pr("196", Some(&r)), Some(196));
        assert_eq!(parse_pr("#196", Some(&r)), Some(196));
        assert_eq!(parse_pr("https://github.com/felixowens/beauty-barn/pull/196", Some(&r)), Some(196));
        assert_eq!(parse_pr("https://github.com/other/x/pull/196", Some(&r)), None);
        assert_eq!(parse_pr("soon", Some(&r)), None);
    }

    #[test]
    fn says_why_fixes_arent_watched() {
        let gh = Some("https://github.com/a/b");
        assert_eq!(fix_watching(gh, true, true), FixWatching::On);
        assert_eq!(fix_watching(gh, true, false), FixWatching::NoToken);
        assert_eq!(fix_watching(gh, false, true), FixWatching::Off);
        assert_eq!(fix_watching(Some("https://gitlab.com/a/b"), true, true), FixWatching::NotGithub);
        assert_eq!(fix_watching(None, true, true), FixWatching::NoRepo);
        assert!(not_watched(FixWatching::On).is_none());
        assert!(not_watched(FixWatching::NoToken).is_some_and(|m| m.contains("BERTHA_GITHUB_TOKEN")));
    }
}
