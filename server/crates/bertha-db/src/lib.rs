//! bertha's storage: one SQLite file in WAL mode, and a second beside it for log lines
//! (`<name>.logs.db`), so the issues' file and its backups stay small.
//!
//! Reads take a [`Viewer`], which can only be built from a verified session, and every
//! query is limited to the viewer's projects. Writes go through a single connection so
//! SQLite never has to arbitrate between writers.

use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::time::Duration;

use bertha_core::time::{Millis, now_millis};
use sqlx::sqlite::{
    SqliteAutoVacuum, SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous,
};

pub mod auth;
pub mod codec;
pub mod reads;
pub mod reports;
mod scope;
pub mod seed;
mod series;
pub mod stored;
pub mod writes;

pub use reads::issues::{EventWhich, LIST_LIMIT, ref_segment};
pub use scope::Viewer;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("database: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("migration: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),
    /// Stored data that doesn't decode: a bug or a damaged file, never user input.
    #[error("stored data is unreadable: {0}")]
    Corrupt(String),
    /// The viewer may not see this at all (as opposed to a contract failure kind).
    #[error("forbidden")]
    Forbidden,
    /// Input to an admin operation (seed, CLI) that can't be used as given.
    #[error("{0}")]
    Invalid(String),
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Corrupt(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// Where "now" comes from. Fixed in tests and when serving the seeded fixtures as-is.
#[derive(Clone, Debug)]
pub enum Clock {
    System,
    Fixed(Arc<AtomicI64>),
}

impl Clock {
    pub fn fixed(at: Millis) -> Self {
        Clock::Fixed(Arc::new(AtomicI64::new(at)))
    }

    pub fn now(&self) -> Millis {
        match self {
            Clock::System => now_millis(),
            Clock::Fixed(at) => at.load(Ordering::Relaxed),
        }
    }

    /// Moves a fixed clock; no effect on the system clock.
    pub fn advance(&self, by: Millis) {
        if let Clock::Fixed(at) = self {
            at.fetch_add(by, Ordering::Relaxed);
        }
    }
}

/// The log lines' own file: its pools, like the main ones.
#[derive(Clone, Debug)]
pub(crate) struct LogsDb {
    pub(crate) read: SqlitePool,
    pub(crate) write: SqlitePool,
}

#[derive(Clone, Debug)]
pub struct Db {
    read: SqlitePool,
    write: SqlitePool,
    logs: LogsDb,
    clock: Clock,
    /// Public URL of this bertha, for setup snippets and links in emails.
    public_url: Arc<str>,
    /// Whether bertha has a GitHub token to follow fixes with.
    github: Arc<AtomicBool>,
    /// Woken when a project gets a release it hadn't seen, so waiting fixes are checked.
    new_release: Arc<tokio::sync::Notify>,
}

impl Db {
    /// Opens (creating if needed) the database file and runs pending migrations.
    /// The log lines go in [`logs_path`] beside it.
    pub async fn open(path: &Path, public_url: &str, clock: Clock) -> Result<Db> {
        let opts = options(path)?;
        let write = SqlitePoolOptions::new().max_connections(1).connect_with(opts.clone()).await?;
        sqlx::migrate!("./migrations").run(&write).await?;
        let read = readers(opts).await?;
        let logs_opts = options(&logs_path(path))?;
        // Lines come and go all day: hand freed pages back without rewriting the file.
        let logs_write = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(logs_opts.clone().auto_vacuum(SqliteAutoVacuum::Incremental))
            .await?;
        sqlx::migrate!("./migrations-logs").run(&logs_write).await?;
        let logs_read = readers(logs_opts).await?;
        let db = Db {
            read,
            write,
            logs: LogsDb { read: logs_read, write: logs_write },
            clock,
            public_url: public_url.trim_end_matches('/').into(),
            github: Arc::default(),
            new_release: Arc::default(),
        };
        db.read_old_fixes().await?;
        Ok(db)
    }

    pub fn now(&self) -> Millis {
        self.clock.now()
    }

    pub fn clock(&self) -> &Clock {
        &self.clock
    }

    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    /// Says whether bertha has a GitHub token, so fixes show as watched or not.
    pub fn set_watches_github(&self, on: bool) {
        self.github.store(on, Ordering::Relaxed);
    }

    pub fn watches_github(&self) -> bool {
        self.github.load(Ordering::Relaxed)
    }

    /// Resolves when a project has a release it hadn't seen before.
    pub async fn new_release(&self) {
        self.new_release.notified().await;
    }

    pub(crate) fn saw_new_release(&self) {
        self.new_release.notify_one();
    }

    /// The single writer connection, for crates that add their own write paths.
    pub fn writer(&self) -> &SqlitePool {
        &self.write
    }

    pub fn reader(&self) -> &SqlitePool {
        &self.read
    }

    /// Checks every pool answers. For `/healthz`.
    pub async fn ping(&self) -> Result<()> {
        for pool in [&self.read, &self.write, &self.logs.read, &self.logs.write] {
            sqlx::query("SELECT 1").execute(pool).await?;
        }
        Ok(())
    }

    /// Consistent copy of the live database, safe while serving. Log lines aren't in it.
    pub async fn backup_to(&self, path: &Path) -> Result<()> {
        let target = path.to_string_lossy().into_owned();
        sqlx::query("VACUUM INTO ?").bind(target).execute(&self.write).await?;
        Ok(())
    }

    pub async fn close(&self) {
        self.read.close().await;
        self.write.close().await;
        self.logs.read.close().await;
        self.logs.write.close().await;
    }
}

/// Where the log lines of the database at `path` are kept: `bertha.db` keeps them in
/// `bertha.logs.db`.
pub fn logs_path(path: &Path) -> PathBuf {
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "bertha".into());
    path.with_file_name(format!("{stem}.logs.db"))
}

fn options(path: &Path) -> Result<SqliteConnectOptions> {
    Ok(SqliteConnectOptions::from_str("sqlite:")?
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5))
        .pragma("temp_store", "memory")
        .pragma("cache_size", "-16000")
        .optimize_on_close(true, None))
}

async fn readers(opts: SqliteConnectOptions) -> Result<SqlitePool> {
    Ok(SqlitePoolOptions::new()
        .max_connections(8)
        .min_connections(1)
        .idle_timeout(Duration::from_secs(300))
        .connect_with(opts.read_only(true))
        .await?)
}

#[cfg(test)]
pub(crate) mod test_util {
    use super::*;

    pub const T0: Millis = 1_791_890_000_000; // 2026-10-13T09:13:20Z

    pub async fn db() -> (Db, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let db = Db::open(&dir.path().join("t.db"), "https://bertha.test", Clock::fixed(T0)).await.expect("open");
        (db, dir)
    }
}
