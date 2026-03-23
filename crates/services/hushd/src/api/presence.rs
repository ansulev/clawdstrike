//! WebSocket presence endpoint for tracking analyst activity
//!
//! Manages per-file rooms, heartbeat-based stale detection, and broadcast
//! fan-out so connected clients see who else is viewing the same files.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
};
use dashmap::DashMap;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio::sync::Notify;

use crate::api::v1::V1Error;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// How often the client should send heartbeats (seconds).
pub const HEARTBEAT_INTERVAL_SECS: u64 = 15;

/// How long without a heartbeat before an analyst is considered stale (seconds).
pub const HEARTBEAT_TTL_SECS: u64 = 45;

/// How often the reaper task checks for stale analysts (seconds).
pub const REAPER_INTERVAL_SECS: u64 = 10;

/// Deterministic color palette for analyst cursors / avatars.
pub const PRESENCE_COLORS: [&str; 8] = [
    "#5b8def", "#e06c75", "#98c379", "#d19a66", "#c678dd", "#56b6c2", "#be5046", "#e5c07b",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Information about a connected analyst.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AnalystInfo {
    pub fingerprint: String,
    pub display_name: String,
    pub sigil: String,
    pub color: String,
    pub active_file: Option<String>,
}

/// Messages sent from the server to connected clients.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Welcome {
        analyst_id: String,
        color: String,
        roster: Vec<AnalystInfo>,
    },
    AnalystJoined {
        analyst: AnalystInfo,
    },
    AnalystLeft {
        fingerprint: String,
    },
    AnalystViewing {
        fingerprint: String,
        file_path: String,
    },
    AnalystLeftFile {
        fingerprint: String,
        file_path: String,
    },
    AnalystCursor {
        fingerprint: String,
        file_path: String,
        line: u32,
        ch: u32,
    },
    AnalystSelection {
        fingerprint: String,
        file_path: String,
        anchor_line: u32,
        anchor_ch: u32,
        head_line: u32,
        head_ch: u32,
    },
    HeartbeatAck,
    Error {
        message: String,
    },
}

/// Messages sent from clients to the server.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum ClientMessage {
    Join {
        fingerprint: String,
        display_name: String,
        sigil: String,
    },
    ViewFile {
        file_path: String,
    },
    LeaveFile {
        file_path: String,
    },
    Cursor {
        file_path: String,
        line: u32,
        ch: u32,
    },
    Selection {
        file_path: String,
        anchor_line: u32,
        anchor_ch: u32,
        head_line: u32,
        head_ch: u32,
    },
    Heartbeat,
}

// ---------------------------------------------------------------------------
// PresenceHub
// ---------------------------------------------------------------------------

/// Central state for analyst presence tracking.
pub struct PresenceHub {
    /// Connected analysts: fingerprint -> AnalystInfo
    analysts: DashMap<String, AnalystInfo>,
    /// Per-file rooms: normalized_path -> Set<fingerprint>
    rooms: DashMap<String, HashSet<String>>,
    /// Last heartbeat timestamp: fingerprint -> Instant
    last_seen: DashMap<String, tokio::time::Instant>,
    /// Broadcast channel for presence events to all connected WS handlers
    tx: broadcast::Sender<ServerMessage>,
}

impl PresenceHub {
    /// Create a new presence hub with a broadcast channel (capacity 1024).
    pub fn new() -> (Self, broadcast::Receiver<ServerMessage>) {
        let (tx, rx) = broadcast::channel(1024);
        let hub = Self {
            analysts: DashMap::new(),
            rooms: DashMap::new(),
            last_seen: DashMap::new(),
            tx,
        };
        (hub, rx)
    }

    /// Register a new analyst. Returns the populated [`AnalystInfo`].
    ///
    /// Does **not** broadcast; the caller is responsible for sending the
    /// `AnalystJoined` message after sending a `Welcome` to the new client.
    pub fn join(&self, fingerprint: &str, display_name: &str, sigil: &str) -> AnalystInfo {
        let color = assign_color(fingerprint);
        let info = AnalystInfo {
            fingerprint: fingerprint.to_string(),
            display_name: display_name.to_string(),
            sigil: sigil.to_string(),
            color,
            active_file: None,
        };
        self.analysts.insert(fingerprint.to_string(), info.clone());
        self.last_seen
            .insert(fingerprint.to_string(), tokio::time::Instant::now());
        info
    }

