//! OCSF Process object.

use serde::{Deserialize, Serialize};

use super::file::OcsfFile;

/// OCSF Process object.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OcsfProcess {
    /// Process ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    /// Process name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Full command line.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cmd_line: Option<String>,
    /// The binary / executable file.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<OcsfFile>,
    /// User who owns the process.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<OcsfUser>,
    /// Parent process.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_process: Option<Box<OcsfProcess>>,
    /// Current working directory.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

/// Minimal user object embedded within process.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OcsfUser {
    /// User name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// User UID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn process_roundtrip() {
        let p = OcsfProcess {
            pid: Some(1234),
            name: Some("curl".to_string()),
            cmd_line: Some("curl https://example.com".to_string()),
            file: Some(OcsfFile {
                path: Some("/usr/bin/curl".to_string()),
                name: Some("curl".to_string()),
                uid: None,
                type_id: None,
                size: None,
                hashes: None,
            }),
            user: Some(OcsfUser {
                name: Some("root".to_string()),
                uid: Some("0".to_string()),
            }),
            parent_process: None,
            cwd: Some("/tmp".to_string()),
        };
        let json = serde_json::to_string(&p).unwrap();
        let p2: OcsfProcess = serde_json::from_str(&json).unwrap();
        assert_eq!(p, p2);
    }

    #[test]
    fn minimal_process() {
        let p = OcsfProcess {
            pid: None,
            name: Some("sh".to_string()),
            cmd_line: None,
            file: None,
            user: None,
            parent_process: None,
            cwd: None,
        };
        let json = serde_json::to_value(&p).unwrap();
        assert!(json.get("pid").is_none());
        assert_eq!(json["name"], "sh");
    }
}
