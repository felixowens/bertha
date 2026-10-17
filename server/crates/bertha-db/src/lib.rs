//! bertha's storage: one SQLite file in WAL mode.
//!
//! Reads take a [`Viewer`], which can only be built from a verified session, and every
//! query is limited to the viewer's projects. Writes go through a single connection so
//! SQLite never has to arbitrate between writers.

use std::path::Path;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::Duration;

use bertha_core::time::{Millis, now_millis};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous};

pub mod auth;
pub mod codec;
pub mod reads;
mod scope;
pub mod seed;
mod series;
pub mod stored;

pub use reads::issues::{EventWhich, LIST_LIMIT};
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

#[derive(Clone, Debug)]
pub struct Db {
    read: SqlitePool,
    write: SqlitePool,
    clock: Clock,
    /// Public URL of this bertha, for setup snippets and links in emails.
    public_url: Arc<str>,
}

impl Db {
    /// Opens (creating if needed) the database file and runs pending migrations.
    pub async fn open(path: &Path, public_url: &str, clock: Clock) -> Result<Db> {
        let opts = SqliteConnectOptions::from_str("sqlite:")?
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .foreign_keys(true)
            .busy_timeout(Duration::from_secs(5))
            .pragma("temp_store", "memory")
            .pragma("cache_size", "-16000")
            .optimize_on_close(true, None);
        let write = SqlitePoolOptions::new().max_connections(1).connect_with(opts.clone()).await?;
        sqlx::migrate!("./migrations").run(&write).await?;
        let read = SqlitePoolOptions::new()
            .max_connections(8)
            .min_connections(1)
            .idle_timeout(Duration::from_secs(300))
            .connect_with(opts.read_only(true))
            .await?;
        Ok(Db { read, write, clock, public_url: public_url.trim_end_matches('/').into() })
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

    /// The single writer connection, for crates that add their own write paths.
    pub fn writer(&self) -> &SqlitePool {
        &self.write
    }

    pub fn reader(&self) -> &SqlitePool {
        &self.read
    }

    /// Checks both pools answer. For `/healthz`.
    pub async fn ping(&self) -> Result<()> {
        sqlx::query("SELECT 1").execute(&self.read).await?;
        sqlx::query("SELECT 1").execute(&self.write).await?;
        Ok(())
    }

    /// Consistent copy of the live database, safe while serving.
    pub async fn backup_to(&self, path: &Path) -> Result<()> {
        let target = path.to_string_lossy().into_owned();
        sqlx::query("VACUUM INTO ?").bind(target).execute(&self.write).await?;
        Ok(())
    }

    pub async fn close(&self) {
        self.read.close().await;
        self.write.close().await;
    }
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
