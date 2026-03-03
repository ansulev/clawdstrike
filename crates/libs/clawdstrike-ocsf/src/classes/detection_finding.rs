//! OCSF Detection Finding (class_uid = 2004, category_uid = 2 Findings).
//!
//! Activity IDs: 1=Create, 2=Update, 3=Close.

use serde::{Deserialize, Serialize};

use crate::base::{category_for_class, compute_type_uid, ClassUid};
use crate::objects::actor::Actor;
use crate::objects::attack::Attack;
use crate::objects::evidence::Evidence;
use crate::objects::finding_info::FindingInfo;
use crate::objects::metadata::Metadata;
use crate::objects::observable::Observable;
use crate::objects::resource::ResourceDetail;

/// OCSF activity IDs for Detection Finding.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum DetectionFindingActivity {
    /// Create a new finding.
    Create = 1,
    /// Update an existing finding.
    Update = 2,
    /// Close a finding.
    Close = 3,
    /// Other (vendor-specific).
    Other = 99,
}

impl DetectionFindingActivity {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF Detection Finding event (class_uid = 2004).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DetectionFinding {
    // ── OCSF base fields ──
    /// Always 2004.
    pub class_uid: u16,
    /// Always 2 (Findings).
    pub category_uid: u8,
    /// `class_uid * 100 + activity_id`.
    pub type_uid: u32,
    /// Activity ID (1=Create, 2=Update, 3=Close).
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
    /// Action ID (1=Allowed, 2=Denied).
    pub action_id: u8,
    /// Disposition ID (1=Allowed, 2=Blocked, 17=Logged).
    pub disposition_id: u8,
    /// Human-readable disposition label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disposition: Option<String>,
    /// Human-readable event message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Metadata (required).
    pub metadata: Metadata,

    // ── Detection Finding-specific fields ──
    /// Finding information (required for Detection Finding).
    pub finding_info: FindingInfo,
    /// Actor who triggered the finding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<Actor>,
    /// Affected resources.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<Vec<ResourceDetail>>,
    /// Observables associated with the finding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observables: Option<Vec<Observable>>,
    /// Evidence supporting the finding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<Evidence>,
    /// MITRE ATT&CK mapping.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attacks: Option<Vec<Attack>>,
    /// Vendor-specific unmapped data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unmapped: Option<serde_json::Value>,
}

impl DetectionFinding {
    /// Create a new Detection Finding with required fields.
    #[must_use]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        activity: DetectionFindingActivity,
        time: i64,
        severity_id: u8,
        status_id: u8,
        action_id: u8,
        disposition_id: u8,
        metadata: Metadata,
        finding_info: FindingInfo,
    ) -> Self {
        let class_uid = ClassUid::DetectionFinding;
        let activity_id = activity.as_u8();
        Self {
            class_uid: class_uid.as_u16(),
            category_uid: category_for_class(class_uid).as_u8(),
            type_uid: compute_type_uid(class_uid.as_u16(), activity_id),
            activity_id,
            activity_name: Some(detection_finding_activity_name(activity).to_string()),
            time,
            severity_id,
            severity: None,
            status_id,
            status: None,
            action_id,
            disposition_id,
            disposition: None,
            message: None,
            metadata,
            finding_info,
            actor: None,
            resources: None,
            observables: None,
            evidence: None,
            attacks: None,
            unmapped: None,
        }
    }

