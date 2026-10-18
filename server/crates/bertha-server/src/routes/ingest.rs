//! `/ingest/v1`: what `@bigbertha/sdk` and the build plugins talk to. Open to any origin
//! (the SDK runs on the apps' own sites) and authenticated by key, not cookie.
//!
//! - `events` and `heartbeat` take the project's public ingest key.
//! - `deploys` and `sourcemaps` take the secret upload key, used from CI only.
//!
//! The key goes in `Authorization: Bearer …`, or `?key=` where headers can't be set
//! (`navigator.sendBeacon`).

use std::borrow::Cow;
use std::io::Read;
use std::net::{IpAddr, SocketAddr};
use std::time::{Duration, Instant};

use axum::body::Bytes;
use axum::extract::{ConnectInfo, DefaultBodyLimit, FromRequestParts, State};
use axum::http::request::Parts;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use bertha_core::ingest::{
    DeployRecorded, IngestBatch, IngestDeploy, IngestError, IngestHeartbeat, IngestResponse, SourceMapUploaded,
    environment_from, limits,
};
use bertha_core::time::parse_millis;
use bertha_db::writes::ingest::KeyedProject;
use bertha_ingest::{Context, check, cut, parse_map};
use serde::Deserialize;
use tower_http::cors::{Any, CorsLayer};

use crate::app::AppState;
use crate::pipeline::Job;

pub fn router() -> Router<AppState> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::CONTENT_ENCODING])
        .max_age(Duration::from_secs(24 * 60 * 60));
    Router::new()
        .route("/events", post(events).layer(DefaultBodyLimit::max(limits::BODY_BYTES)))
        .route("/heartbeat", post(heartbeat).layer(DefaultBodyLimit::max(16 * 1024)))
        .route("/deploys", post(deploys).layer(DefaultBodyLimit::max(64 * 1024)))
        .route("/sourcemaps", post(sourcemaps).layer(DefaultBodyLimit::max(limits::SOURCEMAP_BYTES)))
        .fallback(|| async { Fail::new(StatusCode::NOT_FOUND, "There's no such ingest endpoint.") })
        .layer(cors)
}

/// An ingest error: `{ error }`, which the SDK logs once and doesn't retry (except
/// 429 and 5xx).
#[derive(Debug)]
pub struct Fail(StatusCode, String);

impl Fail {
    fn new(status: StatusCode, message: impl Into<String>) -> Fail {
        Fail(status, message.into())
    }

    fn internal(e: impl std::fmt::Debug) -> Fail {
        tracing::error!(error = ?e, "ingest request failed");
        Fail::new(StatusCode::INTERNAL_SERVER_ERROR, "bertha couldn't take this right now. Try again.")
    }
}

impl IntoResponse for Fail {
    fn into_response(self) -> Response {
        (self.0, Json(IngestError { error: self.1 })).into_response()
    }
}

impl From<bertha_db::Error> for Fail {
    fn from(e: bertha_db::Error) -> Self {
        Fail::internal(e)
    }
}

#[derive(Deserialize)]
struct KeyQuery {
    key: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MapQuery {
    key: Option<String>,
    debug_id: Option<String>,
    file: Option<String>,
    release: Option<String>,
}

fn key_from(headers: &HeaderMap, query: Option<String>) -> Option<String> {
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|k| k.trim().to_owned());
    bearer.or(query).filter(|k| !k.is_empty())
}

async fn ingest_project(s: &AppState, headers: &HeaderMap, query: Option<String>) -> Result<KeyedProject, Fail> {
    let Some(key) = key_from(headers, query) else {
        return Err(Fail::new(StatusCode::UNAUTHORIZED, "Send the project's ingest key as a Bearer token."));
    };
    s.db.project_by_ingest_key(&key).await?.ok_or_else(|| {
        Fail::new(StatusCode::UNAUTHORIZED, "That ingest key isn't bertha's. Copy it again from the project's setup.")
    })
}

