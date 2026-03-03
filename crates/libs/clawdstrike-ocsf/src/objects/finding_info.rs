//! OCSF FindingInfo and Analytic objects for Detection Finding events.

use serde::{Deserialize, Serialize};

/// OCSF Analytic type identifiers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum AnalyticTypeId {
    /// Unknown analytic type.
    Unknown = 0,
    /// Rule-based detection (policy engine).
    Rule = 1,
    /// Behavioral analysis.
    Behavioral = 2,
    /// Statistical anomaly.
    Statistical = 3,
    /// Other (vendor-specific).
    Other = 99,
}

impl AnalyticTypeId {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF Analytic object — describes the detection analytic/rule.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Analytic {
    /// Analytic/rule name (e.g., guard name).
    pub name: String,
    /// Type of analytic.
    pub type_id: u8,
    /// Human-readable type label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    /// Analytic unique identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    /// Analytic version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

impl Analytic {
    /// Create a rule-based analytic (the most common for ClawdStrike guard decisions).
    #[must_use]
    pub fn rule(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            type_id: AnalyticTypeId::Rule.as_u8(),
            r#type: Some("Rule".to_string()),
            uid: None,
            version: None,
        }
    }
}

/// OCSF FindingInfo object — core of Detection Finding events.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FindingInfo {
    /// Unique identifier for this finding.
    pub uid: String,
    /// Short title describing the finding.
    pub title: String,
    /// The analytic/rule that produced this finding.
    pub analytic: Analytic,
    /// Detailed description of the finding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desc: Option<String>,
    /// Related analytics (additional rules that contributed).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_analytics: Option<Vec<Analytic>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analytic_rule() {
        let a = Analytic::rule("ForbiddenPathGuard");
        assert_eq!(a.name, "ForbiddenPathGuard");
        assert_eq!(a.type_id, 1);
        assert_eq!(a.r#type.as_deref(), Some("Rule"));
    }

    #[test]
    fn finding_info_roundtrip() {
        let fi = FindingInfo {
            uid: "finding-001".to_string(),
            title: "Forbidden path access blocked".to_string(),
            analytic: Analytic::rule("ForbiddenPathGuard"),
            desc: Some("Access to /etc/shadow was denied".to_string()),
            related_analytics: None,
        };
        let json = serde_json::to_string(&fi).unwrap();
        let fi2: FindingInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(fi, fi2);
    }

    #[test]
    fn analytic_type_id_values() {
        assert_eq!(AnalyticTypeId::Unknown.as_u8(), 0);
        assert_eq!(AnalyticTypeId::Rule.as_u8(), 1);
        assert_eq!(AnalyticTypeId::Behavioral.as_u8(), 2);
        assert_eq!(AnalyticTypeId::Statistical.as_u8(), 3);
        assert_eq!(AnalyticTypeId::Other.as_u8(), 99);
    }
}
