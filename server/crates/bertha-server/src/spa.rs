//! The frontend, built into the binary (`npm run build` first). Unknown paths get
//! `index.html` so the client router can take them.

use axum::http::{HeaderValue, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../../../dist"]
#[allow_missing = true]
struct Dist;

pub async fn serve(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    if let Some(file) = (!path.is_empty()).then(|| Dist::get(path)).flatten() {
        // Vite fingerprints everything under assets/, so those never change.
        let cache = if path.starts_with("assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
        return file_response(file, cache);
    }
    // A missing file with an extension is a 404, not the app.
    if path.rsplit('/').next().is_some_and(|last| last.contains('.')) {
        return StatusCode::NOT_FOUND.into_response();
    }
    match Dist::get("index.html") {
        Some(index) => file_response(index, "no-cache"),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            "This bertha was built without its frontend. Run `npm run build`, then rebuild the server.",
        )
            .into_response(),
    }
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
