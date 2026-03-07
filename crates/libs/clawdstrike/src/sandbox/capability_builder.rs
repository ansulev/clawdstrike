//! CapabilityBuilder -- translates ClawdStrike guard policies to nono CapabilitySets.

use std::path::{Path, PathBuf};

use nono::{AccessMode, CapabilitySet, FsCapability, NetworkMode};

use crate::guards::{EgressAllowlistConfig, ForbiddenPathConfig};
use crate::policy::Policy;

/// Builds a nono `CapabilitySet` from a ClawdStrike `Policy`.
pub struct CapabilityBuilder {
    policy: Policy,
    working_dir: PathBuf,
    proxy_port: Option<u16>,
}

/// Warning emitted during policy translation.
#[derive(Debug, Clone)]
pub struct TranslationWarning {
    pub guard: String,
    pub message: String,
    pub severity: WarningSeverity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WarningSeverity {
    Info,
    Warning,
}

impl CapabilityBuilder {
    pub fn new(policy: Policy, working_dir: PathBuf) -> Self {
        Self {
            policy,
            working_dir,
            proxy_port: None,
        }
    }

    #[must_use]
    pub fn with_proxy_port(mut self, port: u16) -> Self {
        self.proxy_port = Some(port);
        self
    }

    /// Build a CapabilitySet from the policy.
    pub fn build(self) -> nono::Result<CapabilitySet> {
        let (caps, _warnings) = self.build_with_diagnostics()?;
        Ok(caps)
    }

