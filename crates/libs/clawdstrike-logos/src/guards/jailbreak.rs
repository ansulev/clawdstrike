//! Formula translation for [`JailbreakConfig`].

use clawdstrike::guards::JailbreakConfig;
use logos_ffi::{AgentId, Formula};

use super::{custom_permission, custom_prohibition, GuardFormulas};

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
