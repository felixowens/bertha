//! bertha's server: the API, sign-in, the embedded frontend, ingest and the
//! background workers. `main.rs` is the CLI around it.

pub mod alerts;
pub mod app;
pub mod config;
pub mod error;
pub mod extract;
pub mod live;
pub mod mail;
pub mod pipeline;
pub mod routes;
pub mod session;
mod spa;
pub mod uptime;

pub use app::{AppState, router};
