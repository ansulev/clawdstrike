//! Pre-flight validation for sandbox capability sets.
//!
//! Checks that the capability set is viable before applying the sandbox.

use std::path::Path;

use nono::query::{QueryContext, QueryResult};
use nono::{AccessMode, CapabilitySet};

/// Result of a pre-flight check.
pub struct PreflightResult {
    /// Critical errors that would prevent execution.
    pub errors: Vec<String>,
    /// Non-critical warnings.
    pub warnings: Vec<String>,
}

impl PreflightResult {
    /// True if no critical errors were found.
    pub fn is_ok(&self) -> bool {
        self.errors.is_empty()
    }
}

/// Validate a capability set against expected operations.
pub fn preflight_check(
    caps: &CapabilitySet,
    command: &[String],
    working_dir: &Path,
) -> PreflightResult {
    let ctx = QueryContext::new(caps.clone());
    let mut errors = Vec::new();
    let warnings = Vec::new();

    // 1. Working directory must be accessible
    if !matches!(
        ctx.query_path(working_dir, AccessMode::ReadWrite),
        QueryResult::Allowed(_)
    ) {
        errors.push(format!(
            "Working directory {} not accessible in sandbox",
            working_dir.display()
        ));
    }

    // 2. Command binary must be readable (best-effort lookup)
    if !command.is_empty() {
        if let Some(bin_path) = find_command_in_path(&command[0]) {
            if !matches!(
                ctx.query_path(&bin_path, AccessMode::Read),
                QueryResult::Allowed(_)
            ) {
                errors.push(format!(
                    "Command binary {} not accessible in sandbox",
                    bin_path.display()
                ));
            }
        }
    }

    PreflightResult { errors, warnings }
}

/// Find a command in PATH.
fn find_command_in_path(cmd: &str) -> Option<std::path::PathBuf> {
    let path = Path::new(cmd);
    if path.is_absolute() && path.exists() {
        return Some(path.to_path_buf());
    }
    let path_var = std::env::var("PATH").ok()?;
    for dir in path_var.split(':') {
        let candidate = Path::new(dir).join(cmd);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::unwrap_used)]

    use super::*;

    #[test]
    fn test_preflight_ok_with_valid_caps() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = CapabilitySet::new()
            .allow_path(tmp.path(), AccessMode::ReadWrite)
            .unwrap()
            .allow_path("/usr", AccessMode::Read)
            .unwrap()
            .allow_path("/bin", AccessMode::Read)
            .unwrap();

        let result = preflight_check(&caps, &["ls".into()], tmp.path());
        assert!(result.is_ok(), "should pass with valid caps");
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_preflight_error_working_dir_not_accessible() {
        let caps = CapabilitySet::new();
        let result = preflight_check(&caps, &[], Path::new("/nonexistent/working/dir"));
        assert!(!result.is_ok());
        assert!(result.errors.iter().any(|e| e.contains("Working directory")));
    }

    #[test]
    fn test_preflight_empty_command_no_binary_error() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = CapabilitySet::new()
            .allow_path(tmp.path(), AccessMode::ReadWrite)
            .unwrap();
        let result = preflight_check(&caps, &[], tmp.path());
        // No binary check for empty command
        assert!(!result.errors.iter().any(|e| e.contains("Command binary")));
    }
}
