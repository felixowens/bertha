// What `init` takes. `options!()` reads the environment and names the app from the
// calling crate's manifest; the setters override anything.

use std::collections::BTreeMap;
use std::fmt;
use std::sync::Arc;

use crate::env;
use crate::log::LogLevel;
use crate::wire::IngestEvent;

/// Changes an event just before it's sent, or drops it by returning `None`.
pub type BeforeSend = Arc<dyn Fn(IngestEvent) -> Option<IngestEvent> + Send + Sync>;

/// The app being reported on, from its own `Cargo.toml`. [`options!`](crate::options)
/// fills it in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct App {
    /// The crate name; frames in functions under it are the app's.
    pub name: &'static str,
    /// The crate version: the release when nothing else names one.
    pub version: &'static str,
    /// `BERTHA_RELEASE` as it was when the app was built.
    pub release: Option<&'static str>,
    /// The crate's directory; frame paths under it become relative (`src/orders.rs`).
    pub dir: &'static str,
}

/// Options for [`init`](crate::init). Start from [`options!`](crate::options) (or
/// [`Options::from_env`]) and override with the setters.
#[derive(Clone)]
pub struct Options {
    pub(crate) key: Option<String>,
    pub(crate) url: Option<String>,
    pub(crate) release: Option<String>,
    pub(crate) environment: Option<String>,
    pub(crate) commit: Option<String>,
    pub(crate) sample_rate: f64,
    pub(crate) scrub: bool,
    pub(crate) tags: BTreeMap<String, String>,
    pub(crate) versions: BTreeMap<String, String>,
    pub(crate) heartbeat: bool,
    pub(crate) panics: bool,
    pub(crate) debug: bool,
    pub(crate) log_level: Option<LogLevel>,
    pub(crate) before_send: Option<BeforeSend>,
    pub(crate) app: Option<App>,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            key: None,
            url: None,
            release: None,
            environment: None,
            commit: None,
            sample_rate: 1.0,
            scrub: true,
            tags: BTreeMap::new(),
            versions: BTreeMap::new(),
            heartbeat: true,
            panics: true,
            debug: false,
            log_level: Some(LogLevel::Info),
            before_send: None,
            app: None,
        }
    }
}

impl fmt::Debug for Options {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Options")
            .field("key", &self.key.as_ref().map(|_| "[set]"))
            .field("url", &self.url)
            .field("release", &self.release)
            .field("environment", &self.environment)
            .field("commit", &self.commit)
            .field("sample_rate", &self.sample_rate)
            .field("scrub", &self.scrub)
            .field("tags", &self.tags)
            .field("versions", &self.versions)
            .field("heartbeat", &self.heartbeat)
            .field("panics", &self.panics)
            .field("debug", &self.debug)
            .field("log_level", &self.log_level)
            .field("before_send", &self.before_send.as_ref().map(|_| "[set]"))
            .field("app", &self.app)
            .finish()
    }
}

impl Options {
    /// `BERTHA_KEY`, `BERTHA_URL`, `BERTHA_RELEASE`, `BERTHA_ENVIRONMENT`,
    /// `BERTHA_LOG_LEVEL`, and the commit from `BERTHA_COMMIT` or the host's own variable
    /// (`GITHUB_SHA`, `RENDER_GIT_COMMIT`…).
    pub fn from_env() -> Self {
        let log_level = match env::var("BERTHA_LOG_LEVEL") {
            None => Some(LogLevel::Info),
            Some(v) if v.trim().eq_ignore_ascii_case("off") => None,
            Some(v) => v.parse().map(Some).unwrap_or_else(|e| {
                eprintln!("[bertha] BERTHA_LOG_LEVEL: {e} Sending info and above.");
                Some(LogLevel::Info)
            }),
        };
        Self {
            log_level,
            key: env::var("BERTHA_KEY"),
            url: env::var("BERTHA_URL"),
            release: env::var("BERTHA_RELEASE"),
            environment: env::var("BERTHA_ENVIRONMENT"),
            commit: env::commit(),
            ..Self::default()
        }
    }

    /// The project's ingest key.
    pub fn key(mut self, key: impl Into<String>) -> Self {
        self.key = Some(key.into());
        self
    }

    /// Where bertha runs, e.g. `https://bertha.example.com`.
    pub fn url(mut self, url: impl Into<String>) -> Self {
        self.url = Some(url.into());
        self
    }

    /// The release; the app's version when unset.
    pub fn release(mut self, release: impl Into<String>) -> Self {
        self.release = Some(release.into());
        self
    }

    /// `production`, `staging`, `development`, or anything bertha can map to one.
    pub fn environment(mut self, environment: impl Into<String>) -> Self {
        self.environment = Some(environment.into());
        self
    }

    /// The commit this build is from, so bertha can link releases and fixes.
    pub fn commit(mut self, commit: impl Into<String>) -> Self {
        self.commit = Some(commit.into());
        self
    }

    /// The share of events to send, from 0 to 1.
    pub fn sample_rate(mut self, rate: f64) -> Self {
        self.sample_rate = rate.clamp(0.0, 1.0);
        self
    }

    /// Redact emails, bearer tokens and secret-looking query values (on by default).
    pub fn scrub(mut self, scrub: bool) -> Self {
        self.scrub = scrub;
        self
    }

    /// A tag on every event.
    pub fn tag(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.tags.insert(key.into(), value.into());
        self
    }

    /// A version to show with every event, e.g. `("axum", "0.8.4")`.
    pub fn version(mut self, name: impl Into<String>, version: impl Into<String>) -> Self {
        self.versions.insert(name.into(), version.into());
        self
    }

    /// Tell bertha the process is alive every 20 minutes (on by default), so quiet
    /// stretches show as "no errors" instead of "no data".
    pub fn heartbeat(mut self, heartbeat: bool) -> Self {
        self.heartbeat = heartbeat;
        self
    }

    /// Report panics (on by default, with the `panic` feature).
    pub fn panics(mut self, panics: bool) -> Self {
        self.panics = panics;
        self
    }

    /// Print what's sent and why things are dropped, to stderr.
    pub fn debug(mut self, debug: bool) -> Self {
        self.debug = debug;
        self
    }

    /// The lowest level sent to the project's logs: `Info` by default, `None` for no
    /// logs. Breadcrumbs and reports don't depend on it.
    pub fn log_level(mut self, level: impl Into<Option<LogLevel>>) -> Self {
        self.log_level = level.into();
        self
    }

    /// Change or drop events just before they're sent. If it panics, the event is sent
    /// as it was.
    pub fn before_send(mut self, f: impl Fn(IngestEvent) -> Option<IngestEvent> + Send + Sync + 'static) -> Self {
        self.before_send = Some(Arc::new(f));
        self
    }

    /// The app, from its manifest. [`options!`](crate::options) sets this.
    pub fn app(mut self, app: App) -> Self {
        self.app = Some(app);
        self
    }
}

/// [`Options::from_env`] for the calling crate: its name, directory (to make frame paths
/// relative) and release. The release is `BERTHA_RELEASE` when the app runs, else
/// `BERTHA_RELEASE` when it was built, else the commit the host names (as the deploy CLI
/// does), else the crate version.
///
/// ```no_run
/// let _bertha = bigbertha::init(bigbertha::options!().environment("production"));
/// ```
#[macro_export]
macro_rules! options {
    () => {
        $crate::Options::from_env().app($crate::App {
            name: env!("CARGO_PKG_NAME"),
            version: env!("CARGO_PKG_VERSION"),
            release: option_env!("BERTHA_RELEASE"),
            dir: env!("CARGO_MANIFEST_DIR"),
        })
    };
}
