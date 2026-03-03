//! OCSF Actor object.

use serde::{Deserialize, Serialize};

use super::process::OcsfUser;

/// OCSF Actor object identifying who performed the action.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Actor {
    /// User who performed the action.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<OcsfUser>,
    /// Application / agent that performed the action.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    /// Application UID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_uid: Option<String>,
    /// Session information.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<ActorSession>,
}

/// Minimal session object within an Actor.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActorSession {
    /// Session UID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn actor_roundtrip() {
        let a = Actor {
            user: Some(OcsfUser {
                name: Some("agent-1".to_string()),
                uid: Some("agent-1".to_string()),
            }),
            app_name: Some("clawdstrike".to_string()),
            app_uid: Some("hushd".to_string()),
            session: Some(ActorSession {
                uid: Some("sess-123".to_string()),
            }),
        };
        let json = serde_json::to_string(&a).unwrap();
        let a2: Actor = serde_json::from_str(&json).unwrap();
        assert_eq!(a, a2);
    }
}
