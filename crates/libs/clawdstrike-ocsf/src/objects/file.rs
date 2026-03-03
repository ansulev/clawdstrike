//! OCSF File object.

use serde::{Deserialize, Serialize};

/// OCSF File object.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OcsfFile {
    /// Full file path.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// File name (basename).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// File unique identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    /// OCSF file type ID (1=Regular, 2=Folder, 3=Character, 4=Block, 5=FIFO, 6=Socket, 7=Symlink).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_id: Option<u8>,
    /// File size in bytes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// File hashes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hashes: Option<Vec<FileHash>>,
}

/// File hash entry.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FileHash {
    /// Hash algorithm ID (1=MD5, 2=SHA-1, 3=SHA-256, 4=SHA-512, 99=Other).
    pub algorithm_id: u8,
    /// Hex-encoded hash value.
    pub value: String,
}

impl OcsfFile {
    /// Derive the file name from the path if not explicitly set.
    #[must_use]
    pub fn with_name_from_path(mut self) -> Self {
        if self.name.is_none() {
            if let Some(ref path) = self.path {
                self.name = path.rsplit('/').next().map(String::from);
            }
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_roundtrip() {
        let f = OcsfFile {
            path: Some("/etc/shadow".to_string()),
            name: Some("shadow".to_string()),
            uid: None,
            type_id: Some(1),
            size: Some(1024),
            hashes: Some(vec![FileHash {
                algorithm_id: 3,
                value: "abc123".to_string(),
            }]),
        };
        let json = serde_json::to_string(&f).unwrap();
        let f2: OcsfFile = serde_json::from_str(&json).unwrap();
        assert_eq!(f, f2);
    }

    #[test]
    fn name_from_path() {
        let f = OcsfFile {
            path: Some("/usr/bin/curl".to_string()),
            name: None,
            uid: None,
            type_id: None,
            size: None,
            hashes: None,
        }
        .with_name_from_path();
        assert_eq!(f.name.as_deref(), Some("curl"));
    }

    #[test]
    fn name_from_path_preserves_existing() {
        let f = OcsfFile {
            path: Some("/usr/bin/curl".to_string()),
            name: Some("custom".to_string()),
            uid: None,
            type_id: None,
            size: None,
            hashes: None,
        }
        .with_name_from_path();
        assert_eq!(f.name.as_deref(), Some("custom"));
    }
}
