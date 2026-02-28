//! Configuration for the registry service, loaded from environment variables.

use std::path::PathBuf;

/// Registry service configuration.
#[derive(Clone, Debug)]
pub struct Config {
    /// Listen host (default: 0.0.0.0).
    pub host: String,
    /// Listen port (default: 3100).
    pub port: u16,
    /// Root data directory for SQLite, blobs, index, and keys.
    pub data_dir: PathBuf,
    /// API key for publisher authentication. Empty string disables auth.
    pub api_key: String,
    /// Max upload size in bytes (default: 50 MB).
    pub max_upload_bytes: usize,
}

impl Config {
    /// Load configuration from environment variables.
    pub fn from_env() -> anyhow::Result<Self> {
        let host = std::env::var("CLAWDSTRIKE_REGISTRY_HOST").unwrap_or_else(|_| "0.0.0.0".into());
        let port: u16 = std::env::var("CLAWDSTRIKE_REGISTRY_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(3100);

        let data_dir = std::env::var("CLAWDSTRIKE_REGISTRY_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join(".clawdstrike")
                    .join("registry")
            });

        let api_key = std::env::var("CLAWDSTRIKE_REGISTRY_API_KEY").unwrap_or_default();

        let max_upload_bytes: usize = std::env::var("CLAWDSTRIKE_REGISTRY_MAX_UPLOAD_BYTES")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(50 * 1024 * 1024);

        Ok(Self {
            host,
            port,
            data_dir,
            api_key,
            max_upload_bytes,
        })
    }

    pub fn db_path(&self) -> PathBuf {
        self.data_dir.join("db.sqlite")
    }

    pub fn blob_dir(&self) -> PathBuf {
        self.data_dir.join("blobs")
    }

    pub fn index_dir(&self) -> PathBuf {
        self.data_dir.join("index")
    }

    pub fn keys_dir(&self) -> PathBuf {
        self.data_dir.join("keys")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_paths() {
        let config = Config {
            host: "0.0.0.0".into(),
            port: 3100,
            data_dir: PathBuf::from("/tmp/registry"),
            api_key: String::new(),
            max_upload_bytes: 50 * 1024 * 1024,
        };
        assert_eq!(config.db_path(), PathBuf::from("/tmp/registry/db.sqlite"));
        assert_eq!(config.blob_dir(), PathBuf::from("/tmp/registry/blobs"));
        assert_eq!(config.index_dir(), PathBuf::from("/tmp/registry/index"));
        assert_eq!(config.keys_dir(), PathBuf::from("/tmp/registry/keys"));
    }
}
