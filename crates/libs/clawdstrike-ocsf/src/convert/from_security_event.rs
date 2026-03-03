//! Convert a SecurityEvent (via primitive fields) to a set of OCSF events.
//!
//! A single SecurityEvent may produce:
//! 1. A DetectionFinding (always) — the primary OCSF class for guard decisions.
//! 2. An optional secondary class based on resource type:
//!    - File → FileActivity
//!    - Process → ProcessActivity
//!    - Network → NetworkActivity
//!    - Tool / Configuration → no secondary

use crate::base::{ActionId, DispositionId, StatusId};
use crate::classes::detection_finding::{DetectionFinding, DetectionFindingActivity};
use crate::classes::file_activity::{FileActivity, FileActivityType};
use crate::classes::network_activity::{NetworkActivity, NetworkActivityType};
use crate::classes::process_activity::{ProcessActivity, ProcessActivityType};
use crate::objects::actor::{Actor, ActorSession};
use crate::objects::file::OcsfFile;
use crate::objects::finding_info::{Analytic, FindingInfo};
use crate::objects::metadata::Metadata;
use crate::objects::network_endpoint::NetworkEndpoint;
use crate::objects::process::{OcsfProcess, OcsfUser};
use crate::objects::resource::ResourceDetail;
use crate::severity::map_severity;

/// Input describing a SecurityEvent in primitive terms.
pub struct SecurityEventInput<'a> {
    /// Unique event ID.
    pub event_id: &'a str,
    /// Timestamp as epoch milliseconds.
    pub time_ms: i64,
    /// Whether the action was allowed.
    pub allowed: bool,
    /// Outcome string: "success", "failure", "unknown".
    pub outcome: &'a str,
    /// Severity string from the decision.
    pub severity: &'a str,
    /// Guard name that made the decision.
    pub guard: &'a str,
    /// Human-readable reason / message.
    pub reason: &'a str,
    /// Product version.
    pub product_version: &'a str,
    /// Action that was checked (e.g., "file_access", "file_write", "egress", "shell", "mcp_tool", "patch").
    pub action: &'a str,
    /// Resource type: "file", "network", "process", "tool", "configuration".
    pub resource_type: &'a str,
    /// Resource name (path, host, command, tool name).
    pub resource_name: &'a str,
    /// Optional file path.
    pub resource_path: Option<&'a str>,
    /// Optional network host.
    pub resource_host: Option<&'a str>,
    /// Optional network port.
    pub resource_port: Option<u16>,
    /// Agent ID.
    pub agent_id: &'a str,
    /// Agent name.
    pub agent_name: &'a str,
    /// Session ID.
    pub session_id: Option<&'a str>,
    /// Whether this is a warn event (non-blocking but logged).
    pub is_warn: bool,
}

/// Result set from converting a SecurityEvent to OCSF.
pub struct OcsfEventSet {
    /// The primary Detection Finding (always present).
    pub detection_finding: DetectionFinding,
    /// Optional secondary event based on resource type.
    pub secondary: Option<SecondaryEvent>,
}

/// A secondary OCSF event derived from the resource type.
pub enum SecondaryEvent {
    /// File Activity event.
    File(FileActivity),
    /// Process Activity event.
    Process(ProcessActivity),
    /// Network Activity event.
    Network(NetworkActivity),
}

