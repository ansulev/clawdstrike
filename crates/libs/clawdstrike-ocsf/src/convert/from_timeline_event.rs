//! Convert a timeline event (from hunt-query) to the appropriate OCSF class.
//!
//! Dispatches based on the event kind/source to produce the correct OCSF class.

use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::classes::detection_finding::DetectionFinding;
use crate::classes::network_activity::NetworkActivity;
use crate::classes::process_activity::ProcessActivity;
use crate::convert::from_hubble_fact::hubble_fact_to_network_activity;
use crate::convert::from_tetragon_fact::tetragon_fact_to_process_activity;
use crate::decision::{decision_object_allowed, decision_object_is_warn, severity_from_value};

/// An OCSF event produced from a timeline event.
pub enum TimelineOcsfEvent {
    /// Process activity from Tetragon events.
    Process(ProcessActivity),
    /// Network activity from Hubble events.
    Network(NetworkActivity),
    /// Detection finding from guard receipt events.
    Detection(DetectionFinding),
}

/// Input describing a timeline event in primitive terms.
pub struct TimelineEventInput<'a> {
    /// Event kind: "process_exec", "process_exit", "process_kprobe", "network_flow", "guard_decision".
    pub kind: &'a str,
    /// Event source: "tetragon", "hubble", "receipt".
    pub source: &'a str,
    /// Timestamp as epoch milliseconds.
    pub time_ms: i64,
    /// The raw fact/envelope JSON.
    pub raw: &'a Value,
    /// Product version.
    pub product_version: &'a str,
}

/// Convert a timeline event to an OCSF event.
///
/// Returns `None` if the event cannot be mapped.
#[must_use]
pub fn timeline_event_to_ocsf(input: &TimelineEventInput<'_>) -> Option<TimelineOcsfEvent> {
    match input.source {
        "tetragon" => {
            let fact = input.raw.get("fact").unwrap_or(input.raw);
            tetragon_fact_to_process_activity(fact, input.time_ms, input.product_version)
                .map(TimelineOcsfEvent::Process)
        }
        "hubble" => {
            let fact = input.raw.get("fact").unwrap_or(input.raw);
            hubble_fact_to_network_activity(fact, input.time_ms, input.product_version)
                .map(TimelineOcsfEvent::Network)
        }
        "receipt" => {
            // Guard receipts become Detection Findings.
            let fact = input.raw.get("fact").unwrap_or(input.raw);
            receipt_to_detection_finding(fact, input.time_ms, input.product_version)
                .map(TimelineOcsfEvent::Detection)
        }
        _ => None,
    }
}

fn receipt_to_detection_finding(
    fact: &Value,
    time_ms: i64,
    product_version: &str,
) -> Option<DetectionFinding> {
    let (decision_kind, decision_label) = extract_receipt_decision(fact)?;
    let is_warn = matches!(decision_kind, ReceiptDecisionKind::Warn);
    let allowed = matches!(
        decision_kind,
        ReceiptDecisionKind::Allow | ReceiptDecisionKind::Warn
    );
    let guard_name = extract_receipt_guard_name(fact).unwrap_or("unknown");
    let severity_str = extract_receipt_severity(fact).unwrap_or_else(|| "info".to_string());
    let action_type = extract_receipt_action_type(fact).unwrap_or("unknown");
    let resource_name = extract_receipt_target(fact);
    let event_uid = extract_receipt_uid(fact, time_ms, guard_name, &decision_label);

    use crate::convert::from_guard_result::{guard_result_to_detection_finding, GuardResultInput};

    let input = GuardResultInput {
        allowed,
        is_warn,
        guard: guard_name,
        severity: &severity_str,
        message: &format!("{guard_name} decision={decision_label}"),
        time_ms,
        event_uid: &event_uid,
        product_version,
        resource_name,
        resource_type: Some(normalize_receipt_resource_type(action_type)),
    };

    Some(guard_result_to_detection_finding(&input))
}

