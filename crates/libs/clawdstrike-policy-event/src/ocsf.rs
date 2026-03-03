//! Convert PolicyEvent to OCSF events.
//!
//! Uses `clawdstrike-ocsf` converters for OCSF-compliant output.

use clawdstrike_ocsf::convert::from_security_event::{security_event_to_ocsf, SecurityEventInput};

use crate::event::{MappedGuardAction, PolicyEvent, PolicyEventData, PolicyEventType};

/// Convert a single PolicyEvent to an OCSF JSON value.
///
/// Returns the primary Detection Finding (class_uid 2004) as JSON.
/// Returns `None` for event types that cannot be mapped to OCSF.
#[must_use]
pub fn policy_event_to_ocsf(event: &PolicyEvent) -> Option<serde_json::Value> {
    let time_ms = event.timestamp.timestamp_millis();
    let (action, resource_type, resource_name, resource_path, resource_host, resource_port) =
        classify_event(event);

    let agent_id =
        crate::event::extract_metadata_string(event.metadata.as_ref(), &["agentId", "agent_id"])
            .unwrap_or_else(|| "unknown".to_string());

    let agent_name = crate::event::extract_metadata_string(
        event.metadata.as_ref(),
        &["agentName", "agent_name"],
    )
    .unwrap_or_else(|| "agent".to_string());

    // Check metadata for a verdict/decision field; default to allowed for observations.
    // Supports both string form ("deny") and object form ({"allowed": false, "guard": "..."}).
    let verdict_str = crate::event::extract_metadata_string(
        event.metadata.as_ref(),
        &["verdict", "decision"],
    );
    let (allowed, is_warn) = if let Some(ref s) = verdict_str {
        match s.to_lowercase().as_str() {
            "deny" | "denied" | "block" | "blocked" => (false, false),
            "warn" | "warning" | "warned" | "logged" => (true, true),
            _ => (true, false),
        }
    } else {
        // Fallback: decode object-form decision (e.g. {"allowed": false, "guard": "..."})
        decode_object_decision(event.metadata.as_ref())
    };
    let outcome = if allowed { "success" } else { "failure" };
    let severity = if !allowed {
        "high"
    } else if is_warn {
        "medium"
    } else {
        "info"
    };

    let input = SecurityEventInput {
        event_id: &event.event_id,
        time_ms,
        allowed,
        outcome,
        severity,
        guard: "PolicyEvent",
        reason: &format!("{} observation", event.event_type),
        product_version: env!("CARGO_PKG_VERSION"),
        action,
        resource_type,
        resource_name: &resource_name,
        resource_path: resource_path.as_deref(),
        resource_host: resource_host.as_deref(),
        resource_port,
        agent_id: &agent_id,
        agent_name: &agent_name,
        session_id: event.session_id.as_deref(),
        is_warn,
    };

    let event_set = security_event_to_ocsf(&input);
    serde_json::to_value(&event_set.detection_finding).ok()
}

/// Convert a MappedGuardAction + report into an OCSF JSON value.
///
/// This variant is useful when you already have a guard evaluation result.
#[must_use]
pub fn guard_decision_to_ocsf(
    event: &PolicyEvent,
    action: &MappedGuardAction,
    allowed: bool,
    guard: &str,
    severity: &str,
    message: &str,
    is_warn: bool,
) -> Option<serde_json::Value> {
    let time_ms = event.timestamp.timestamp_millis();
    let (action_str, resource_type, resource_name, resource_path, resource_host, resource_port) =
        classify_action(action);

    let agent_id =
        crate::event::extract_metadata_string(event.metadata.as_ref(), &["agentId", "agent_id"])
            .unwrap_or_else(|| "unknown".to_string());

    let agent_name = crate::event::extract_metadata_string(
        event.metadata.as_ref(),
        &["agentName", "agent_name"],
    )
    .unwrap_or_else(|| "agent".to_string());

    let outcome = if allowed { "success" } else { "failure" };

    let input = SecurityEventInput {
        event_id: &event.event_id,
        time_ms,
        allowed,
        outcome,
        severity,
        guard,
        reason: message,
        product_version: env!("CARGO_PKG_VERSION"),
        action: action_str,
        resource_type,
        resource_name: &resource_name,
        resource_path: resource_path.as_deref(),
        resource_host: resource_host.as_deref(),
        resource_port,
        agent_id: &agent_id,
        agent_name: &agent_name,
        session_id: event.session_id.as_deref(),
        is_warn,
    };

    let event_set = security_event_to_ocsf(&input);
    serde_json::to_value(&event_set.detection_finding).ok()
}

