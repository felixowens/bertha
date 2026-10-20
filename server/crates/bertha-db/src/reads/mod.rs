//! Page reads. Each takes a [`crate::Viewer`] and only returns what it may see; a
//! detail page for something outside the viewer's projects is `None`, the same as
//! something that doesn't exist.

pub mod issues;
mod monitors;
mod overview;
pub(crate) mod projects;
mod releases;
mod settings;
pub(crate) mod triages;

#[cfg(test)]
mod tests;
