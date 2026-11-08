//! `bertha`: serve, plus the few things done on the server by hand.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, bail};
use bertha_core::ids::ProjectId;
use bertha_core::time::DAY;
use bertha_db::seed::{Fixtures, SeedOptions};
use bertha_db::{Clock, Db};
use bertha_server::alerts::Alerter;
use bertha_server::config::Config;
use bertha_server::github::Forge;
use bertha_server::live::Live;
use bertha_server::mail::Mailer;
use bertha_server::pipeline::Pipeline;
use bertha_server::report::{self, Reporting};
use bertha_server::uptime::Checker;
use bertha_server::workers::{self, Workers};
use bertha_server::{AppState, router};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;
use tracing_subscriber::prelude::*;

#[derive(Parser)]
#[command(name = "bertha", version, about = "Error tracking and uptime for a handful of apps")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run the server (the default).
    Serve,
    /// Manage the owner account.
    Owner {
        #[command(subcommand)]
        command: OwnerCommand,
    },
    /// Load the design fixtures into an empty database.
    Seed {
        /// The fixtures as JSON (`node scripts/export-fixtures.ts` writes them).
        #[arg(required_unless_present = "builtin")]
        file: Option<PathBuf>,
        /// Use the fixtures built into this binary (needs the `fixtures` feature).
        #[arg(long)]
        builtin: bool,
        /// Also store the fixtures' invite links ("valid", "expired", "used"). Local use only.
        #[arg(long)]
        dev_invites: bool,
    },
    /// Write a consistent copy of the database while bertha keeps running.
    Backup { to: PathBuf },
    /// Look up projects and their keys.
    Project {
        #[command(subcommand)]
        command: ProjectCommand,
    },
    /// Access tokens, for agents reaching bertha over MCP.
    Token {
        #[command(subcommand)]
        command: TokenCommand,
    },
}

#[derive(Subcommand)]
enum TokenCommand {
    /// Create an access token for a member and print it once. It sees what they see.
    Create {
        /// The member's email.
        #[arg(long)]
        email: String,
        /// What it's for, e.g. "claude on laptop". It shows on everything the agent writes.
        #[arg(long)]
        name: String,
    },
}

#[derive(Subcommand)]
enum ProjectCommand {
    /// List projects.
    List,
    /// Print a project's ingest and upload keys as environment variables.
    Keys {
        /// The project's id, short key (e.g. LANT) or name.
        project: String,
    },
}

