//! OCSF Observable object.

use serde::{Deserialize, Serialize};

/// OCSF Observable type IDs.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum ObservableTypeId {
    /// Unknown observable type.
    Unknown = 0,
    /// IP address.
    IpAddress = 2,
    /// Domain name.
    Domain = 3,
    /// File path.
    FilePath = 7,
    /// File name.
    FileName = 8,
    /// Process name.
    ProcessName = 9,
    /// URL.
    Url = 20,
    /// Hash.
    Hash = 28,
    /// Other (vendor-specific).
    Other = 99,
}

impl ObservableTypeId {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF Observable object — a key-value pair identifying something observed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Observable {
    /// Human-readable name of the observable.
    pub name: String,
    /// Observable value.
    pub value: String,
    /// Observable type ID.
    pub type_id: u8,
    /// Human-readable type label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn observable_roundtrip() {
        let o = Observable {
            name: "file.path".to_string(),
            value: "/etc/shadow".to_string(),
            type_id: ObservableTypeId::FilePath.as_u8(),
            r#type: Some("File Path".to_string()),
        };
        let json = serde_json::to_string(&o).unwrap();
        let o2: Observable = serde_json::from_str(&json).unwrap();
        assert_eq!(o, o2);
    }
}
