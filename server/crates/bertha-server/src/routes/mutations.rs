//! One route per `Backend` mutation. Each answers 200 with the contract's `Result`;
//! a named failure is `{ ok: false, failure, message }`, never an HTTP error.

use std::collections::BTreeMap;

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use bertha_core::api::*;
use bertha_core::domain::{
    AlertDestination, AlertRule, Issue, IssueSummary, Member, Monitor, Project, ProjectSetup, Triage, UptimeCheck,
};
use bertha_core::ids::{IssueId, ProjectId};
use bertha_core::live::LiveEvent;
use bertha_core::pages::{CreatedProject, CreatedToken, Delivered, DestinationDeleted};
use bertha_core::time::IsoDate;
use bertha_core::validate;
use bertha_db::Viewer;
use bertha_db::writes::team::Invitation;

use crate::alerts::{Notice, deliver};
use crate::app::AppState;
use crate::error::{ApiError, ApiResult};
use crate::extract::{JsonBody, Path};
use crate::mail;
use crate::session::Session;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/issues/update", post(update_issues))
        .route("/issues/merge", post(merge_issues))
        .route("/issues/{id}/notes", post(add_note))
        .route("/issues/{id}/triages", post(start_triage))
        .route("/triages/{id}", post(update_triage))
        .route("/projects", post(create_project))
        .route("/projects/{id}", post(update_project))
        .route("/projects/{id}/rotate-key", post(rotate_key))
        .route("/projects/{id}/delete", post(delete_project))
        .route("/monitors", post(save_monitor))
        .route("/monitors/{id}/delete", post(delete_monitor))
        .route("/monitors/{id}/check", post(check_monitor))
        .route("/alerts/rules", post(save_rule))
        .route("/alerts/rules/{id}/delete", post(delete_rule))
        .route("/alerts/destinations", post(save_destination))
        .route("/alerts/destinations/{id}/test", post(test_destination))
        .route("/alerts/destinations/{id}/delete", post(delete_destination))
        .route("/team/invites", post(invite))
        .route("/team/members/{id}/access", post(member_access))
        .route("/team/members/{id}/remove", post(remove_member))
        .route("/team/members/{id}/resend", post(resend_invite))
        .route("/agents/tokens", post(create_token))
        .route("/agents/tokens/{id}/revoke", post(revoke_token))
        .route("/agents/reports/{id}/done", post(report_done))
}

type Reply<T, F> = ApiResult<Json<Outcome<T, F>>>;

async fn update_issues(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<UpdateIssuesInput>,
) -> Reply<Vec<IssueSummary>, UpdateIssuesFailure> {
    let ids: Vec<String> = input.issue_ids.into_iter().map(|i| i.0).collect();
    let out = s.db.update_issues(&v, &ids, &input.change, input.seen.as_deref()).await?;
    if let Outcome::Ok(changed) = &out {
        tell(&s, changed.iter());
        if let IssueChange::Assign { person_id: Some(to) } = &input.change
            && *to != v.member().id
        {
            tell_assignee(&s, &v.member().name, &to.0, changed).await;
        }
    }
    Ok(Json(out))
}

/// Emails whoever was handed the issues, one email for the lot. Assigning yourself
/// sends nothing. A failed email is logged, not reported: the assignment stands.
pub(crate) async fn tell_assignee(s: &AppState, by: &str, to: &str, issues: &[IssueSummary]) {
    let member = match s.db.joined_member(to).await {
        Ok(Some(m)) => m,
        Ok(None) => return,
        Err(e) => return tracing::error!(error = ?e, "loading the assignee failed"),
    };
    let mail = match issues {
        [] => return,
        [one] => mail::assigned(
            &member.email,
            by,
            &one.short_id,
            &format!("{}: {}", one.r#type, one.message),
            &format!("{}/issues/{}", s.config.public_url, one.id),
        ),
        many => mail::assigned(
            &member.email,
            by,
            &format!("{} issues", many.len()),
            &many.iter().map(|i| i.short_id.as_str()).collect::<Vec<_>>().join(", "),
            &format!(
                "{}/issues?ids={}",
                s.config.public_url,
                many.iter().map(|i| i.id.0.as_str()).collect::<Vec<_>>().join(",")
            ),
        ),
    };
    if let Err(e) = s.mailer.send(mail).await {
        tracing::error!(error = ?e, "assignment email failed");
    }
}

async fn merge_issues(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<MergeIssuesInput>,
) -> Reply<Issue, MergeIssuesFailure> {
    let sources: Vec<String> = input.source_ids.into_iter().map(|i| i.0).collect();
    let out = s.db.merge_issues(&v, &input.target_id.0, &sources).await?;
    if let Outcome::Ok(issue) = &out {
        // The sources are gone; open lists drop them when they reload.
        let mut ids: Vec<IssueId> = sources.into_iter().map(IssueId).collect();
        ids.push(issue.summary.id.clone());
        s.live.send(LiveEvent::IssuesChanged { project_id: issue.summary.project_id.clone(), issue_ids: ids });
    }
    Ok(Json(out))
}

/// One `issuesChanged` per project, so each viewer hears only about their own.
pub(crate) fn tell<'a>(s: &AppState, changed: impl Iterator<Item = &'a IssueSummary>) {
    let mut by_project: BTreeMap<ProjectId, Vec<IssueId>> = BTreeMap::new();
    for i in changed {
        by_project.entry(i.project_id.clone()).or_default().push(i.id.clone());
    }
    for (project_id, issue_ids) in by_project {
        s.live.send(LiveEvent::IssuesChanged { project_id, issue_ids });
    }
}