/// Batch convert events to OCSF JSONL.
pub fn policy_events_to_ocsf_jsonl(events: &[PolicyEvent]) -> anyhow::Result<String> {
    let mut lines = Vec::with_capacity(events.len());

    for event in events {
        if let Some(ocsf_json) = policy_event_to_ocsf(event) {
            let line = serde_json::to_string(&ocsf_json)?;
            lines.push(line);
        }
    }

    Ok(lines.join("\n"))
}

fn classify_event(
    event: &PolicyEvent,
) -> (
    &'static str,
    &'static str,
    String,
    Option<String>,
    Option<String>,
    Option<u16>,
) {
    match (&event.event_type, &event.data) {
        (PolicyEventType::FileRead, PolicyEventData::File(f)) => (
            "file_access",
            "file",
            f.path.clone(),
            Some(f.path.clone()),
            None,
            None,
        ),
        (PolicyEventType::FileWrite, PolicyEventData::File(f)) => (
            "file_write",
            "file",
            f.path.clone(),
            Some(f.path.clone()),
            None,
            None,
        ),
        (PolicyEventType::NetworkEgress, PolicyEventData::Network(n)) => (
            "egress",
            "network",
            n.host.clone(),
            None,
            Some(n.host.clone()),
            Some(n.port),
        ),
        (PolicyEventType::CommandExec, PolicyEventData::Command(c)) => {
            ("shell", "process", c.command.clone(), None, None, None)
        }
        (PolicyEventType::PatchApply, PolicyEventData::Patch(p)) => (
            "patch",
            "file",
            p.file_path.clone(),
            Some(p.file_path.clone()),
            None,
            None,
        ),
        (PolicyEventType::ToolCall, PolicyEventData::Tool(t)) => {
            ("mcp_tool", "tool", t.tool_name.clone(), None, None, None)
        }
        (PolicyEventType::SecretAccess, PolicyEventData::Secret(s)) => (
            "secret_access",
            "configuration",
            s.secret_name.clone(),
            None,
            None,
            None,
        ),
        _ => (
            "custom",
            "configuration",
            event.event_type.as_str().to_string(),
            None,
            None,
            None,
        ),
    }
}