#[derive(Subcommand)]
enum OwnerCommand {
    /// Create the owner, who can then sign in by email.
    Create {
        email: String,
        #[arg(long, default_value = "Owner")]
        name: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let json_logs = std::env::var("BERTHA_LOG_FORMAT").is_ok_and(|v| v == "json");
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,tower_http=warn,sqlx=warn"));
    // bertha's own errors go to a project of its own when BERTHA_REPORT_TO says which;
    // until then the bigbertha layer does nothing.
    let registry = tracing_subscriber::registry().with(filter).with(bigbertha::tracing::layer());
    if json_logs {
        registry.with(tracing_subscriber::fmt::layer().json()).init();
    } else {
        registry.with(tracing_subscriber::fmt::layer()).init();
    }

    let cli = Cli::parse();
    let config = Config::from_env()?;
    let clock = config.fixed_now.map(Clock::fixed).unwrap_or(Clock::System);
    let command = cli.command.unwrap_or(Command::Serve);
    // Held until bertha exits. Taken before the database opens, so a second server
    // doesn't run migrations under the first one either.
    let _only = match command {
        Command::Serve => Some(only_server(&config.database)?),
        _ => None,
    };
    let db = Db::open(&config.database, &config.public_url, clock)
        .await
        .with_context(|| format!("can't open the database at {}", config.database.display()))?;

    match command {
        Command::Serve => serve(db, config).await,
        Command::Owner { command: OwnerCommand::Create { email, name } } => {
            if let Some(o) = db.owner().await? {
                bail!("There is already an owner: {}. Nothing was changed.", o.email);
            }
            if !email.contains('@') {
                bail!("{email:?} isn't an email address.");
            }
            let owner = db.create_owner(&email, &name).await?;
            println!("Created the owner {}. Sign in at {}/sign-in", owner.email, config.public_url);
            Ok(())
        }
        Command::Seed { file, builtin, dev_invites } => {
            let json = match (file, builtin) {
                (Some(f), _) => std::fs::read_to_string(&f).with_context(|| format!("can't read {}", f.display()))?,
                (None, true) => builtin_fixtures()?,
                (None, false) => bail!("Pass a fixtures file or --builtin."),
            };
            let fixtures = Fixtures::parse(&json)?;
            let report = db.seed(&fixtures, SeedOptions { dev_invite_tokens: dev_invites }).await?;
            println!(
                "Seeded {} projects, {} issues, {} hourly counts, {} checks and {} log lines.",
                report.projects, report.issues, report.hourly_rows, report.checks, report.log_lines
            );
            Ok(())
        }
        Command::Project { command } => {
            let all = db.project_keys().await?;
            match command {
                ProjectCommand::List => {
                    if all.is_empty() {
                        println!("No projects yet.");
                    }
                    for p in all {
                        println!("{}\t{}\t{}", p.id, p.key, p.name);
                    }
                }
                ProjectCommand::Keys { project } => {
                    let Some(p) = report::find(all, &project) else {
                        bail!("No project {project:?}. `bertha project list` shows them all.");
                    };
                    println!("BERTHA_KEY={}\nBERTHA_UPLOAD_KEY={}", p.ingest_key, p.upload_key);
                }
            }
            Ok(())
        }
        Command::Token { command: TokenCommand::Create { email, name } } => {
            let Some(made) = db.create_access_token_for(&email, &name).await? else {
                bail!("Nobody has joined bertha as {email}. Nothing was created.");
            };
            println!(
                "Created the token {:?} for {email}. It won't be shown again:\n\n{}\n",
                made.token.name, made.secret
            );
            println!(
                "Claude Code:\n  claude mcp add --transport http --scope user bertha {url}/mcp --header \"Authorization: Bearer {secret}\"",
                url = config.public_url,
                secret = made.secret
            );
            Ok(())
        }
        Command::Backup { to } => {
            if to.exists() {
                bail!("{} already exists. Choose a new path.", to.display());
            }
            db.backup_to(&to).await?;
            println!("Wrote {}", to.display());
            Ok(())
        }
    }
}

#[cfg(feature = "fixtures")]
fn builtin_fixtures() -> anyhow::Result<String> {
    Ok(bertha_db::seed::FIXTURES.to_owned())
}

#[cfg(not(feature = "fixtures"))]
fn builtin_fixtures() -> anyhow::Result<String> {
    bail!("This build has no fixtures built in. Pass the JSON file instead.")
}

/// Locks `<database>.lock`: two servers on one database would check every monitor
/// twice (one blip reads as two failures in a row) and send every alert twice. The lock
/// goes when the process does, however it ends. The CLI's other commands don't take it.
fn only_server(database: &std::path::Path) -> anyhow::Result<std::fs::File> {
    let mut name = database.as_os_str().to_owned();
    name.push(".lock");
    let path = PathBuf::from(name);
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&path)
        .with_context(|| format!("can't open {}", path.display()))?;
    match file.try_lock() {
        Ok(()) => Ok(file),
        Err(std::fs::TryLockError::WouldBlock) => bail!(
            "Another bertha is already serving {}. Stop it first, or point DATABASE_PATH at another file.",
            database.display()
        ),
        Err(std::fs::TryLockError::Error(e)) => Err(e).with_context(|| format!("can't lock {}", path.display())),
    }
}