async fn upload_project(s: &AppState, headers: &HeaderMap, query: Option<String>) -> Result<KeyedProject, Fail> {
    let Some(key) = key_from(headers, query) else {
        return Err(Fail::new(StatusCode::UNAUTHORIZED, "Send the project's upload key as a Bearer token."));
    };
    if let Some(p) = s.db.project_by_upload_key(&key).await? {
        return Ok(p);
    }
    let message = if s.db.project_by_ingest_key(&key).await?.is_some() {
        "That's the ingest key. Uploads need the project's upload key (BERTHA_UPLOAD_KEY)."
    } else {
        "That upload key isn't bertha's. Copy it again from the project's setup."
    };
    Err(Fail::new(StatusCode::UNAUTHORIZED, message))
}

/// The body as sent, gunzipped if it starts with gzip's magic bytes, whatever the
/// headers say. Stops reading past `max`, so a small bomb can't inflate into memory.
fn decode(body: &[u8], max: usize) -> Result<Cow<'_, [u8]>, Fail> {
    let too_big = || {
        Fail::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            format!("The body is over {} MB uncompressed. Send less at once.", max >> 20),
        )
    };
    if !body.starts_with(&[0x1f, 0x8b]) {
        return if body.len() > max { Err(too_big()) } else { Ok(Cow::Borrowed(body)) };
    }
    let mut out = Vec::new();
    flate2::read::GzDecoder::new(body)
        .take(max as u64 + 1)
        .read_to_end(&mut out)
        .map_err(|_| Fail::new(StatusCode::BAD_REQUEST, "The body looks gzipped but doesn't decompress."))?;
    if out.len() > max {
        return Err(too_big());
    }
    Ok(Cow::Owned(out))
}

fn json<T: serde::de::DeserializeOwned>(bytes: &[u8], what: &str) -> Result<T, Fail> {
    serde_json::from_slice(bytes).map_err(|e| Fail::new(StatusCode::BAD_REQUEST, format!("The body isn't {what}: {e}")))
}

/// Where a report came from. Behind Caddy on the same host, that's the first
/// `X-Forwarded-For`; from anywhere else, the peer itself (the header can be forged).
pub struct ClientIp(pub Option<IpAddr>);

impl<S: Send + Sync> FromRequestParts<S> for ClientIp {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let peer = parts.extensions.get::<ConnectInfo<SocketAddr>>().map(|c| c.0.ip());
        let forwarded = || {
            parts
                .headers
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.split(',').next())
                .and_then(|v| v.trim().parse::<IpAddr>().ok())
        };
        Ok(ClientIp(match peer {
            Some(ip) if !ip.is_loopback() => Some(ip),
            _ => forwarded().or(peer),
        }))
    }
}

async fn events(
    State(s): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(q): axum::extract::Query<KeyQuery>,
    ClientIp(client_ip): ClientIp,
    body: Bytes,
) -> Result<Response, Fail> {
    let project = ingest_project(&s, &headers, q.key).await?;
    let batch: IngestBatch = tokio::task::spawn_blocking(move || {
        let bytes = decode(&body, limits::DECOMPRESSED_BYTES)?;
        json(&bytes, "a batch of events")
    })
    .await
    .map_err(Fail::internal)??;

    let mut events = batch.events;
    let mut rejected = events.len().saturating_sub(limits::EVENTS_PER_BATCH);
    events.truncate(limits::EVENTS_PER_BATCH);
    let before = events.len();
    events.retain(|e| check(e).is_ok());
    rejected += before - events.len();
    if events.is_empty() {
        return Ok(reply(StatusCode::ACCEPTED, 0, rejected, None));
    }

    let (allowed, wait) = s.pipeline.limiter.take(&project.id, events.len(), Instant::now());
    rejected += events.len() - allowed;
    events.truncate(allowed);
    if allowed == 0 {
        return Ok(reply(StatusCode::TOO_MANY_REQUESTS, 0, rejected, wait));
    }
    let ctx = Context { received_at: s.db.now(), client_ip };
    match s.pipeline.submit(Job { project, events, ctx }) {
        Ok(()) => Ok(reply(StatusCode::ACCEPTED, allowed, rejected, wait)),
        Err(_) => {
            tracing::warn!("ingest queue is full; asking SDKs to back off");
            Ok(reply(StatusCode::TOO_MANY_REQUESTS, 0, rejected + allowed, Some(Duration::from_secs(5))))
        }
    }
}

