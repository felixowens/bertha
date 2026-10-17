//! The HTTP app: API routes, auth pages and the embedded frontend.

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use bertha_db::Db;
use tower_http::compression::CompressionLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::mail::Mailer;
use crate::{routes, session, spa};

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub config: Arc<Config>,
    pub mailer: Mailer,
}

/// API bodies are small JSON; ingest has its own, larger limit.
const API_BODY_LIMIT: usize = 256 * 1024;

pub fn router(state: AppState) -> Router {
    let signed_in = routes::reads::router()
        .merge(routes::auth::signed_in())
        .route_layer(middleware::from_fn_with_state(state.clone(), session::require_session));

    let api = Router::new()
        .merge(signed_in)
        .merge(routes::auth::public())
        .fallback(|| async { crate::error::ApiError::NotFound })
        .layer(middleware::from_fn(session::require_csrf_header))
        .layer(RequestBodyLimitLayer::new(API_BODY_LIMIT))
        .layer(SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, HeaderValue::from_static("no-store")));

    Router::new()
        .nest("/api/v1", api)
        .merge(routes::auth::pages())
        .route("/healthz", get(healthz))
        .fallback(spa::serve)
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("same-origin")))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
        .layer(CompressionLayer::new())
        .layer(TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, Duration::from_secs(30)))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn healthz(axum::extract::State(state): axum::extract::State<AppState>) -> impl IntoResponse {
    match state.db.ping().await {
        Ok(()) => (StatusCode::OK, "ok"),
        Err(e) => {
            tracing::error!(error = %e, "health check failed");
            (StatusCode::SERVICE_UNAVAILABLE, "database unavailable")
        }
    }
}
