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
use std::fmt::Write as _;

use crate::atoms::ActionAtom;

pub(crate) use self::shell_command::shell_command_formulas;

/// Translate a guard configuration into Logos Layer 3 normative formulas.
pub trait GuardFormulas {
    fn to_formulas(&self, agent: &logos_ffi::AgentId) -> Vec<Formula>;
}

pub(super) fn custom_permission(agent: &logos_ffi::AgentId, detail: impl Into<String>) -> Formula {
    Formula::permission(agent.clone(), ActionAtom::custom(detail).to_formula())
}

pub(super) fn custom_prohibition(agent: &logos_ffi::AgentId, detail: impl Into<String>) -> Formula {
    Formula::prohibition(agent.clone(), ActionAtom::custom(detail).to_formula())
}

pub(super) fn stable_token(value: &str) -> String {
    let mut token = String::new();
    let mut utf8 = [0u8; 4];

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            token.push(ch.to_ascii_lowercase());
            continue;
        }

        token.push('_');
        for byte in ch.encode_utf8(&mut utf8).as_bytes() {
            let _ = write!(&mut token, "{byte:02x}");
        }
        token.push('_');
    }

    let trimmed = token.trim_matches('_');
    if trimmed.is_empty() {
        hush_core::hashing::sha256(value.as_bytes()).to_hex()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::stable_token;

    #[test]
    fn stable_token_preserves_separator_distinctions() {
        assert_ne!(
            stable_token("remote.clipboard"),
            stable_token("remote_clipboard")
        );
        assert_ne!(stable_token("foo-bar"), stable_token("foo.bar"));
    }
}
