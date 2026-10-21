// Errors to `IngestException`: the error, then its `source()` chain as causes.

use std::any::type_name;
use std::error::Error;

use crate::wire::{IngestException, IngestFrame};

const MAX_CAUSES: usize = 5;

/// The error and its causes. Only the outermost carries frames.
pub(crate) fn from_error(e: &(dyn Error + 'static), r#type: String, frames: Vec<IngestFrame>) -> IngestException {
    let mut causes = Vec::new();
    let mut source = e.source();
    while let Some(s) = source {
        if causes.len() == MAX_CAUSES {
            break;
        }
        causes.push(s);
        source = s.source();
    }
    from_messages(r#type, e.to_string(), frames, causes.iter().map(|c| (dyn_type(*c), c.to_string())))
}

pub(crate) fn from_messages(
    r#type: String,
    message: String,
    frames: Vec<IngestFrame>,
    causes: impl DoubleEndedIterator<Item = (String, String)>,
) -> IngestException {
    let cause = causes.rev().fold(None, |inner, (r#type, message)| {
        Some(Box::new(IngestException {
            r#type,
            message,
            frames: vec![],
            cause: inner,
            data: None,
            component_stack: None,
        }))
    });
    IngestException { r#type, message, frames, cause, data: None, component_stack: None }
}

/// `std::io::error::Error` is `io::Error`; `beauty_barn::api::ApiError` is `ApiError`.
pub(crate) fn short_type<T: ?Sized>() -> String {
    short_path(type_name::<T>())
}

pub(crate) fn short_path(path: &str) -> String {
    let path = path.split('<').next().unwrap_or(path);
    let mut segments = path.rsplit("::");
    let last = segments.next().unwrap_or(path);
    if !last.eq_ignore_ascii_case("error") {
        return last.to_owned();
    }
    match segments.find(|s| !s.eq_ignore_ascii_case("error") && !s.eq_ignore_ascii_case("errors")) {
        Some(module) => format!("{module}::{last}"),
        None => last.to_owned(),
    }
}

/// A cause's type, which `dyn Error` doesn't say: common ones by downcasting, others
/// from the start of their Debug output (`NotFound { … }` is `NotFound`).
pub(crate) fn dyn_type(e: &(dyn Error + 'static)) -> String {
    macro_rules! known {
        ($($t:ty),* $(,)?) => {
            $(if e.is::<$t>() { return short_type::<$t>(); })*
        };
    }
    known!(
        std::io::Error,
        std::num::ParseIntError,
        std::num::ParseFloatError,
        std::num::TryFromIntError,
        std::str::Utf8Error,
        std::string::FromUtf8Error,
        std::fmt::Error,
        std::time::SystemTimeError,
        std::env::VarError,
        std::net::AddrParseError,
        serde_json::Error,
    );
    let debug = format!("{e:?}");
    let ident: String = debug.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '_').collect();
    if ident.starts_with(|c: char| c.is_ascii_uppercase()) { ident } else { "Error".to_owned() }
}

#[cfg(test)]
mod tests {
    use std::fmt;

    use super::*;

    #[derive(Debug)]
    enum OrderError {
        Load(std::io::Error),
    }

    impl fmt::Display for OrderError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("couldn't load the order")
        }
    }

    impl Error for OrderError {
        fn source(&self) -> Option<&(dyn Error + 'static)> {
            match self {
                Self::Load(e) => Some(e),
            }
        }
    }

    #[derive(Debug)]
    struct Outer(OrderError);

    impl fmt::Display for Outer {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("checkout failed")
        }
    }

    impl Error for Outer {
        fn source(&self) -> Option<&(dyn Error + 'static)> {
            Some(&self.0)
        }
    }

    #[test]
    fn walks_the_cause_chain() {
        let e = Outer(OrderError::Load(std::io::Error::new(std::io::ErrorKind::NotFound, "orders.db missing")));
        let x = from_error(&e, short_type::<Outer>(), vec![]);
        assert_eq!((x.r#type.as_str(), x.message.as_str()), ("Outer", "checkout failed"));
        let c = x.cause.expect("cause");
        assert_eq!((c.r#type.as_str(), c.message.as_str()), ("Load", "couldn't load the order"));
        let c = c.cause.expect("cause");
        assert_eq!((c.r#type.as_str(), c.message.as_str()), ("io::Error", "orders.db missing"));
        assert!(c.cause.is_none());
    }

    #[test]
    fn short_type_names() {
        assert_eq!(short_type::<std::io::Error>(), "io::Error");
        assert_eq!(short_type::<serde_json::Error>(), "serde_json::Error");
        assert_eq!(short_path("beauty_barn::api::ApiError"), "ApiError");
        assert_eq!(short_path("Error"), "Error");
        assert_eq!(short_path("my::Wrapper<core::fmt::Error>"), "Wrapper");
    }
}
