//! Formula translation for [`InputInjectionCapabilityConfig`].

use clawdstrike::guards::InputInjectionCapabilityConfig;
use logos_ffi::{AgentId, Formula};

use super::GuardFormulas;
use crate::atoms::ActionAtom;

fn custom_permission(agent: &AgentId, detail: impl Into<String>) -> Formula {
    Formula::permission(agent.clone(), ActionAtom::custom(detail).to_formula())
}

fn custom_prohibition(agent: &AgentId, detail: impl Into<String>) -> Formula {
    Formula::prohibition(agent.clone(), ActionAtom::custom(detail).to_formula())
}

fn stable_token(value: &str) -> String {
    let token = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    let trimmed = token.trim_matches('_');
    if trimmed.is_empty() {
        hush_core::hashing::sha256(value.as_bytes()).to_hex()
    } else {
        trimmed.to_string()
    }
}

impl GuardFormulas for InputInjectionCapabilityConfig {
    fn to_formulas(&self, agent: &AgentId) -> Vec<Formula> {
        if !self.enabled {
            return vec![];
        }

        let mut formulas = vec![custom_permission(
            agent,
            "guard:input_injection_capability:enabled",
        )];

        formulas.extend(self.allowed_input_types.iter().map(|input_type| {
            custom_permission(
                agent,
                format!("input_injection:input_type:{}", stable_token(input_type)),
            )
        }));

        if self.require_postcondition_probe {
            formulas.push(custom_prohibition(
                agent,
                "input_injection:missing_postcondition_probe",
            ));
        }

        formulas
    }
}