fn reply(status: StatusCode, accepted: usize, rejected: usize, wait: Option<Duration>) -> Response {
    let retry_after = wait.map(|w| w.as_secs_f64().ceil().max(1.0) as u32);
    let body = IngestResponse {
        accepted: u32::try_from(accepted).unwrap_or(u32::MAX),
        rejected: u32::try_from(rejected).unwrap_or(u32::MAX),
        retry_after,
    };
    let mut res = (status, Json(body)).into_response();
    if let Some(secs) = retry_after {
        res.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(secs));
    }
    res
}

async fn heartbeat(
    State(s): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(q): axum::extract::Query<KeyQuery>,
    body: Bytes,
) -> Result<StatusCode, Fail> {
    let project = ingest_project(&s, &headers, q.key).await?;
    // The body is optional and only informative; an empty one is fine.
    if !body.is_empty() {
        let _: IngestHeartbeat = json(&decode(&body, 16 * 1024)?, "a heartbeat")?;
    }
    s.db.heartbeat(&project.id, s.db.now()).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn deploys(
    State(s): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(q): axum::extract::Query<KeyQuery>,
    body: Bytes,
) -> Result<(StatusCode, Json<DeployRecorded>), Fail> {
    let project = upload_project(&s, &headers, q.key).await?;
    let deploy: IngestDeploy = json(&decode(&body, 64 * 1024)?, "a deploy")?;
    let release = deploy.release.trim();
    if release.is_empty() {
        return Err(Fail::new(StatusCode::BAD_REQUEST, "A deploy needs a release, such as a version or commit sha."));
    }
    let release = cut(release, 200);
    let now = s.db.now();
    let at = deploy.deployed_at.as_deref().and_then(parse_millis).map_or(now, |t| t.min(now));
    let environment = environment_from(deploy.environment.as_deref());
    let commit =
        deploy.commit.as_ref().map(|c| (cut(c.sha.trim(), 64), cut(c.message.trim(), 500), cut(c.author.trim(), 200)));
    let id =
        s.db.record_deploy(
            &project.id,
            &release,
            environment,
            at,
            commit.as_ref().map(|(a, b, c)| (a.as_str(), b.as_str(), c.as_str())),
        )
        .await?;
    Ok((StatusCode::CREATED, Json(DeployRecorded { release_id: id.0 })))
}

async fn sourcemaps(
    State(s): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(q): axum::extract::Query<MapQuery>,
    body: Bytes,
) -> Result<(StatusCode, Json<SourceMapUploaded>), Fail> {
    let project = upload_project(&s, &headers, q.key).await?;
    let (json_bytes, map) = tokio::task::spawn_blocking(move || {
        let bytes = decode(&body, limits::SOURCEMAP_BYTES)?.into_owned();
        let map = parse_map(&bytes)
            .map_err(|e| Fail::new(StatusCode::BAD_REQUEST, format!("The body isn't a source map: {e}")))?;
        Ok::<_, Fail>((bytes, map))
    })
    .await
    .map_err(Fail::internal)??;

    let from_map = map.get_debug_id().map(|d| d.to_string());
    let Some(debug_id) = q.debug_id.filter(|d| !d.trim().is_empty()).or(from_map) else {
        return Err(Fail::new(
            StatusCode::BAD_REQUEST,
            "The map has no debug id. Build with the bertha plugin, or pass ?debugId=.",
        ));
    };
    let debug_id = cut(&debug_id.trim().to_ascii_lowercase(), 64);
    let file = q.file.or_else(|| map.get_file().map(str::to_owned)).unwrap_or_else(|| "unknown".to_owned());
    let release = q.release.map(|r| cut(r.trim(), 200)).filter(|r| !r.is_empty());
    s.db.save_sourcemap(&project.id, &debug_id, &cut(&file, 500), release.as_deref(), &json_bytes).await?;
    s.pipeline.maps.forget(&project.id, &debug_id);
    let sources = map.get_source_count();
    Ok((StatusCode::CREATED, Json(SourceMapUploaded { debug_id, sources })))
}
