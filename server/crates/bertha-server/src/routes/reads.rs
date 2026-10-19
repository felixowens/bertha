//! One route per `Backend` read. Detail reads answer `null` for something missing or
//! out of the viewer's reach, the same as the contract's `| null`.

use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use bertha_core::api::IssueQuery;
use bertha_core::domain::{ProjectSetup, TimeRange};
use bertha_core::ids::EventId;
use bertha_core::pages::*;
use bertha_db::EventWhich;
use serde::Deserialize;

use crate::app::AppState;
use crate::error::{ApiError, ApiResult};
use crate::extract::{JsonBody, Path, Query};
use crate::session::Session;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/shell", get(shell))
        .route("/overview", get(overview))
        .route("/projects", get(projects))
        .route("/issues/query", post(list_issues))
        .route("/issues/{id}", get(issue))
        .route("/issues/{id}/events/{which}", get(event))
        .route("/releases", get(releases))
        .route("/releases/{id}", get(release))
        .route("/monitors", get(monitors))
        .route("/monitors/{id}", get(monitor))
        .route("/projects/{id}/settings", get(project_settings))
        .route("/projects/{id}/setup", get(project_setup))
        .route("/alerts", get(alerts))
        .route("/team", get(team))
        .route("/agents", get(agents))
}

async fn shell(State(s): State<AppState>, Session(v): Session) -> ApiResult<Json<ShellData>> {
    Ok(Json(s.db.shell(&v).await?))
}

#[derive(Deserialize)]
struct RangeQuery {
    range: Option<TimeRange>,
    project: Option<String>,
}

/// Everything, or one project's home with `?project=`; `null` for a project out of reach.
async fn overview(
    State(s): State<AppState>,
    Session(v): Session,
    Query(q): Query<RangeQuery>,
) -> ApiResult<Json<Option<OverviewData>>> {
    let project = q.project.as_deref().filter(|p| !p.is_empty());
    Ok(Json(s.db.overview(&v, q.range.unwrap_or(TimeRange::Day), project).await?))
}

async fn projects(
    State(s): State<AppState>,
    Session(v): Session,
    Query(q): Query<RangeQuery>,
) -> ApiResult<Json<ProjectsData>> {
    Ok(Json(s.db.list_projects(&v, q.range.unwrap_or(TimeRange::Day)).await?))
}

/// A POST because the filter is a structured object; it changes nothing.
async fn list_issues(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(q): JsonBody<IssueQuery>,
) -> ApiResult<Json<IssueList>> {
    Ok(Json(s.db.list_issues(&v, &q.filter).await?))
}

async fn issue(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> ApiResult<Json<Option<IssueDetail>>> {
    // Notes say KILN-4F, so the app's links can too; the page then settles on the id.
    let Some(id) = s.db.find_issue(&v, &id).await? else { return Ok(Json(None)) };
    Ok(Json(s.db.issue_detail(&v, &id).await?))
}

async fn event(
    State(s): State<AppState>,
    Session(v): Session,
    Path((id, which)): Path<(String, String)>,
) -> ApiResult<Json<EventAt>> {
    let which = match which.as_str() {
        "latest" => EventWhich::Latest,
        "oldest" => EventWhich::Oldest,
        other => EventWhich::Id(EventId(other.to_owned())),
    };
    s.db.event_at(&v, &id, &which).await?.map(Json).ok_or(ApiError::NotFound)
}

#[derive(Deserialize)]
struct ProjectQuery {
    project: Option<String>,
}

async fn releases(
    State(s): State<AppState>,
    Session(v): Session,
    Query(q): Query<ProjectQuery>,
) -> ApiResult<Json<ReleaseList>> {
    Ok(Json(s.db.list_releases(&v, q.project.as_deref().filter(|p| !p.is_empty())).await?))
}

async fn release(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> ApiResult<Json<Option<ReleaseDetail>>> {
    Ok(Json(s.db.release_detail(&v, &id).await?))
}

async fn monitors(State(s): State<AppState>, Session(v): Session) -> ApiResult<Json<UptimeData>> {
    Ok(Json(s.db.list_monitors(&v).await?))
}

async fn monitor(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> ApiResult<Json<Option<MonitorDetail>>> {
    Ok(Json(s.db.monitor_detail(&v, &id).await?))
}

async fn project_settings(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> ApiResult<Json<Option<ProjectSettings>>> {
    Ok(Json(s.db.project_settings(&v, &id).await?))
}

async fn project_setup(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> ApiResult<Json<ProjectSetup>> {
    s.db.project_setup(&v, &id).await?.map(Json).ok_or(ApiError::NotFound)
}

async fn alerts(State(s): State<AppState>, Session(v): Session) -> ApiResult<Json<AlertsData>> {
    Ok(Json(s.db.alerts(&v).await?))
}

async fn agents(State(s): State<AppState>, Session(v): Session) -> ApiResult<Json<AgentsData>> {
    let tokens = s.db.access_tokens(&v).await?;
    let reports = s.db.agent_reports(&v).await?;
    Ok(Json(AgentsData { tokens, reports, mcp_url: format!("{}/mcp", s.config.public_url) }))
}

async fn team(State(s): State<AppState>, Session(v): Session) -> ApiResult<Json<TeamData>> {
    Ok(Json(s.db.team(&v).await?))
}
