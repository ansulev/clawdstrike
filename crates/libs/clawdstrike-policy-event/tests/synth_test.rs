#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

use chrono::Utc;
use clawdstrike_policy_event::event::*;
use clawdstrike_policy_event::synth::{build_candidate_policy, collect_stats};

fn sample_events() -> Vec<PolicyEvent> {
    vec![
        PolicyEvent {
            event_id: "synth-1".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::File(FileEventData {
                path: "/workspace/project/src/main.rs".to_string(),
                operation: Some("read".to_string()),
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "synth-2".to_string(),
            event_type: PolicyEventType::FileWrite,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::File(FileEventData {
                path: "/workspace/project/out/result.json".to_string(),
                operation: Some("write".to_string()),
                content_base64: None,
                content: Some("{}".to_string()),
                content_hash: None,
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "synth-3".to_string(),
            event_type: PolicyEventType::NetworkEgress,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::Network(NetworkEventData {
                host: "api.github.com".to_string(),
                port: 443,
                protocol: Some("tcp".to_string()),
                url: None,
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "synth-4".to_string(),
            event_type: PolicyEventType::NetworkEgress,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::Network(NetworkEventData {
                host: "registry.npmjs.org".to_string(),
                port: 443,
                protocol: Some("tcp".to_string()),
                url: None,
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "synth-5".to_string(),
            event_type: PolicyEventType::CommandExec,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::Command(CommandEventData {
                command: "ls".to_string(),
                args: vec!["-la".to_string()],
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "synth-6".to_string(),
            event_type: PolicyEventType::ToolCall,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::Tool(ToolEventData {
                tool_name: "fs_read".to_string(),
                parameters: serde_json::json!({}),
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "synth-7".to_string(),
            event_type: PolicyEventType::PatchApply,
            timestamp: Utc::now(),
            session_id: Some("sess-1".to_string()),
            data: PolicyEventData::Patch(PatchEventData {
                file_path: "/workspace/project/src/lib.rs".to_string(),
                patch_content: "@@ -1,3 +1,4 @@\n+use std::io;\n".to_string(),
                patch_hash: None,
            }),
            metadata: None,
            context: None,
        },
    ]
}

#[test]
fn collect_stats_counts_correctly() {
    let stats = collect_stats(&sample_events());

    assert_eq!(stats.total_events, 7);
    assert_eq!(stats.file_writes, 1);
    assert_eq!(stats.egress_calls, 2);
    assert_eq!(stats.shell_commands, 1);
    assert_eq!(stats.mcp_tool_calls, 1);
    assert_eq!(stats.patches, 1);
}

#[test]
fn collect_stats_tracks_capabilities() {
    let stats = collect_stats(&sample_events());

    assert!(stats.capabilities.contains("file_access"));
    assert!(stats.capabilities.contains("file_write"));
    assert!(stats.capabilities.contains("egress"));
    assert!(stats.capabilities.contains("shell"));
    assert!(stats.capabilities.contains("mcp_tool"));
    assert!(stats.capabilities.contains("patch"));
}

#[test]
fn collect_stats_tracks_hosts() {
    let stats = collect_stats(&sample_events());

    assert_eq!(stats.hosts.len(), 2);
    assert!(stats.hosts.contains("api.github.com"));
    assert!(stats.hosts.contains("registry.npmjs.org"));
}

#[test]
fn collect_stats_tracks_timestamps() {
    let stats = collect_stats(&sample_events());

    assert!(stats.earliest_ts.is_some());
    assert!(stats.latest_ts.is_some());
}

#[test]
fn collect_stats_empty_input() {
    let stats = collect_stats(&[]);

    assert_eq!(stats.total_events, 0);
    assert!(stats.capabilities.is_empty());
    assert!(stats.hosts.is_empty());
    assert!(stats.earliest_ts.is_none());
}

#[test]
fn build_policy_produces_valid_yaml() {
    let stats = collect_stats(&sample_events());
    let policy = build_candidate_policy(&stats, None, false);

    let yaml = policy.to_yaml().unwrap();
    assert!(!yaml.is_empty());

    // Round-trip: parse the YAML back as a Policy
    let parsed: clawdstrike::Policy = serde_yaml::from_str(&yaml).unwrap();
    parsed.validate().unwrap();
}

#[test]
fn build_policy_includes_safety_guards() {
    let stats = collect_stats(&sample_events());
    let policy = build_candidate_policy(&stats, None, false);

    assert!(policy.guards.forbidden_path.is_some());
    assert!(policy.guards.secret_leak.is_some());
}

#[test]
fn build_policy_includes_egress_allowlist() {
    let stats = collect_stats(&sample_events());
    let policy = build_candidate_policy(&stats, None, false);

    let egress = policy.guards.egress_allowlist.as_ref().unwrap();
    assert!(egress.allow.contains(&"api.github.com".to_string()));
    assert!(egress.allow.contains(&"registry.npmjs.org".to_string()));
}

#[test]
fn build_policy_includes_path_allowlist() {
    let stats = collect_stats(&sample_events());
    let policy = build_candidate_policy(&stats, None, false);

    assert!(policy.guards.path_allowlist.is_some());
    let allowlist = policy.guards.path_allowlist.as_ref().unwrap();
    assert!(!allowlist.file_access_allow.is_empty());
}

#[test]
fn build_policy_with_posture() {
    let stats = collect_stats(&sample_events());
    let policy = build_candidate_policy(&stats, None, true);

    let posture = policy.posture.as_ref().unwrap();
    assert_eq!(posture.initial, "work");
    assert!(posture.states.contains_key("work"));
    assert!(posture.states.contains_key("quarantine"));

    let work = &posture.states["work"];
    assert!(!work.capabilities.is_empty());

    // Budgets should have margins above observed counts
    assert!(!work.budgets.is_empty());
}

#[test]
fn build_policy_with_extends() {
    let stats = collect_stats(&sample_events());
    let policy = build_candidate_policy(&stats, Some("clawdstrike:default".to_string()), false);

    assert_eq!(policy.extends.as_deref(), Some("clawdstrike:default"));
}
