//! `bertha`: serve, plus the few things done on the server by hand.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, bail};
use bertha_core::time::DAY;
use bertha_db::seed::{Fixtures, SeedOptions};
use bertha_db::{Clock, Db};
use bertha_server::alerts::Alerter;
use bertha_server::config::Config;
use bertha_server::live::Live;
use bertha_server::mail::Mailer;
use bertha_server::pipeline::Pipeline;
use bertha_server::uptime::Checker;
use bertha_server::workers::{self, Workers};
use bertha_server::{AppState, router};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

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
    if json_logs {
        tracing_subscriber::fmt().with_env_filter(filter).json().init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }

    let cli = Cli::parse();
    let config = Config::from_env()?;
    let clock = config.fixed_now.map(Clock::fixed).unwrap_or(Clock::System);
    let db = Db::open(&config.database, &config.public_url, clock)
        .await
        .with_context(|| format!("can't open the database at {}", config.database.display()))?;

    match cli.command.unwrap_or(Command::Serve) {
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
                "Seeded {} projects, {} issues, {} hourly counts and {} checks.",
                report.projects, report.issues, report.hourly_rows, report.checks
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
                    let wanted = project.to_lowercase();
                    let Some(p) = all
                        .into_iter()
                        .find(|p| p.id == project || p.key.to_lowercase() == wanted || p.name.to_lowercase() == wanted)
                    else {
                        bail!("No project {project:?}. `bertha project list` shows them all.");
                    };
                    println!("BERTHA_KEY={}\nBERTHA_UPLOAD_KEY={}", p.ingest_key, p.upload_key);
                }
            }
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

async fn serve(db: Db, config: Config) -> anyhow::Result<()> {
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
    let workers = run_workers.then(|| {
        Workers::start(workers::Context {
            db: db.clone(),
            checker: checker.clone(),
            alerter: alerter.clone(),
            mailer: mailer.clone(),
            http: http.clone(),
            live: live.clone(),
            retention: i64::from(config.retention_days) * DAY,
            check_every: config.check_every,
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
    };
    let app = router(state).into_make_service_with_connect_info::<SocketAddr>();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown().await;
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