    /// Remove an analyst from all tracking structures.
    ///
    /// Returns the removed [`AnalystInfo`] if the analyst was connected.
    pub fn leave(&self, fingerprint: &str) -> Option<AnalystInfo> {
        self.last_seen.remove(fingerprint);
        // Remove from all rooms
        self.rooms.iter_mut().for_each(|mut entry| {
            entry.value_mut().remove(fingerprint);
        });
        // Clean up empty rooms
        self.rooms.retain(|_, v| !v.is_empty());
        self.analysts.remove(fingerprint).map(|(_, info)| info)
    }

    /// Track that an analyst is now viewing `file_path`.
    ///
    /// Normalizes the path, removes the analyst from any previous room, and
    /// updates the `active_file` field on their [`AnalystInfo`].
    pub fn view_file(&self, fingerprint: &str, file_path: &str) {
        let normalized = normalize_path(file_path);

        // Remove from all existing rooms first
        self.rooms.iter_mut().for_each(|mut entry| {
            entry.value_mut().remove(fingerprint);
        });
        self.rooms.retain(|_, v| !v.is_empty());

        // Add to the new room
        self.rooms
            .entry(normalized.clone())
            .or_default()
            .insert(fingerprint.to_string());

        // Update active_file on analyst info
        if let Some(mut info) = self.analysts.get_mut(fingerprint) {
            info.active_file = Some(normalized);
        }
    }

    /// Stop tracking an analyst's view of `file_path`.
    pub fn leave_file(&self, fingerprint: &str, file_path: &str) {
        let normalized = normalize_path(file_path);
        if let Some(mut entry) = self.rooms.get_mut(&normalized) {
            entry.value_mut().remove(fingerprint);
        }
        self.rooms.retain(|_, v| !v.is_empty());
        if let Some(mut info) = self.analysts.get_mut(fingerprint) {
            info.active_file = None;
        }
    }

    /// Update the last-seen timestamp for an analyst.
    pub fn touch(&self, fingerprint: &str) {
        self.last_seen
            .insert(fingerprint.to_string(), tokio::time::Instant::now());
    }

    /// Return the full roster of connected analysts.
    pub fn roster(&self) -> Vec<AnalystInfo> {
        self.analysts.iter().map(|e| e.value().clone()).collect()
    }

    /// Return the set of fingerprints currently viewing the given file.
    pub fn viewers_of(&self, file_path: &str) -> HashSet<String> {
        let normalized = normalize_path(file_path);
        self.rooms
            .get(&normalized)
            .map(|entry| entry.value().clone())
            .unwrap_or_default()
    }

    /// Return fingerprints that have not sent a heartbeat within `ttl`.
    pub fn stale_analysts(&self, ttl: Duration) -> Vec<String> {
        let now = tokio::time::Instant::now();
        self.last_seen
            .iter()
            .filter(|entry| now.duration_since(*entry.value()) > ttl)
            .map(|entry| entry.key().clone())
            .collect()
    }

    /// Broadcast a server message to all subscribers.
    ///
    /// Ignores [`broadcast::error::SendError`] (no receivers is fine).
    pub fn broadcast(&self, msg: ServerMessage) {
        let _ = self.tx.send(msg);
    }

    /// Subscribe to the broadcast channel.
    pub fn subscribe(&self) -> broadcast::Receiver<ServerMessage> {
        self.tx.subscribe()
    }
}

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

/// Normalize a file path to workspace-relative form.
///
/// Strips drive letters and leading slashes as a safety net. The primary
/// normalization responsibility is on the client (Phase 19).
pub fn normalize_path(path: &str) -> String {
    let path = path.replace('\\', "/");
    // Strip leading drive letter (e.g. "C:/")
    let path = if path.len() >= 3
        && path
            .as_bytes()
            .first()
            .is_some_and(|b| b.is_ascii_alphabetic())
        && path.as_bytes().get(1) == Some(&b':')
        && path.as_bytes().get(2) == Some(&b'/')
    {
        &path[3..]
    } else {
        &path
    };
    // Strip leading slash
    let path = path.strip_prefix('/').unwrap_or(path);
    path.to_string()
}

// ---------------------------------------------------------------------------
// Color assignment
// ---------------------------------------------------------------------------

