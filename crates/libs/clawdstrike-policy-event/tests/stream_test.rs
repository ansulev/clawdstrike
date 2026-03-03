#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

use chrono::Utc;
use clawdstrike_policy_event::event::*;
use clawdstrike_policy_event::stream::{
    filter_events, read_events_from_str, write_event, write_events,
};

fn file_event(id: &str) -> PolicyEvent {
    PolicyEvent {
        event_id: id.to_string(),
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
    }
}

fn network_event(id: &str, host: &str) -> PolicyEvent {
    PolicyEvent {
        event_id: id.to_string(),
        event_type: PolicyEventType::NetworkEgress,
        timestamp: Utc::now(),
        session_id: None,
        data: PolicyEventData::Network(NetworkEventData {
            host: host.to_string(),
            port: 443,
            protocol: None,
            url: None,
        }),
        metadata: None,
        context: None,
    }
}

fn command_event(id: &str) -> PolicyEvent {
    PolicyEvent {
        event_id: id.to_string(),
        event_type: PolicyEventType::CommandExec,
        timestamp: Utc::now(),
        session_id: None,
        data: PolicyEventData::Command(CommandEventData {
            command: "echo".to_string(),
            args: vec!["hello".to_string()],
        }),
        metadata: None,
        context: None,
    }
}

#[test]
fn roundtrip_single_event() {
    let event = file_event("rt-1");
    let mut buf = Vec::new();
    write_event(&mut buf, &event).unwrap();

    let jsonl = String::from_utf8(buf).unwrap();
    let parsed = read_events_from_str(&jsonl).unwrap();
    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0].event_id, "rt-1");
}

#[test]
fn roundtrip_multiple_events() {
    let events = vec![
        file_event("rt-a"),
        network_event("rt-b", "example.com"),
        command_event("rt-c"),
    ];

    let mut buf = Vec::new();
    write_events(&mut buf, &events).unwrap();

    let jsonl = String::from_utf8(buf).unwrap();
    let parsed = read_events_from_str(&jsonl).unwrap();
    assert_eq!(parsed.len(), 3);
    assert_eq!(parsed[0].event_id, "rt-a");
    assert_eq!(parsed[1].event_id, "rt-b");
    assert_eq!(parsed[2].event_id, "rt-c");
}

#[test]
fn roundtrip_preserves_data() {
    let event = network_event("rt-data", "api.github.com");
    let mut buf = Vec::new();
    write_event(&mut buf, &event).unwrap();

    let parsed = read_events_from_str(&String::from_utf8(buf).unwrap()).unwrap();
    assert_eq!(parsed[0].event_type, PolicyEventType::NetworkEgress);

    match &parsed[0].data {
        PolicyEventData::Network(n) => {
            assert_eq!(n.host, "api.github.com");
            assert_eq!(n.port, 443);
        }
        other => panic!("expected Network data, got {:?}", other),
    }
}

#[test]
fn blank_lines_skipped() {
    let event = file_event("bl-1");
    let line = serde_json::to_string(&event).unwrap();
    let jsonl = format!("{}\n\n\n{}\n", line, line);

    let parsed = read_events_from_str(&jsonl).unwrap();
    assert_eq!(parsed.len(), 2);
}

#[test]
fn empty_input_returns_empty_vec() {
    let parsed = read_events_from_str("").unwrap();
    assert!(parsed.is_empty());
}

#[test]
fn whitespace_only_input_returns_empty_vec() {
    let parsed = read_events_from_str("   \n  \n  ").unwrap();
    assert!(parsed.is_empty());
}

#[test]
fn filter_by_single_type() {
    let events = vec![
        file_event("f-1"),
        network_event("n-1", "x.com"),
        file_event("f-2"),
        command_event("c-1"),
    ];

    let filtered = filter_events(events, Some(&[PolicyEventType::FileRead]));
    assert_eq!(filtered.len(), 2);
    assert_eq!(filtered[0].event_id, "f-1");
    assert_eq!(filtered[1].event_id, "f-2");
}

#[test]
fn filter_by_multiple_types() {
    let events = vec![
        file_event("f-1"),
        network_event("n-1", "x.com"),
        command_event("c-1"),
    ];

    let filtered = filter_events(
        events,
        Some(&[PolicyEventType::FileRead, PolicyEventType::CommandExec]),
    );
    assert_eq!(filtered.len(), 2);
    assert_eq!(filtered[0].event_id, "f-1");
    assert_eq!(filtered[1].event_id, "c-1");
}

#[test]
fn filter_none_returns_all() {
    let events = vec![
        file_event("a"),
        network_event("b", "x.com"),
        command_event("c"),
    ];

    let filtered = filter_events(events, None);
    assert_eq!(filtered.len(), 3);
}

#[test]
fn filter_no_match_returns_empty() {
    let events = vec![file_event("f-1"), file_event("f-2")];
    let filtered = filter_events(events, Some(&[PolicyEventType::NetworkEgress]));
    assert!(filtered.is_empty());
}

#[test]
fn invalid_json_line_returns_error() {
    let jsonl = "not valid json\n";
    let result = read_events_from_str(jsonl);
    assert!(result.is_err());
}
