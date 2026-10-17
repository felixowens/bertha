//! axum's extractors, with their rejections answered in the API's own `{ error }` shape
//! instead of plain text.

use axum::extract::FromRequest;
use axum::extract::FromRequestParts;

use crate::error::ApiError;

/// A JSON request body.
#[derive(FromRequest)]
#[from_request(via(axum::Json), rejection(ApiError))]
pub struct JsonBody<T>(pub T);

#[derive(FromRequestParts)]
#[from_request(via(axum::extract::Query), rejection(ApiError))]
pub struct Query<T>(pub T);

#[derive(FromRequestParts)]
#[from_request(via(axum::extract::Path), rejection(ApiError))]
pub struct Path<T>(pub T);
