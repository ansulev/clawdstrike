//! Policy-to-formula compiler.

use clawdstrike::policy::{GuardConfigs, Policy};
use logos_ffi::{AgentId, Formula};

use crate::guards::GuardFormulas;

pub trait PolicyCompiler {
    fn compile_guards(&self, guards: &GuardConfigs) -> Vec<Formula>;

    fn compile_policy(&self, policy: &Policy) -> Vec<Formula> {
        self.compile_guards(&policy.guards)
    }
}

pub struct DefaultPolicyCompiler {
    agent: AgentId,
}

impl DefaultPolicyCompiler {
    pub fn new(agent: AgentId) -> Self {
        Self { agent }
    }

    pub fn agent(&self) -> &AgentId {
        &self.agent
    }
}

impl PolicyCompiler for DefaultPolicyCompiler {
    fn compile_guards(&self, guards: &GuardConfigs) -> Vec<Formula> {
        let mut formulas = Vec::new();

        if let Some(ref cfg) = guards.forbidden_path {
            formulas.extend(cfg.to_formulas(&self.agent));
        }

        if let Some(ref cfg) = guards.path_allowlist {
            formulas.extend(cfg.to_formulas(&self.agent));
        }

        if let Some(ref cfg) = guards.egress_allowlist {
            formulas.extend(cfg.to_formulas(&self.agent));
        }

        if let Some(ref cfg) = guards.shell_command {
            formulas.extend(cfg.to_formulas(&self.agent));
        }

        if let Some(ref cfg) = guards.mcp_tool {
            formulas.extend(cfg.to_formulas(&self.agent));
        }

        formulas
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clawdstrike::guards::{
        EgressAllowlistConfig, ForbiddenPathConfig, McpToolConfig, PathAllowlistConfig,
        ShellCommandConfig,
    };

    fn test_agent() -> AgentId {
        AgentId::new("test-agent")
    }

    #[test]
    fn empty_guards_produce_no_formulas() {
        let compiler = DefaultPolicyCompiler::new(test_agent());
        let guards = GuardConfigs::default();
        let formulas = compiler.compile_guards(&guards);
        assert!(formulas.is_empty());
    }

    #[test]
    fn compile_guards_collects_all_guard_formulas() {
        let compiler = DefaultPolicyCompiler::new(test_agent());
        let guards = GuardConfigs {
            forbidden_path: Some(ForbiddenPathConfig {
                enabled: true,
                patterns: Some(vec!["/etc/shadow".to_string()]),
                exceptions: vec![],
                additional_patterns: vec![],
                remove_patterns: vec![],
            }),
            path_allowlist: Some(PathAllowlistConfig {
                enabled: true,
                file_access_allow: vec!["/app/**".to_string()],
                file_write_allow: vec![],
                patch_allow: vec![],
            }),
            egress_allowlist: Some(EgressAllowlistConfig {
                enabled: true,
                allow: vec!["api.openai.com".to_string()],
                block: vec![],
                default_action: None,
                additional_allow: vec![],
                remove_allow: vec![],
                additional_block: vec![],
                remove_block: vec![],
            }),
            shell_command: Some(ShellCommandConfig {
                enabled: true,
                forbidden_patterns: vec!["rm -rf /".to_string()],
                enforce_forbidden_paths: true,
            }),
            mcp_tool: Some(McpToolConfig {
                enabled: true,
                allow: vec![],
                block: vec!["shell_exec".to_string()],
                require_confirmation: vec![],
                default_action: None,
                max_args_size: None,
                additional_allow: vec![],
                remove_allow: vec![],
                additional_block: vec![],
                remove_block: vec![],
            }),
            ..GuardConfigs::default()
        };

        let formulas = compiler.compile_guards(&guards);

        // 1 forbidden_path prohibition
        // + 1 path_allowlist permission
        // + 1 egress permission + 1 egress default permission
        // + 1 shell prohibition
        // + 1 mcp prohibition + 1 mcp default permission
        // = 7 formulas
        assert_eq!(formulas.len(), 7);

        // Verify we have a mix of Prohibition and Permission
        let prohibition_count = formulas
            .iter()
            .filter(|f| matches!(f, Formula::Prohibition(_, _)))
            .count();
        let permission_count = formulas
            .iter()
            .filter(|f| matches!(f, Formula::Permission(_, _)))
            .count();
        assert_eq!(prohibition_count, 3);
        assert_eq!(permission_count, 4);
    }

    #[test]
    fn compile_policy_delegates_to_compile_guards() {
        let compiler = DefaultPolicyCompiler::new(test_agent());
        let mut policy = Policy::default();
        policy.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["/etc/shadow".to_string()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });

        let formulas = compiler.compile_policy(&policy);
        assert_eq!(formulas.len(), 1);
        assert!(matches!(&formulas[0], Formula::Prohibition(_, _)));
    }

    #[test]
    fn all_formulas_are_normative() {
        let compiler = DefaultPolicyCompiler::new(test_agent());
        let mut policy = Policy::default();
        policy.guards.forbidden_path = Some(ForbiddenPathConfig::default());
        policy.guards.egress_allowlist = Some(EgressAllowlistConfig::default());
        policy.guards.shell_command = Some(ShellCommandConfig::default());
        policy.guards.mcp_tool = Some(McpToolConfig::default());

        let formulas = compiler.compile_policy(&policy);
        assert!(!formulas.is_empty());

        for formula in &formulas {
            assert_eq!(
                formula.required_layer(),
                3,
                "expected Layer 3 (normative), got layer {} for: {formula}",
                formula.required_layer()
            );
        }
    }

    #[test]
    fn disabled_guards_skipped() {
        let compiler = DefaultPolicyCompiler::new(test_agent());
        let guards = GuardConfigs {
            forbidden_path: Some(ForbiddenPathConfig {
                enabled: false,
                patterns: Some(vec!["/etc/shadow".to_string()]),
                exceptions: vec![],
                additional_patterns: vec![],
                remove_patterns: vec![],
            }),
            shell_command: Some(ShellCommandConfig {
                enabled: false,
                forbidden_patterns: vec!["rm".to_string()],
                enforce_forbidden_paths: true,
            }),
            ..GuardConfigs::default()
        };

        let formulas = compiler.compile_guards(&guards);
        assert!(formulas.is_empty());
    }
}