fn extract_receipt_decision(fact: &Value) -> Option<(ReceiptDecisionKind, String)> {
    let direct_decision = fact
        .get("verdict")
        .and_then(|v| v.as_str())
        .or_else(|| fact.get("decision").and_then(|v| v.as_str()))
        .or_else(|| {
            fact.get("metadata")
                .and_then(|v| v.as_object())
                .and_then(|obj| {
                    obj.get("verdict")
                        .and_then(|v| v.as_str())
                        .or_else(|| obj.get("decision").and_then(|v| v.as_str()))
                })
        });

    if let Some(decision_str) = direct_decision {
        let decision_kind = parse_receipt_decision(decision_str);
        if !matches!(decision_kind, ReceiptDecisionKind::Unknown) {
            return Some((decision_kind, decision_str.to_string()));
        }
    }

    let decision_obj = decision_object_from_fact(fact)?;
    let allowed = decision_object_allowed(decision_obj);
    if allowed == Some(false) {
        return Some((ReceiptDecisionKind::Deny, "deny".to_string()));
    }
    if decision_object_is_warn(decision_obj) {
        return Some((ReceiptDecisionKind::Warn, "warn".to_string()));
    }

    let allowed = allowed?;
    Some((
        if allowed {
            ReceiptDecisionKind::Allow
        } else {
            ReceiptDecisionKind::Deny
        },
        if allowed {
            "allow".to_string()
        } else {
            "deny".to_string()
        },
    ))
}

fn parse_receipt_decision(decision: &str) -> ReceiptDecisionKind {
    match decision.to_lowercase().as_str() {
        "allow" | "allowed" | "pass" | "passed" => ReceiptDecisionKind::Allow,
        "deny" | "denied" | "block" | "blocked" => ReceiptDecisionKind::Deny,
        "warn" | "warning" | "warned" | "logged" => ReceiptDecisionKind::Warn,
        _ => ReceiptDecisionKind::Unknown,
    }
}

fn extract_receipt_guard_name(fact: &Value) -> Option<&str> {
    fact.get("guard").and_then(|v| v.as_str()).or_else(|| {
        decision_object_from_fact(fact)?
            .get("guard")
            .and_then(|v| v.as_str())
    })
}

fn extract_receipt_severity(fact: &Value) -> Option<String> {
    fact.get("severity")
        .and_then(severity_from_value)
        .or_else(|| {
            fact.get("metadata")
                .and_then(|v| v.as_object())
                .and_then(|obj| obj.get("severity"))
                .and_then(severity_from_value)
        })
        .or_else(|| {
            decision_object_from_fact(fact)?
                .get("severity")
                .and_then(severity_from_value)
        })
}

fn extract_receipt_action_type(fact: &Value) -> Option<&str> {
    fact.get("action_type")
        .and_then(|v| v.as_str())
        .or_else(|| fact.get("actionType").and_then(|v| v.as_str()))
        .or_else(|| {
            fact.get("eventType")
                .and_then(|v| v.as_str())
                .or_else(|| fact.get("event_type").and_then(|v| v.as_str()))
                .and_then(map_policy_event_type_to_resource_type)
        })
        .or_else(|| {
            fact.get("data")
                .and_then(|v| v.get("type"))
                .and_then(|v| v.as_str())
        })
}

fn extract_receipt_target(fact: &Value) -> Option<&str> {
    fact.get("target")
        .and_then(|v| v.as_str())
        .or_else(|| fact.get("resource").and_then(|v| v.as_str()))
        .or_else(|| {
            fact.get("data")
                .and_then(|v| v.get("path"))
                .and_then(|v| v.as_str())
        })
        .or_else(|| {
            fact.get("data")
                .and_then(|v| v.get("host"))
                .and_then(|v| v.as_str())
        })
        .or_else(|| {
            fact.get("data")
                .and_then(|v| v.get("command"))
                .and_then(|v| v.as_str())
        })
        .or_else(|| {
            fact.get("data")
                .and_then(|v| v.get("toolName"))
                .and_then(|v| v.as_str())
                .or_else(|| {
                    fact.get("data")
                        .and_then(|v| v.get("tool_name"))
                        .and_then(|v| v.as_str())
                })
        })
        .or_else(|| {
            fact.get("data")
                .and_then(|v| v.get("secretName"))
                .and_then(|v| v.as_str())
                .or_else(|| {
                    fact.get("data")
                        .and_then(|v| v.get("secret_name"))
                        .and_then(|v| v.as_str())
                })
        })
}

fn extract_receipt_uid(
    fact: &Value,
    time_ms: i64,
    guard_name: &str,
    decision_label: &str,
) -> String {
    if let Some(event_id) = fact
        .get("receipt_id")
        .and_then(|v| v.as_str())
        .or_else(|| fact.get("receiptId").and_then(|v| v.as_str()))
        .or_else(|| fact.get("eventId").and_then(|v| v.as_str()))
        .or_else(|| fact.get("event_id").and_then(|v| v.as_str()))
        .or_else(|| fact.get("id").and_then(|v| v.as_str()))
        .or_else(|| fact.get("uid").and_then(|v| v.as_str()))
    {
        return format!("receipt-{event_id}");
    }

    let canonical_fact = canonical_json_for_uid(fact);
    let digest = Sha256::digest(canonical_fact.as_bytes());
    let mut fp_bytes = [0_u8; 8];
    fp_bytes.copy_from_slice(&digest[..8]);
    let fingerprint = u64::from_be_bytes(fp_bytes);
    format!("receipt-{time_ms}-{guard_name}-{decision_label}-{fingerprint:016x}")
}

