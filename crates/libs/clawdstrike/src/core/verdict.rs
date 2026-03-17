//! Pure verdict types and severity ordering for formal verification.
//!
//! This module contains the core decision types used by the aggregation logic.
//! It has **no** external dependencies (no serde, no async, no I/O).

/// Severity level for violations (pure enum, no serde).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CoreSeverity {
    /// Informational, logged but allowed.
    Info,
    /// Warning, logged and may be flagged.
    Warning,
    /// Error, action is blocked.
    Error,
    /// Critical, action is blocked and session may be terminated.
    Critical,
}

/// Convert severity to ordinal for comparison.
///
/// Higher values indicate more severe violations:
/// `Info(0) < Warning(1) < Error(2) < Critical(3)`
#[inline]
#[must_use]
pub const fn severity_ord(s: CoreSeverity) -> u8 {
    match s {
        CoreSeverity::Info => 0,
        CoreSeverity::Warning => 1,
        CoreSeverity::Error => 2,
        CoreSeverity::Critical => 3,
    }
}

/// Minimal verdict representation used by the aggregation logic.
///
/// This mirrors the fields of `GuardResult` that the `aggregate_overall`
/// function actually inspects, but without serde or `serde_json::Value`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CoreVerdict {
    /// Whether the action is allowed.
    pub allowed: bool,
    /// Severity of any violation.
    pub severity: CoreSeverity,
    /// Whether this verdict represents a sanitization (content was modified).
    pub sanitized: bool,
    /// Guard that produced this result.
    pub guard: String,
    /// Human-readable message.
    pub message: String,
}

impl CoreVerdict {
    /// Create an allow verdict.
    #[must_use]
    pub fn allow(guard: impl Into<String>) -> Self {
        Self {
            allowed: true,
            severity: CoreSeverity::Info,
            sanitized: false,
            guard: guard.into(),
            message: "Allowed".to_string(),
        }
    }

    /// Create a block verdict.
    #[must_use]
    pub fn block(
        guard: impl Into<String>,
        severity: CoreSeverity,
        message: impl Into<String>,
    ) -> Self {
        Self {
            allowed: false,
            severity,
            sanitized: false,
            guard: guard.into(),
            message: message.into(),
        }
    }

    /// Create a warning verdict (allowed but logged).
    #[must_use]
    pub fn warn(guard: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            allowed: true,
            severity: CoreSeverity::Warning,
            sanitized: false,
            guard: guard.into(),
            message: message.into(),
        }
    }

    /// Create a sanitize verdict (allowed but with modified content).
    #[must_use]
    pub fn sanitize(guard: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            allowed: true,
            severity: CoreSeverity::Warning,
            sanitized: true,
            guard: guard.into(),
            message: message.into(),
        }
    }
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn severity_ordering() {
        assert!(severity_ord(CoreSeverity::Info) < severity_ord(CoreSeverity::Warning));
        assert!(severity_ord(CoreSeverity::Warning) < severity_ord(CoreSeverity::Error));
        assert!(severity_ord(CoreSeverity::Error) < severity_ord(CoreSeverity::Critical));
    }

    #[test]
    fn severity_values_are_contiguous() {
        assert_eq!(severity_ord(CoreSeverity::Info), 0);
        assert_eq!(severity_ord(CoreSeverity::Warning), 1);
        assert_eq!(severity_ord(CoreSeverity::Error), 2);
        assert_eq!(severity_ord(CoreSeverity::Critical), 3);
    }

    #[test]
    fn allow_verdict_defaults() {
        let v = CoreVerdict::allow("test");
        assert!(v.allowed);
        assert_eq!(v.severity, CoreSeverity::Info);
        assert!(!v.sanitized);
    }

    #[test]
    fn block_verdict() {
        let v = CoreVerdict::block("test", CoreSeverity::Error, "blocked");
        assert!(!v.allowed);
        assert_eq!(v.severity, CoreSeverity::Error);
    }

    #[test]
    fn sanitize_verdict() {
        let v = CoreVerdict::sanitize("test", "sanitized");
        assert!(v.allowed);
        assert!(v.sanitized);
        assert_eq!(v.severity, CoreSeverity::Warning);
    }
}
