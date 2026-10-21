// Tells bertha a release went out (`POST /ingest/v1/deploys`), from CI or a deploy
// script, with the project's upload key.

use std::fmt;

use crate::transport::{agent, endpoint, json};
use crate::wire::{DeployRecorded, IngestDeploy, IngestError};

/// Why a deploy wasn't recorded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeployError {
    /// bertha answered, and said no.
    Refused { status: u16, message: String },
    /// bertha couldn't be reached.
    Unreachable(String),
}

impl fmt::Display for DeployError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Refused { status, message } => {
                write!(f, "bertha didn't record the deploy (HTTP {status}): {message}")
            }
            Self::Unreachable(why) => write!(f, "Couldn't reach bertha: {why}"),
        }
    }
}

impl std::error::Error for DeployError {}

/// Records a deploy. `url` is where bertha runs; `upload_key` is the project's upload
/// key, not its ingest key.
pub fn record_deploy(url: &str, upload_key: &str, deploy: &IngestDeploy) -> Result<DeployRecorded, DeployError> {
    let mut res = agent()
        .post(&endpoint(url, "deploys"))
        .header("authorization", &format!("Bearer {upload_key}"))
        .header("content-type", "application/json")
        .send(&json(deploy)[..])
        .map_err(|e| DeployError::Unreachable(e.to_string()))?;
    let status = res.status().as_u16();
    let text = res.body_mut().read_to_string().unwrap_or_default();
    if res.status().is_success() {
        return serde_json::from_str(&text)
            .map_err(|_| DeployError::Refused { status, message: "bertha's answer wasn't a deploy.".to_owned() });
    }
    let message =
        serde_json::from_str::<IngestError>(&text).map(|e| e.error).unwrap_or_else(|_| format!("HTTP {status}"));
    Err(DeployError::Refused { status, message })
}