fn decision_object_from_fact(fact: &Value) -> Option<&serde_json::Map<String, Value>> {
    fact.get("verdict")
        .and_then(|v| v.as_object())
        .or_else(|| fact.get("decision").and_then(|v| v.as_object()))
        .or_else(|| {
            fact.get("metadata")
                .and_then(|v| v.as_object())
                .and_then(|obj| {
                    obj.get("verdict")
                        .and_then(|v| v.as_object())
                        .or_else(|| obj.get("decision").and_then(|v| v.as_object()))
                })
        })
}

fn map_policy_event_type_to_resource_type(event_type: &str) -> Option<&'static str> {
    match event_type {
        "file_read" | "file_write" | "patch_apply" => Some("file"),
        "network_egress" => Some("network"),
        "command_exec" => Some("process"),
        "tool_call" => Some("tool"),
        "secret_access" => Some("configuration"),
        _ => None,
    }
}

fn normalize_receipt_resource_type<'a>(action_type: &'a str) -> &'a str {
    match action_type {
        "file" | "network" | "process" | "tool" | "configuration" => action_type,
        "file_access" | "file_read" | "file_write" | "patch" | "patch_apply" => "file",
        "egress" | "network_egress" => "network",
        "shell" | "command_exec" => "process",
        "mcp_tool" | "tool_call" => "tool",
        "secret_access" => "configuration",
        other => map_policy_event_type_to_resource_type(other).unwrap_or(other),
    }
}

fn canonical_json_for_uid(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&str> = map.keys().map(String::as_str).collect();
            keys.sort_unstable();

            let mut out = String::from("{");
            for (idx, key) in keys.iter().enumerate() {
                if idx > 0 {
                    out.push(',');
                }
                out.push_str(&serde_json::to_string(key).unwrap_or_default());
                out.push(':');
                out.push_str(&canonical_json_for_uid(&map[*key]));
            }
            out.push('}');
            out
        }
        Value::Array(items) => {
            let mut out = String::from("[");
            for (idx, item) in items.iter().enumerate() {
                if idx > 0 {
                    out.push(',');
                }
                out.push_str(&canonical_json_for_uid(item));
            }
            out.push(']');
            out
        }
        _ => serde_json::to_string(value).unwrap_or_default(),
    }
}

