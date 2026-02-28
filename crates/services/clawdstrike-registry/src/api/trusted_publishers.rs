//! Trusted publisher management API endpoints for OIDC-based CI/CD publishing.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::RegistryError;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct AddTrustedPublisherRequest {
    /// OIDC provider: "github" or "gitlab".
    pub provider: String,
    /// Repository identifier, e.g., "owner/repo".
    pub repository: String,
    /// Optional workflow filter (e.g., "release.yml").
    pub workflow: Option<String>,
    /// Optional environment filter (e.g., "production").
    pub environment: Option<String>,
    /// Ed25519 public key hex of the caller (used as `created_by`).
    pub publisher_key: String,
}

#[derive(Serialize)]
pub struct TrustedPublisherResponse {
    pub id: i64,
    pub package_name: String,
    pub provider: String,
    pub repository: String,
    pub workflow: Option<String>,
    pub environment: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Serialize)]
pub struct TrustedPublishersListResponse {
    pub trusted_publishers: Vec<TrustedPublisherResponse>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /api/v1/packages/{name}/trusted-publishers — add a trusted publisher (auth required).
pub async fn add_trusted_publisher(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(req): Json<AddTrustedPublisherRequest>,
) -> Result<(StatusCode, Json<TrustedPublisherResponse>), RegistryError> {
    // Validate provider.
    if !matches!(
        req.provider.to_ascii_lowercase().as_str(),
        "github" | "gitlab"
    ) {
        return Err(RegistryError::BadRequest(format!(
            "unsupported OIDC provider '{}'. Must be 'github' or 'gitlab'",
            req.provider
        )));
    }

    // Validate repository format.
    if !req.repository.contains('/') {
        return Err(RegistryError::BadRequest(
            "repository must be in 'owner/repo' format".into(),
        ));
    }

    let db = state
        .db
        .lock()
        .map_err(|e| RegistryError::Internal(format!("db lock poisoned: {e}")))?;

    // For scoped packages, verify the caller has owner/maintainer role.
    if let Some((scope, _basename)) = crate::auth::parse_package_scope(&name) {
        crate::auth::authorize_scoped_publish(&db, &scope, &req.publisher_key)?;
    }

    let id = db.add_trusted_publisher(
        &name,
        &req.provider.to_ascii_lowercase(),
        &req.repository,
        req.workflow.as_deref(),
        req.environment.as_deref(),
        &req.publisher_key,
    )?;

    let publishers = db.get_trusted_publishers(&name)?;
    let publisher = publishers.into_iter().find(|p| p.id == id).ok_or_else(|| {
        RegistryError::Internal("trusted publisher just created but not found".into())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(TrustedPublisherResponse {
            id: publisher.id,
            package_name: publisher.package_name,
            provider: publisher.provider,
            repository: publisher.repository,
            workflow: publisher.workflow,
            environment: publisher.environment,
            created_at: publisher.created_at,
            created_by: publisher.created_by,
        }),
    ))
}

/// GET /api/v1/packages/{name}/trusted-publishers — list trusted publishers (public).
pub async fn list_trusted_publishers(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<TrustedPublishersListResponse>, RegistryError> {
    let db = state
        .db
        .lock()
        .map_err(|e| RegistryError::Internal(format!("db lock poisoned: {e}")))?;

    let publishers = db.get_trusted_publishers(&name)?;

    Ok(Json(TrustedPublishersListResponse {
        trusted_publishers: publishers
            .into_iter()
            .map(|p| TrustedPublisherResponse {
                id: p.id,
                package_name: p.package_name,
                provider: p.provider,
                repository: p.repository,
                workflow: p.workflow,
                environment: p.environment,
                created_at: p.created_at,
                created_by: p.created_by,
            })
            .collect(),
    }))
}

/// DELETE /api/v1/packages/{name}/trusted-publishers/{id} — remove a trusted publisher (auth required).
pub async fn remove_trusted_publisher(
    State(state): State<AppState>,
    Path((_name, id)): Path<(String, i64)>,
) -> Result<StatusCode, RegistryError> {
    let db = state
        .db
        .lock()
        .map_err(|e| RegistryError::Internal(format!("db lock poisoned: {e}")))?;

    let deleted = db.remove_trusted_publisher(id)?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(RegistryError::NotFound(format!(
            "trusted publisher with id {id} not found"
        )))
    }
}
