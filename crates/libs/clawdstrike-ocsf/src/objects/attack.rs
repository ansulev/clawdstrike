//! OCSF Attack (MITRE ATT&CK) object.

use serde::{Deserialize, Serialize};

/// OCSF Attack object for MITRE ATT&CK mapping.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attack {
    /// MITRE ATT&CK tactic (e.g., "Credential Access").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tactic: Option<AttackTactic>,
    /// MITRE ATT&CK technique.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub technique: Option<AttackTechnique>,
    /// Framework version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

/// MITRE ATT&CK tactic.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AttackTactic {
    /// Tactic name (e.g., "Initial Access").
    pub name: String,
    /// Tactic UID (e.g., "TA0001").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

/// MITRE ATT&CK technique.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AttackTechnique {
    /// Technique name (e.g., "Phishing").
    pub name: String,
    /// Technique UID (e.g., "T1566").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attack_roundtrip() {
        let a = Attack {
            tactic: Some(AttackTactic {
                name: "Credential Access".to_string(),
                uid: Some("TA0006".to_string()),
            }),
            technique: Some(AttackTechnique {
                name: "OS Credential Dumping".to_string(),
                uid: Some("T1003".to_string()),
            }),
            version: Some("14.1".to_string()),
        };
        let json = serde_json::to_string(&a).unwrap();
        let a2: Attack = serde_json::from_str(&json).unwrap();
        assert_eq!(a, a2);
    }
}
