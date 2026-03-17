//! Formula translation for [`ShellCommandConfig`].
//!
//! Each forbidden regex pattern becomes a `Prohibition` formula. Since Z3 cannot
//! directly reason about regex matching, the translation is necessarily an
//! over-approximation: the pattern string itself is used as the atom parameter.

use clawdstrike::guards::ShellCommandConfig;
use logos_ffi::{AgentId, Formula};

use super::GuardFormulas;
use crate::atoms::ActionAtom;

impl GuardFormulas for ShellCommandConfig {
    /// Translate shell-command configuration into normative formulas.
    ///
    /// For each forbidden pattern `pat`:
    ///   `F_agent(exec(pat))` -- Prohibition on executing commands matching pat
    fn to_formulas(&self, agent: &AgentId) -> Vec<Formula> {
        if !self.enabled {
            return vec![];
        }

        self.forbidden_patterns
            .iter()
            .map(|pattern| {
                let atom = ActionAtom::exec(pattern);
                Formula::prohibition(agent.clone(), atom.to_formula())
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_agent() -> AgentId {
        AgentId::new("test-agent")
    }

    #[test]
    fn disabled_guard_produces_no_formulas() {
        let cfg = ShellCommandConfig {
            enabled: false,
            forbidden_patterns: vec!["rm -rf /".to_string()],
            enforce_forbidden_paths: true,
        };
        assert!(cfg.to_formulas(&test_agent()).is_empty());
    }

    #[test]
    fn each_pattern_becomes_prohibition() {
        let cfg = ShellCommandConfig {
            enabled: true,
            forbidden_patterns: vec![
                r"(?i)\brm\s+(-rf?|--recursive)\s+/\s*(?:$|\*)".to_string(),
                r"(?i)\bcurl\s+[^|]*\|\s*(bash|sh|zsh)\b".to_string(),
            ],
            enforce_forbidden_paths: true,
        };
        let formulas = cfg.to_formulas(&test_agent());

        assert_eq!(formulas.len(), 2);
        for f in &formulas {
            assert!(matches!(f, Formula::Prohibition(_, _)));
        }
    }

    #[test]
    fn default_config_produces_prohibitions() {
        let cfg = ShellCommandConfig::default();
        let formulas = cfg.to_formulas(&test_agent());

        // Default config has several forbidden patterns
        assert!(!formulas.is_empty());
        for f in &formulas {
            assert!(matches!(f, Formula::Prohibition(_, _)));
        }
    }
}
