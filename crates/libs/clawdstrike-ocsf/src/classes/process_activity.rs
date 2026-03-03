//! OCSF Process Activity (class_uid = 1007, category_uid = 1 System Activity).
//!
//! Activity IDs: 1=Launch, 2=Terminate, 3=Open, 4=Inject, 5=SetUserId.

use serde::{Deserialize, Serialize};

use crate::base::compute_type_uid;
use crate::objects::actor::Actor;
use crate::objects::metadata::Metadata;
use crate::objects::process::OcsfProcess;

/// OCSF activity IDs for Process Activity.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum ProcessActivityType {
    /// Process launched / created.
    Launch = 1,
    /// Process terminated / exited.
    Terminate = 2,
    /// Process opened (e.g., ptrace attach).
    Open = 3,
    /// Code injected into process.
    Inject = 4,
    /// UID changed (setuid).
    SetUserId = 5,
    /// Other (vendor-specific).
    Other = 99,
}

impl ProcessActivityType {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF Process Activity event (class_uid = 1007).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProcessActivity {
    // ── OCSF base fields ──
    /// Always 1007.
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

    // ── Process Activity-specific fields ──
    /// The process (required).
    pub process: OcsfProcess,
    /// Actor who initiated the process activity.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<Actor>,
    /// Vendor-specific unmapped data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unmapped: Option<serde_json::Value>,
}

impl ProcessActivity {
    /// Create a new Process Activity event with required fields.
    #[must_use]
    pub fn new(
        activity: ProcessActivityType,
        time: i64,
        severity_id: u8,
        status_id: u8,
        metadata: Metadata,
        process: OcsfProcess,
    ) -> Self {
        let activity_id = activity.as_u8();
        Self {
            class_uid: 1007,
            category_uid: 1,
            type_uid: compute_type_uid(1007, activity_id),
            activity_id,
            activity_name: Some(process_activity_name(activity).to_string()),
            time,
            severity_id,
            severity: None,
            status_id,
            status: None,
            message: None,
            metadata,
            process,
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

    /// Set unmapped vendor data.
    #[must_use]
    pub fn with_unmapped(mut self, unmapped: serde_json::Value) -> Self {
        self.unmapped = Some(unmapped);
        self
    }
}

fn process_activity_name(activity: ProcessActivityType) -> &'static str {
    match activity {
        ProcessActivityType::Launch => "Launch",
        ProcessActivityType::Terminate => "Terminate",
        ProcessActivityType::Open => "Open",
        ProcessActivityType::Inject => "Inject",
        ProcessActivityType::SetUserId => "Set User ID",
        ProcessActivityType::Other => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_process() -> OcsfProcess {
        OcsfProcess {
            pid: Some(1234),
            name: Some("curl".to_string()),
            cmd_line: Some("curl https://example.com".to_string()),
            file: None,
            user: None,
            parent_process: None,
            cwd: None,
        }
    }

    #[test]
    fn class_uid_is_1007() {
        let e = ProcessActivity::new(
            ProcessActivityType::Launch,
            1_709_366_400_000,
            1,
            1,
            Metadata::clawdstrike("0.1.3"),
            sample_process(),
        );
        assert_eq!(e.class_uid, 1007);
    }

    #[test]
    fn category_uid_is_1() {
        let e = ProcessActivity::new(
            ProcessActivityType::Launch,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_process(),
        );
        assert_eq!(e.category_uid, 1);
    }

    #[test]
    fn type_uid_launch() {
        let e = ProcessActivity::new(
            ProcessActivityType::Launch,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_process(),
        );
        assert_eq!(e.type_uid, 100701);
    }

    #[test]
    fn type_uid_terminate() {
        let e = ProcessActivity::new(
            ProcessActivityType::Terminate,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            sample_process(),
        );
        assert_eq!(e.type_uid, 100702);
    }

    #[test]
    fn serialization_roundtrip() {
        let e = ProcessActivity::new(
            ProcessActivityType::Launch,
            1_709_366_400_000,
            1,
            1,
            Metadata::clawdstrike("0.1.3"),
            sample_process(),
        )
        .with_message("curl launched");

        let json = serde_json::to_string(&e).unwrap();
        let e2: ProcessActivity = serde_json::from_str(&json).unwrap();
        assert_eq!(e.type_uid, e2.type_uid);
        assert_eq!(e.process.pid, e2.process.pid);
    }
}