enum ReceiptDecisionKind {
    Allow,
    Deny,
    Warn,
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn tetragon_timeline_event() {
        let raw = json!({
            "fact": {
                "event_type": "PROCESS_EXEC",
                "process": { "binary": "/usr/bin/curl", "pid": 1234 },
                "severity": "info"
            }
        });

        let input = TimelineEventInput {
            kind: "process_exec",
            source: "tetragon",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        assert!(matches!(event, TimelineOcsfEvent::Process(_)));
        if let TimelineOcsfEvent::Process(pa) = event {
            assert_eq!(pa.class_uid, 1007);
            assert_eq!(pa.type_uid, 100701);
        }
    }

    #[test]
    fn hubble_timeline_event() {
        let raw = json!({
            "fact": {
                "verdict": "FORWARDED",
                "traffic_direction": "EGRESS",
                "summary": "flow"
            }
        });

        let input = TimelineEventInput {
            kind: "network_flow",
            source: "hubble",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        assert!(matches!(event, TimelineOcsfEvent::Network(_)));
    }

    #[test]
    fn receipt_timeline_event() {
        let raw = json!({
            "fact": {
                "decision": "deny",
                "guard": "ForbiddenPathGuard",
                "action_type": "file",
                "severity": "critical"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        assert!(matches!(event, TimelineOcsfEvent::Detection(_)));
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.class_uid, 2004);
            assert_eq!(df.severity_id, 5); // Critical = 5
        }
    }

    #[test]
    fn receipt_allowed_decision() {
        let raw = json!({
            "fact": {
                "decision": "allow",
                "guard": "PathAllowlistGuard",
                "action_type": "file",
                "severity": "info"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 1); // Allowed
            assert_eq!(df.disposition_id, 1); // Allowed
            assert_eq!(df.status_id, 1); // Success
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_passed_decision_is_allowed() {
        let raw = json!({
            "fact": {
                "decision": "passed",
                "guard": "EgressAllowlistGuard",
                "action_type": "network"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 1); // Allowed
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_warn_decision_is_logged() {
        let raw = json!({
            "fact": {
                "decision": "warn",
                "guard": "ShellCommandGuard",
                "action_type": "shell",
                "severity": "medium"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 1); // Allowed (non-blocking)
            assert_eq!(df.disposition_id, 17); // Logged
            assert_eq!(df.status_id, 1); // Success
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_warned_decision_is_logged() {
        let raw = json!({
            "fact": {
                "decision": "warned",
                "guard": "ShellCommandGuard",
                "action_type": "shell",
                "severity": "medium"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 1); // Allowed (non-blocking)
            assert_eq!(df.disposition_id, 17); // Logged
            assert_eq!(df.status_id, 1); // Success
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_missing_target_still_valid() {
        let raw = json!({
            "fact": {
                "decision": "deny",
                "guard": "TestGuard"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.class_uid, 2004);
            // No resources when target is missing
            assert!(df.resources.is_none());
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn bridged_policy_event_receipt_is_parsed() {
        let raw = json!({
            "eventId": "evt-bridge-1",
            "eventType": "file_read",
            "data": {
                "type": "file",
                "path": "/etc/shadow"
            },
            "metadata": {
                "decision": {
                    "allowed": false,
                    "guard": "ForbiddenPathGuard",
                    "severity": "critical",
                    "message": "Blocked /etc/shadow"
                }
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 2); // Denied
            assert_eq!(df.disposition_id, 2); // Blocked
            assert_eq!(df.severity_id, 5); // Critical
            assert_eq!(df.finding_info.uid, "receipt-evt-bridge-1");
            assert_eq!(df.finding_info.analytic.name, "ForbiddenPathGuard");
            assert_eq!(
                df.finding_info.desc.as_deref(),
                Some("ForbiddenPathGuard decision=deny")
            );
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_uid_uses_source_event_id_when_present() {
        let raw1 = json!({
            "eventId": "evt-bridge-uid-1",
            "eventType": "file_read",
            "data": { "type": "file", "path": "/tmp/a" },
            "metadata": {
                "decision": {
                    "allowed": false,
                    "guard": "ForbiddenPathGuard",
                    "severity": "high"
                }
            }
        });
        let raw2 = json!({
            "eventId": "evt-bridge-uid-2",
            "eventType": "file_read",
            "data": { "type": "file", "path": "/tmp/b" },
            "metadata": {
                "decision": {
                    "allowed": false,
                    "guard": "ForbiddenPathGuard",
                    "severity": "high"
                }
            }
        });

        let input1 = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw1,
            product_version: "0.1.3",
        };
        let input2 = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw2,
            product_version: "0.1.3",
        };

        let uid1 = match timeline_event_to_ocsf(&input1).unwrap() {
            TimelineOcsfEvent::Detection(df) => df.finding_info.uid,
            _ => panic!("expected Detection"),
        };
        let uid2 = match timeline_event_to_ocsf(&input2).unwrap() {
            TimelineOcsfEvent::Detection(df) => df.finding_info.uid,
            _ => panic!("expected Detection"),
        };

        assert_eq!(uid1, "receipt-evt-bridge-uid-1");
        assert_eq!(uid2, "receipt-evt-bridge-uid-2");
        assert_ne!(uid1, uid2);
    }

    #[test]
    fn receipt_uid_fallback_is_deterministic() {
        let fact = json!({
            "decision": {
                "allowed": false,
                "guard": "ForbiddenPathGuard",
                "severity": "high"
            },
            "eventType": "file_read",
            "data": { "path": "/tmp/demo.txt" }
        });

        let uid1 = extract_receipt_uid(&fact, 1_709_366_400_000, "ForbiddenPathGuard", "deny");
        let uid2 = extract_receipt_uid(&fact, 1_709_366_400_000, "ForbiddenPathGuard", "deny");
        assert_eq!(uid1, uid2);
        assert_eq!(
            uid1,
            "receipt-1709366400000-ForbiddenPathGuard-deny-aec44689e55c1079"
        );
    }

    #[test]
    fn receipt_uid_fallback_is_stable_across_key_order() {
        let fact_a: Value = serde_json::from_str(
            r#"{"decision":{"allowed":false,"guard":"ForbiddenPathGuard","severity":"high"},"eventType":"file_read","data":{"path":"/tmp/demo.txt"}}"#,
        )
        .unwrap();
        let fact_b: Value = serde_json::from_str(
            r#"{"data":{"path":"/tmp/demo.txt"},"eventType":"file_read","decision":{"severity":"high","guard":"ForbiddenPathGuard","allowed":false}}"#,
        )
        .unwrap();

        let uid_a = extract_receipt_uid(&fact_a, 1_709_366_400_000, "ForbiddenPathGuard", "deny");
        let uid_b = extract_receipt_uid(&fact_b, 1_709_366_400_000, "ForbiddenPathGuard", "deny");
        assert_eq!(uid_a, uid_b);
    }

    #[test]
    fn receipt_verdict_string_takes_precedence_over_decision() {
        let raw = json!({
            "fact": {
                "decision": "allow",
                "verdict": "deny",
                "guard": "ForbiddenPathGuard",
                "action_type": "file"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 2); // Denied
            assert_eq!(df.finding_info.analytic.name, "ForbiddenPathGuard");
            assert_eq!(
                df.finding_info.desc.as_deref(),
                Some("ForbiddenPathGuard decision=deny")
            );
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_verdict_object_takes_precedence_over_decision() {
        let raw = json!({
            "fact": {
                "decision": {
                    "allowed": true,
                    "guard": "AllowGuard"
                },
                "verdict": {
                    "allowed": false,
                    "guard": "DenyGuard"
                },
                "action_type": "file"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 2); // Denied
            assert_eq!(df.finding_info.analytic.name, "DenyGuard");
            assert_eq!(
                df.finding_info.desc.as_deref(),
                Some("DenyGuard decision=deny")
            );
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_denied_decision_object_takes_precedence_over_warn() {
        let raw = json!({
            "fact": {
                "decision": {
                    "allowed": false,
                    "warn": true,
                    "guard": "DenyGuard"
                },
                "action_type": "file"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 2); // Denied
            assert_eq!(df.disposition_id, 2); // Blocked
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_warning_severity_decision_object_maps_to_warn() {
        let raw = json!({
            "fact": {
                "decision": {
                    "allowed": true,
                    "severity": "warning",
                    "guard": "WarnGuard"
                },
                "action_type": "shell"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 1); // Allowed
            assert_eq!(df.disposition_id, 17); // Logged
            assert_eq!(df.status_id, 1); // Success
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_nested_severity_object_maps_to_critical() {
        let raw = json!({
            "fact": {
                "decision": "deny",
                "guard": "ForbiddenPathGuard",
                "severity": {
                    "level": "critical"
                },
                "action_type": "file_access"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.severity_id, 5); // Critical
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_action_type_is_normalized_to_resource_taxonomy() {
        let raw = json!({
            "fact": {
                "decision": "deny",
                "guard": "EgressAllowlistGuard",
                "action_type": "egress",
                "target": "evil.example"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            let resource_type = df
                .resources
                .as_ref()
                .and_then(|r| r.first())
                .and_then(|r| r.r#type.as_deref());
            assert_eq!(resource_type, Some("network"));
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_verdict_object_passed_is_allowed() {
        let raw = json!({
            "fact": {
                "verdict": {
                    "passed": true
                }
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 1); // Allowed
            assert_eq!(df.disposition_id, 1); // Allowed
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_verdict_object_failed_is_denied() {
        let raw = json!({
            "fact": {
                "verdict": {
                    "passed": false
                }
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        let event = timeline_event_to_ocsf(&input).unwrap();
        if let TimelineOcsfEvent::Detection(df) = event {
            assert_eq!(df.action_id, 2); // Denied
            assert_eq!(df.disposition_id, 2); // Blocked
        } else {
            panic!("expected Detection");
        }
    }

    #[test]
    fn receipt_uid_prefers_receipt_id_when_present() {
        let fact = json!({
            "receipt_id": "snap-posture-allow",
            "verdict": {
                "passed": true
            }
        });

        let uid = extract_receipt_uid(&fact, 1_709_366_499_999, "unknown", "allow");
        assert_eq!(uid, "receipt-snap-posture-allow");
    }

    #[test]
    fn unknown_source_returns_none() {
        let raw = json!({});
        let input = TimelineEventInput {
            kind: "unknown",
            source: "unknown",
            time_ms: 0,
            raw: &raw,
            product_version: "0.1.3",
        };
        assert!(timeline_event_to_ocsf(&input).is_none());
    }

    #[test]
    fn receipt_unknown_decision_returns_none() {
        let raw = json!({
            "fact": {
                "decision": "observe",
                "guard": "SomeGuard"
            }
        });

        let input = TimelineEventInput {
            kind: "guard_decision",
            source: "receipt",
            time_ms: 1_709_366_400_000,
            raw: &raw,
            product_version: "0.1.3",
        };

        assert!(timeline_event_to_ocsf(&input).is_none());
    }
}
