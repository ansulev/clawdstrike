//! Base OCSF enumerations and types shared across all event classes.

use serde::{Deserialize, Serialize};

/// OCSF event class identifiers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u16)]
pub enum ClassUid {
    /// File Activity (System Activity category).
    FileActivity = 1001,
    /// Process Activity (System Activity category).
    ProcessActivity = 1007,
    /// Detection Finding (Findings category).
    DetectionFinding = 2004,
    /// Network Activity (Network Activity category).
    NetworkActivity = 4001,
}

impl ClassUid {
    /// Returns the integer representation used in OCSF JSON.
    #[must_use]
    pub const fn as_u16(self) -> u16 {
        self as u16
    }
}

/// OCSF category identifiers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum CategoryUid {
    /// System Activity (classes 1xxx).
    SystemActivity = 1,
    /// Findings (classes 2xxx).
    Findings = 2,
    /// Network Activity (classes 4xxx).
    NetworkActivity = 4,
}

impl CategoryUid {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// Maps a [`ClassUid`] to its parent [`CategoryUid`].
#[must_use]
pub const fn category_for_class(class: ClassUid) -> CategoryUid {
    match class {
        ClassUid::FileActivity | ClassUid::ProcessActivity => CategoryUid::SystemActivity,
        ClassUid::DetectionFinding => CategoryUid::Findings,
        ClassUid::NetworkActivity => CategoryUid::NetworkActivity,
    }
}

/// OCSF severity identifiers (0-6, 99).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum SeverityId {
    /// Unknown or unspecified severity.
    Unknown = 0,
    /// Informational — no action required.
    Informational = 1,
    /// Low severity.
    Low = 2,
    /// Medium severity.
    Medium = 3,
    /// High severity.
    High = 4,
    /// Critical severity. **Not** Fatal (6).
    Critical = 5,
    /// Fatal — system-level unrecoverable.
    Fatal = 6,
    /// Other (vendor-specific).
    Other = 99,
}

impl SeverityId {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }

    /// Returns the canonical OCSF severity label.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Unknown => "Unknown",
            Self::Informational => "Informational",
            Self::Low => "Low",
            Self::Medium => "Medium",
            Self::High => "High",
            Self::Critical => "Critical",
            Self::Fatal => "Fatal",
            Self::Other => "Other",
        }
    }
}

/// OCSF action identifiers: 1=Allowed, 2=Denied.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum ActionId {
    /// Unknown action.
    Unknown = 0,
    /// Action was allowed.
    Allowed = 1,
    /// Action was denied/blocked.
    Denied = 2,
    /// Other (vendor-specific).
    Other = 99,
}

impl ActionId {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF disposition identifiers used as numeric constants.
///
/// The event structs serialize `disposition_id` as raw `u8` fields to match
/// OCSF JSON payloads directly; this enum exists to provide well-named values
/// and `as_u8()` conversions.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum DispositionId {
    /// Unknown disposition.
    Unknown = 0,
    /// Allowed / passed.
    Allowed = 1,
    /// Blocked / prevented.
    Blocked = 2,
    /// Logged only (no enforcement action).
    Logged = 17,
    /// Other (vendor-specific).
    Other = 99,
}

impl DispositionId {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF status identifiers for event outcome.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum StatusId {
    /// Unknown outcome.
    Unknown = 0,
    /// The operation succeeded.
    Success = 1,
    /// The operation failed.
    Failure = 2,
    /// Other (vendor-specific).
    Other = 99,
}

impl StatusId {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// Compute `type_uid` from `class_uid` and `activity_id`.
///
/// Formula: `class_uid * 100 + activity_id`.
#[must_use]
pub const fn compute_type_uid(class_uid: u16, activity_id: u8) -> u32 {
    (class_uid as u32) * 100 + (activity_id as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn class_uid_values() {
        assert_eq!(ClassUid::FileActivity.as_u16(), 1001);
        assert_eq!(ClassUid::ProcessActivity.as_u16(), 1007);
        assert_eq!(ClassUid::DetectionFinding.as_u16(), 2004);
        assert_eq!(ClassUid::NetworkActivity.as_u16(), 4001);
    }

    #[test]
    fn category_mapping() {
        assert_eq!(
            category_for_class(ClassUid::FileActivity),
            CategoryUid::SystemActivity
        );
        assert_eq!(
            category_for_class(ClassUid::ProcessActivity),
            CategoryUid::SystemActivity
        );
        assert_eq!(
            category_for_class(ClassUid::DetectionFinding),
            CategoryUid::Findings
        );
        assert_eq!(
            category_for_class(ClassUid::NetworkActivity),
            CategoryUid::NetworkActivity
        );
    }

    #[test]
    fn severity_critical_is_five_not_six() {
        assert_eq!(SeverityId::Critical.as_u8(), 5);
        assert_eq!(SeverityId::Fatal.as_u8(), 6);
    }

    #[test]
    fn type_uid_formula() {
        // Detection Finding Create: 2004 * 100 + 1 = 200401
        assert_eq!(compute_type_uid(2004, 1), 200401);
        // Process Activity Launch: 1007 * 100 + 1 = 100701
        assert_eq!(compute_type_uid(1007, 1), 100701);
        // File Activity Read: 1001 * 100 + 2 = 100102
        assert_eq!(compute_type_uid(1001, 2), 100102);
        // Network Activity Traffic: 4001 * 100 + 6 = 400106
        assert_eq!(compute_type_uid(4001, 6), 400106);
    }

    #[test]
    fn action_id_values() {
        assert_eq!(ActionId::Allowed.as_u8(), 1);
        assert_eq!(ActionId::Denied.as_u8(), 2);
    }

    #[test]
    fn disposition_id_values() {
        assert_eq!(DispositionId::Allowed.as_u8(), 1);
        assert_eq!(DispositionId::Blocked.as_u8(), 2);
        assert_eq!(DispositionId::Logged.as_u8(), 17);
    }

    #[test]
    fn status_id_values() {
        assert_eq!(StatusId::Unknown.as_u8(), 0);
        assert_eq!(StatusId::Success.as_u8(), 1);
        assert_eq!(StatusId::Failure.as_u8(), 2);
    }

    #[test]
    fn severity_labels() {
        assert_eq!(SeverityId::Informational.label(), "Informational");
        assert_eq!(SeverityId::Critical.label(), "Critical");
        assert_eq!(SeverityId::Fatal.label(), "Fatal");
    }
}
