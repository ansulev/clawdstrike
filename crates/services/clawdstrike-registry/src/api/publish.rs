//! POST /api/v1/packages — publish a new package version.

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use hush_core::{PublicKey, Signature};

use crate::db::VersionRow;
use crate::error::RegistryError;
use crate::index;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct PublishRequest {
    /// Base64-encoded .cpkg archive bytes.
    pub archive_base64: String,
    /// Hex-encoded Ed25519 publisher public key.
    pub publisher_key: String,
    /// Hex-encoded Ed25519 signature over the SHA-256 hash of the archive.
    pub publisher_sig: String,
    /// Raw TOML manifest content (`clawdstrike-pkg.toml`).
    pub manifest_toml: String,
}

#[derive(Serialize)]
pub struct PublishResponse {
    pub name: String,
    pub version: String,
    pub checksum: String,
    pub registry_sig: String,
    pub registry_key: String,
}

/// POST /api/v1/packages
pub async fn publish(
    State(state): State<AppState>,
    Json(req): Json<PublishRequest>,
) -> Result<Json<PublishResponse>, RegistryError> {
    // 1. Parse and validate manifest.
    let manifest = clawdstrike::pkg::manifest::parse_pkg_manifest_toml(&req.manifest_toml)
        .map_err(|e| RegistryError::BadRequest(format!("invalid manifest: {e}")))?;

    let name = manifest.package.name.clone();
    let version = manifest.package.version.clone();

    // 2. Decode archive bytes.
    use base64::Engine as _;
    let archive_bytes = base64::engine::general_purpose::STANDARD
        .decode(&req.archive_base64)
        .map_err(|e| RegistryError::BadRequest(format!("invalid base64 archive: {e}")))?;

    // 3. Compute SHA-256 of the archive.
    let checksum = hush_core::sha256_hex(&archive_bytes);

    // 4. Verify publisher signature.
    let publisher_key = PublicKey::from_hex(&req.publisher_key)
        .map_err(|e| RegistryError::BadRequest(format!("invalid publisher key: {e}")))?;
    let publisher_sig = Signature::from_hex(&req.publisher_sig)
        .map_err(|e| RegistryError::BadRequest(format!("invalid publisher signature: {e}")))?;

    let hash = hush_core::sha256(&archive_bytes);
    if !publisher_key.verify(hash.as_bytes(), &publisher_sig) {
        return Err(RegistryError::Integrity(
            "publisher signature verification failed".into(),
        ));
    }

    // 5. Counter-sign with registry keypair.
    let registry_sig = state.registry_keypair.sign(hash.as_bytes());
    let registry_sig_hex = registry_sig.to_hex();
    let registry_key_hex = state.registry_keypair.public_key().to_hex();

    // 6. Store blob.
    state.blobs.store_with_hash(&archive_bytes, &checksum)?;

    // 7. Serialize dependencies JSON.
    let deps_json = serde_json::to_string(&manifest.dependencies)
        .map_err(|e| RegistryError::Internal(format!("failed to serialize deps: {e}")))?;

    let now = chrono::Utc::now().to_rfc3339();

    // 8. Upsert package + insert version (under lock).
    {
        let db = state
            .db
            .lock()
            .map_err(|e| RegistryError::Internal(format!("db lock poisoned: {e}")))?;

        db.upsert_package(&name, manifest.package.description.as_deref(), &now)?;

        db.insert_version(&VersionRow {
            name: name.clone(),
            version: version.clone(),
            pkg_type: manifest.package.pkg_type.to_string(),
            checksum: checksum.clone(),
            manifest_toml: req.manifest_toml.clone(),
            publisher_key: req.publisher_key.clone(),
            publisher_sig: req.publisher_sig.clone(),
            registry_sig: Some(registry_sig_hex.clone()),
            dependencies_json: deps_json,
            yanked: false,
            published_at: now,
        })?;

        // 9. Update sparse index.
        index::update_index(&db, &state.config.index_dir(), &name)?;
    }

    tracing::info!(name = %name, version = %version, checksum = %checksum, "Package published");

    Ok(Json(PublishResponse {
        name,
        version,
        checksum,
        registry_sig: registry_sig_hex,
        registry_key: registry_key_hex,
    }))
}
