//! Per-guard formula translation.

mod computer_use;
mod egress_allowlist;
mod forbidden_path;
mod input_injection_capability;
mod jailbreak;
mod mcp_tool;
mod patch_integrity;
mod path_allowlist;
mod prompt_injection;
mod remote_desktop_side_channel;
mod secret_leak;
mod shell_command;

use logos_ffi::Formula;

/// Translate a guard configuration into Logos Layer 3 normative formulas.
pub trait GuardFormulas {
    fn to_formulas(&self, agent: &logos_ffi::AgentId) -> Vec<Formula>;
}
