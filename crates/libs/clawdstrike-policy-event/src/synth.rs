//! Pure policy synthesis logic: observe events and generate a candidate policy.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use clawdstrike::guards::{normalize_path_for_policy, EgressAllowlistConfig, ForbiddenPathConfig};
use clawdstrike::guards::{PathAllowlistConfig, SecretLeakConfig};
use clawdstrike::policy::POLICY_SCHEMA_VERSION;
use clawdstrike::{Policy, PostureConfig, PostureState, PostureTransition, TransitionTrigger};
use hush_proxy::policy::PolicyAction;

use crate::event::{PolicyEvent, PolicyEventData, PolicyEventType};

/// Aggregated statistics from a set of observed policy events.
#[derive(Debug, Clone, Default)]
pub struct ObservedStats {
    pub total_events: u64,
    pub earliest_ts: Option<String>,
    pub latest_ts: Option<String>,
    pub capabilities: BTreeSet<String>,
    pub hosts: BTreeSet<String>,
    pub file_access_paths: BTreeSet<String>,
    pub file_write_paths: BTreeSet<String>,
    pub patch_paths: BTreeSet<String>,
    pub file_writes: u64,
    pub egress_calls: u64,
    pub shell_commands: u64,
    pub mcp_tool_calls: u64,
    pub patches: u64,
    pub custom_calls: u64,
}

/// Collect aggregate statistics from a slice of policy events.
#[must_use]
pub fn collect_stats(events: &[PolicyEvent]) -> ObservedStats {
    let mut stats = ObservedStats::default();

    for event in events {
        stats.total_events += 1;

        let ts = event.timestamp.to_rfc3339();
        if stats
            .earliest_ts
            .as_ref()
            .is_none_or(|existing| ts < *existing)
        {
            stats.earliest_ts = Some(ts.clone());
        }
        if stats
            .latest_ts
            .as_ref()
            .is_none_or(|existing| ts > *existing)
        {
            stats.latest_ts = Some(ts.clone());
        }

        match (&event.event_type, &event.data) {
            (PolicyEventType::FileRead, PolicyEventData::File(file)) => {
                stats.capabilities.insert("file_access".to_string());
                stats.file_access_paths.insert(file.path.clone());
            }
            (PolicyEventType::FileWrite, PolicyEventData::File(file)) => {
                stats.capabilities.insert("file_access".to_string());
                stats.capabilities.insert("file_write".to_string());
                stats.file_access_paths.insert(file.path.clone());
                stats.file_write_paths.insert(file.path.clone());
                stats.file_writes += 1;
            }
            (PolicyEventType::NetworkEgress, PolicyEventData::Network(network)) => {
                stats.capabilities.insert("egress".to_string());
                stats.hosts.insert(network.host.clone());
                stats.egress_calls += 1;
            }
            (PolicyEventType::CommandExec, PolicyEventData::Command(_)) => {
                stats.capabilities.insert("shell".to_string());
                stats.shell_commands += 1;
            }
            (PolicyEventType::PatchApply, PolicyEventData::Patch(patch)) => {
                stats.capabilities.insert("patch".to_string());
                stats.capabilities.insert("file_write".to_string());
                stats.patch_paths.insert(patch.file_path.clone());
                stats.patches += 1;
            }
            (PolicyEventType::ToolCall, PolicyEventData::Tool(_)) => {
                stats.capabilities.insert("mcp_tool".to_string());
                stats.mcp_tool_calls += 1;
            }
            (PolicyEventType::Custom, _) => {
                stats.capabilities.insert("custom".to_string());
                stats.custom_calls += 1;
            }
            _ => {}
        }
    }

    stats
}

/// Build a candidate `Policy` from observed statistics.
#[must_use]
pub fn build_candidate_policy(
    stats: &ObservedStats,
    extends: Option<String>,
    with_posture: bool,
) -> Policy {
    let mut policy = Policy {
        version: POLICY_SCHEMA_VERSION.to_string(),
        name: "Synthesized Policy".to_string(),
        description: "Auto-generated from observed policy events".to_string(),
        extends,
        ..Policy::default()
    };

    policy.guards.forbidden_path = Some(ForbiddenPathConfig::with_defaults());
    policy.guards.secret_leak = Some(SecretLeakConfig::default());

    let file_access_allow = derive_path_patterns(&stats.file_access_paths);
    let file_write_allow = derive_path_patterns(&stats.file_write_paths);
    let patch_allow = derive_path_patterns(&stats.patch_paths);

    if !file_access_allow.is_empty() || !file_write_allow.is_empty() || !patch_allow.is_empty() {
        policy.guards.path_allowlist = Some(PathAllowlistConfig {
            enabled: true,
            file_access_allow,
            file_write_allow,
            patch_allow,
        });
    }

    if !stats.hosts.is_empty() {
        policy.guards.egress_allowlist = Some(EgressAllowlistConfig {
            enabled: true,
            allow: stats.hosts.iter().cloned().collect(),
            block: Vec::new(),
            default_action: Some(PolicyAction::Block),
            additional_allow: Vec::new(),
            remove_allow: Vec::new(),
            additional_block: Vec::new(),
            remove_block: Vec::new(),
        });
    }

    if with_posture {
        let mut states = BTreeMap::new();
        let capabilities = ordered_capabilities(&stats.capabilities);

        let mut budgets: HashMap<String, i64> = HashMap::new();
        maybe_insert_budget(&mut budgets, "file_writes", stats.file_writes);
        maybe_insert_budget(&mut budgets, "egress_calls", stats.egress_calls);
        maybe_insert_budget(&mut budgets, "shell_commands", stats.shell_commands);
        maybe_insert_budget(&mut budgets, "mcp_tool_calls", stats.mcp_tool_calls);
        maybe_insert_budget(&mut budgets, "patches", stats.patches);
        maybe_insert_budget(&mut budgets, "custom_calls", stats.custom_calls);

        states.insert(
            "work".to_string(),
            PostureState {
                description: Some("Synthesized working state".to_string()),
                capabilities,
                budgets,
            },
        );

        states.insert(
            "quarantine".to_string(),
            PostureState {
                description: Some("Lockdown state on critical violations".to_string()),
                capabilities: Vec::new(),
                budgets: HashMap::new(),
            },
        );

        policy.posture = Some(PostureConfig {
            initial: "work".to_string(),
            states,
            transitions: vec![PostureTransition {
                from: "*".to_string(),
                to: "quarantine".to_string(),
                on: TransitionTrigger::CriticalViolation,
                after: None,
                requires: Vec::new(),
            }],
        });
    }

    policy
}

