//! Signing in by emailed link, invitations and signing out.

use axum::extract::State;
use axum::http::header::{LOCATION, SET_COOKIE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use bertha_core::api::{AcceptInviteFailure, Outcome, SignInFailure, SignInInput};
use bertha_core::domain::Member;
use bertha_core::pages::{EmailLinkHandoff, InviteData};
use bertha_core::time::MINUTE;
use bertha_db::auth::{LinkProblem, safe_next};
use serde::Deserialize;

use crate::app::AppState;
use crate::error::ApiResult;
use crate::extract::{JsonBody, Path, Query};
use crate::mail;
use crate::session::{clear_cookie, session_cookie, session_token};

/// At most this many sign-in emails per person per window; more are dropped quietly.
const SIGN_IN_BURST: i64 = 5;
const SIGN_IN_WINDOW: i64 = 15 * MINUTE;

/// API routes that work without a session.
pub fn public() -> Router<AppState> {
    Router::new()
        .route("/sign-in", post(sign_in))
        .route("/sign-out", post(sign_out))
        .route("/invites/{token}", get(invite))
        .route("/invites/{token}/accept", post(accept_invite))
}

/// API routes about the current session.
pub fn signed_in() -> Router<AppState> {
    Router::new()
}

/// Pages the server answers itself: the link in the sign-in email.
pub fn pages() -> Router<AppState> {
    Router::new().route("/auth/callback", get(callback))
}

async fn sign_in(
    State(s): State<AppState>,
    JsonBody(input): JsonBody<SignInInput>,
) -> ApiResult<Json<Outcome<EmailLinkHandoff, SignInFailure>>> {
    let email = input.email.trim();
    let Some(member) = s.db.member_by_email(email).await? else {
        return Ok(Json(Outcome::fail(SignInFailure::UnknownEmail)));
    };
    let returns_to = safe_next(input.next.as_deref());
    let handoff = EmailLinkHandoff { sent_to: member.email.clone(), returns_to: returns_to.clone() };

    let recent = s.db.sign_in_links_since(&member.id.0, s.db.now() - SIGN_IN_WINDOW).await?;
    if recent >= SIGN_IN_BURST {
        tracing::warn!(member = %member.id.0, "sign-in links rate limited");
        return Ok(Json(Outcome::Ok(handoff)));
    }
    let Some((token, member)) = s.db.issue_sign_in(email, Some(&returns_to)).await? else {
        return Ok(Json(Outcome::fail(SignInFailure::UnknownEmail)));
    };
    let link = format!("{}/auth/callback?token={token}", s.config.public_url);
    s.mailer.send(mail::sign_in(&member.email, &link)).await?;
    Ok(Json(Outcome::Ok(handoff)))
}

async fn sign_out(State(s): State<AppState>, headers: HeaderMap) -> ApiResult<Response> {
    if let Some(token) = session_token(&headers) {
        s.db.end_session(&token).await?;
    }
    Ok(([(SET_COOKIE, clear_cookie(s.config.secure_cookies()))], Json(serde_json::Value::Null)).into_response())
}

async fn invite(State(s): State<AppState>, Path(token): Path<String>) -> ApiResult<Json<Option<InviteData>>> {
    Ok(Json(s.db.invite(&token).await?))
}

async fn accept_invite(State(s): State<AppState>, Path(token): Path<String>) -> ApiResult<Response> {
    let outcome: Outcome<Member, AcceptInviteFailure> = match s.db.accept_invite(&token).await? {
        Outcome::Ok(session) => {
            let cookie = session_cookie(&session.token, s.config.secure_cookies());
            let body = Json(Outcome::<Member, AcceptInviteFailure>::Ok(session.viewer.member().clone()));
            return Ok(([(SET_COOKIE, cookie)], body).into_response());
        }
        Outcome::Failed(f, m) => Outcome::Failed(f, m),
    };
    Ok(Json(outcome).into_response())
}

#[derive(Deserialize)]
struct CallbackQuery {
    token: Option<String>,
}

/// The link in the email: starts a session and goes where the person was headed. A
/// dead link goes back to sign-in, which says why.
async fn callback(State(s): State<AppState>, Query(q): Query<CallbackQuery>) -> ApiResult<Response> {
    let result = match q.token {
        Some(t) => s.db.consume_sign_in(&t).await?,
        None => Err(LinkProblem::Invalid),
    };
    Ok(match result {
        Ok((session, next)) => redirect(&next, Some(session_cookie(&session.token, s.config.secure_cookies()))),
        Err(problem) => {
            let why = match problem {
                LinkProblem::Expired => "expired",
                LinkProblem::Used => "used",
                LinkProblem::Invalid => "invalid",
            };
            redirect(&format!("/sign-in?link={why}"), None)
        }
    })
}

fn redirect(to: &str, cookie: Option<HeaderValue>) -> Response {
    let mut res = StatusCode::SEE_OTHER.into_response();
    if let Ok(v) = HeaderValue::from_str(to) {
        res.headers_mut().insert(LOCATION, v);
    }
    if let Some(c) = cookie {
        res.headers_mut().insert(SET_COOKIE, c);
    }
    res
}
