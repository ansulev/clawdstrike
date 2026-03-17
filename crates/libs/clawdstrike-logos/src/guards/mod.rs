//! Per-guard formula translation.

mod egress_allowlist;
mod forbidden_path;
mod mcp_tool;
mod path_allowlist;
mod shell_command;

use logos_ffi::Formula;

/// Translate a guard configuration into Logos Layer 3 normative formulas.
pub trait GuardFormulas {
    fn to_formulas(&self, agent: &logos_ffi::AgentId) -> Vec<Formula>;
}
