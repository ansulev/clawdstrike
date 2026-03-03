#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

use chrono::Utc;
use clawdstrike_policy_event::event::*;
use clawdstrike_policy_event::simulate::replay_events;

fn permissive_policy_yaml() -> &'static str {
    r#"
version: "1.1.0"
name: Permissive
description: Test permissive policy

guards:
  egress_allowlist:
    allow:
      - "*"
    block: []
    default_action: allow

  patch_integrity:
    max_additions: 10000
    max_deletions: 5000
    require_balance: false
    max_imbalance_ratio: 50.0

settings:
  fail_fast: false
  verbose_logging: true
  session_timeout_secs: 7200
"#
}

fn strict_policy_yaml() -> &'static str {
    r#"
version: "1.1.0"
name: Strict
description: Test strict policy

guards:
  forbidden_path:
    patterns:
      - /etc/shadow
      - /etc/passwd

  egress_allowlist:
    allow:
      - "api.allowed.com"
    block: []
    default_action: block

settings:
  fail_fast: false
"#
}

fn sample_events() -> Vec<PolicyEvent> {
    vec![
        PolicyEvent {
            event_id: "sim-1".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/workspace/src/main.rs".to_string(),
                operation: Some("read".to_string()),
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        },
        PolicyEvent {
            event_id: "sim-2".to_string(),
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
        },
        PolicyEvent {
            event_id: "sim-3".to_string(),
            event_type: PolicyEventType::CommandExec,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::Command(CommandEventData {
                command: "ls".to_string(),
                args: vec!["-la".to_string()],
            }),
            metadata: None,
            context: None,
        },
    ]
}

#[tokio::test]
async fn permissive_allows_all_events() {
    let result = replay_events(permissive_policy_yaml(), &sample_events(), false)
        .await
        .unwrap();

    assert_eq!(result.summary.total, 3);
    assert_eq!(result.summary.allowed, 3);
    assert_eq!(result.summary.blocked, 0);
    assert_eq!(result.summary.warn, 0);
    assert_eq!(result.results.len(), 3);

    for entry in &result.results {
        assert_eq!(entry.outcome, "allowed");
        assert!(entry.decision.allowed);
        assert!(!entry.decision.denied);
    }
}

#[tokio::test]
async fn strict_blocks_forbidden_path() {
    let events = vec![PolicyEvent {
        event_id: "sim-block".to_string(),
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
    }];

    let result = replay_events(strict_policy_yaml(), &events, false)
        .await
        .unwrap();

    assert_eq!(result.summary.total, 1);
    assert_eq!(result.summary.blocked, 1);
    assert_eq!(result.summary.allowed, 0);
    assert_eq!(result.results[0].outcome, "blocked");
    assert!(result.results[0].decision.denied);
}

#[tokio::test]
async fn strict_blocks_unlisted_egress() {
    let events = vec![PolicyEvent {
        event_id: "sim-egress-block".to_string(),
        event_type: PolicyEventType::NetworkEgress,
        timestamp: Utc::now(),
        session_id: None,
        data: PolicyEventData::Network(NetworkEventData {
            host: "evil.example.com".to_string(),
            port: 443,
            protocol: None,
            url: None,
        }),
        metadata: None,
        context: None,
    }];

    let result = replay_events(strict_policy_yaml(), &events, false)
        .await
        .unwrap();

    assert_eq!(result.summary.total, 1);
    assert_eq!(result.summary.blocked, 1);
}

#[tokio::test]
async fn strict_allows_listed_egress() {
    let events = vec![PolicyEvent {
        event_id: "sim-egress-ok".to_string(),
        event_type: PolicyEventType::NetworkEgress,
        timestamp: Utc::now(),
        session_id: None,
        data: PolicyEventData::Network(NetworkEventData {
            host: "api.allowed.com".to_string(),
            port: 443,
            protocol: None,
            url: None,
        }),
        metadata: None,
        context: None,
    }];

    let result = replay_events(strict_policy_yaml(), &events, false)
        .await
        .unwrap();

    assert_eq!(result.summary.total, 1);
    assert_eq!(result.summary.allowed, 1);
}

#[tokio::test]
async fn empty_events_returns_zero_summary() {
    let result = replay_events(permissive_policy_yaml(), &[], false)
        .await
        .unwrap();

    assert_eq!(result.summary.total, 0);
    assert_eq!(result.summary.allowed, 0);
    assert_eq!(result.summary.blocked, 0);
    assert_eq!(result.summary.warn, 0);
    assert!(result.results.is_empty());
}

#[tokio::test]
async fn event_ids_preserved_in_results() {
    let result = replay_events(permissive_policy_yaml(), &sample_events(), false)
        .await
        .unwrap();

    assert_eq!(result.results[0].event_id, "sim-1");
    assert_eq!(result.results[1].event_id, "sim-2");
    assert_eq!(result.results[2].event_id, "sim-3");
}

#[tokio::test]
async fn mixed_allowed_and_blocked() {
    let events = vec![
        // This should be allowed (safe path)
        PolicyEvent {
            event_id: "mix-1".to_string(),
            event_type: PolicyEventType::FileRead,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/workspace/readme.md".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        },
        // This should be blocked (forbidden path)
        PolicyEvent {
            event_id: "mix-2".to_string(),
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
        },
        // This should be allowed (listed host)
        PolicyEvent {
            event_id: "mix-3".to_string(),
            event_type: PolicyEventType::NetworkEgress,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::Network(NetworkEventData {
                host: "api.allowed.com".to_string(),
                port: 443,
                protocol: None,
                url: None,
            }),
            metadata: None,
            context: None,
        },
    ];

    let result = replay_events(strict_policy_yaml(), &events, false)
        .await
        .unwrap();

    assert_eq!(result.summary.total, 3);
    assert!(result.summary.allowed >= 1);
    assert!(result.summary.blocked >= 1);
}