    /// Set the human-readable severity label.
    #[must_use]
    pub fn with_severity_label(mut self, label: &str) -> Self {
        self.severity = Some(label.to_string());
        self
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

    /// Set resources.
    #[must_use]
    pub fn with_resources(mut self, resources: Vec<ResourceDetail>) -> Self {
        self.resources = Some(resources);
        self
    }

    /// Set observables.
    #[must_use]
    pub fn with_observables(mut self, observables: Vec<Observable>) -> Self {
        self.observables = Some(observables);
        self
    }

    /// Set evidence.
    #[must_use]
    pub fn with_evidence(mut self, evidence: Evidence) -> Self {
        self.evidence = Some(evidence);
        self
    }

    /// Set MITRE ATT&CK mappings.
    #[must_use]
    pub fn with_attacks(mut self, attacks: Vec<Attack>) -> Self {
        self.attacks = Some(attacks);
        self
    }

    /// Set unmapped vendor data.
    #[must_use]
    pub fn with_unmapped(mut self, unmapped: serde_json::Value) -> Self {
        self.unmapped = Some(unmapped);
        self
    }
}

fn detection_finding_activity_name(activity: DetectionFindingActivity) -> &'static str {
    match activity {
        DetectionFindingActivity::Create => "Create",
        DetectionFindingActivity::Update => "Update",
        DetectionFindingActivity::Close => "Close",
        DetectionFindingActivity::Other => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::objects::finding_info::Analytic;

    fn sample_finding() -> DetectionFinding {
        DetectionFinding::new(
            DetectionFindingActivity::Create,
            1_709_366_400_000,
            4, // High
            2, // Failure
            2, // Denied
            2, // Blocked
            Metadata::clawdstrike("0.1.3"),
            FindingInfo {
                uid: "finding-001".to_string(),
                title: "Forbidden path access".to_string(),
                analytic: Analytic::rule("ForbiddenPathGuard"),
                desc: None,
                related_analytics: None,
            },
        )
    }

    #[test]
    fn class_uid_is_2004() {
        let f = sample_finding();
        assert_eq!(f.class_uid, 2004);
    }

    #[test]
    fn category_uid_is_2() {
        let f = sample_finding();
        assert_eq!(f.category_uid, 2);
    }

    #[test]
    fn type_uid_for_create() {
        let f = sample_finding();
        assert_eq!(f.type_uid, 200401);
    }

    #[test]
    fn type_uid_for_update() {
        let f = DetectionFinding::new(
            DetectionFindingActivity::Update,
            0,
            0,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            FindingInfo {
                uid: "f".to_string(),
                title: "t".to_string(),
                analytic: Analytic::rule("g"),
                desc: None,
                related_analytics: None,
            },
        );
        assert_eq!(f.type_uid, 200402);
    }

    #[test]
    fn type_uid_for_close() {
        let f = DetectionFinding::new(
            DetectionFindingActivity::Close,
            0,
            0,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
            FindingInfo {
                uid: "f".to_string(),
                title: "t".to_string(),
                analytic: Analytic::rule("g"),
                desc: None,
                related_analytics: None,
            },
        );
        assert_eq!(f.type_uid, 200403);
    }

    #[test]
    fn serialization_roundtrip() {
        let f = sample_finding()
            .with_message("Blocked access to /etc/shadow")
            .with_severity_label("High");
        let json = serde_json::to_string(&f).unwrap();
        let f2: DetectionFinding = serde_json::from_str(&json).unwrap();
        assert_eq!(f.class_uid, f2.class_uid);
        assert_eq!(f.type_uid, f2.type_uid);
        assert_eq!(f.finding_info.uid, f2.finding_info.uid);
    }

    #[test]
    fn json_contains_required_ocsf_fields() {
        let f = sample_finding();
        let v = serde_json::to_value(&f).unwrap();
        assert!(v.get("class_uid").is_some());
        assert!(v.get("category_uid").is_some());
        assert!(v.get("type_uid").is_some());
        assert!(v.get("activity_id").is_some());
        assert!(v.get("time").is_some());
        assert!(v.get("severity_id").is_some());
        assert!(v.get("status_id").is_some());
        assert!(v.get("action_id").is_some());
        assert!(v.get("disposition_id").is_some());
        assert!(v.get("metadata").is_some());
        assert!(v.get("finding_info").is_some());
        assert!(v["metadata"].get("version").is_some());
        assert!(v["metadata"].get("product").is_some());
        assert!(v["finding_info"].get("uid").is_some());
        assert!(v["finding_info"].get("title").is_some());
        assert!(v["finding_info"].get("analytic").is_some());
        assert_eq!(v["finding_info"]["analytic"]["type_id"], 1);
    }
}