    /// Build with diagnostic warnings about translation gaps.
    pub fn build_with_diagnostics(self) -> nono::Result<(CapabilitySet, Vec<TranslationWarning>)> {
        let mut caps = CapabilitySet::new();
        let mut warnings = Vec::new();

        // 1. Collect forbidden patterns FIRST (before any grants).
        //    On Linux (Landlock), once a path is granted it cannot be revoked.
        let forbidden_patterns = self.collect_forbidden_patterns();

        // 2. System read paths -- skip forbidden
        for path in system_read_paths() {
            if path.exists() && !is_path_forbidden(&path, &forbidden_patterns) {
                caps = caps.allow_path(&path, AccessMode::Read)?;
            }
        }

        // 3. System write paths -- skip forbidden
        for path in system_write_paths() {
            if path.exists() && !is_path_forbidden(&path, &forbidden_patterns) {
                caps = caps.allow_path(&path, AccessMode::ReadWrite)?;
            }
        }

        // 4. Working directory (ReadWrite)
        caps = caps.allow_path(&self.working_dir, AccessMode::ReadWrite)?;

        // 5. PathAllowlistGuard -> direct path grants
        if let Some(ref allowlist) = self.policy.guards.path_allowlist {
            if allowlist.enabled {
                for pattern in &allowlist.file_access_allow {
                    for path in expand_glob_to_existing(pattern) {
                        if !is_path_forbidden(&path, &forbidden_patterns) {
                            match try_fs_capability(&path, AccessMode::Read) {
                                Ok(cap) => caps.add_fs(cap),
                                Err(_) => {
                                    warnings.push(TranslationWarning {
                                        guard: "PathAllowlistGuard".into(),
                                        message: format!(
                                            "Could not grant read access to {}",
                                            path.display()
                                        ),
                                        severity: WarningSeverity::Warning,
                                    });
                                }
                            }
                        }
                    }
                }
                for pattern in &allowlist.file_write_allow {
                    for path in expand_glob_to_existing(pattern) {
                        if !is_path_forbidden(&path, &forbidden_patterns) {
                            match try_fs_capability(&path, AccessMode::ReadWrite) {
                                Ok(cap) => caps.add_fs(cap),
                                Err(_) => {
                                    warnings.push(TranslationWarning {
                                        guard: "PathAllowlistGuard".into(),
                                        message: format!(
                                            "Could not grant write access to {}",
                                            path.display()
                                        ),
                                        severity: WarningSeverity::Warning,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // 6. macOS: add deny platform rules for forbidden paths
        #[cfg(target_os = "macos")]
        {
            let concrete_forbidden = self.resolve_forbidden_to_concrete_paths();
            for path in &concrete_forbidden {
                let escaped = escape_seatbelt_path(&path.to_string_lossy());
                // Deny content reads (allow metadata for stat)
                let _ = caps.add_platform_rule(format!(
                    "(deny file-read-data (subpath \"{escaped}\"))"
                ));
                let _ = caps.add_platform_rule(format!(
                    "(deny file-write* (subpath \"{escaped}\"))"
                ));
            }
        }

        // 7. EgressAllowlistGuard -> NetworkMode
        self.apply_network_mode(&mut caps);

        // 8. ShellCommandGuard -> blocked commands (defense in depth)
        self.apply_blocked_commands(&mut caps);

        // 9. Deduplicate
        caps.deduplicate();

        // Add informational warnings about untranslatable guards
        for guard_name in &[
            "SecretLeakGuard",
            "PatchIntegrityGuard",
            "PromptInjectionGuard",
            "JailbreakGuard",
        ] {
            warnings.push(TranslationWarning {
                guard: guard_name.to_string(),
                message:
                    "Content inspection guard -- no kernel equivalent, runs at application level only"
                        .into(),
                severity: WarningSeverity::Info,
            });
        }

        Ok((caps, warnings))
    }

    /// Collect all forbidden path patterns from the policy.
    fn collect_forbidden_patterns(&self) -> Vec<String> {
        if let Some(ref fp) = self.policy.guards.forbidden_path {
            if !fp.enabled {
                return vec![];
            }
            fp.effective_patterns()
        } else {
            ForbiddenPathConfig::default().effective_patterns()
        }
    }

    /// Resolve forbidden glob patterns to concrete existing paths for macOS deny rules.
    #[cfg(target_os = "macos")]
    fn resolve_forbidden_to_concrete_paths(&self) -> Vec<PathBuf> {
        let patterns = self.collect_forbidden_patterns();
        let mut paths = Vec::new();

        if let Some(home) = dirs::home_dir() {
            for pattern in &patterns {
                if let Some(rel) = pattern.strip_prefix("**/") {
                    // Strip trailing glob suffixes
                    let rel = rel.trim_end_matches("/**").trim_end_matches("/*");
                    let concrete = home.join(rel);
                    if concrete.exists() {
                        paths.push(concrete);
                    }
                } else if pattern.starts_with('/') {
                    let p = PathBuf::from(pattern);
                    if p.exists() {
                        paths.push(p);
                    }
                }
            }
        }

        paths
    }

    fn apply_network_mode(&self, caps: &mut CapabilitySet) {
        if let Some(ref egress) = self.policy.guards.egress_allowlist {
            if egress.enabled {
                let is_blocking = is_egress_blocking(egress);
                if is_blocking {
                    if let Some(port) = self.proxy_port {
                        *caps = std::mem::take(caps).proxy_only(port);
                    } else {
                        *caps = std::mem::take(caps).block_network();
                    }
                } else {
                    caps.set_network_mode_mut(NetworkMode::AllowAll);
                }
            }
        } else if let Some(port) = self.proxy_port {
            *caps = std::mem::take(caps).proxy_only(port);
        } else {
            *caps = std::mem::take(caps).block_network();
        }
    }

    fn apply_blocked_commands(&self, caps: &mut CapabilitySet) {
        const KERNEL_BLOCKED: &[&str] = &[
            "rm",
            "rmdir",
            "dd",
            "chmod",
            "chown",
            "sudo",
            "kill",
            "killall",
            "shutdown",
            "mkfs",
            "parted",
            "systemctl",
        ];

        if let Some(ref shell) = self.policy.guards.shell_command {
            if shell.enabled {
                for cmd in KERNEL_BLOCKED {
                    caps.add_blocked_command(*cmd);
                }
            }
        }
    }
}

/// Check if egress policy defaults to blocking.
fn is_egress_blocking(egress: &EgressAllowlistConfig) -> bool {
    use hush_proxy::policy::PolicyAction;
    egress
        .default_action
        .as_ref()
        .map(|a| matches!(a, PolicyAction::Block))
        .unwrap_or(true)
}

/// Try to create an `FsCapability` for a path, choosing dir or file based on metadata.
fn try_fs_capability(path: &Path, mode: AccessMode) -> nono::Result<FsCapability> {
    if path.is_dir() {
        FsCapability::new_dir(path, mode)
    } else {
        FsCapability::new_file(path, mode)
    }
}

/// Check if a path matches any forbidden pattern.
///
/// Uses `Path::components()` for dotfile/dotdir matching to avoid
/// string `starts_with` vulnerabilities on path segments.
fn is_path_forbidden(path: &Path, patterns: &[String]) -> bool {
    for pattern in patterns {
        let clean = pattern
            .trim_start_matches("**/")
            .trim_end_matches("/**")
            .trim_end_matches("/*");

        if clean.starts_with('/') {
            // Absolute path pattern -- use Path::starts_with for component-level comparison
            if path.starts_with(clean) {
                return true;
            }
        } else if clean.starts_with('.') {
            // Dotfile/dotdir pattern -- check each path component
            for component in path.components() {
                let comp_str = component.as_os_str().to_string_lossy();
                // Exact match on path component (e.g., ".ssh" matches component ".ssh")
                if comp_str == clean {
                    return true;
                }
                // Handle patterns like ".env.*" where clean is ".env." after glob stripping
                // Also handles ".env" matching a component that starts with ".env."
                // (e.g., ".env.local")
                if clean.ends_with('*') {
                    let prefix = clean.trim_end_matches('*');
                    if comp_str.starts_with(prefix) {
                        return true;
                    }
                }
            }
        } else {
            // Filename pattern (e.g., "id_rsa*") -- check final component
            if let Some(file_name) = path.file_name() {
                let name = file_name.to_string_lossy();
                if clean.ends_with('*') {
                    let prefix = clean.trim_end_matches('*');
                    if name.starts_with(prefix) {
                        return true;
                    }
                } else if name == clean {
                    return true;
                }
            }
        }
    }
    false
}

/// Expand a glob pattern to existing paths.
fn expand_glob_to_existing(pattern: &str) -> Vec<PathBuf> {
    match glob::glob(pattern) {
        Ok(paths) => paths.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    }
}

/// Escape a path for embedding in a Seatbelt S-expression string.
#[cfg(target_os = "macos")]
fn escape_seatbelt_path(path: &str) -> String {
    path.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Platform-specific system paths (read-only).
#[cfg(target_os = "macos")]
fn system_read_paths() -> Vec<PathBuf> {
    [
        "/bin",
        "/usr",
        "/sbin",
        "/System/Library",
        "/Library",
        "/private/etc",
        "/opt/homebrew",
    ]
    .iter()
    .map(PathBuf::from)
    .collect()
}

#[cfg(target_os = "linux")]
fn system_read_paths() -> Vec<PathBuf> {
    [
        "/bin", "/lib", "/lib64", "/usr", "/sbin", "/etc", "/proc", "/sys", "/run",
    ]
    .iter()
    .map(PathBuf::from)
    .collect()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn system_read_paths() -> Vec<PathBuf> {
    vec![]
}

/// Platform-specific system paths (writable).
#[cfg(target_os = "macos")]
fn system_write_paths() -> Vec<PathBuf> {
    ["/tmp", "/private/tmp", "/dev"]
        .iter()
        .map(PathBuf::from)
        .collect()
}

#[cfg(target_os = "linux")]
fn system_write_paths() -> Vec<PathBuf> {
    ["/tmp", "/dev", "/dev/shm"]
        .iter()
        .map(PathBuf::from)
        .collect()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn system_write_paths() -> Vec<PathBuf> {
    vec![]
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::unwrap_used)]

    use super::*;
    use crate::guards::{ForbiddenPathConfig, ShellCommandConfig};

    fn minimal_policy() -> Policy {
        Policy::default()
    }

    #[test]
    fn test_forbidden_patterns_collected() {
        let builder = CapabilityBuilder::new(minimal_policy(), PathBuf::from("/tmp"));
        let patterns = builder.collect_forbidden_patterns();
        assert!(patterns.iter().any(|p| p.contains(".ssh")));
        assert!(patterns.iter().any(|p| p.contains(".aws")));
    }

    #[test]
    fn test_forbidden_patterns_with_custom_config() {
        let mut policy = minimal_policy();
        policy.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["**/custom/**".into()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });
        let builder = CapabilityBuilder::new(policy, PathBuf::from("/tmp"));
        let patterns = builder.collect_forbidden_patterns();
        assert_eq!(patterns, vec!["**/custom/**"]);
    }

    #[test]
    fn test_forbidden_patterns_disabled_returns_empty() {
        let mut policy = minimal_policy();
        policy.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: false,
            patterns: None,
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });
        let builder = CapabilityBuilder::new(policy, PathBuf::from("/tmp"));
        let patterns = builder.collect_forbidden_patterns();
        assert!(patterns.is_empty());
    }

    #[test]
    fn test_is_path_forbidden_ssh() {
        let patterns = ForbiddenPathConfig::default().effective_patterns();
        assert!(is_path_forbidden(
            Path::new("/home/user/.ssh/id_rsa"),
            &patterns
        ));
        assert!(is_path_forbidden(
            Path::new("/home/user/.ssh/authorized_keys"),
            &patterns
        ));
    }

    #[test]
    fn test_is_path_forbidden_aws() {
        let patterns = ForbiddenPathConfig::default().effective_patterns();
        assert!(is_path_forbidden(
            Path::new("/home/user/.aws/credentials"),
            &patterns
        ));
    }

    #[test]
    fn test_is_path_forbidden_system() {
        let patterns = ForbiddenPathConfig::default().effective_patterns();
        assert!(is_path_forbidden(Path::new("/etc/shadow"), &patterns));
        assert!(is_path_forbidden(Path::new("/etc/passwd"), &patterns));
    }

    #[test]
    fn test_safe_paths_not_forbidden() {
        let patterns = ForbiddenPathConfig::default().effective_patterns();
        assert!(!is_path_forbidden(
            Path::new("/home/user/project/src/main.rs"),
            &patterns
        ));
        assert!(!is_path_forbidden(
            Path::new("/tmp/build/output.txt"),
            &patterns
        ));
    }

    #[test]
    fn test_is_path_forbidden_no_false_prefix_match() {
        // Ensure "/etc/passwd" does not match "/etc/passwdevil" --
        // Path::starts_with does component-level comparison.
        let patterns = vec!["/etc/passwd".to_string()];
        assert!(!is_path_forbidden(
            Path::new("/etc/passwdevil"),
            &patterns
        ));
    }

    #[test]
    fn test_build_with_defaults() {
        let tmp = tempfile::TempDir::new().unwrap();
        let builder = CapabilityBuilder::new(minimal_policy(), tmp.path().to_path_buf());
        let result = builder.build();
        assert!(result.is_ok(), "should build with default policy");
    }

    #[test]
    fn test_build_with_proxy_port() {
        let tmp = tempfile::TempDir::new().unwrap();
        let builder = CapabilityBuilder::new(minimal_policy(), tmp.path().to_path_buf())
            .with_proxy_port(8080);
        let (caps, _) = builder.build_with_diagnostics().unwrap();
        assert!(caps.is_network_blocked());
    }

    #[test]
    fn test_build_emits_info_warnings() {
        let tmp = tempfile::TempDir::new().unwrap();
        let builder = CapabilityBuilder::new(minimal_policy(), tmp.path().to_path_buf());
        let (_, warnings) = builder.build_with_diagnostics().unwrap();
        let info_guards: Vec<_> = warnings
            .iter()
            .filter(|w| w.severity == WarningSeverity::Info)
            .map(|w| w.guard.as_str())
            .collect();
        assert!(info_guards.contains(&"SecretLeakGuard"));
        assert!(info_guards.contains(&"PatchIntegrityGuard"));
    }

    #[test]
    fn test_blocked_commands_applied() {
        let tmp = tempfile::TempDir::new().unwrap();
        let mut policy = minimal_policy();
        policy.guards.shell_command = Some(ShellCommandConfig::default());
        let builder = CapabilityBuilder::new(policy, tmp.path().to_path_buf());
        let (caps, _) = builder.build_with_diagnostics().unwrap();
        let blocked = caps.blocked_commands();
        assert!(blocked.contains(&"rm".to_string()));
        assert!(blocked.contains(&"sudo".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_escape_seatbelt_path() {
        assert_eq!(escape_seatbelt_path("/normal/path"), "/normal/path");
        assert_eq!(
            escape_seatbelt_path("/path/with\"quotes"),
            "/path/with\\\"quotes"
        );
        assert_eq!(
            escape_seatbelt_path("/path/with\\backslash"),
            "/path/with\\\\backslash"
        );
    }
}
