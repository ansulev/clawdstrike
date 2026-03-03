//! OCSF Metadata and Product objects.
//!
//! Every OCSF event **must** contain a `metadata` object with `version` and `product`.

use serde::{Deserialize, Serialize};

use crate::OCSF_VERSION;

/// OCSF Metadata object — required on every event.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Metadata {
    /// OCSF schema version (e.g., "1.4.0").
    pub version: String,
    /// Product that generated the event.
    pub product: Product,
    /// Original event UID from the source system.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_uid: Option<String>,
}

impl Metadata {
    /// Create metadata for a ClawdStrike event.
    #[must_use]
    pub fn clawdstrike(product_version: &str) -> Self {
        Self {
            version: OCSF_VERSION.to_string(),
            product: Product::clawdstrike(product_version),
            original_uid: None,
        }
    }

    /// Create metadata with an original UID.
    #[must_use]
    pub fn with_original_uid(mut self, uid: impl Into<String>) -> Self {
        self.original_uid = Some(uid.into());
        self
    }
}

/// OCSF Product object identifying the source product.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Product {
    /// Product display name.
    pub name: String,
    /// Product unique identifier.
    pub uid: String,
    /// Vendor / company name.
    pub vendor_name: String,
    /// Product version.
    pub version: String,
}

impl Product {
    /// Create the canonical ClawdStrike product descriptor.
    #[must_use]
    pub fn clawdstrike(version: &str) -> Self {
        Self {
            name: "ClawdStrike".to_string(),
            uid: "clawdstrike".to_string(),
            vendor_name: "Backbay Labs".to_string(),
            version: version.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_clawdstrike() {
        let m = Metadata::clawdstrike("0.1.3");
        assert_eq!(m.version, "1.4.0");
        assert_eq!(m.product.name, "ClawdStrike");
        assert_eq!(m.product.uid, "clawdstrike");
        assert_eq!(m.product.vendor_name, "Backbay Labs");
        assert_eq!(m.product.version, "0.1.3");
        assert!(m.original_uid.is_none());
    }

    #[test]
    fn metadata_with_original_uid() {
        let m = Metadata::clawdstrike("0.1.3").with_original_uid("evt-123");
        assert_eq!(m.original_uid.as_deref(), Some("evt-123"));
    }

    #[test]
    fn metadata_roundtrip() {
        let m = Metadata::clawdstrike("0.1.3").with_original_uid("uid-1");
        let json = serde_json::to_string(&m).unwrap();
        let m2: Metadata = serde_json::from_str(&json).unwrap();
        assert_eq!(m, m2);
    }
}