async fn add_note(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<NoteInput>,
) -> Reply<Issue, AddIssueNoteFailure> {
    let out = s.db.add_issue_note(&v, &id, &input.body).await?;
    if let Outcome::Ok(issue) = &out {
        tell(&s, std::iter::once(&issue.summary));
    }
    Ok(Json(out))
}

async fn start_triage(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<StartTriageInput>,
) -> Reply<Triage, StartTriageFailure> {
    let out = s.db.start_triage(&v, &id, input.take_over.unwrap_or(false)).await?;
    Ok(Json(out.map(|change| {
        tell(&s, std::iter::once(&change.issue));
        change.triage
    })))
}

async fn update_triage(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<TriageInput>,
) -> Reply<Triage, UpdateTriageFailure> {
    let out = s.db.update_triage(&v, &id, &input).await?;
    Ok(Json(out.map(|change| {
        tell(&s, std::iter::once(&change.issue));
        change.triage
    })))
}

async fn create_project(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<CreateProjectInput>,
) -> Reply<CreatedProject, CreateProjectFailure> {
    Ok(Json(s.db.create_project(&v, &input).await?))
}

async fn update_project(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<ProjectInput>,
) -> Reply<Project, UpdateProjectFailure> {
    s.db.update_project(&v, &id, &input).await?.map(Json).ok_or(ApiError::NotFound)
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
    // Owner only: a monitor makes bertha request any URL it's given.
    if !v.is_owner() || !v.can_see(&input.project_id) {
        return Err(ApiError::Forbidden);
    }
    let Some(url) = validate::monitor_url(&input.url) else {
        return Ok(Json(Outcome::fail(SaveMonitorFailure::InvalidUrl)));
    };
    let first =
        if s.db.monitor_needs_check(&input).await? { Some(s.checker.check(&url, s.db.now()).await) } else { None };
    Ok(Json(s.db.save_monitor(&v, &input, first.as_ref()).await?))
}

async fn delete_monitor(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<(), DeleteMonitorFailure> {
    Ok(Json(s.db.delete_monitor(&v, &id).await?))
}

/// One check now, outside the schedule, after a fix. It counts like any other check:
/// it can open or close an incident, and its next scheduled check moves back.
async fn check_monitor(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<UptimeCheck, CheckMonitorNowFailure> {
    let Some(m) = s.db.monitor_to_check(&v, &id).await? else {
        return Ok(Json(Outcome::fail(CheckMonitorNowFailure::NotFound)));
    };
    let at = s.db.now();
    let result = s.checker.check(&m.url, at).await;
    if let Some(t) = s.db.record_check(&m.id, &m.url, &result, at + m.interval).await? {
        crate::workers::changed(&s.live, &s.alerter, &t).await;
    }
    Ok(Json(Outcome::Ok(UptimeCheck {
        at: IsoDate::from_millis(result.at),
        ok: result.ok,
        http_status: result.http_status.map(u32::from),
        response_ms: result.response_ms,
        error: result.error,
        region: result.region,
    })))
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

async fn delete_destination(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<DestinationDeleted, DeleteDestinationFailure> {
    Ok(Json(s.db.delete_destination(&v, &id).await?))
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
    send_invite(&s, &v, invitation).await
}

async fn send_invite<F: Failure>(s: &AppState, v: &Viewer, invitation: Invitation) -> Reply<Member, F> {
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

/// A new link and a new 7 days; the old link stops working.
async fn resend_invite(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<Member, ResendInviteFailure> {
    let invitation = match s.db.resend_invite(&v, &id).await? {
        Outcome::Ok(i) => i,
        Outcome::Failed(f, m) => return Ok(Json(Outcome::Failed(f, m))),
    };
    send_invite(&s, &v, invitation).await
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

async fn create_token(
    State(s): State<AppState>,
    Session(v): Session,
    JsonBody(input): JsonBody<CreateAccessTokenInput>,
) -> Reply<CreatedToken, CreateAccessTokenFailure> {
    Ok(Json(s.db.create_access_token(&v, &input.name).await?))
}

async fn revoke_token(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
) -> Reply<(), RevokeAccessTokenFailure> {
    Ok(Json(s.db.revoke_access_token(&v, &id).await?))
}

async fn report_done(
    State(s): State<AppState>,
    Session(v): Session,
    Path(id): Path<String>,
    JsonBody(input): JsonBody<AgentReportDoneInput>,
) -> Reply<(), SetAgentReportDoneFailure> {
    Ok(Json(s.db.set_agent_report_done(&v, &id, input.done).await?))
}
