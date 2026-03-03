#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

use chrono::Utc;
use clawdstrike_policy_event::event::*;
use clawdstrike_policy_event::ocsf::{
    guard_decision_to_ocsf, policy_event_to_ocsf, policy_events_to_ocsf_jsonl,
};

fn make_event(id: &str, event_type: PolicyEventType, data: PolicyEventData) -> PolicyEvent {
    PolicyEvent {
        event_id: id.to_string(),
        event_type,
        timestamp: Utc::now(),
        session_id: Some("sess-ocsf".to_string()),
        data,
        metadata: None,
        context: None,
    }
}

#[test]
fn file_read_produces_detection_finding() {
    let event = make_event(
        "ocsf-1",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/etc/passwd".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();

    assert_eq!(json["class_uid"], 2004);
    assert_eq!(json["category_uid"], 2);
    assert!(json["time"].is_number());
    assert!(json["severity_id"].is_number());
    assert!(json["metadata"].is_object());
    assert!(json["metadata"]["product"].is_object());
}

#[test]
fn file_write_produces_detection_finding() {
    let event = make_event(
        "ocsf-2",
        PolicyEventType::FileWrite,
        PolicyEventData::File(FileEventData {
            path: "/tmp/out.json".to_string(),
            operation: Some("write".to_string()),
            content_base64: None,
            content: Some("data".to_string()),
            content_hash: None,
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();
    assert_eq!(json["class_uid"], 2004);
}

#[test]
fn network_egress_produces_detection_finding() {
    let event = make_event(
        "ocsf-3",
        PolicyEventType::NetworkEgress,
        PolicyEventData::Network(NetworkEventData {
            host: "api.github.com".to_string(),
            port: 443,
            protocol: Some("tcp".to_string()),
            url: None,
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();
    assert_eq!(json["class_uid"], 2004);
}

#[test]
fn command_exec_produces_detection_finding() {
    let event = make_event(
        "ocsf-4",
        PolicyEventType::CommandExec,
        PolicyEventData::Command(CommandEventData {
            command: "ls".to_string(),
            args: vec!["-la".to_string()],
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();
    assert_eq!(json["class_uid"], 2004);
}

#[test]
fn tool_call_produces_detection_finding() {
    let event = make_event(
        "ocsf-5",
        PolicyEventType::ToolCall,
        PolicyEventData::Tool(ToolEventData {
            tool_name: "mcp__search".to_string(),
            parameters: serde_json::json!({"query": "test"}),
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();
    assert_eq!(json["class_uid"], 2004);
}

#[test]
fn secret_access_produces_detection_finding() {
    let event = make_event(
        "ocsf-6",
        PolicyEventType::SecretAccess,
        PolicyEventData::Secret(SecretEventData {
            secret_name: "API_KEY".to_string(),
            scope: "env".to_string(),
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();
    assert_eq!(json["class_uid"], 2004);
}

#[test]
fn ocsf_required_fields_present() {
    let event = make_event(
        "ocsf-fields",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/test".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
    );

    let json = policy_event_to_ocsf(&event).unwrap();

    // Required OCSF base fields
    assert!(json["class_uid"].is_number());
    assert!(json["category_uid"].is_number());
    assert!(json["time"].is_number());
    assert!(json["severity_id"].is_number());
    assert!(json["type_uid"].is_number());
    assert!(json["status_id"].is_number());

    // Metadata with product info
    let metadata = &json["metadata"];
    assert!(metadata["product"]["name"].is_string());
    assert!(metadata["product"]["vendor_name"].is_string());
    assert!(metadata["version"].is_string());
}

#[test]
fn guard_decision_denied_maps_correctly() {
    let event = make_event(
        "ocsf-deny",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/etc/shadow".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
    );

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

#[test]
fn guard_decision_warn_maps_correctly() {
    let event = make_event(
        "ocsf-warn",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/var/log/syslog".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
    );

    let action = MappedGuardAction::FileAccess {
        path: "/var/log/syslog".to_string(),
    };

    let json = guard_decision_to_ocsf(
        &event,
        &action,
        true,
        "ForbiddenPathGuard",
        "warning",
        "Logged access to /var/log/syslog",
        true,
    )
    .unwrap();

    assert_eq!(json["class_uid"], 2004);
    assert_eq!(json["action_id"], 1); // Allowed
    assert_eq!(json["disposition_id"], 17); // Logged
}

#[test]
fn batch_ocsf_jsonl_produces_valid_lines() {
    let events = vec![
        make_event(
            "batch-1",
            PolicyEventType::FileRead,
            PolicyEventData::File(FileEventData {
                path: "/a".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
        ),
        make_event(
            "batch-2",
            PolicyEventType::NetworkEgress,
            PolicyEventData::Network(NetworkEventData {
                host: "example.com".to_string(),
                port: 80,
                protocol: None,
                url: None,
            }),
        ),
    ];

    let jsonl = policy_events_to_ocsf_jsonl(&events).unwrap();
    let lines: Vec<&str> = jsonl.lines().collect();
    assert_eq!(lines.len(), 2);

    for line in lines {
        let parsed: serde_json::Value = serde_json::from_str(line).unwrap();
        assert_eq!(parsed["class_uid"], 2004);
    }
}