/// Convert a SecurityEvent to an OCSF event set.
#[must_use]
pub fn security_event_to_ocsf(input: &SecurityEventInput<'_>) -> OcsfEventSet {
    let severity_id = map_severity(input.severity);
    let action_id = if input.allowed {
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
    let status_id = match input.outcome {
        "success" => StatusId::Success,
        "failure" => StatusId::Failure,
        _ => StatusId::Unknown,
    };

    let metadata = Metadata::clawdstrike(input.product_version).with_original_uid(input.event_id);

    let finding_info = FindingInfo {
        uid: input.event_id.to_string(),
        title: format!("{} decision", input.guard),
        analytic: Analytic::rule(input.guard),
        desc: Some(input.reason.to_string()),
        related_analytics: None,
    };

    let actor = Actor {
        user: Some(OcsfUser {
            name: Some(input.agent_name.to_string()),
            uid: Some(input.agent_id.to_string()),
        }),
        app_name: Some("clawdstrike".to_string()),
        app_uid: None,
        session: input.session_id.map(|sid| ActorSession {
            uid: Some(sid.to_string()),
        }),
    };

    let resources = vec![ResourceDetail {
        uid: None,
        name: Some(input.resource_name.to_string()),
        r#type: Some(input.resource_type.to_string()),
    }];

    let detection_finding = DetectionFinding::new(
        DetectionFindingActivity::Create,
        input.time_ms,
        severity_id.as_u8(),
        status_id.as_u8(),
        action_id.as_u8(),
        disposition_id.as_u8(),
        metadata.clone(),
        finding_info,
    )
    .with_severity_label(severity_id.label())
    .with_message(input.reason)
    .with_actor(actor.clone())
    .with_resources(resources);

    let secondary = build_secondary(
        input,
        &metadata,
        severity_id.as_u8(),
        status_id.as_u8(),
        &actor,
    );

    OcsfEventSet {
        detection_finding,
        secondary,
    }
}

/// Convert a SecurityEvent to a single OCSF JSON value (Detection Finding only).
///
/// Convenience wrapper for backward compatibility.
#[must_use]
pub fn to_ocsf_json(input: &SecurityEventInput<'_>) -> serde_json::Value {
    let event_set = security_event_to_ocsf(input);
    // Return the primary Detection Finding as JSON.
    // If serde_json::to_value fails on our own types, that's a programming error.
    serde_json::to_value(&event_set.detection_finding).unwrap_or_default()
}

fn build_secondary(
    input: &SecurityEventInput<'_>,
    metadata: &Metadata,
    severity_id: u8,
    status_id: u8,
    actor: &Actor,
) -> Option<SecondaryEvent> {
    match input.resource_type {
        "file" => {
            let file_activity = match input.action {
                "file_access" => FileActivityType::Read,
                "file_write" | "patch" => FileActivityType::Update,
                _ => FileActivityType::Other,
            };
            let file = OcsfFile {
                path: input.resource_path.map(|p| p.to_string()),
                name: Some(input.resource_name.to_string()),
                uid: None,
                type_id: None,
                size: None,
                hashes: None,
            };
            Some(SecondaryEvent::File(
                FileActivity::new(
                    file_activity,
                    input.time_ms,
                    severity_id,
                    status_id,
                    metadata.clone(),
                    file,
                )
                .with_actor(actor.clone())
                .with_message(input.reason),
            ))
        }
        "process" => {
            let process = OcsfProcess {
                pid: None,
                name: Some(input.resource_name.to_string()),
                cmd_line: Some(input.resource_name.to_string()),
                file: None,
                user: None,
                parent_process: None,
                cwd: None,
            };
            Some(SecondaryEvent::Process(
                ProcessActivity::new(
                    ProcessActivityType::Launch,
                    input.time_ms,
                    severity_id,
                    status_id,
                    metadata.clone(),
                    process,
                )
                .with_actor(actor.clone())
                .with_message(input.reason),
            ))
        }
        "network" => {
            let dst = NetworkEndpoint {
                ip: None,
                port: input.resource_port,
                domain: input.resource_host.map(|h| h.to_string()),
                hostname: input.resource_host.map(|h| h.to_string()),
                subnet_uid: None,
            };
            Some(SecondaryEvent::Network(
                NetworkActivity::new(
                    NetworkActivityType::Traffic,
                    input.time_ms,
                    severity_id,
                    status_id,
                    metadata.clone(),
                )
                .with_dst_endpoint(dst)
                .with_actor(actor.clone())
                .with_message(input.reason)
                .with_action_id(if input.allowed {
                    ActionId::Allowed.as_u8()
                } else {
                    ActionId::Denied.as_u8()
                }),
            ))
        }
        // Tool and Configuration don't have secondary OCSF classes.
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validate::validate_ocsf_json;

    fn sample_input() -> SecurityEventInput<'static> {
        SecurityEventInput {
            event_id: "evt-001",
            time_ms: 1_709_366_400_000,
            allowed: false,
            outcome: "failure",
            severity: "high",
            guard: "ForbiddenPathGuard",
            reason: "Blocked access to /etc/shadow",
            product_version: "0.1.3",
            action: "file_access",
            resource_type: "file",
            resource_name: "/etc/shadow",
            resource_path: Some("/etc/shadow"),
            resource_host: None,
            resource_port: None,
            agent_id: "agent-1",
            agent_name: "test-agent",
            session_id: Some("sess-1"),
            is_warn: false,
        }
    }

    #[test]
    fn detection_finding_always_produced() {
        let result = security_event_to_ocsf(&sample_input());
        assert_eq!(result.detection_finding.class_uid, 2004);
    }

    #[test]
    fn file_resource_produces_valid_secondary() {
        let result = security_event_to_ocsf(&sample_input());
        match &result.secondary {
            Some(SecondaryEvent::File(fa)) => {
                assert_eq!(fa.class_uid, 1001);
                assert_eq!(fa.activity_id, 2); // Read (file_access)
                let json = serde_json::to_value(fa).unwrap();
                let errors = validate_ocsf_json(&json);
                assert!(
                    errors.is_empty(),
                    "file secondary OCSF errors: {:?}",
                    errors
                );
            }
            other => panic!("expected File secondary, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn file_write_action_maps_to_update() {
        let mut input = sample_input();
        input.action = "file_write";
        let result = security_event_to_ocsf(&input);
        match &result.secondary {
            Some(SecondaryEvent::File(fa)) => {
                assert_eq!(fa.activity_id, 3); // Update
                assert_eq!(fa.type_uid, 100103);
            }
            other => panic!("expected File secondary, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn patch_action_maps_to_update() {
        let mut input = sample_input();
        input.action = "patch";
        let result = security_event_to_ocsf(&input);
        match &result.secondary {
            Some(SecondaryEvent::File(fa)) => {
                assert_eq!(fa.activity_id, 3); // Update
            }
            other => panic!("expected File secondary, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn process_resource_produces_valid_secondary() {
        let mut input = sample_input();
        input.resource_type = "process";
        input.action = "shell";
        input.resource_name = "ls -la";
        let result = security_event_to_ocsf(&input);
        match &result.secondary {
            Some(SecondaryEvent::Process(pa)) => {
                assert_eq!(pa.class_uid, 1007);
                let json = serde_json::to_value(pa).unwrap();
                let errors = validate_ocsf_json(&json);
                assert!(
                    errors.is_empty(),
                    "process secondary OCSF errors: {:?}",
                    errors
                );
            }
            other => panic!("expected Process secondary, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn network_resource_produces_valid_secondary() {
        let mut input = sample_input();
        input.resource_type = "network";
        input.action = "egress";
        input.resource_name = "evil.com";
        input.resource_host = Some("evil.com");
        input.resource_port = Some(443);
        let result = security_event_to_ocsf(&input);
        match &result.secondary {
            Some(SecondaryEvent::Network(na)) => {
                assert_eq!(na.class_uid, 4001);
                assert_eq!(na.action_id, Some(2)); // Denied (allowed=false)
                let json = serde_json::to_value(na).unwrap();
                let errors = validate_ocsf_json(&json);
                assert!(
                    errors.is_empty(),
                    "network secondary OCSF errors: {:?}",
                    errors
                );
            }
            other => panic!("expected Network secondary, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn tool_resource_no_secondary() {
        let mut input = sample_input();
        input.resource_type = "tool";
        input.action = "mcp_tool";
        input.resource_name = "execute_sql";
        let result = security_event_to_ocsf(&input);
        assert!(result.secondary.is_none());
    }

    #[test]
    fn to_ocsf_json_produces_valid_detection_finding() {
        let json = to_ocsf_json(&sample_input());
        let errors = validate_ocsf_json(&json);
        assert!(errors.is_empty(), "validation errors: {:?}", errors);
        assert_eq!(json["class_uid"], 2004);
        assert_eq!(json["category_uid"], 2);
        assert_eq!(json["type_uid"], 200401);
        assert_eq!(json["severity_id"], 4); // High
        assert_eq!(json["action_id"], 2); // Denied
        assert_eq!(json["disposition_id"], 2); // Blocked
        assert_eq!(json["metadata"]["version"], "1.4.0");
        assert_eq!(json["metadata"]["product"]["name"], "ClawdStrike");
        assert_eq!(json["metadata"]["product"]["vendor_name"], "Backbay Labs");
        assert_eq!(json["finding_info"]["analytic"]["type_id"], 1); // Rule
    }

    #[test]
    fn allowed_event_maps_correctly() {
        let mut input = sample_input();
        input.allowed = true;
        input.outcome = "success";
        input.severity = "info";
        let json = to_ocsf_json(&input);
        assert_eq!(json["action_id"], 1); // Allowed
        assert_eq!(json["disposition_id"], 1); // Allowed
        assert_eq!(json["status_id"], 1); // Success
        assert_eq!(json["severity_id"], 1); // Informational
    }

    #[test]
    fn critical_severity_maps_to_five() {
        let mut input = sample_input();
        input.severity = "critical";
        let json = to_ocsf_json(&input);
        assert_eq!(json["severity_id"], 5);
    }

    #[test]
    fn warn_event_produces_logged_disposition() {
        let mut input = sample_input();
        input.allowed = true;
        input.outcome = "success";
        input.severity = "medium";
        input.is_warn = true;
        let json = to_ocsf_json(&input);
        assert_eq!(json["action_id"], 1); // Allowed (non-blocking)
        assert_eq!(json["disposition_id"], 17); // Logged
        assert_eq!(json["status_id"], 1); // Success
    }
}
