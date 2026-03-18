//! Formula translation for [`JailbreakConfig`].

use clawdstrike::guards::JailbreakConfig;
use logos_ffi::{AgentId, Formula};

use super::GuardFormulas;
use crate::atoms::ActionAtom;

fn custom_permission(agent: &AgentId, detail: impl Into<String>) -> Formula {
    Formula::permission(agent.clone(), ActionAtom::custom(detail).to_formula())
}

fn custom_prohibition(agent: &AgentId, detail: impl Into<String>) -> Formula {
    Formula::prohibition(agent.clone(), ActionAtom::custom(detail).to_formula())
}

impl GuardFormulas for JailbreakConfig {
    fn to_formulas(&self, agent: &AgentId) -> Vec<Formula> {
        if !self.enabled {
            return vec![];
        }

        let mut formulas = vec![custom_permission(agent, "guard:jailbreak:enabled")];

        formulas.extend(
            (self.detector.block_threshold..=100)
                .map(|score| custom_prohibition(agent, format!("jailbreak:risk_score:{score}"))),
        );

        formulas
    }
}
