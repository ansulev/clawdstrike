//! OCSF ResourceDetail object.

use serde::{Deserialize, Serialize};

/// OCSF ResourceDetail object describing an affected resource.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceDetail {
    /// Resource unique identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    /// Resource display name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Resource type label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_detail_roundtrip() {
        let r = ResourceDetail {
            uid: Some("res-1".to_string()),
            name: Some("/etc/shadow".to_string()),
            r#type: Some("File".to_string()),
        };
        let json = serde_json::to_string(&r).unwrap();
        let r2: ResourceDetail = serde_json::from_str(&json).unwrap();
        assert_eq!(r, r2);
    }
}