async fn serve(db: Db, config: Config) -> anyhow::Result<()> {
    let reporting = match &config.report_to {
        Some(wanted) => match report::find(db.project_keys().await?, wanted) {
            Some(p) => Some(Reporting { project: ProjectId(p.id), ingest_key: p.ingest_key }),
            None => {
                tracing::warn!(
                    "BERTHA_REPORT_TO is {wanted:?}, but there's no such project, so bertha's own errors aren't \
                     reported. `bertha project list` shows them all."
                );
                None
            }
        },
        None => None,
    };
    // First, so problems found at startup are reported. Reports wait until bertha listens.
    // Kept until serve returns: dropping it sends what's left.
    let _reports = reporting.as_ref().and_then(|r| report::start(r, config.bind));
    if let Some(r) = &reporting {
        match report::store_maps(&db, &r.project).await {
            Ok(maps) => tracing::info!(project = %r.project, maps, "reporting bertha's own errors"),
            Err(e) => tracing::warn!(error = ?e, "couldn't store the app's source maps; its stacks stay minified"),
        }
    }

    let mailer = Mailer::from_config(config.smtp.as_ref())?;
    if let Err(e) = mailer.check().await {
        // Not fatal: the rest of bertha works, and the next send will say why it failed.
        tracing::error!(error = ?e, "SMTP check failed; sign-in emails won't arrive until this is fixed");
    }
    if matches!(mailer, Mailer::Log) {
        tracing::warn!("SMTP_HOST is not set: emails, including sign-in links, are written to this log");
    }
    if db.owner().await?.is_none() {
        tracing::warn!("No owner yet. Create one with: bertha owner create you@example.com");
    }
    db.set_watches_github(config.github.is_some());
    if config.github.is_none() {
        tracing::info!("BERTHA_GITHUB_TOKEN is not set: fixes are marked shipped by hand");
    }
    let run_workers = config.fixed_now.is_none();
    if !run_workers {
        tracing::warn!("BERTHA_FIXED_NOW is set: the clock is stopped, and monitors, alerts and housekeeping are off");
    }

    let listener =
        tokio::net::TcpListener::bind(config.bind).await.with_context(|| format!("can't listen on {}", config.bind))?;
    tracing::info!(addr = %config.bind, url = %config.public_url, "bertha is listening");

    let http = bertha_server::uptime::http_client()?;
    let checker = Checker::Http { client: http.clone(), region: config.region.clone() };
    let live = Live::new();
    let alerter = Alerter::new(db.clone());
    let (pipeline, ingest_worker) = Pipeline::start(db.clone(), live.clone(), alerter.clone());
    let mut workers = run_workers.then(|| {
        Workers::start(workers::Context {
            db: db.clone(),
            checker: checker.clone(),
            alerter: alerter.clone(),
            mailer: mailer.clone(),
            http: http.clone(),
            live: live.clone(),
            retention: i64::from(config.retention_days) * DAY,
            check_every: config.check_every,
            forge: config.github.as_ref().map(|g| Forge::github(http.clone(), &g.api, &g.token)),
        })
    });
    let state = AppState {
        db: db.clone(),
        config: Arc::new(config),
        mailer,
        checker,
        http,
        pipeline,
        live: live.clone(),
        alerter,
        reporting,
    };
    let app = router(state).into_make_service_with_connect_info::<SocketAddr>();
    let mut deaths = workers.as_mut().and_then(Workers::deaths);
    let (died_tx, mut died_rx) = tokio::sync::oneshot::channel::<&'static str>();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let died = async {
                match deaths.as_mut() {
                    Some(rx) => rx.recv().await,
                    None => std::future::pending().await,
                }
            };
            tokio::select! {
                () = shutdown() => {},
                Some(name) = died => {
                    let _ = died_tx.send(name);
                },
            }
            // Live streams never finish by themselves.
            live.close();
        })
        .await?;
    // The router (and its queue sender) is gone: the worker drains what's queued.
    if tokio::time::timeout(Duration::from_secs(10), ingest_worker).await.is_err() {
        tracing::warn!("stopped before the ingest queue drained");
    }
    // After ingest, so alerts from the last batches are queued before the outbox stops.
    // Anything still pending goes out on the next start.
    if let Some(w) = workers {
        w.stop().await;
    }
    db.close().await;
    if let Ok(name) = died_rx.try_recv() {
        // A non-zero exit, so systemd (Restart=on-failure) or Docker starts bertha again.
        bail!("The {name} worker stopped, so bertha shut down to be restarted. The log above says why.");
    }
    tracing::info!("stopped");
    Ok(())
}

async fn shutdown() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let term = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! {
        () = ctrl_c => {},
        () = term => {},
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, reason = "tests")]

    #[test]
    fn one_server_per_database() {
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join("bertha.db");
        let first = super::only_server(&db).unwrap();
        let second = super::only_server(&db).unwrap_err().to_string();
        assert!(second.starts_with("Another bertha is already serving"), "{second}");
        drop(first);
        super::only_server(&db).unwrap();
    }
}
