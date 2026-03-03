//! Convert a timeline event (from hunt-query) to the appropriate OCSF class.
//!
//! Dispatches based on the event kind/source to produce the correct OCSF class.

use serde_json::Value;

use crate::classes::detection_finding::DetectionFinding;
use crate::classes::network_activity::NetworkActivity;
use crate::classes::process_activity::ProcessActivity;
use crate::convert::from_hubble_fact::hubble_fact_to_network_activity;
use crate::convert::from_tetragon_fact::tetragon_fact_to_process_activity;

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
    let decision = fact.get("decision").and_then(|v| v.as_str())?;
    let guard_name = fact
        .get("guard")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let severity_str = fact
        .get("severity")
        .and_then(|s| s.as_str())
        .unwrap_or("info");

    let decision_lower = decision.to_lowercase();
    let is_warn = matches!(decision_lower.as_str(), "warn" | "warning");
    let allowed = is_warn
        || matches!(
            decision_lower.as_str(),
            "allow" | "allowed" | "pass" | "passed"
        );

    use crate::convert::from_guard_result::{guard_result_to_detection_finding, GuardResultInput};

    let action_type = fact
        .get("action_type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let input = GuardResultInput {
        allowed,
        guard: guard_name,
        severity: severity_str,
        message: &format!("{guard_name} decision={decision}"),
        time_ms,
        event_uid: &format!("receipt-{time_ms}"),
        product_version,
        resource_name: fact.get("target").and_then(|v| v.as_str()),
        resource_type: Some(action_type),
    };

    let mut finding = guard_result_to_detection_finding(&input);

    // Warn decisions are non-blocking but should be logged, not marked as allowed.
    if is_warn {
        finding.disposition_id = crate::base::DispositionId::Logged.as_u8();
    }

    Some(finding)
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
}