/// Classify a MappedGuardAction into OCSF resource fields.
///
/// Delegates to `classify_event` by converting the action back to the
/// corresponding event type/data — avoids duplicating the mapping logic.
fn classify_action(
    action: &MappedGuardAction,
) -> (
    &'static str,
    &'static str,
    String,
    Option<String>,
    Option<String>,
    Option<u16>,
) {
    use crate::event::{
        CommandEventData, CustomEventData, FileEventData, NetworkEventData, PatchEventData,
        ToolEventData,
    };

    let (event_type, data) = match action {
        MappedGuardAction::FileAccess { path } => (
            PolicyEventType::FileRead,
            PolicyEventData::File(FileEventData {
                path: path.clone(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
        ),
        MappedGuardAction::FileWrite { path, .. } => (
            PolicyEventType::FileWrite,
            PolicyEventData::File(FileEventData {
                path: path.clone(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
        ),
        MappedGuardAction::NetworkEgress { host, port } => (
            PolicyEventType::NetworkEgress,
            PolicyEventData::Network(NetworkEventData {
                host: host.clone(),
                port: *port,
                protocol: None,
                url: None,
            }),
        ),
        MappedGuardAction::ShellCommand { commandline } => (
            PolicyEventType::CommandExec,
            PolicyEventData::Command(CommandEventData {
                command: commandline.clone(),
                args: vec![],
            }),
        ),
        MappedGuardAction::Patch { file_path, .. } => (
            PolicyEventType::PatchApply,
            PolicyEventData::Patch(PatchEventData {
                file_path: file_path.clone(),
                patch_content: String::new(),
                patch_hash: None,
            }),
        ),
        MappedGuardAction::McpTool { tool_name, .. } => (
            PolicyEventType::ToolCall,
            PolicyEventData::Tool(ToolEventData {
                tool_name: tool_name.clone(),
                parameters: serde_json::Value::Null,
            }),
        ),
        MappedGuardAction::Custom { custom_type, .. } => (
            PolicyEventType::Custom,
            PolicyEventData::Custom(CustomEventData {
                custom_type: custom_type.clone(),
                extra: serde_json::Map::new(),
            }),
        ),
    };

    let stub = PolicyEvent {
        event_id: String::new(),
        event_type,
        timestamp: chrono::Utc::now(),
        session_id: None,
        data,
        metadata: None,
        context: None,
    };
    classify_event(&stub)
}

/// Decode an object-form decision from metadata.
///
/// When `metadata.decision` (or `metadata.verdict`) is an object like
/// `{"allowed": false, "guard": "ForbiddenPathGuard"}`, extract the boolean
/// `allowed` field. Returns `(true, false)` (allowed, not warn) as the
/// default when the field is absent or not an object.
fn decode_object_decision(metadata: Option<&serde_json::Value>) -> (bool, bool) {
    let obj = match metadata {
        Some(serde_json::Value::Object(o)) => o,
        _ => return (true, false),
    };

    let decision_val = obj.get("verdict").or_else(|| obj.get("decision"));

    match decision_val {
        Some(serde_json::Value::Object(decision_obj)) => {
            match decision_obj.get("allowed").and_then(|v| v.as_bool()) {
                Some(true) => (true, false),
                Some(false) => (false, false),
                None => (true, false),
            }
        }
        _ => (true, false),
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::unwrap_used)]

    use super::*;
    use crate::event::{FileEventData, NetworkEventData};
    use chrono::Utc;

    #[test]
    fn file_read_produces_detection_finding() {
        let event = PolicyEvent {
            event_id: "evt-1".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::File(FileEventData {
                path: "/etc/passwd".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        };

        let json = policy_event_to_ocsf(&event).unwrap();
        assert_eq!(json["class_uid"], 2004);
        assert_eq!(json["category_uid"], 2);
    }

    #[test]
    fn egress_produces_detection_finding() {
        let event = PolicyEvent {
            event_id: "evt-2".to_string(),
            event_type: PolicyEventType::NetworkEgress,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::Network(NetworkEventData {
                host: "api.github.com".to_string(),
                port: 443,
                protocol: None,
                url: None,
            }),
            metadata: None,
            context: None,
        };

        let json = policy_event_to_ocsf(&event).unwrap();
        assert_eq!(json["class_uid"], 2004);
    }

    #[test]
    fn batch_ocsf_jsonl() {
        let events = vec![PolicyEvent {
            event_id: "evt-1".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/tmp/test".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        }];

        let jsonl = policy_events_to_ocsf_jsonl(&events).unwrap();
        assert!(!jsonl.is_empty());
        let parsed: serde_json::Value = serde_json::from_str(&jsonl).unwrap();
        assert_eq!(parsed["class_uid"], 2004);
    }

    #[test]
    fn object_form_decision_denied() {
        let event = PolicyEvent {
            event_id: "evt-obj".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/etc/shadow".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: Some(serde_json::json!({
                "decision": { "allowed": false, "guard": "ForbiddenPathGuard" }
            })),
            context: None,
        };

        let json = policy_event_to_ocsf(&event).unwrap();
        assert_eq!(json["class_uid"], 2004);
        // Object-form {allowed: false} → action_id 2 (Denied)
        assert_eq!(json["action_id"], 2);
        assert_eq!(json["disposition_id"], 2); // Blocked
    }

    #[test]
    fn object_form_decision_allowed() {
        let event = PolicyEvent {
            event_id: "evt-obj-allow".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/tmp/test".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: Some(serde_json::json!({
                "decision": { "allowed": true }
            })),
            context: None,
        };

        let json = policy_event_to_ocsf(&event).unwrap();
        assert_eq!(json["class_uid"], 2004);
        // Object-form {allowed: true} → action_id 1 (Allowed)
        assert_eq!(json["action_id"], 1);
        assert_eq!(json["disposition_id"], 1); // Allowed
    }

    #[test]
    fn guard_decision_denied() {
        let event = PolicyEvent {
            event_id: "evt-3".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/etc/shadow".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        };

        let action = MappedGuardAction::FileAccess {
            path: "/etc/shadow".to_string(),
        };

        let json = guard_decision_to_ocsf(
            &event,
            &action,
            false,
            "ForbiddenPathGuard",
            "critical",
            "Blocked /etc/shadow",
            false,
        )
        .unwrap();

        assert_eq!(json["class_uid"], 2004);
        assert_eq!(json["action_id"], 2); // Denied
        assert_eq!(json["disposition_id"], 2); // Blocked
    }
}
