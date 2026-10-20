//! Mutations. Each returns the contract's `Outcome`: the new state, or a named failure
//! the page knows how to show. Input no form could send is an [`crate::Error::Invalid`].

pub mod alerts;
pub mod housekeeping;
pub mod ingest;
pub mod issues;
pub mod merge;
pub mod monitors;
pub mod outbox;
pub mod projects;
pub mod team;
pub mod triages;
pub mod uptime;

#[cfg(test)]
mod ingest_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod triage_tests;
#[cfg(test)]
mod worker_tests;
