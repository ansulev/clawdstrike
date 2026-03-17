//! Action atom encoding for Logos formulas.
//!
//! Every [`GuardAction`](clawdstrike::guards::GuardAction) variant maps to a
//! family of atoms with a structured naming convention:
//!
//! ```text
//! access("/etc/shadow")     -- file access
//! write("/tmp/secrets.txt") -- file write
//! egress("api.openai.com")  -- network egress
//! exec("rm -rf /")          -- shell command execution
//! mcp("shell_exec")         -- MCP tool invocation
//! patch("/src/main.rs")     -- patch application
//! custom("my_action")       -- custom action type
//! ```
//!
//! In the Logos AST these are represented as [`Formula::Atom(String)`] with the
//! format `"type(param)"`.

use logos_ffi::Formula;
use std::fmt;

/// The kind of action being modeled.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum ActionKind {
    /// File access (read).
    Access,
    /// File write.
    Write,
    /// Network egress to a domain.
    Egress,
    /// Shell command execution.
    Exec,
    /// MCP tool invocation.
    Mcp,
    /// Patch application.
    Patch,
    /// Custom action type.
    Custom,
}

impl ActionKind {
    /// Return the string prefix used in atom names.
    fn prefix(&self) -> &'static str {
        match self {
            Self::Access => "access",
            Self::Write => "write",
            Self::Egress => "egress",
            Self::Exec => "exec",
            Self::Mcp => "mcp",
            Self::Patch => "patch",
            Self::Custom => "custom",
        }
    }

    /// Return all seven standard action kinds.
    pub fn all() -> Vec<ActionKind> {
        vec![
            Self::Access,
            Self::Write,
            Self::Egress,
            Self::Exec,
            Self::Mcp,
            Self::Patch,
            Self::Custom,
        ]
    }

    /// Return the four core action kinds commonly required for agent security
    /// policies: `access`, `egress`, `exec`, and `mcp`.
    pub fn core() -> Vec<ActionKind> {
        vec![Self::Access, Self::Egress, Self::Exec, Self::Mcp]
    }

    /// Parse an [`ActionKind`] from an atom name prefix (the part before the
    /// opening parenthesis).
    pub fn from_prefix(prefix: &str) -> Option<ActionKind> {
        match prefix {
            "access" => Some(Self::Access),
            "write" => Some(Self::Write),
            "egress" => Some(Self::Egress),
            "exec" => Some(Self::Exec),
            "mcp" => Some(Self::Mcp),
            "patch" => Some(Self::Patch),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }
}

impl fmt::Display for ActionKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.prefix())
    }
}

/// An action atom: a typed, parameterized proposition for use in Logos formulas.
///
/// The atom name follows the convention `kind(param)`, e.g. `access(/etc/shadow)`.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ActionAtom {
    /// The kind of action.
    pub kind: ActionKind,
    /// The parameter (path, domain, tool name, pattern, etc.).
    pub param: String,
}

impl ActionAtom {
    /// Create a new action atom.
    pub fn new(kind: ActionKind, param: impl Into<String>) -> Self {
        Self {
            kind,
            param: param.into(),
        }
    }

    /// File access atom.
    pub fn access(path: impl Into<String>) -> Self {
        Self::new(ActionKind::Access, path)
    }

    /// File write atom.
    pub fn write(path: impl Into<String>) -> Self {
        Self::new(ActionKind::Write, path)
    }

    /// Network egress atom.
    pub fn egress(domain: impl Into<String>) -> Self {
        Self::new(ActionKind::Egress, domain)
    }

    /// Shell command execution atom.
    pub fn exec(pattern: impl Into<String>) -> Self {
        Self::new(ActionKind::Exec, pattern)
    }

    /// MCP tool invocation atom.
    pub fn mcp(tool: impl Into<String>) -> Self {
        Self::new(ActionKind::Mcp, tool)
    }

    /// Patch application atom.
    pub fn patch(path: impl Into<String>) -> Self {
        Self::new(ActionKind::Patch, path)
    }

    /// Custom action atom.
    pub fn custom(action_type: impl Into<String>) -> Self {
        Self::new(ActionKind::Custom, action_type)
    }

    /// Return the canonical atom name: `kind(param)`.
    #[must_use]
    pub fn atom_name(&self) -> String {
        format!("{}({})", self.kind.prefix(), self.param)
    }

    /// Convert this atom into a Logos [`Formula::Atom`].
    #[must_use]
    pub fn to_formula(&self) -> Formula {
        Formula::atom(self.atom_name())
    }
}

impl fmt::Display for ActionAtom {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}({})", self.kind.prefix(), self.param)
    }
}

/// Convenience function: produce a [`Formula::Atom`] from an action type and parameter.
#[must_use]
pub fn action_atom(action_type: &str, param: &str) -> Formula {
    Formula::atom(format!("{action_type}({param})"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atom_name_format() {
        let atom = ActionAtom::access("/etc/shadow");
        assert_eq!(atom.atom_name(), "access(/etc/shadow)");
    }

    #[test]
    fn atom_display() {
        let atom = ActionAtom::egress("api.openai.com");
        assert_eq!(format!("{atom}"), "egress(api.openai.com)");
    }

    #[test]
    fn action_atom_helper() {
        let f = action_atom("mcp", "shell_exec");
        assert!(matches!(f, Formula::Atom(ref s) if s == "mcp(shell_exec)"));
    }

    #[test]
    fn to_formula_roundtrip() {
        let atom = ActionAtom::exec("rm -rf /");
        let formula = atom.to_formula();
        assert_eq!(format!("{formula}"), "exec(rm -rf /)");
    }

    #[test]
    fn action_kind_display() {
        assert_eq!(format!("{}", ActionKind::Access), "access");
        assert_eq!(format!("{}", ActionKind::Mcp), "mcp");
        assert_eq!(format!("{}", ActionKind::Custom), "custom");
    }
}
