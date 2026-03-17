//! Per-guard formula translation.
//!
//! Each guard configuration type is translated into a set of Logos normative
//! formulas via the [`GuardFormulas`] trait.

mod egress_allowlist;
mod forbidden_path;
mod mcp_tool;
mod path_allowlist;
mod shell_command;

// Trait implementations for guard config types are provided in sub-modules.
// They are automatically available when `GuardFormulas` is in scope.

use logos_ffi::Formula;

/// Trait for translating a guard configuration into Logos normative formulas.
///
/// Each guard config implements this trait to produce a [`Vec<Formula>`] that
/// encodes its security semantics in Logos Layer 3 (normative) operators.
pub trait GuardFormulas {
    /// Translate this guard configuration into normative formulas for the
    /// given agent.
    fn to_formulas(&self, agent: &logos_ffi::AgentId) -> Vec<Formula>;
}