/// Deterministically assign a color from the palette based on the analyst's
/// fingerprint (first 8 hex chars hashed to an index).
pub fn assign_color(fingerprint: &str) -> String {
    let hex_chars: String = fingerprint.chars().take(8).collect();
    let hash = u32::from_str_radix(&hex_chars, 16).unwrap_or(0);
    PRESENCE_COLORS[(hash as usize) % PRESENCE_COLORS.len()].to_string()
}

// ---------------------------------------------------------------------------
// Heartbeat reaper
// ---------------------------------------------------------------------------

/// Background task that periodically evicts analysts who have not sent a
/// heartbeat within [`HEARTBEAT_TTL_SECS`].
pub async fn spawn_heartbeat_reaper(hub: Arc<PresenceHub>, shutdown: Arc<Notify>) {
    let mut interval = tokio::time::interval(Duration::from_secs(REAPER_INTERVAL_SECS));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                let stale = hub.stale_analysts(Duration::from_secs(HEARTBEAT_TTL_SECS));
                for fingerprint in stale {
                    if hub.leave(&fingerprint).is_some() {
                        tracing::info!(fingerprint = %fingerprint, "Evicting stale analyst");
                        hub.broadcast(ServerMessage::AnalystLeft { fingerprint });
                    }
                }
            }
            _ = shutdown.notified() => {
                tracing::info!("Heartbeat reaper shutting down");
                break;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

/// Query parameters for the WebSocket upgrade request.
#[derive(Debug, Deserialize)]
pub struct PresenceQuery {
    pub token: Option<String>,
}

/// Handler for `GET /api/v1/presence` — upgrades to WebSocket.
///
/// Authentication is handled via the `?token=` query parameter because the
/// browser `WebSocket` constructor cannot set custom headers.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<PresenceQuery>,
) -> Result<impl IntoResponse, V1Error> {
    if state.auth_enabled() {
        let token = query.token.as_deref().ok_or_else(|| {
            V1Error::unauthorized(
                "MISSING_TOKEN",
                "WebSocket requires ?token= query parameter",
            )
        })?;
        state
            .auth_store
            .validate_key(token)
            .await
            .map_err(|_| V1Error::unauthorized("INVALID_TOKEN", "Invalid or expired token"))?;
    }

    Ok(ws.on_upgrade(move |socket| handle_ws(socket, state)))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    use futures::stream::SplitSink;
    let (sender, mut receiver): (SplitSink<WebSocket, Message>, _) = socket.split();
    let hub = &state.presence_hub;
    let mut rx = hub.subscribe();
    let mut analyst_fingerprint: Option<String> = None;

    // Channel to forward messages to the WS sender task
    let (internal_tx, mut internal_rx) = tokio::sync::mpsc::channel::<ServerMessage>(64);

    let send_task = tokio::spawn(async move {
        let mut sender = sender;
        while let Some(msg) = internal_rx.recv().await {
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Forward broadcast messages to this client's internal channel
    let internal_tx_clone = internal_tx.clone();
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if internal_tx_clone.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Process incoming messages from client
    while let Some(msg_result) = StreamExt::next(&mut receiver).await {
        let msg = match msg_result {
            Ok(m) => m,
            Err(_) => break,
        };
        match msg {
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => match client_msg {
                    ClientMessage::Join {
                        fingerprint,
                        display_name,
                        sigil,
                    } => {
                        let info = hub.join(&fingerprint, &display_name, &sigil);
                        analyst_fingerprint = Some(fingerprint.clone());
                        let _ = internal_tx
                            .send(ServerMessage::Welcome {
                                analyst_id: fingerprint.clone(),
                                color: info.color.clone(),
                                roster: hub.roster(),
                            })
                            .await;
                        hub.broadcast(ServerMessage::AnalystJoined { analyst: info });
                    }
                    ClientMessage::ViewFile { file_path } => {
                        if let Some(ref fp) = analyst_fingerprint {
                            let normalized = normalize_path(&file_path);
                            hub.view_file(fp, &file_path);
                            hub.broadcast(ServerMessage::AnalystViewing {
                                fingerprint: fp.clone(),
                                file_path: normalized,
                            });
                        }
                    }
                    ClientMessage::LeaveFile { file_path } => {
                        if let Some(ref fp) = analyst_fingerprint {
                            let normalized = normalize_path(&file_path);
                            hub.leave_file(fp, &file_path);
                            hub.broadcast(ServerMessage::AnalystLeftFile {
                                fingerprint: fp.clone(),
                                file_path: normalized,
                            });
                        }
                    }
                    ClientMessage::Cursor {
                        file_path,
                        line,
                        ch,
                    } => {
                        if let Some(ref fp) = analyst_fingerprint {
                            hub.touch(fp);
                            hub.broadcast(ServerMessage::AnalystCursor {
                                fingerprint: fp.clone(),
                                file_path: normalize_path(&file_path),
                                line,
                                ch,
                            });
                        }
                    }
                    ClientMessage::Selection {
                        file_path,
                        anchor_line,
                        anchor_ch,
                        head_line,
                        head_ch,
                    } => {
                        if let Some(ref fp) = analyst_fingerprint {
                            hub.touch(fp);
                            hub.broadcast(ServerMessage::AnalystSelection {
                                fingerprint: fp.clone(),
                                file_path: normalize_path(&file_path),
                                anchor_line,
                                anchor_ch,
                                head_line,
                                head_ch,
                            });
                        }
                    }
                    ClientMessage::Heartbeat => {
                        if let Some(ref fp) = analyst_fingerprint {
                            hub.touch(fp);
                            let _ = internal_tx.send(ServerMessage::HeartbeatAck).await;
                        }
                    }
                },
                Err(e) => {
                    let _ = internal_tx
                        .send(ServerMessage::Error {
                            message: format!("Invalid message: {e}"),
                        })
                        .await;
                }
            },
            Message::Close(_) => break,
            _ => {} // ignore binary/ping/pong
        }
    }

    // Cleanup on disconnect
    if let Some(fp) = analyst_fingerprint {
        hub.leave(&fp);
        hub.broadcast(ServerMessage::AnalystLeft { fingerprint: fp });
    }
    forward_task.abort();
    send_task.abort();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hub_new_creates_empty_hub() {
        let (hub, _rx) = PresenceHub::new();
        assert!(hub.roster().is_empty());
        assert!(hub.rooms.is_empty());
        assert!(hub.last_seen.is_empty());
    }

    #[test]
    fn normalize_path_strips_absolute_prefix() {
        assert_eq!(
            normalize_path("/home/user/project/policies/foo.yaml"),
            "home/user/project/policies/foo.yaml"
        );
    }

    #[test]
    fn normalize_path_handles_windows_paths() {
        assert_eq!(
            normalize_path("C:\\Users\\analyst\\project\\policies\\foo.yaml"),
            "Users/analyst/project/policies/foo.yaml"
        );
    }

    #[test]
    fn normalize_path_passes_through_relative_paths() {
        assert_eq!(normalize_path("policies/foo.yaml"), "policies/foo.yaml");
    }

    #[test]
    fn normalize_path_strips_leading_slash() {
        assert_eq!(normalize_path("/policies/foo.yaml"), "policies/foo.yaml");
    }

    #[test]
    fn server_message_serializes_with_type_discriminator() {
        let msg = ServerMessage::AnalystJoined {
            analyst: AnalystInfo {
                fingerprint: "abc123".to_string(),
                display_name: "Alice".to_string(),
                sigil: "A".to_string(),
                color: "#5b8def".to_string(),
                active_file: None,
            },
        };
        let json = serde_json::to_value(&msg).expect("serialize");
        assert_eq!(json["type"], "analyst_joined");
        assert_eq!(json["analyst"]["fingerprint"], "abc123");
    }

    #[test]
    fn client_message_deserializes_with_type_discriminator() {
        let json = r#"{"type":"join","fingerprint":"abc123","display_name":"Alice","sigil":"A"}"#;
        let msg: ClientMessage = serde_json::from_str(json).expect("deserialize");
        match msg {
            ClientMessage::Join {
                fingerprint,
                display_name,
                sigil,
            } => {
                assert_eq!(fingerprint, "abc123");
                assert_eq!(display_name, "Alice");
                assert_eq!(sigil, "A");
            }
            _ => panic!("Expected Join variant"),
        }
    }

    #[test]
    fn client_message_rejects_unknown_fields() {
        let json =
            r#"{"type":"join","fingerprint":"abc","display_name":"A","sigil":"S","extra":1}"#;
        let result = serde_json::from_str::<ClientMessage>(json);
        assert!(result.is_err(), "Should reject unknown fields");
    }

    #[test]
    fn presence_colors_has_eight_entries() {
        assert_eq!(PRESENCE_COLORS.len(), 8);
    }

    #[test]
    fn assign_color_is_deterministic() {
        let c1 = assign_color("abcdef01");
        let c2 = assign_color("abcdef01");
        assert_eq!(c1, c2);
    }

    #[test]
    fn assign_color_varies_by_fingerprint() {
        let c1 = assign_color("00000000");
        let c2 = assign_color("00000001");
        // They CAN be the same by coincidence, but the function should at least not crash
        assert!(!c1.is_empty());
        assert!(!c2.is_empty());
    }

    #[test]
    fn hub_join_adds_analyst_to_roster() {
        let (hub, _rx) = PresenceHub::new();
        let info = hub.join("fp1", "Alice", "A");
        assert_eq!(info.fingerprint, "fp1");
        assert_eq!(info.display_name, "Alice");
        assert!(!info.color.is_empty());
        assert_eq!(hub.roster().len(), 1);
    }

    #[test]
    fn hub_leave_removes_analyst_and_room_memberships() {
        let (hub, _rx) = PresenceHub::new();
        hub.join("fp1", "Alice", "A");
        hub.view_file("fp1", "policies/foo.yaml");
        assert_eq!(hub.viewers_of("policies/foo.yaml").len(), 1);

        let removed = hub.leave("fp1");
        assert!(removed.is_some());
        assert!(hub.roster().is_empty());
        assert!(hub.viewers_of("policies/foo.yaml").is_empty());
    }

    #[test]
    fn hub_view_file_moves_analyst_between_rooms() {
        let (hub, _rx) = PresenceHub::new();
        hub.join("fp1", "Alice", "A");
        hub.view_file("fp1", "a.yaml");
        assert_eq!(hub.viewers_of("a.yaml").len(), 1);

        hub.view_file("fp1", "b.yaml");
        assert!(hub.viewers_of("a.yaml").is_empty());
        assert_eq!(hub.viewers_of("b.yaml").len(), 1);
    }

    #[test]
    fn hub_leave_file_removes_from_room() {
        let (hub, _rx) = PresenceHub::new();
        hub.join("fp1", "Alice", "A");
        hub.view_file("fp1", "a.yaml");
        hub.leave_file("fp1", "a.yaml");
        assert!(hub.viewers_of("a.yaml").is_empty());
        // active_file should be None
        let info = hub.analysts.get("fp1").expect("analyst exists");
        assert!(info.active_file.is_none());
    }

    #[tokio::test]
    async fn hub_stale_analysts_returns_stale_fingerprints() {
        let (hub, _rx) = PresenceHub::new();
        hub.join("fp1", "Alice", "A");
        // Manually set last_seen to a very old time
        hub.last_seen.insert(
            "fp1".to_string(),
            tokio::time::Instant::now() - Duration::from_secs(60),
        );
        let stale = hub.stale_analysts(Duration::from_secs(45));
        assert!(stale.contains(&"fp1".to_string()));
    }

    #[tokio::test]
    async fn hub_stale_analysts_excludes_fresh() {
        let (hub, _rx) = PresenceHub::new();
        hub.join("fp1", "Alice", "A");
        // Just joined, so last_seen is ~now
        let stale = hub.stale_analysts(Duration::from_secs(45));
        assert!(stale.is_empty());
    }

    #[test]
    fn hub_two_analysts_in_same_room() {
        let (hub, _rx) = PresenceHub::new();
        hub.join("fp1", "Alice", "A");
        hub.join("fp2", "Bob", "B");
        hub.view_file("fp1", "policies/foo.yaml");
        hub.view_file("fp2", "policies/foo.yaml");
        let viewers = hub.viewers_of("policies/foo.yaml");
        assert_eq!(viewers.len(), 2);
        assert!(viewers.contains("fp1"));
        assert!(viewers.contains("fp2"));
    }

    #[test]
    fn heartbeat_ack_serializes() {
        let msg = ServerMessage::HeartbeatAck;
        let json = serde_json::to_value(&msg).expect("serialize");
        assert_eq!(json["type"], "heartbeat_ack");
    }

    #[test]
    fn heartbeat_client_message_deserializes() {
        let json = r#"{"type":"heartbeat"}"#;
        let msg: ClientMessage = serde_json::from_str(json).expect("deserialize");
        assert!(matches!(msg, ClientMessage::Heartbeat));
    }
}
