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

    let input = SecurityEventInput {
        event_id: &event.event_id,
        time_ms,
        allowed: true,
        outcome: "success",
        severity: "info",
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
        is_warn: false,
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
    match action {
        MappedGuardAction::FileAccess { path } => (
            "file_access",
            "file",
            path.clone(),
            Some(path.clone()),
            None,
            None,
        ),
        MappedGuardAction::FileWrite { path, .. } => (
            "file_write",
            "file",
            path.clone(),
            Some(path.clone()),
            None,
            None,
        ),
        MappedGuardAction::NetworkEgress { host, port } => (
            "egress",
            "network",
            host.clone(),
            None,
            Some(host.clone()),
            Some(*port),
        ),
        MappedGuardAction::ShellCommand { commandline } => {
            ("shell", "process", commandline.clone(), None, None, None)
        }
        MappedGuardAction::Patch { file_path, .. } => (
            "patch",
            "file",
            file_path.clone(),
            Some(file_path.clone()),
            None,
            None,
        ),
        MappedGuardAction::McpTool { tool_name, .. } => {
            ("mcp_tool", "tool", tool_name.clone(), None, None, None)
        }
        MappedGuardAction::Custom { custom_type, .. } => (
            "custom",
            "configuration",
            custom_type.clone(),
            None,
            None,
            None,
        ),
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
