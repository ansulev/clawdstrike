//! Never-grant list builder for nono supervisor.
//!
//! Maps ClawdStrike's [`ForbiddenPathConfig`] to nono's [`NeverGrantChecker`].
//! These paths are denied BEFORE guard evaluation -- they are the absolute
//! security floor that guards cannot override.

use crate::guards::ForbiddenPathConfig;
use crate::policy::Policy;

/// Build a never-grant path list from policy.
///
/// These paths are denied at the supervisor level before any guard evaluation.
/// Even if a guard would allow access, the never-grant list blocks it.
///
/// The returned strings use `~/` for home-relative paths; nono's
/// [`NeverGrantChecker::new`] handles tilde expansion internally.
pub fn build_never_grant_list(policy: &Policy) -> Vec<String> {
    let mut paths: Vec<String> = vec![
        // Critical credential paths (always blocked)
        "~/.ssh/id_rsa".into(),
        "~/.ssh/id_ed25519".into(),
        "~/.ssh/id_ecdsa".into(),
        "/etc/shadow".into(),
        "/etc/sudoers".into(),
    ];

    // Add patterns from ForbiddenPathGuard config
    let forbidden = if let Some(ref fp) = policy.guards.forbidden_path {
        if fp.enabled {
            fp.effective_patterns()
        } else {
            vec![]
        }
    } else {
        ForbiddenPathConfig::default().effective_patterns()
    };

    for pattern in &forbidden {
        if pattern.starts_with('/') {
            // Absolute path -- use directly
            paths.push(pattern.clone());
        } else if let Some(rel) = pattern.strip_prefix("**/") {
            // Relative glob -- convert to home-relative where applicable
            let rel = rel.trim_end_matches("/**").trim_end_matches("/*");
            if rel.starts_with('.') {
                paths.push(format!("~/{rel}"));
            }
        }
    }

    // Deduplicate
    paths.sort();
    paths.dedup();
    paths
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_always_includes_credential_paths() {
        let policy = Policy::default();
        let paths = build_never_grant_list(&policy);

        assert!(paths.contains(&"~/.ssh/id_rsa".to_string()));
        assert!(paths.contains(&"~/.ssh/id_ed25519".to_string()));
        assert!(paths.contains(&"/etc/shadow".to_string()));
    }

    #[test]
    fn test_deduplicates() {
        let policy = Policy::default();
        let paths = build_never_grant_list(&policy);

        let mut sorted = paths.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(paths.len(), sorted.len(), "paths should be deduplicated");
    }
}
