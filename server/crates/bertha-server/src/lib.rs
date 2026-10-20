//! bertha's server: the API, sign-in, the embedded frontend, ingest and the
//! background workers. `main.rs` is the CLI around it.

pub mod alerts;
pub mod app;
pub mod config;
pub mod error;
pub mod extract;
pub mod github;
pub mod live;
pub mod mail;
mod mcp;
pub mod pipeline;
pub mod routes;
pub mod session;
mod spa;
pub mod uptime;
pub mod workers;

pub use app::{AppState, router};
