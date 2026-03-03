//! OCSF Evidence object.

use serde::{Deserialize, Serialize};

/// OCSF Evidence object carrying structured proof of a finding.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Evidence {
    /// Arbitrary structured evidence data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evidence_roundtrip() {
        let e = Evidence {
            data: Some(serde_json::json!({
                "matched_pattern": "ssh_private_key",
                "line": 42,
            })),
        };
        let json = serde_json::to_string(&e).unwrap();
        let e2: Evidence = serde_json::from_str(&json).unwrap();
        assert_eq!(e, e2);
    }
}
