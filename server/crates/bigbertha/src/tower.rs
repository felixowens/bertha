//! A tower layer for axum, tonic or any `http` service. Each request gets a
//! [`Scope`](crate::Scope): reports made while handling it carry its method, URL,
//! headers (without credentials), the client's IP, its `traceparent` trace and
//! `x-request-id`, and the response status once it's known. A panic in the handler is
//! reported and answered with a 500.
//!
//! ```no_run
//! # async fn orders() {}
//! let app: axum::Router = axum::Router::new()
//!     .route("/orders", axum::routing::get(orders))
//!     .layer(bigbertha::tower::layer());
//! ```

use std::collections::BTreeMap;
use std::future::Future;
use std::panic::AssertUnwindSafe;
use std::pin::Pin;
use std::task::{Context, Poll};

use http::{HeaderMap, Request, Response, StatusCode};

use crate::client::{Capture, hub};
use crate::exception::from_messages;
use crate::scope::Scope;
use crate::trace::parse_traceparent;
use crate::wire::{IngestEvent, IngestLevel, IngestRequest, IngestUser};

/// Never sent: they'd let anyone reading the event act as the user.
const CREDENTIAL_HEADERS: [&str; 5] = ["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"];
const HEADERS: usize = 30;
const HEADER_CHARS: usize = 512;

/// The layer; see the [module docs](self).
pub fn layer() -> Layer {
    Layer { _private: () }
}

/// See [`layer`].
#[derive(Debug, Clone)]
pub struct Layer {
    _private: (),
}

impl<S> tower_layer::Layer<S> for Layer {
    type Service = Service<S>;

    fn layer(&self, inner: S) -> Service<S> {
        Service { inner }
    }
}

/// The service [`Layer`] wraps around yours.
#[derive(Debug, Clone)]
pub struct Service<S> {
    inner: S,
}

impl<S, ReqBody, ResBody> tower_service::Service<Request<ReqBody>> for Service<S>
where
    S: tower_service::Service<Request<ReqBody>, Response = Response<ResBody>>,
    ResBody: Default,
{
    type Response = Response<ResBody>;
    type Error = S::Error;
    type Future = ResponseFuture<S::Future>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), S::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        if hub().is_none() {
            return ResponseFuture { scope: None, inner: Box::pin(self.inner.call(req)) };
        }
        let scope = scope_for(&req);
        scope.hold();
        let inner = scope.run(|| self.inner.call(req));
        ResponseFuture { scope: Some(scope), inner: Box::pin(inner) }
    }
}

/// The response, with the request's scope current while it's built.
pub struct ResponseFuture<F> {
    scope: Option<Scope>,
    inner: Pin<Box<F>>,
}

impl<F> std::fmt::Debug for ResponseFuture<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ResponseFuture").field("scope", &self.scope).finish_non_exhaustive()
    }
}

impl<F, B, E> Future for ResponseFuture<F>
where
    F: Future<Output = Result<Response<B>, E>>,
    B: Default,
{
    type Output = Result<Response<B>, E>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = &mut *self;
        let Some(scope) = this.scope.clone() else { return this.inner.as_mut().poll(cx) };
        let polled = {
            let _g = scope.enter();
            reported_panic();
            std::panic::catch_unwind(AssertUnwindSafe(|| this.inner.as_mut().poll(cx)))
        };
        let out = match polled {
            Ok(Poll::Pending) => return Poll::Pending,
            Ok(Poll::Ready(Ok(res))) => {
                release(&scope, Some(res.status()));
                Ok(res)
            }
            Ok(Poll::Ready(Err(e))) => {
                release(&scope, None);
                Err(e)
            }
            Err(payload) => {
                if !reported_panic() {
                    let message = match payload.downcast_ref::<&str>() {
                        Some(s) => (*s).to_owned(),
                        None => payload.downcast_ref::<String>().cloned().unwrap_or_else(|| "Box<dyn Any>".to_owned()),
                    };
                    if let Some(client) = hub() {
                        let event = IngestEvent {
                            exception: Some(from_messages("panic".to_owned(), message, vec![], std::iter::empty())),
                            ..IngestEvent::default()
                        };
                        let capture = Capture::new().level(IngestLevel::Fatal).mechanism("tower", false);
                        scope.run(|| client.capture(event, capture, true));
                    }
                }
                release(&scope, Some(StatusCode::INTERNAL_SERVER_ERROR));
                let mut res = Response::new(B::default());
                *res.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                Ok(res)
            }
        };
        this.scope = None;
        Poll::Ready(out)
    }
}

