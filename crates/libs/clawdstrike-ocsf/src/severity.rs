//! Severity mapping from ClawdStrike severity levels to OCSF severity IDs.
//!
//! ClawdStrike uses two severity enums across its codebase:
//! - Guard `Severity`: Info, Warning, Error, Critical
//! - SIEM `SecuritySeverity`: Info, Low, Medium, High, Critical
//!
//! This module maps both to OCSF `SeverityId` with the corrected mapping where
//! Critical = 5 (not 6/Fatal as in the old transforms).

use crate::base::SeverityId;

/// Map a ClawdStrike guard severity string to OCSF [`SeverityId`].
///
/// Accepts both Guard-level names (`info`, `warning`, `error`, `critical`) and
/// SIEM-level names (`info`, `low`, `medium`, `high`, `critical`).
///
/// Returns [`SeverityId::Unknown`] for unrecognised inputs.
#[must_use]
pub fn map_severity(severity: &str) -> SeverityId {
    match severity.to_ascii_lowercase().as_str() {
        "info" | "informational" => SeverityId::Informational,
        "low" => SeverityId::Low,
        "warning" | "warn" | "medium" => SeverityId::Medium,
        "error" | "high" => SeverityId::High,
        "critical" => SeverityId::Critical,
        "fatal" => SeverityId::Fatal,
        _ => SeverityId::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guard_severity_mapping() {
        assert_eq!(map_severity("info"), SeverityId::Informational);
        assert_eq!(map_severity("warning"), SeverityId::Medium);
        assert_eq!(map_severity("error"), SeverityId::High);
        assert_eq!(map_severity("critical"), SeverityId::Critical);
    }

    #[test]
    fn siem_severity_mapping() {
        assert_eq!(map_severity("info"), SeverityId::Informational);
        assert_eq!(map_severity("low"), SeverityId::Low);
        assert_eq!(map_severity("medium"), SeverityId::Medium);
        assert_eq!(map_severity("high"), SeverityId::High);
        assert_eq!(map_severity("critical"), SeverityId::Critical);
    }

    #[test]
    fn critical_maps_to_five() {
        assert_eq!(map_severity("critical").as_u8(), 5);
        assert_ne!(map_severity("critical").as_u8(), 6);
    }

    #[test]
    fn case_insensitive() {
        assert_eq!(map_severity("Critical"), SeverityId::Critical);
        assert_eq!(map_severity("HIGH"), SeverityId::High);
        assert_eq!(map_severity("Info"), SeverityId::Informational);
    }

    #[test]
    fn unknown_severity() {
        assert_eq!(map_severity(""), SeverityId::Unknown);
        assert_eq!(map_severity("banana"), SeverityId::Unknown);
    }

    #[test]
    fn warn_alias() {
        assert_eq!(map_severity("warn"), SeverityId::Medium);
    }

    #[test]
    fn informational_alias() {
        assert_eq!(map_severity("informational"), SeverityId::Informational);
    }
}
