//! WASM bindings for PolicyLab operations.
//!
//! Note: `simulate` is not available in WASM because it requires tokio
//! (which depends on mio, incompatible with wasm32-unknown-unknown).
//! Use `synth`, `to_ocsf`, and `to_timeline` instead.

use wasm_bindgen::prelude::*;

use clawdstrike_policy_event::facade::PolicyLabHandle;

use crate::detect::serialize_camel_case;

fn throw_js_error(message: impl std::fmt::Display) -> ! {
    wasm_bindgen::throw_str(&message.to_string())
}

/// WASM wrapper around `PolicyLabHandle` for policy validation.
///
/// Simulation is not available in WASM. Use the native FFI or PyO3
/// bindings for simulate support.
#[wasm_bindgen]
pub struct WasmPolicyLab {
    #[allow(dead_code)]
    inner: PolicyLabHandle,
}

#[wasm_bindgen]
impl WasmPolicyLab {
    /// Create a new PolicyLab handle from a policy YAML string.
    ///
    /// Validates that the YAML is a well-formed policy.
    #[wasm_bindgen(constructor)]
    pub fn new(policy_yaml: &str) -> Result<WasmPolicyLab, JsError> {
        let inner = PolicyLabHandle::new(policy_yaml).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(Self { inner })
    }
}

/// Synthesize a policy from observed events (JSONL).
///
/// Returns a camelCase JSON string with `policyYaml` and `risks`.
#[wasm_bindgen]
pub fn policy_lab_synth(events_jsonl: &str) -> String {
    let result = PolicyLabHandle::synth(events_jsonl).unwrap_or_else(|e| throw_js_error(e));
    serialize_camel_case(&result).unwrap_or_else(|e| throw_js_error(format!("{e:?}")))
}

/// Convert events JSONL to OCSF JSONL.
#[wasm_bindgen]
pub fn policy_lab_to_ocsf(events_jsonl: &str) -> String {
    PolicyLabHandle::to_ocsf(events_jsonl).unwrap_or_else(|e| throw_js_error(e))
}

/// Convert events JSONL to timeline JSONL.
#[wasm_bindgen]
pub fn policy_lab_to_timeline(events_jsonl: &str) -> String {
    PolicyLabHandle::to_timeline(events_jsonl).unwrap_or_else(|e| throw_js_error(e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_event_jsonl() -> String {
        let event = serde_json::json!({
            "event_id": "evt-wasm-1",
            "event_type": "file_read",
            "timestamp": "2026-03-03T00:00:00Z",
            "data": {
                "type": "file",
                "path": "/tmp/test.txt"
            }
        });
        serde_json::to_string(&event).unwrap()
    }

    #[test]
    fn synth_returns_camel_case_json() {
        let jsonl = sample_event_jsonl();
        let result = policy_lab_synth(&jsonl);
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert!(v.get("policyYaml").is_some());
        assert!(v.get("risks").is_some());
    }

    #[test]
    fn to_ocsf_returns_json() {
        let jsonl = sample_event_jsonl();
        let result = policy_lab_to_ocsf(&jsonl);
        assert!(!result.is_empty());
        let _parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
    }

    #[test]
    fn to_timeline_returns_json() {
        let jsonl = sample_event_jsonl();
        let result = policy_lab_to_timeline(&jsonl);
        assert!(!result.is_empty());
        let _parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
    }

    #[test]
    fn new_validates_yaml() {
        let lab = WasmPolicyLab::new("version: \"1.1.0\"\nname: test\n");
        assert!(lab.is_ok());
    }

    // Note: error-path tests (e.g. invalid YAML → JsError) can only run on
    // actual wasm32 targets because `JsError::new()` panics on native.
}
