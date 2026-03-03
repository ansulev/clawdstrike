//! Convert a guard result (primitive fields) into a Detection Finding.

use crate::base::{ActionId, DispositionId, StatusId};
use crate::classes::detection_finding::{DetectionFinding, DetectionFindingActivity};
use crate::objects::finding_info::{Analytic, FindingInfo};
use crate::objects::metadata::Metadata;
use crate::objects::resource::ResourceDetail;
use crate::severity::map_severity;

/// Input for converting a guard result to OCSF.
///
/// Uses plain types so this crate does not depend on `clawdstrike`.
pub struct GuardResultInput<'a> {
    /// Whether the action was allowed.
    pub allowed: bool,
    /// Whether this is a warning decision (non-blocking but logged).
    pub is_warn: bool,
    /// Guard name that produced the result.
    pub guard: &'a str,
    /// Severity string (e.g., "info", "warning", "error", "critical").
    pub severity: &'a str,
    /// Human-readable message.
    pub message: &'a str,
    /// Event timestamp as epoch milliseconds.
    pub time_ms: i64,
    /// Unique event ID.
    pub event_uid: &'a str,
    /// Product version.
    pub product_version: &'a str,
    /// Optional resource name.
    pub resource_name: Option<&'a str>,
    /// Optional resource type label.
    pub resource_type: Option<&'a str>,
}

/// Convert a guard result to an OCSF Detection Finding.
#[must_use]
pub fn guard_result_to_detection_finding(input: &GuardResultInput<'_>) -> DetectionFinding {
    let severity_id = map_severity(input.severity);

    // Warn outcomes are non-blocking and should be modeled as Allowed + Logged.
    let action_id = if input.is_warn || input.allowed {
        ActionId::Allowed
    } else {
        ActionId::Denied
    };

    let disposition_id = if input.is_warn {
        DispositionId::Logged
    } else if input.allowed {
        DispositionId::Allowed
    } else {
        DispositionId::Blocked
    };

    let status_id = if input.is_warn || input.allowed {
        StatusId::Success
    } else {
        StatusId::Failure
    };

    let finding_info = FindingInfo {
        uid: input.event_uid.to_string(),
        title: format!("{} decision", input.guard),
        analytic: Analytic::rule(input.guard),
        desc: Some(input.message.to_string()),
        related_analytics: None,
    };

    let resources = input.resource_name.map(|name| {
        vec![ResourceDetail {
            uid: None,
            name: Some(name.to_string()),
            r#type: input.resource_type.map(|t| t.to_string()),
        }]
    });

    let mut finding = DetectionFinding::new(
        DetectionFindingActivity::Create,
        input.time_ms,
        severity_id.as_u8(),
        status_id.as_u8(),
        action_id.as_u8(),
        disposition_id.as_u8(),
        Metadata::clawdstrike(input.product_version),
        finding_info,
    )
    .with_severity_label(severity_id.label())
    .with_message(input.message);

    if let Some(r) = resources {
        finding = finding.with_resources(r);
    }

    finding
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validate::validate_ocsf_json;

    #[test]
    fn allowed_guard_result() {
        let input = GuardResultInput {
            allowed: true,
            is_warn: false,
            guard: "EgressAllowlistGuard",
            severity: "info",
            message: "Allowed",
            time_ms: 1_709_366_400_000,
            event_uid: "evt-001",
            product_version: "0.1.3",
            resource_name: Some("api.example.com"),
            resource_type: Some("Network"),
        };

        let finding = guard_result_to_detection_finding(&input);
        assert_eq!(finding.class_uid, 2004);
        assert_eq!(finding.action_id, ActionId::Allowed.as_u8());
        assert_eq!(finding.disposition_id, DispositionId::Allowed.as_u8());
        assert_eq!(finding.status_id, StatusId::Success.as_u8());
        assert_eq!(finding.severity_id, 1); // Informational

        let json = serde_json::to_value(&finding).unwrap();
        let errors = validate_ocsf_json(&json);
        assert!(errors.is_empty(), "validation errors: {:?}", errors);
    }

    #[test]
    fn denied_guard_result() {
        let input = GuardResultInput {
            allowed: false,
            is_warn: false,
            guard: "ForbiddenPathGuard",
            severity: "critical",
            message: "Blocked /etc/shadow",
            time_ms: 1_709_366_400_000,
            event_uid: "evt-002",
            product_version: "0.1.3",
            resource_name: Some("/etc/shadow"),
            resource_type: Some("File"),
        };

        let finding = guard_result_to_detection_finding(&input);
        assert_eq!(finding.action_id, ActionId::Denied.as_u8());
        assert_eq!(finding.disposition_id, DispositionId::Blocked.as_u8());
        assert_eq!(finding.status_id, StatusId::Failure.as_u8());
        assert_eq!(finding.severity_id, 5); // Critical = 5, NOT 6

        let json = serde_json::to_value(&finding).unwrap();
        let errors = validate_ocsf_json(&json);
        assert!(errors.is_empty(), "validation errors: {:?}", errors);
    }

    #[test]
    fn warn_guard_result() {
        let input = GuardResultInput {
            allowed: false,
            is_warn: true,
            guard: "ShellCommandGuard",
            severity: "warning",
            message: "Logged shell command",
            time_ms: 1_709_366_400_000,
            event_uid: "evt-003",
            product_version: "0.1.3",
            resource_name: Some("rm -rf /tmp"),
            resource_type: Some("process"),
        };

        let finding = guard_result_to_detection_finding(&input);
        assert_eq!(finding.action_id, ActionId::Allowed.as_u8());
        assert_eq!(finding.disposition_id, DispositionId::Logged.as_u8());
        assert_eq!(finding.status_id, StatusId::Success.as_u8());

        let json = serde_json::to_value(&finding).unwrap();
        let errors = validate_ocsf_json(&json);
        assert!(errors.is_empty(), "validation errors: {:?}", errors);
    }
}
