//! OCSF Network Activity (class_uid = 4001, category_uid = 4 Network Activity).
//!
//! Activity IDs: 1=Open, 2=Close, 3=Reset, 4=Fail, 5=Refuse, 6=Traffic.

use serde::{Deserialize, Serialize};

use crate::base::{category_for_class, compute_type_uid, ClassUid};
use crate::objects::actor::Actor;
use crate::objects::metadata::Metadata;
use crate::objects::network_endpoint::{ConnectionInfo, NetworkEndpoint};

/// OCSF activity IDs for Network Activity.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum NetworkActivityType {
    /// Connection opened.
    Open = 1,
    /// Connection closed.
    Close = 2,
    /// Connection reset.
    Reset = 3,
    /// Connection failed.
    Fail = 4,
    /// Connection refused.
    Refuse = 5,
    /// Generic traffic observed.
    Traffic = 6,
    /// Other (vendor-specific).
    Other = 99,
}

impl NetworkActivityType {
    /// Returns the integer representation.
    #[must_use]
    pub const fn as_u8(self) -> u8 {
        self as u8
    }
}

/// OCSF Network Activity event (class_uid = 4001).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NetworkActivity {
    // ── OCSF base fields ──
    /// Always 4001.
    pub class_uid: u16,
    /// Always 4 (Network Activity).
    pub category_uid: u8,
    /// `class_uid * 100 + activity_id`.
    pub type_uid: u32,
    /// Activity ID.
    pub activity_id: u8,
    /// Human-readable activity name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activity_name: Option<String>,
    /// Event time as epoch milliseconds.
    pub time: i64,
    /// Severity ID (0-6, 99).
    pub severity_id: u8,
    /// Human-readable severity label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    /// Status ID (0=Unknown, 1=Success, 2=Failure).
    pub status_id: u8,
    /// Human-readable status label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    /// Human-readable event message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Metadata (required).
    pub metadata: Metadata,

    // ── Network Activity-specific fields ──
    /// Source endpoint.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src_endpoint: Option<NetworkEndpoint>,
    /// Destination endpoint.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dst_endpoint: Option<NetworkEndpoint>,
    /// Connection info.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_info: Option<ConnectionInfo>,
    /// Actor who initiated the network activity.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<Actor>,
    /// Action ID (1=Allowed, 2=Denied).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_id: Option<u8>,
    /// Disposition ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disposition_id: Option<u8>,
    /// Vendor-specific unmapped data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unmapped: Option<serde_json::Value>,
}

impl NetworkActivity {
    /// Create a new Network Activity event with required fields.
    #[must_use]
    pub fn new(
        activity: NetworkActivityType,
        time: i64,
        severity_id: u8,
        status_id: u8,
        metadata: Metadata,
    ) -> Self {
        let class_uid = ClassUid::NetworkActivity;
        let activity_id = activity.as_u8();
        Self {
            class_uid: class_uid.as_u16(),
            category_uid: category_for_class(class_uid).as_u8(),
            type_uid: compute_type_uid(class_uid.as_u16(), activity_id),
            activity_id,
            activity_name: Some(network_activity_name(activity).to_string()),
            time,
            severity_id,
            severity: None,
            status_id,
            status: None,
            message: None,
            metadata,
            src_endpoint: None,
            dst_endpoint: None,
            connection_info: None,
            actor: None,
            action_id: None,
            disposition_id: None,
            unmapped: None,
        }
    }

    /// Set the source endpoint.
    #[must_use]
    pub fn with_src_endpoint(mut self, ep: NetworkEndpoint) -> Self {
        self.src_endpoint = Some(ep);
        self
    }

    /// Set the destination endpoint.
    #[must_use]
    pub fn with_dst_endpoint(mut self, ep: NetworkEndpoint) -> Self {
        self.dst_endpoint = Some(ep);
        self
    }

    /// Set connection info.
    #[must_use]
    pub fn with_connection_info(mut self, ci: ConnectionInfo) -> Self {
        self.connection_info = Some(ci);
        self
    }

    /// Set the event message.
    #[must_use]
    pub fn with_message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }

    /// Set the actor.
    #[must_use]
    pub fn with_actor(mut self, actor: Actor) -> Self {
        self.actor = Some(actor);
        self
    }

    /// Set action ID.
    #[must_use]
    pub fn with_action_id(mut self, action_id: u8) -> Self {
        self.action_id = Some(action_id);
        self
    }

    /// Set disposition ID.
    #[must_use]
    pub fn with_disposition_id(mut self, disposition_id: u8) -> Self {
        self.disposition_id = Some(disposition_id);
        self
    }
}

fn network_activity_name(activity: NetworkActivityType) -> &'static str {
    match activity {
        NetworkActivityType::Open => "Open",
        NetworkActivityType::Close => "Close",
        NetworkActivityType::Reset => "Reset",
        NetworkActivityType::Fail => "Fail",
        NetworkActivityType::Refuse => "Refuse",
        NetworkActivityType::Traffic => "Traffic",
        NetworkActivityType::Other => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn class_uid_is_4001() {
        let e = NetworkActivity::new(
            NetworkActivityType::Traffic,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
        );
        assert_eq!(e.class_uid, 4001);
    }

    #[test]
    fn category_uid_is_4() {
        let e = NetworkActivity::new(
            NetworkActivityType::Traffic,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
        );
        assert_eq!(e.category_uid, 4);
    }

    #[test]
    fn type_uid_traffic() {
        let e = NetworkActivity::new(
            NetworkActivityType::Traffic,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
        );
        assert_eq!(e.type_uid, 400106);
    }

    #[test]
    fn type_uid_refuse() {
        let e = NetworkActivity::new(
            NetworkActivityType::Refuse,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
        );
        assert_eq!(e.type_uid, 400105);
    }

    #[test]
    fn type_uid_fail() {
        let e = NetworkActivity::new(
            NetworkActivityType::Fail,
            0,
            0,
            0,
            Metadata::clawdstrike("0.1.3"),
        );
        assert_eq!(e.type_uid, 400104);
    }

    #[test]
    fn serialization_roundtrip() {
        let e = NetworkActivity::new(
            NetworkActivityType::Traffic,
            1_709_366_400_000,
            1,
            1,
            Metadata::clawdstrike("0.1.3"),
        )
        .with_src_endpoint(NetworkEndpoint {
            ip: Some("10.0.0.1".to_string()),
            port: Some(8080),
            domain: None,
            hostname: None,
            subnet_uid: None,
        })
        .with_dst_endpoint(NetworkEndpoint {
            ip: Some("93.184.216.34".to_string()),
            port: Some(443),
            domain: Some("example.com".to_string()),
            hostname: None,
            subnet_uid: None,
        })
        .with_message("Egress traffic observed");

        let json = serde_json::to_string(&e).unwrap();
        let e2: NetworkActivity = serde_json::from_str(&json).unwrap();
        assert_eq!(e.type_uid, e2.type_uid);
        assert_eq!(
            e.dst_endpoint.as_ref().and_then(|ep| ep.domain.as_deref()),
            Some("example.com")
        );
    }
}
