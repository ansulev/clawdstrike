//! API key validation middleware for publish/yank operations.

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::state::AppState;

/// Extract bearer token from the Authorization header.
fn extract_bearer_token(req: &Request<Body>) -> Option<String> {
    let header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())?;

    if header.len() > 7 {
        let prefix = &header[..7];
        if prefix.eq_ignore_ascii_case("Bearer ") {
            return Some(header[7..].to_string());
        }
    }

    None
}

/// Middleware that validates a bearer token against the configured API key.
///
/// If no API key is configured (empty string), all requests are allowed through.
pub async fn require_publish_auth(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth if no API key is configured.
    if state.config.api_key.is_empty() {
        return Ok(next.run(req).await);
    }

    let token = extract_bearer_token(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    // Constant-time comparison via SHA-256 hash to avoid timing attacks.
    let token_hash = hush_core::sha256_hex(token.as_bytes());
    let expected_hash = hush_core::sha256_hex(state.config.api_key.as_bytes());

    if token_hash != expected_hash {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::header;

    fn make_request(auth: Option<&str>) -> Request<Body> {
        let mut builder = Request::builder();
        if let Some(val) = auth {
            builder = builder.header(header::AUTHORIZATION, val);
        }
        builder.body(Body::empty()).unwrap()
    }

    #[test]
    fn extract_valid_bearer() {
        let req = make_request(Some("Bearer my-key"));
        assert_eq!(extract_bearer_token(&req).as_deref(), Some("my-key"));
    }

    #[test]
    fn extract_case_insensitive() {
        let req = make_request(Some("bearer my-key"));
        assert_eq!(extract_bearer_token(&req).as_deref(), Some("my-key"));
    }

    #[test]
    fn extract_missing_header() {
        let req = make_request(None);
        assert!(extract_bearer_token(&req).is_none());
    }

    #[test]
    fn extract_wrong_scheme() {
        let req = make_request(Some("Basic abc123"));
        assert!(extract_bearer_token(&req).is_none());
    }
}
