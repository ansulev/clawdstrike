//! OCSF File Activity (class_uid = 1001, category_uid = 1 System Activity).
//!
//! Activity IDs: 1=Create, 2=Read, 3=Update, 4=Delete, 14=Open.

use serde::{Deserialize, Serialize};

use crate::base::compute_type_uid;
use crate::objects::actor::Actor;
use crate::objects::file::OcsfFile;
use crate::objects::metadata::Metadata;

/// OCSF activity IDs for File Activity.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum FileActivityType {
    /// File created.
    Create = 1,
    /// File read.
    Read = 2,
    /// File updated / written.
    Update = 3,
    /// File deleted.
    Delete = 4,
    /// File opened.
    Open = 14,
    /// Other (vendor-specific).
    Other = 99,
}

impl FileActivityType {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF File Activity event (class_uid = 1001).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FileActivity {
    // ── OCSF base fields ──
    /// Always 1001.
    pub class_uid: u16,
    /// Always 1 (System Activity).
    pub category_uid: u8,
    /// `class_uid * 100 + activity_id`.
    pub type_uid: u32,
    /// Activity ID.
    pub activity_id: u8,
    /// Human-readable activity name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activity_name: Option<String>,
    /// Event time as epoch milliseconds.
    pub time: i64,
    /// Severity ID (0-6, 99).
    pub severity_id: u8,
    /// Human-readable severity label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    /// Status ID (0=Unknown, 1=Success, 2=Failure).
    pub status_id: u8,
    /// Human-readable status label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    /// Human-readable event message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Metadata (required).
    pub metadata: Metadata,

    // ── File Activity-specific fields ──
    /// The file being accessed (required).
    pub file: OcsfFile,
    /// Actor performing the file operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<Actor>,
    /// Vendor-specific unmapped data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unmapped: Option<serde_json::Value>,
}

impl FileActivity {
    /// Create a new File Activity event with required fields.
    #[must_use]
    pub fn new(
        activity: FileActivityType,
        time: i64,
        severity_id: u8,
        status_id: u8,
        metadata: Metadata,
        file: OcsfFile,
    ) -> Self {
        let activity_id = activity.as_u8();
        Self {
            class_uid: 1001,
            category_uid: 1,
            type_uid: compute_type_uid(1001, activity_id),
            activity_id,
            activity_name: Some(file_activity_name(activity).to_string()),
            time,
            severity_id,
            severity: None,
            status_id,
            status: None,
            message: None,
            metadata,
            file,
            actor: None,
            unmapped: None,
        }
    }

    /// Set the event message.
    #[must_use]
    pub fn with_message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }

    /// Set the actor.
    #[must_use]
    pub fn with_actor(mut self, actor: Actor) -> Self {
        self.actor = Some(actor);
        self
    }
}

fn file_activity_name(activity: FileActivityType) -> &'static str {
    match activity {
        FileActivityType::Create => "Create",
        FileActivityType::Read => "Read",
        FileActivityType::Update => "Update",
        FileActivityType::Delete => "Delete",
        FileActivityType::Open => "Open",
        FileActivityType::Other => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_file() -> OcsfFile {
        OcsfFile {
            path: Some("/etc/shadow".to_string()),
            name: Some("shadow".to_string()),
            uid: None,
            type_id: None,
            size: None,
            hashes: None,
        }
    }

    #[test]
    fn class_uid_is_1001() {
        let e = FileActivity::new(
            FileActivityType::Read,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_file(),
        );
        assert_eq!(e.class_uid, 1001);
    }

    #[test]
    fn category_uid_is_1() {
        let e = FileActivity::new(
            FileActivityType::Read,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_file(),
        );
        assert_eq!(e.category_uid, 1);
    }

    #[test]
    fn type_uid_read() {
        let e = FileActivity::new(
            FileActivityType::Read,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_file(),
        );
        assert_eq!(e.type_uid, 100102);
    }

    #[test]
    fn type_uid_update() {
        let e = FileActivity::new(
            FileActivityType::Update,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_file(),
        );
        assert_eq!(e.type_uid, 100103);
    }

    #[test]
    fn type_uid_open() {
        let e = FileActivity::new(
            FileActivityType::Open,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_file(),
        );
        // 1001 * 100 + 14 = 100114
        assert_eq!(e.type_uid, 100114);
    }

    #[test]
    fn serialization_roundtrip() {
        let e = FileActivity::new(
            FileActivityType::Update,
            1_709_366_400_000,
            4,
            2,
            Metadata::clawdstrike("0.1.3"),
            sample_file(),
        )
        .with_message("File write blocked");

        let json = serde_json::to_string(&e).unwrap();
        let e2: FileActivity = serde_json::from_str(&json).unwrap();
        assert_eq!(e.type_uid, e2.type_uid);
        assert_eq!(e.file.path, e2.file.path);
    }
}
