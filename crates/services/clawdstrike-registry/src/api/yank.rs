//! DELETE /api/v1/packages/{name}/{version} — yank a package version.

use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::error::RegistryError;
use crate::index;
use crate::state::AppState;

#[derive(Serialize)]
pub struct YankResponse {
    pub name: String,
    pub version: String,
    pub yanked: bool,
}

/// DELETE /api/v1/packages/{name}/{version}
pub async fn yank(
    State(state): State<AppState>,
    Path((name, version)): Path<(String, String)>,
) -> Result<Json<YankResponse>, RegistryError> {
    let yanked = {
        let db = state
            .db
            .lock()
            .map_err(|e| RegistryError::Internal(format!("db lock poisoned: {e}")))?;

        // Verify the version exists.
        db.get_version(&name, &version)?.ok_or_else(|| {
            RegistryError::NotFound(format!("version {version} of {name} not found"))
        })?;

        db.yank_version(&name, &version)?
    };

    if yanked {
        let db = state
            .db
            .lock()
            .map_err(|e| RegistryError::Internal(format!("db lock poisoned: {e}")))?;
        index::update_index(&db, &state.config.index_dir(), &name)?;
        tracing::info!(name = %name, version = %version, "Version yanked");
    }

    Ok(Json(YankResponse {
        name,
        version,
        yanked,
    }))
}
