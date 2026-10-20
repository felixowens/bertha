//! Reading fixes on GitHub: whether a PR merged, and whether a release's commit contains
//! a fix. One read-only token (`BERTHA_GITHUB_TOKEN`) for every repo bertha follows.

use std::sync::Arc;

use bertha_core::fixes::GithubRepo;
use bertha_core::time::{Millis, parse_millis};
use reqwest::StatusCode;
use serde::Deserialize;

/// A PR as far as following its fix goes.
#[derive(Debug, Clone, PartialEq)]
pub struct Pull {
    /// The commit it merged as, once it merged.
    pub merged: Option<(String, Millis)>,
    /// Closed without merging.
    pub closed: bool,
}

/// Why GitHub couldn't answer.
#[derive(Debug, Clone, PartialEq)]
pub enum Unread {
    /// It will keep failing until someone changes something: shown on the fix.
    Problem(String),
    /// Worth trying again on the next pass: only logged.
    Later(String),
}

type PullFn = dyn Fn(&GithubRepo, u32) -> Result<Pull, Unread> + Send + Sync;
type ContainsFn = dyn Fn(&GithubRepo, &str, &str) -> Result<bool, Unread> + Send + Sync;

#[derive(Clone)]
pub enum Forge {
    Github {
        client: reqwest::Client,
        /// `https://api.github.com`, or the e2e suite's fake.
        api: String,
        token: Arc<str>,
    },
    /// Answers without the network, for tests.
    Canned { pull: Arc<PullFn>, contains: Arc<ContainsFn> },
}

#[derive(Deserialize)]
struct PullBody {
    state: String,
    #[serde(default)]
    merged: bool,
    merge_commit_sha: Option<String>,
    merged_at: Option<String>,
}

#[derive(Deserialize)]
struct CompareBody {
    status: String,
}

impl Forge {
    pub fn github(client: reqwest::Client, api: &str, token: &str) -> Forge {
        Forge::Github { client, api: api.trim_end_matches('/').to_owned(), token: token.into() }
    }

    pub fn canned(
        pull: impl Fn(&GithubRepo, u32) -> Result<Pull, Unread> + Send + Sync + 'static,
        contains: impl Fn(&GithubRepo, &str, &str) -> Result<bool, Unread> + Send + Sync + 'static,
    ) -> Forge {
        Forge::Canned { pull: Arc::new(pull), contains: Arc::new(contains) }
    }

    pub async fn pull(&self, repo: &GithubRepo, n: u32) -> Result<Pull, Unread> {
        let (client, api, token) = match self {
            Forge::Canned { pull, .. } => return pull(repo, n),
            Forge::Github { client, api, token } => (client, api, token),
        };
        let what = format!("{}#{n}", repo.path());
        let url = format!("{api}/repos/{}/pulls/{n}", repo.path());
        let body: PullBody = get(client, &url, token, &what).await?;
        let merged = match (body.merged, body.merge_commit_sha) {
            (true, Some(sha)) => {
                let at = body.merged_at.as_deref().and_then(parse_millis);
                Some((sha, at.ok_or_else(|| Unread::Later(format!("GitHub gave no merge time for {what}")))?))
            }
            _ => None,
        };
        Ok(Pull { closed: merged.is_none() && body.state == "closed", merged })
    }

    /// Whether `release` (a commit) contains `fix`: the release is the fix or comes after it.
    pub async fn contains(&self, repo: &GithubRepo, fix: &str, release: &str) -> Result<bool, Unread> {
        let (client, api, token) = match self {
            Forge::Canned { contains, .. } => return contains(repo, fix, release),
            Forge::Github { client, api, token } => (client, api, token),
        };
        let what = format!("{} {}...{}", repo.path(), short(fix), short(release));
        let url = format!("{api}/repos/{}/compare/{fix}...{release}", repo.path());
        let body: CompareBody = get(client, &url, token, &what).await?;
        Ok(matches!(body.status.as_str(), "ahead" | "identical"))
    }
}

async fn get<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    what: &str,
) -> Result<T, Unread> {
    let r = client
        .get(url)
        .bearer_auth(token)
        .header("accept", "application/vnd.github+json")
        .header("x-github-api-version", "2022-11-28")
        .send()
        .await
        .map_err(|e| Unread::Later(format!("GitHub didn't answer for {what}: {e}")))?;
    let status = r.status();
    let limited = r.headers().get("x-ratelimit-remaining").is_some_and(|v| v.as_bytes() == b"0");
    match status {
        s if s.is_success() => {
            r.json().await.map_err(|e| Unread::Later(format!("GitHub's answer for {what} didn't parse: {e}")))
        }
        StatusCode::UNAUTHORIZED => {
            Err(Unread::Problem("GitHub refused BERTHA_GITHUB_TOKEN. Check it hasn't expired.".to_owned()))
        }
        StatusCode::TOO_MANY_REQUESTS => Err(Unread::Later(format!("GitHub's rate limit stopped reading {what}"))),
        StatusCode::FORBIDDEN if limited => Err(Unread::Later(format!("GitHub's rate limit stopped reading {what}"))),
        StatusCode::FORBIDDEN | StatusCode::NOT_FOUND => Err(Unread::Problem(format!(
            "GitHub answered {} for {what}. Check the token can read this repo.",
            status.as_u16()
        ))),
        s => Err(Unread::Later(format!("GitHub answered {} for {what}", s.as_u16()))),
    }
}

/// The first 7 characters of a sha, as GitHub shows it.
pub fn short(sha: &str) -> &str {
    sha.get(..7).unwrap_or(sha)
}
