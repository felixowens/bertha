//! Session cookies and the request guards around the API.

use axum::extract::{FromRequestParts, Request, State};
use axum::http::header::{COOKIE, SET_COOKIE};
use axum::http::request::Parts;
use axum::http::{HeaderMap, HeaderValue, Method};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use bertha_db::Viewer;
use bertha_db::auth::SESSION_TTL;

use crate::app::AppState;
use crate::error::ApiError;

pub const COOKIE_NAME: &str = "bertha_session";
/// Mutations must carry this header. A cross-site form can't set it, and a cross-site
/// `fetch` that does needs a CORS preflight bertha never approves.
pub const CSRF_HEADER: &str = "x-bertha";

pub fn session_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|kv| kv.trim().split_once('='))
        .find(|(k, _)| *k == COOKIE_NAME)
        .map(|(_, v)| v.to_owned())
}

pub fn session_cookie(token: &str, secure: bool) -> HeaderValue {
    let max_age = SESSION_TTL / 1000;
    let secure = if secure { "; Secure" } else { "" };
    HeaderValue::from_str(&format!("{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}{secure}"))
        .unwrap_or_else(|_| HeaderValue::from_static(""))
}

pub fn clear_cookie(secure: bool) -> HeaderValue {
    let secure = if secure { "; Secure" } else { "" };
    HeaderValue::from_str(&format!("{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure}"))
        .unwrap_or_else(|_| HeaderValue::from_static(""))
}

/// Rejects state-changing requests without the CSRF header.
pub async fn require_csrf_header(req: Request, next: Next) -> Response {
    let safe = matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS);
    if !safe && req.headers().get(CSRF_HEADER).is_none_or(|v| v != "1") {
        return ApiError::CrossSite.into_response();
    }
    next.run(req).await
}

/// Resolves the session for routes that need one, and keeps the cookie's lifetime in
/// step with the session's sliding expiry.
pub async fn require_session(State(state): State<AppState>, mut req: Request, next: Next) -> Response {
    let Some(token) = session_token(req.headers()) else { return ApiError::Unauthorized.into_response() };
    let viewer = match state.db.viewer_for_session(&token).await {
        Ok(Some(v)) => v,
        Ok(None) => {
            let mut res = ApiError::Unauthorized.into_response();
            res.headers_mut().append(SET_COOKIE, clear_cookie(state.config.secure_cookies()));
            return res;
        }
        Err(e) => return ApiError::from(e).into_response(),
    };
    req.extensions_mut().insert(viewer);
    let mut res = next.run(req).await;
    res.headers_mut().append(SET_COOKIE, session_cookie(&token, state.config.secure_cookies()));
    res
}

/// The signed-in viewer, put there by [`require_session`].
pub struct Session(pub Viewer);

impl<S: Send + Sync> FromRequestParts<S> for Session {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        parts.extensions.get::<Viewer>().cloned().map(Session).ok_or(ApiError::Unauthorized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_cookie_among_others() {
        let mut h = HeaderMap::new();
        h.insert(COOKIE, HeaderValue::from_static("a=1; bertha_session=bs_abc; theme=dark"));
        assert_eq!(session_token(&h).as_deref(), Some("bs_abc"));
        assert_eq!(session_token(&HeaderMap::new()), None);
    }

    #[test]
    fn cookie_flags() {
        let c = session_cookie("bs_x", true);
        let s = c.to_str().unwrap();
        assert!(s.contains("HttpOnly") && s.contains("SameSite=Lax") && s.contains("Secure"));
        assert!(!session_cookie("bs_x", false).to_str().unwrap().contains("Secure"));
    }
}
