//! OCSF NetworkEndpoint object.

use serde::{Deserialize, Serialize};

/// OCSF Network Endpoint object.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NetworkEndpoint {
    /// IP address.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    /// Port number.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    /// Domain name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    /// Hostname.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    /// Subnet UID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subnet_uid: Option<String>,
}

/// OCSF Network Connection Info object.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConnectionInfo {
    /// Protocol name (e.g., "TCP", "UDP").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol_name: Option<String>,
    /// Protocol number (6=TCP, 17=UDP).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol_num: Option<u8>,
    /// Traffic direction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    /// Direction ID (0=Unknown, 1=Inbound, 2=Outbound, 3=Lateral).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction_id: Option<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_roundtrip() {
        let ep = NetworkEndpoint {
            ip: Some("10.0.0.1".to_string()),
            port: Some(443),
            domain: Some("api.example.com".to_string()),
            hostname: None,
            subnet_uid: None,
        };
        let json = serde_json::to_string(&ep).unwrap();
        let ep2: NetworkEndpoint = serde_json::from_str(&json).unwrap();
        assert_eq!(ep, ep2);
    }

    #[test]
    fn connection_info_roundtrip() {
        let ci = ConnectionInfo {
            protocol_name: Some("TCP".to_string()),
            protocol_num: Some(6),
            direction: Some("Outbound".to_string()),
            direction_id: Some(2),
        };
        let json = serde_json::to_string(&ci).unwrap();
        let ci2: ConnectionInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(ci, ci2);
    }
}
