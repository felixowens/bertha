//! One route per `Backend` mutation. Each answers 200 with the contract's `Result`;
//! a named failure is `{ ok: false, failure, message }`, never an HTTP error.

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use bertha_core::api::*;
use bertha_core::domain::{AlertDestination, AlertRule, Issue, IssueSummary, Member, Monitor, ProjectSetup};
use bertha_core::pages::{CreatedProject, Delivered};
use bertha_core::time::IsoDate;
use bertha_core::validate;

use crate::alerts::{Notice, deliver};
use crate::app::AppState;
use crate::error::{ApiError, ApiResult};
use crate::extract::{JsonBody, Path};
use crate::mail;
use crate::session::Session;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/issues/update", post(update_issues))
        .route("/issues/{id}/notes", post(add_note))
        .route("/projects", post(create_project))
        .route("/projects/{id}/rotate-key", post(rotate_key))
        .route("/projects/{id}/delete", post(delete_project))
        .route("/monitors", post(save_monitor))
        .route("/alerts/rules", post(save_rule))
        .route("/alerts/rules/{id}/delete", post(delete_rule))
        .route("/alerts/destinations", post(save_destination))
        .route("/alerts/destinations/{id}/test", post(test_destination))
        .route("/team/invites", post(invite))
        .route("/team/members/{id}/access", post(member_access))
        .route("/team/members/{id}/remove", post(remove_member))
}

type Reply<T, F> = ApiResult<Json<Outcome<T, F>>>;

async fn update_issues(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<UpdateIssuesInput>,
) -> Reply<Vec<IssueSummary>, UpdateIssuesFailure> {
    let ids: Vec<String> = input.issue_ids.into_iter().map(|i| i.0).collect();
    Ok(Json(s.db.update_issues(&v, &ids, &input.change, input.seen.as_deref()).await?))
}

async fn add_note(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<NoteInput>,
) -> Reply<Issue, AddIssueNoteFailure> {
    Ok(Json(s.db.add_issue_note(&v, &id, &input.body).await?))
}

async fn create_project(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<CreateProjectInput>,
) -> Reply<CreatedProject, CreateProjectFailure> {
    Ok(Json(s.db.create_project(&v, &input).await?))
}

async fn rotate_key(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<ProjectSetup, RotateIngestKeyFailure> {
    s.db.rotate_ingest_key(&v, &id).await?.map(Json).ok_or(ApiError::NotFound)
}

async fn delete_project(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<DeleteProjectInput>,
) -> Reply<(), DeleteProjectFailure> {
    s.db.delete_project(&v, &id, &input.confirm_name).await?.map(Json).ok_or(ApiError::NotFound)
}

/// Runs one check first when the monitor is new, moved or unpaused, so a typo'd URL
/// is caught here rather than as an incident a minute later.
async fn save_monitor(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<MonitorInput>,
) -> Reply<Monitor, SaveMonitorFailure> {
    if !v.can_see(&input.project_id) {
        return Err(ApiError::Forbidden);
    }
    let Some(url) = validate::monitor_url(&input.url) else {
        return Ok(Json(Outcome::fail(SaveMonitorFailure::InvalidUrl)));
    };
    let first =
        if s.db.monitor_needs_check(&input).await? { Some(s.checker.check(&url, s.db.now()).await) } else { None };
    Ok(Json(s.db.save_monitor(&v, &input, first.as_ref()).await?))
}

async fn save_rule(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<AlertRuleInput>,
) -> Reply<AlertRule, SaveAlertRuleFailure> {
    Ok(Json(s.db.save_alert_rule(&v, &input).await?))
}

async fn delete_rule(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<(), DeleteAlertRuleFailure> {
    Ok(Json(s.db.delete_alert_rule(&v, &id).await?))
}

async fn save_destination(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<DestinationInput>,
) -> Reply<AlertDestination, SaveDestinationFailure> {
    Ok(Json(s.db.save_destination(&v, &input).await?))
}

async fn test_destination(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<Delivered, TestDestinationFailure> {
    let Some(destination) = s.db.destination(&v, &id).await? else { return Err(ApiError::NotFound) };
    let notice = Notice::test(&s.config.public_url);
    Ok(Json(match deliver(&destination, &notice, &s.mailer, &s.http).await {
        Ok(()) => Outcome::Ok(Delivered { delivered_at: IsoDate::from_millis(s.db.now()) }),
        Err(e) => {
            Outcome::fail_with(TestDestinationFailure::DeliveryFailed, format!("The test alert wasn't delivered. {e}"))
        }
    }))
}

async fn invite(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<InviteInput>,
) -> Reply<Member, InviteMemberFailure> {
    let invitation = match s.db.invite_member(&v, &input.email, &input.project_ids).await? {
        Outcome::Ok(i) => i,
        Outcome::Failed(f, m) => return Ok(Json(Outcome::Failed(f, m))),
    };
    let link = format!("{}/invite/{}", s.config.public_url, invitation.token);
    let mail = mail::invite(&invitation.member.email, &v.member().name, &invitation.project_names, &link);
    if let Err(e) = s.mailer.send(mail).await {
        tracing::error!(error = ?e, "invite email failed");
        return Err(ApiError::Upstream(format!(
            "The invitation was saved, but the email to {} didn't send. Invite them again to retry.",
            invitation.member.email
        )));
    }
    Ok(Json(Outcome::Ok(invitation.member)))
}

async fn member_access(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<MemberAccessInput>,
) -> Reply<Member, UpdateMemberAccessFailure> {
    s.db.update_member_access(&v, &id, &input.project_ids).await?.map(Json).ok_or(ApiError::NotFound)
}

async fn remove_member(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<(), RemoveMemberFailure> {
    Ok(Json(s.db.remove_member(&v, &id).await?))
}
