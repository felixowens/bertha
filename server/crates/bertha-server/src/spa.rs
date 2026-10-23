//! The frontend, built into the binary (`npm run build` first). Unknown paths get
//! `index.html` so the client router can take them.

use axum::extract::State;
use axum::http::{HeaderValue, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use rust_embed::Embed;

use crate::AppState;

#[derive(Embed)]
#[folder = "../../../dist"]
#[allow_missing = true]
pub(crate) struct Dist;

pub async fn serve(State(state): State<AppState>, uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    // Source maps are embedded for bertha's own reports (`report::store_maps`), not served.
    let served = !path.is_empty() && !path.ends_with(".map");
    if let Some(file) = served.then(|| Dist::get(path)).flatten() {
        // Vite fingerprints everything under assets/, so those never change.
        let cache = if path.starts_with("assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
        return file_response(file, cache);
    }
    // A missing file with an extension is a 404, not the app.
    if path.rsplit('/').next().is_some_and(|last| last.contains('.')) {
        return StatusCode::NOT_FOUND.into_response();
    }
    match Dist::get("index.html") {
        Some(index) => match &state.reporting {
            Some(r) => page_reporting_to(&index.data, &r.ingest_key),
            None => file_response(index, "no-cache"),
        },
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            "This bertha was built without its frontend. Run `npm run build`, then rebuild the server.",
        )
            .into_response(),
    }
}

/// The page with the key it reports its own errors with. An ingest key is public:
/// every app's pages carry theirs.
fn page_reporting_to(index: &[u8], key: &str) -> Response {
    let page = String::from_utf8_lossy(index);
    let meta = format!(r#"<meta name="bertha-report" content="{}" />"#, key.replace(['"', '<', '>', '&'], ""));
    let page = page.replacen("</head>", &format!("{meta}\n  </head>"), 1);
    (
        [
            (header::CONTENT_TYPE, HeaderValue::from_static("text/html")),
            (header::CACHE_CONTROL, HeaderValue::from_static("no-cache")),
        ],
        page,
    )
        .into_response()
}

fn file_response(file: rust_embed::EmbeddedFile, cache: &'static str) -> Response {
    let mime = file.metadata.mimetype();
    (
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_str(mime).unwrap_or(HeaderValue::from_static("application/octet-stream")),
            ),
            (header::CACHE_CONTROL, HeaderValue::from_static(cache)),
        ],
        file.data,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;

    use super::*;

    #[tokio::test]
    async fn puts_the_reporting_key_in_the_page() {
        let index = b"<html><head><title>bertha</title></head><body></body></html>";
        let res = page_reporting_to(index, "ik_\"1<");
        assert_eq!(res.headers()[header::CACHE_CONTROL], "no-cache");
        let body = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let page = String::from_utf8(body.to_vec()).unwrap();
        assert!(page.contains(r#"<meta name="bertha-report" content="ik_1" />"#), "{page}");
        assert!(page.find("bertha-report") < page.find("</head>"));
    }
}