impl<F> Drop for ResponseFuture<F> {
    fn drop(&mut self) {
        // Cancelled (the client went away): send what was held, without a status.
        if let Some(scope) = self.scope.take() {
            release(&scope, None);
        }
    }
}

/// Whether the panic hook reported a panic on this thread since the last call.
fn reported_panic() -> bool {
    #[cfg(feature = "panic")]
    return crate::panic::take_reported();
    #[cfg(not(feature = "panic"))]
    false
}

fn release(scope: &Scope, status: Option<StatusCode>) {
    let held = scope.release();
    let Some(client) = hub() else { return };
    for mut event in held {
        if let (Some(r), Some(s)) = (&mut event.request, status) {
            r.status.get_or_insert(u32::from(s.as_u16()));
        }
        client.send(event);
    }
}

/// The scope for a request.
pub fn scope_for<B>(req: &Request<B>) -> Scope {
    let h = req.headers();
    let scope = Scope::new();
    let mut headers = BTreeMap::new();
    for name in h.keys() {
        let key = name.as_str();
        if CREDENTIAL_HEADERS.contains(&key) {
            continue;
        }
        if headers.len() >= HEADERS {
            break;
        }
        let value = h
            .get_all(name)
            .iter()
            .map(|v| String::from_utf8_lossy(v.as_bytes()).into_owned())
            .collect::<Vec<_>>()
            .join(", ");
        let value = if value.chars().count() > HEADER_CHARS {
            let mut v: String = value.chars().take(HEADER_CHARS - 1).collect();
            v.push('…');
            v
        } else {
            value
        };
        headers.insert(key.to_owned(), value);
    }
    scope.set_request(IngestRequest {
        method: req.method().as_str().to_owned(),
        url: url_of(req),
        status: None,
        headers: Some(headers),
    });
    if let Some(ip) = first(h, "x-forwarded-for")
        .and_then(|v| v.split(',').next().map(|s| s.trim().to_owned()))
        .filter(|s| !s.is_empty())
    {
        scope.set_user(IngestUser { ip: Some(ip), ..IngestUser::default() });
    }
    if let Some(t) = first(h, "traceparent").and_then(|v| parse_traceparent(&v)) {
        scope.set_trace(t);
    }
    if let Some(id) = first(h, "x-request-id").filter(|v| !v.is_empty()) {
        scope.set_tag("request_id", id);
    }
    scope
}

fn first(h: &HeaderMap, name: &str) -> Option<String> {
    h.get(name).and_then(|v| v.to_str().ok()).map(|v| v.trim().to_owned())
}

/// Absolute, from `x-forwarded-proto` and `host` when the request line is only a path.
fn url_of<B>(req: &Request<B>) -> String {
    let uri = req.uri();
    if uri.scheme().is_some() && uri.authority().is_some() {
        return uri.to_string();
    }
    let path = uri.path_and_query().map_or("/", |p| p.as_str());
    let h = req.headers();
    let host = first(h, "x-forwarded-host")
        .or_else(|| first(h, "host"))
        .and_then(|v| v.split(',').next().map(|s| s.trim().to_owned()));
    match host {
        Some(host) => {
            let proto = first(h, "x-forwarded-proto").and_then(|v| v.split(',').next().map(|s| s.trim().to_owned()));
            format!("{}://{host}{path}", proto.as_deref().unwrap_or("http"))
        }
        None => path.to_owned(),
    }
}
