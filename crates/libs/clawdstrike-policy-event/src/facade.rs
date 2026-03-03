//! PolicyLabHandle -- JSON-in/JSON-out facade for cross-language bindings.

use serde::Serialize;

use crate::ocsf::policy_events_to_ocsf_jsonl;
use crate::stream::read_events_from_str;
use crate::synth::{build_candidate_policy, collect_stats};

/// Synthesis result containing the generated policy YAML and risk notes.
#[derive(Clone, Debug, Serialize)]
pub struct SynthResult {
    pub policy_yaml: String,
    pub risks: Vec<String>,
}

/// Re-export SimulationResult as the facade's simulate return type.
#[cfg(feature = "simulate")]
pub type SimulateResult = crate::simulate::SimulationResult;

/// JSON-in/JSON-out handle for policy lab operations.
///
/// Holds a policy YAML string. Provides methods that accept JSONL event
/// strings and return JSON/YAML output, suitable for FFI/WASM/PyO3 bindings.
pub struct PolicyLabHandle {
    #[cfg_attr(not(feature = "simulate"), allow(dead_code))]
    policy_yaml: String,
}

impl PolicyLabHandle {
    /// Create a new handle with the given policy YAML.
    pub fn new(policy_yaml: &str) -> anyhow::Result<Self> {
        // Validate the YAML parses as a Policy.
        let _policy: clawdstrike::Policy = serde_yaml::from_str(policy_yaml)?;
        Ok(Self {
            policy_yaml: policy_yaml.to_string(),
        })
    }

    /// Synthesize a policy from observed events (JSONL).
    ///
    /// This is a static method: it does not use the handle's policy.
    pub fn synth(events_jsonl: &str) -> anyhow::Result<SynthResult> {
        let events = read_events_from_str(events_jsonl)?;
        let stats = collect_stats(&events);
        let policy = build_candidate_policy(&stats, None, true);
        let policy_yaml = policy.to_yaml()?;

        let mut risks = Vec::new();
        if stats.shell_commands > 0 {
            risks.push(format!(
                "Observed {} shell command(s) - review shell guard configuration",
                stats.shell_commands
            ));
        }
        if stats.hosts.len() > 10 {
            risks.push(format!(
                "Observed {} distinct egress hosts - review for overly broad allowlist",
                stats.hosts.len()
            ));
        }
        if stats.total_events == 0 {
            risks.push("No events provided - generated policy has minimal controls".to_string());
        }

        Ok(SynthResult { policy_yaml, risks })
    }

    /// Simulate events against this handle's policy.
    ///
    /// Creates a new async runtime per call — suitable for FFI/WASM contexts.
    ///
    /// Requires the `simulate` feature (enabled by default).
    #[cfg(feature = "simulate")]
    pub fn simulate(&self, events_jsonl: &str) -> anyhow::Result<SimulateResult> {
        let events = read_events_from_str(events_jsonl)?;

        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(crate::simulate::replay_events(
            &self.policy_yaml,
            &events,
            false,
        ))
    }

    /// Convert events JSONL to OCSF JSONL.
    pub fn to_ocsf(events_jsonl: &str) -> anyhow::Result<String> {
        let events = read_events_from_str(events_jsonl)?;
        policy_events_to_ocsf_jsonl(&events)
    }

    /// Convert events JSONL to timeline JSONL.
    pub fn to_timeline(events_jsonl: &str) -> anyhow::Result<String> {
        let events = read_events_from_str(events_jsonl)?;
        let timeline = crate::bridge::policy_events_to_timeline(&events);

        let mut lines = Vec::with_capacity(timeline.len());
        for te in &timeline {
            let line = serde_json::to_string(te)?;
            lines.push(line);
        }
        Ok(lines.join("\n"))
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::unwrap_used)]

    use super::*;
    use crate::event::{FileEventData, PolicyEvent, PolicyEventData, PolicyEventType};
    use chrono::Utc;

    fn sample_jsonl() -> String {
        let event = PolicyEvent {
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
        };
        serde_json::to_string(&event).unwrap()
    }

    #[test]
    fn synth_produces_valid_yaml() {
        let result = PolicyLabHandle::synth(&sample_jsonl()).unwrap();
        assert!(!result.policy_yaml.is_empty());
        // Verify it's valid YAML that parses as a Policy.
        let _policy: clawdstrike::Policy = serde_yaml::from_str(&result.policy_yaml).unwrap();
    }

    #[test]
    fn to_ocsf_produces_json() {
        let ocsf = PolicyLabHandle::to_ocsf(&sample_jsonl()).unwrap();
        assert!(!ocsf.is_empty());
        let _parsed: serde_json::Value = serde_json::from_str(&ocsf).unwrap();
    }

    #[test]
    fn to_timeline_produces_json() {
        let timeline = PolicyLabHandle::to_timeline(&sample_jsonl()).unwrap();
        assert!(!timeline.is_empty());
        let _parsed: serde_json::Value = serde_json::from_str(&timeline).unwrap();
    }

    #[test]
    fn new_rejects_invalid_yaml() {
        let result = PolicyLabHandle::new("not: valid: policy: yaml: {{{}}}");
        assert!(result.is_err());
    }

    #[test]
    fn new_rejects_non_policy_yaml() {
        let result = PolicyLabHandle::new("foo: bar\nbaz: 42");
        assert!(result.is_err());
    }

    #[test]
    fn synth_rejects_malformed_jsonl() {
        let result = PolicyLabHandle::synth("this is not json");
        assert!(result.is_err());
    }

    #[test]
    fn to_ocsf_rejects_malformed_jsonl() {
        let result = PolicyLabHandle::to_ocsf("{bad json");
        assert!(result.is_err());
    }

    #[test]
    fn to_timeline_rejects_malformed_jsonl() {
        let result = PolicyLabHandle::to_timeline("<<<invalid>>>");
        assert!(result.is_err());
    }

    #[test]
    fn synth_empty_input_produces_risk_warning() {
        let result = PolicyLabHandle::synth("").unwrap();
        assert!(result
            .risks
            .iter()
            .any(|r| r.contains("No events provided")));
    }
}
