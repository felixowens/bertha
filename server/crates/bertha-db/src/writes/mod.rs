//! Mutations. Each returns the contract's `Outcome`: the new state, or a named failure
//! the page knows how to show. Input no form could send is an [`crate::Error::Invalid`].

pub mod alerts;
pub mod issues;
pub mod monitors;
pub mod projects;
pub mod team;

#[cfg(test)]
mod tests;
