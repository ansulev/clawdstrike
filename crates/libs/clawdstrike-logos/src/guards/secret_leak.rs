//! Formula translation for [`SecretLeakConfig`].

use clawdstrike::guards::{SecretLeakConfig, Severity};
use logos_ffi::{AgentId, Formula};

use super::GuardFormulas;
use crate::atoms::ActionAtom;

fn custom_permission(agent: &AgentId, detail: impl Into<String>) -> Formula {
    Formula::permission(agent.clone(), ActionAtom::custom(detail).to_formula())
}

fn custom_prohibition(agent: &AgentId, detail: impl Into<String>) -> Formula {
    Formula::prohibition(agent.clone(), ActionAtom::custom(detail).to_formula())
}

fn severity_rank(severity: &Severity) -> u8 {
    match severity {
        Severity::Info => 0,
        Severity::Warning => 1,
        Severity::Error => 2,
        Severity::Critical => 3,
    }
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

impl GuardFormulas for SecretLeakConfig {
    fn to_formulas(&self, agent: &AgentId) -> Vec<Formula> {
        if !self.enabled {
            return vec![];
        }

        let mut formulas = vec![custom_permission(agent, "guard:secret_leak:enabled")];

        formulas.extend(
            self.effective_patterns()
                .into_iter()
                .filter(|pattern| {
                    severity_rank(&pattern.severity) >= severity_rank(&self.severity_threshold)
                })
                .flat_map(|pattern| {
                    let pattern_token = stable_token(&pattern.name);
                    [
                        custom_prohibition(
                            agent,
                            format!("secret_leak:file_write:{pattern_token}"),
                        ),
                        custom_prohibition(agent, format!("secret_leak:patch:{pattern_token}")),
                    ]
                }),
        );

        formulas
    }
}
