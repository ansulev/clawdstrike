#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

use chrono::Utc;
use clawdstrike_policy_event::bridge::{policy_event_to_timeline, policy_events_to_timeline};
use clawdstrike_policy_event::event::*;
use hunt_query::query::EventSource;
use hunt_query::timeline::{NormalizedVerdict, TimelineEventKind};

fn make_event(
    id: &str,
    event_type: PolicyEventType,
    data: PolicyEventData,
    metadata: Option<serde_json::Value>,
) -> PolicyEvent {
    PolicyEvent {
        event_id: id.to_string(),
        event_type,
        timestamp: Utc::now(),
        session_id: Some("sess-bridge".to_string()),
        data,
        metadata,
        context: None,
    }
}

#[test]
fn file_read_to_timeline() {
    let event = make_event(
        "br-1",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/workspace/src/main.rs".to_string(),
            operation: Some("read".to_string()),
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        None,
    );

    let te = policy_event_to_timeline(&event);

    assert_eq!(te.source, EventSource::Receipt);
    assert_eq!(te.kind, TimelineEventKind::GuardDecision);
    assert_eq!(te.action_type.as_deref(), Some("file"));
    assert!(te.summary.contains("file_read"));
    assert!(te.summary.contains("/workspace/src/main.rs"));
    assert_eq!(te.timestamp, event.timestamp);
}

#[test]
fn file_write_to_timeline() {
    let event = make_event(
        "br-2",
        PolicyEventType::FileWrite,
        PolicyEventData::File(FileEventData {
            path: "/tmp/output.json".to_string(),
            operation: Some("write".to_string()),
            content_base64: None,
            content: Some("{}".to_string()),
            content_hash: None,
        }),
        None,
    );

    let te = policy_event_to_timeline(&event);

    assert_eq!(te.action_type.as_deref(), Some("file"));
    assert!(te.summary.contains("file_write"));
}

#[test]
fn network_egress_to_timeline() {
    let event = make_event(
        "br-3",
        PolicyEventType::NetworkEgress,
        PolicyEventData::Network(NetworkEventData {
            host: "api.github.com".to_string(),
            port: 443,
            protocol: Some("tcp".to_string()),
            url: None,
        }),
        Some(serde_json::json!({ "verdict": "allow" })),
    );

    let te = policy_event_to_timeline(&event);

    assert_eq!(te.action_type.as_deref(), Some("egress"));
    assert!(te.summary.contains("network_egress"));
    assert!(te.summary.contains("api.github.com"));
    assert_eq!(te.verdict, NormalizedVerdict::Allow);
}

#[test]
fn command_exec_to_timeline() {
    let event = make_event(
        "br-4",
        PolicyEventType::CommandExec,
        PolicyEventData::Command(CommandEventData {
            command: "ls".to_string(),
            args: vec!["-la".to_string(), "/tmp".to_string()],
        }),
        Some(serde_json::json!({ "verdict": "blocked" })),
    );

    let te = policy_event_to_timeline(&event);

    assert_eq!(te.action_type.as_deref(), Some("shell"));
    assert!(te.summary.contains("command_exec"));
    assert_eq!(te.verdict, NormalizedVerdict::Deny);
}

#[test]
fn tool_call_to_timeline() {
    let event = make_event(
        "br-5",
        PolicyEventType::ToolCall,
        PolicyEventData::Tool(ToolEventData {
            tool_name: "read_file".to_string(),
            parameters: serde_json::json!({"path": "/etc/hosts"}),
        }),
        None,
    );

    let te = policy_event_to_timeline(&event);

    assert_eq!(te.action_type.as_deref(), Some("tool"));
    assert!(te.summary.contains("tool_call"));
    assert!(te.summary.contains("read_file"));
}

#[test]
fn timestamp_preserved() {
    let ts = Utc::now();
    let event = PolicyEvent {
        event_id: "br-ts".to_string(),
        event_type: PolicyEventType::FileRead,
        timestamp: ts,
        session_id: None,
        data: PolicyEventData::File(FileEventData {
            path: "/test".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        metadata: None,
        context: None,
    };

    let te = policy_event_to_timeline(&event);
    assert_eq!(te.timestamp, ts);
}

#[test]
fn batch_convert_preserves_count_and_order() {
    let events: Vec<PolicyEvent> = (0..5)
        .map(|i| {
            make_event(
                &format!("batch-{}", i),
                PolicyEventType::FileRead,
                PolicyEventData::File(FileEventData {
                    path: format!("/file-{}", i),
                    operation: None,
                    content_base64: None,
                    content: None,
                    content_hash: None,
                }),
                None,
            )
        })
        .collect();

    let timeline = policy_events_to_timeline(&events);
    assert_eq!(timeline.len(), 5);
    // Verify raw JSON contains event IDs in order
    for (i, te) in timeline.iter().enumerate() {
        let raw = te.raw.as_ref().unwrap();
        assert_eq!(raw["eventId"], format!("batch-{}", i));
    }
}

#[test]
fn verdict_mapping_warn() {
    let event = make_event(
        "br-warn",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/suspicious".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        Some(serde_json::json!({ "decision": "warning" })),
    );

    let te = policy_event_to_timeline(&event);
    assert_eq!(te.verdict, NormalizedVerdict::Warn);
}

#[test]
fn severity_extracted_from_metadata() {
    let event = make_event(
        "br-sev",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/test".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        Some(serde_json::json!({ "severity": "critical" })),
    );

    let te = policy_event_to_timeline(&event);
    assert_eq!(te.severity.as_deref(), Some("critical"));
}

#[test]
fn severity_extracted_from_object_decision() {
    let event = make_event(
        "br-sev-obj",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/test".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        Some(serde_json::json!({
            "decision": { "allowed": true, "severity": "high" }
        })),
    );

    let te = policy_event_to_timeline(&event);
    assert_eq!(te.severity.as_deref(), Some("high"));
}

#[test]
fn object_decision_warn_maps_to_warn_verdict() {
    let event = make_event(
        "br-warn-obj",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/tmp/warn".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        Some(serde_json::json!({
            "decision": { "allowed": true, "warn": true }
        })),
    );

    let te = policy_event_to_timeline(&event);
    assert_eq!(te.verdict, NormalizedVerdict::Warn);
}

#[test]
fn raw_json_included() {
    let event = make_event(
        "br-raw",
        PolicyEventType::FileRead,
        PolicyEventData::File(FileEventData {
            path: "/test".to_string(),
            operation: None,
            content_base64: None,
            content: None,
            content_hash: None,
        }),
        None,
    );

    let te = policy_event_to_timeline(&event);
    assert!(te.raw.is_some());
    let raw = te.raw.unwrap();
    assert_eq!(raw["eventId"], "br-raw");
}
