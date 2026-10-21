// What a capture knows about the work it happened in: the request, the user, the
// trace and tags. A scope is entered on a thread (`enter`, `run`) or carried by a
// future across threads (`bind`); the tower layer makes one per request.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex, PoisonError};
use std::task::{Context, Poll};

use crate::wire::{IngestEvent, IngestRequest, IngestTrace, IngestUser};

thread_local! {
    static CURRENT: RefCell<Vec<Scope>> = const { RefCell::new(Vec::new()) };
}

/// Context for the captures made inside it. Cloning shares it.
#[derive(Clone, Default)]
pub struct Scope {
    inner: Arc<Mutex<Data>>,
}

#[derive(Default)]
pub(crate) struct Data {
    pub(crate) request: Option<IngestRequest>,
    pub(crate) user: Option<IngestUser>,
    pub(crate) trace: Option<IngestTrace>,
    pub(crate) tags: BTreeMap<String, String>,
    /// While a response is being built, its events wait here for its status.
    pub(crate) held: Option<Vec<IngestEvent>>,
}

impl std::fmt::Debug for Scope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let d = self.lock();
        f.debug_struct("Scope")
            .field("request", &d.request)
            .field("user", &d.user)
            .field("trace", &d.trace)
            .field("tags", &d.tags)
            .finish_non_exhaustive()
    }
}

impl Scope {
    pub fn new() -> Self {
        Self::default()
    }

    /// The innermost scope entered on this thread.
    pub fn current() -> Option<Scope> {
        CURRENT.with(|c| c.borrow().last().cloned())
    }

    pub fn set_request(&self, request: IngestRequest) {
        self.lock().request = Some(request);
    }

    /// Merged over the global user; `None` fields keep it.
    pub fn set_user(&self, user: IngestUser) {
        self.lock().user = Some(user);
    }

    pub fn set_trace(&self, trace: IngestTrace) {
        self.lock().trace = Some(trace);
    }

    pub fn set_tag(&self, key: impl Into<String>, value: impl Into<String>) {
        self.lock().tags.insert(key.into(), value.into());
    }

    /// Makes this the current scope on this thread until the guard drops.
    pub fn enter(&self) -> ScopeGuard {
        CURRENT.with(|c| c.borrow_mut().push(self.clone()));
        ScopeGuard { _not_send: std::marker::PhantomData }
    }

    /// Runs `f` with this scope current.
    pub fn run<T>(&self, f: impl FnOnce() -> T) -> T {
        let _g = self.enter();
        f()
    }

    /// The future, with this scope current whenever it runs (on any thread).
    pub fn bind<F: Future>(&self, future: F) -> Bound<F> {
        Bound { scope: self.clone(), future: Box::pin(future) }
    }

    pub(crate) fn lock(&self) -> std::sync::MutexGuard<'_, Data> {
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Holds the events captured from now on, until [`Scope::release`].
    #[cfg_attr(not(feature = "tower"), allow(dead_code))]
    pub(crate) fn hold(&self) {
        self.lock().held.get_or_insert_with(Vec::new);
    }

    /// Stores the event if the scope is holding, or hands it back.
    pub(crate) fn keep(&self, event: IngestEvent) -> Option<IngestEvent> {
        match &mut self.lock().held {
            Some(held) => {
                held.push(event);
                None
            }
            None => Some(event),
        }
    }

    /// Stops holding and returns what was held.
    #[cfg_attr(not(feature = "tower"), allow(dead_code))]
    pub(crate) fn release(&self) -> Vec<IngestEvent> {
        self.lock().held.take().unwrap_or_default()
    }
}

/// Leaves the scope when dropped. Stays on its thread.
#[must_use = "the scope is left as soon as the guard drops"]
pub struct ScopeGuard {
    _not_send: std::marker::PhantomData<*const ()>,
}

impl Drop for ScopeGuard {
    fn drop(&mut self) {
        CURRENT.with(|c| c.borrow_mut().pop());
    }
}

/// A future running in a scope; see [`Scope::bind`].
pub struct Bound<F> {
    scope: Scope,
    future: Pin<Box<F>>,
}

impl<F: Future> Future for Bound<F> {
    type Output = F::Output;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<F::Output> {
        let this = &mut *self;
        let _g = this.scope.enter();
        this.future.as_mut().poll(cx)
    }
}

impl<F> std::fmt::Debug for Bound<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Bound").field("scope", &self.scope).finish_non_exhaustive()
    }
}