fn maybe_insert_budget(budgets: &mut HashMap<String, i64>, key: &str, observed: u64) {
    if observed == 0 {
        return;
    }

    let margin = std::cmp::max(5, ((observed as f64) * 0.2).ceil() as u64);
    let value = observed.saturating_add(margin);
    budgets.insert(key.to_string(), value as i64);
}

fn ordered_capabilities(capabilities: &BTreeSet<String>) -> Vec<String> {
    const ORDER: &[&str] = &[
        "file_access",
        "file_write",
        "egress",
        "mcp_tool",
        "patch",
        "shell",
        "custom",
    ];

    ORDER
        .iter()
        .filter(|capability| capabilities.contains(**capability))
        .map(|capability| capability.to_string())
        .collect()
}

fn derive_path_patterns(paths: &BTreeSet<String>) -> Vec<String> {
    let mut patterns = BTreeSet::new();

    for path in paths {
        let normalized = normalize_path_for_policy(path);
        if normalized.is_empty() {
            continue;
        }

        let dir = normalized
            .rsplit_once('/')
            .map(|(parent, _)| parent)
            .unwrap_or(normalized.as_str());

        let pattern = if normalized.starts_with('/') {
            if dir.is_empty() {
                "/**".to_string()
            } else {
                format!("{}/**", dir)
            }
        } else {
            let trimmed = dir.trim_start_matches("./").trim_start_matches('/');
            if trimmed.is_empty() {
                "**".to_string()
            } else {
                format!("**/{}/**", trimmed)
            }
        };

        patterns.insert(pattern);
    }

    patterns.into_iter().collect()
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::unwrap_used)]

    use super::*;
    use crate::event::{FileEventData, NetworkEventData, ToolEventData};
    use chrono::Utc;

    fn sample_events() -> Vec<PolicyEvent> {
        vec![
            PolicyEvent {
                event_id: "evt-1".to_string(),
                event_type: PolicyEventType::FileRead,
                timestamp: Utc::now(),
                session_id: Some("sess-1".to_string()),
                data: PolicyEventData::File(FileEventData {
                    path: "/workspace/project/src/lib.rs".to_string(),
                    operation: Some("read".to_string()),
                    content_base64: None,
                    content: None,
                    content_hash: None,
                }),
                metadata: None,
                context: None,
            },
            PolicyEvent {
                event_id: "evt-2".to_string(),
                event_type: PolicyEventType::FileWrite,
                timestamp: Utc::now(),
                session_id: Some("sess-1".to_string()),
                data: PolicyEventData::File(FileEventData {
                    path: "/workspace/project/src/lib.rs".to_string(),
                    operation: Some("write".to_string()),
                    content_base64: None,
                    content: None,
                    content_hash: None,
                }),
                metadata: None,
                context: None,
            },
            PolicyEvent {
                event_id: "evt-3".to_string(),
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
                event_id: "evt-4".to_string(),
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
        ]
    }

    #[test]
    fn synth_builds_valid_policy_with_safety_defaults() {
        let stats = collect_stats(&sample_events());
        let policy = build_candidate_policy(&stats, None, false);
        policy
            .validate()
            .expect("synthesized policy should validate");

        assert!(policy.guards.forbidden_path.is_some());
        assert!(policy.guards.secret_leak.is_some());
        assert!(policy.guards.path_allowlist.is_some());
        assert!(policy.guards.egress_allowlist.is_some());
        assert!(policy.posture.is_none());
    }

    #[test]
    fn synth_with_posture_adds_states_and_transition() {
        let stats = collect_stats(&sample_events());
        let policy = build_candidate_policy(&stats, None, true);
        policy
            .validate()
            .expect("synthesized policy should validate");

        let posture = policy.posture.expect("posture should be generated");
        assert_eq!(posture.initial, "work");
        assert!(posture.states.contains_key("work"));
        assert!(posture.states.contains_key("quarantine"));
        assert_eq!(posture.transitions.len(), 1);
        assert_eq!(posture.transitions[0].from, "*");
        assert_eq!(posture.transitions[0].to, "quarantine");
    }

    #[test]
    fn collect_stats_tracks_capabilities() {
        let stats = collect_stats(&sample_events());
        assert_eq!(stats.total_events, 4);
        assert!(stats.capabilities.contains("file_access"));
        assert!(stats.capabilities.contains("file_write"));
        assert!(stats.capabilities.contains("egress"));
        assert!(stats.capabilities.contains("mcp_tool"));
        assert_eq!(stats.file_writes, 1);
        assert_eq!(stats.egress_calls, 1);
        assert_eq!(stats.mcp_tool_calls, 1);
    }
}
