//! Infrastructure errors as HTTP responses. Contract failure kinds are not errors:
//! they travel as `200 { ok: false, failure, message }`. These are for everything the
//! UI shows as its error state, with a message it can display as-is.

use axum::Json;
use axum::extract::rejection::{JsonRejection, PathRejection, QueryRejection};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("not found")]
    NotFound,
    #[error("{0}")]
    BadRequest(String),
    /// A write without the `X-Bertha` header: not sent by bertha's own pages.
    #[error("missing csrf header")]
    CrossSite,
    /// Something bertha depends on (the mail server) failed; the message says what
    /// was and wasn't done.
    #[error("{0}")]
    Upstream(String),
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl From<bertha_db::Error> for ApiError {
    fn from(e: bertha_db::Error) -> Self {
        match e {
            bertha_db::Error::Forbidden => ApiError::Forbidden,
            bertha_db::Error::Invalid(m) => ApiError::BadRequest(m),
            other => ApiError::Internal(other.into()),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "Sign in to continue.".to_owned()),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, "Only the owner has access to this.".to_owned()),
            ApiError::NotFound => {
                (StatusCode::NOT_FOUND, "That doesn't exist, or you don't have access to it.".to_owned())
            }
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            ApiError::Upstream(m) => (StatusCode::BAD_GATEWAY, m.clone()),
            ApiError::CrossSite => (
                StatusCode::FORBIDDEN,
                "This request didn't come from bertha. Reload the page and try again.".to_owned(),
            ),
            ApiError::Internal(e) => {
                tracing::error!(error = ?e, "request failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "Something went wrong on the server. Try again.".to_owned())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

macro_rules! bad_request_from {
    ($($rejection:ty),*) => {$(
        impl From<$rejection> for ApiError {
            fn from(r: $rejection) -> Self {
                ApiError::BadRequest(r.body_text())
            }
        }
    )*};
}
bad_request_from!(JsonRejection, QueryRejection, PathRejection);

pub type ApiResult<T> = Result<T, ApiError>;
