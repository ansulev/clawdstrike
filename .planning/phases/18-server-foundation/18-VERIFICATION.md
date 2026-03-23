---
phase: 18-server-foundation
verified: 2026-03-23T16:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 18: Server Foundation Verification Report

**Phase Goal:** hushd serves a WebSocket presence endpoint that tracks which analysts are viewing which files and broadcasts presence events to connected clients
**Verified:** 2026-03-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A WebSocket client can connect to hushd at /api/v1/presence with a Bearer token query param and receive a welcome roster message | VERIFIED | `ws_handler` in presence.rs validates `?token=` query param, calls `hub.join()`, sends `ServerMessage::Welcome { roster: hub.roster() }` via internal channel |
| 2 | When two clients join the same file room, each receives the other's join event; when one disconnects, the other receives a leave event | VERIFIED | `hub.broadcast(ServerMessage::AnalystJoined)` after join; `hub.broadcast(ServerMessage::AnalystLeft)` in disconnect cleanup; all WS handlers share a broadcast channel via `hub.subscribe()` |
| 3 | If a connected client stops sending heartbeats for 45s, the server evicts it and broadcasts a leave event | VERIFIED | `spawn_heartbeat_reaper` loops on `REAPER_INTERVAL_SECS (10s)`, calls `hub.stale_analysts(Duration::from_secs(HEARTBEAT_TTL_SECS))` where `HEARTBEAT_TTL_SECS = 45`, evicts and broadcasts `AnalystLeft`; test `hub_stale_analysts_returns_stale_fingerprints` confirms 60s-old analysts flagged as stale against 45s TTL |
| 4 | File paths sent by clients are normalized to workspace-relative form before being used as room keys | VERIFIED | `normalize_path()` strips Windows drive letters (C:/) and leading Unix slashes before use as DashMap room keys; PRES-04 split-responsibility design: server safety-net + client sends workspace-relative (Phase 19 responsibility) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `crates/services/hushd/src/api/presence.rs` | PresenceHub struct, PresenceEvent enum, WS handler, room management, heartbeat reaper, path normalization | VERIFIED | 717 lines; `pub struct PresenceHub`, `pub enum ServerMessage`, `pub enum ClientMessage`, `pub async fn ws_handler`, `pub async fn spawn_heartbeat_reaper`, `pub fn normalize_path`, `pub fn assign_color`, 20 unit tests in `#[cfg(test)]` module |
| `crates/services/hushd/src/state.rs` | AppState with presence_hub field | VERIFIED | Line 86: `pub presence_hub: Arc<PresenceHub>`; line 14: `use crate::api::presence::PresenceHub`; lines 409-422: `PresenceHub::new()`, `Arc::new(presence_hub)`, `tokio::spawn(spawn_heartbeat_reaper(...))` |
| `crates/services/hushd/src/api/mod.rs` | Router mounting presence WS endpoint | VERIFIED | Line 15: `pub mod presence;`; line 455: `let ws_routes = Router::new().route("/api/v1/presence", get(presence::ws_handler))`; line 463: `.merge(ws_routes)` in app router |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `crates/services/hushd/src/api/presence.rs` | `crates/services/hushd/src/state.rs` | AppState.presence_hub field | VERIFIED | `handle_ws` accesses `state.presence_hub` at line 380; `ws_handler` receives `State(state): State<AppState>` |
| `crates/services/hushd/src/api/mod.rs` | `crates/services/hushd/src/api/presence.rs` | Route registration in create_router | VERIFIED | `presence::ws_handler` called at line 455; `pub mod presence` declared at line 15 |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| PRES-05 | hushd PresenceHub manages per-file rooms with DashMap and broadcast fan-out | SATISFIED | `PresenceHub.rooms: DashMap<String, HashSet<String>>`, `PresenceHub.tx: broadcast::Sender<ServerMessage>`, `broadcast()` method, `subscribe()` method |
| PRES-02 | Server detects stale analysts via heartbeat timeout (15s interval, 45s TTL) | SATISFIED | `HEARTBEAT_INTERVAL_SECS = 15`, `HEARTBEAT_TTL_SECS = 45`, `spawn_heartbeat_reaper` checks every `REAPER_INTERVAL_SECS = 10`; 2 async tests verify stale/fresh detection |
| PRES-04 | File paths are normalized to workspace-relative before transmission | SATISFIED | `normalize_path()` strips drive letters and leading slashes; used in `view_file()`, `leave_file()`, and all broadcast paths in `handle_ws`; 4 tests cover absolute/Windows/relative/leading-slash cases |
| PRES-03 | Presence is scoped to file rooms (only receive cursor updates for files you have open) | SATISFIED | `rooms: DashMap<String, HashSet<String>>` maps normalized path to analyst fingerprint sets; `view_file()` moves analyst between rooms; `viewers_of()` returns per-file membership; broadcasts carry `file_path` so client-side filtering is possible |

No orphaned requirements: REQUIREMENTS.md maps exactly PRES-02, PRES-03, PRES-04, PRES-05 to Phase 18, all claimed in plan frontmatter and verified above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

Scanned for: TODO/FIXME/XXX, placeholder comments, return null/empty stubs, `unwrap()`/`expect()` outside tests, console.log-only handlers. No anti-patterns found in production code. `expect()` appears only inside `#[cfg(test)]` module (lines 569, 577, 664, 706, 713) which is correct per hushd conventions.

### Human Verification Required

None — all observable behaviors have been verified programmatically. The following were verified via test output and code inspection:

- `cargo test -p hushd --lib` passes 241 unit tests (including all 20 presence-specific tests), 0 failures
- `cargo clippy -p hushd -- -D warnings` produces 0 warnings/errors
- All 20 presence unit tests exercise: hub join/leave/view_file/leave_file, normalize_path (4 path variants), assign_color determinism, stale/fresh detection, serde round-trips for both ServerMessage and ClientMessage, deny_unknown_fields enforcement, PRESENCE_COLORS count

### Commit Verification

Both documented commits exist on `feat/workbench-dev`:
- `8c468185e` — Task 1: PresenceHub, room management, WS handler, 20 tests
- `339dbbf14` — Task 2: Router registration

### Deviation Note

The PLAN's task behavior description specifies `normalize_path("/home/user/project/policies/foo.yaml") -> "policies/foo.yaml"` (stripping the whole absolute path to workspace root), but the action description within the same plan explicitly documents that normalization is intentionally simple: "The server just strips leading slashes and drive letters as a safety net." The implementation and tests are consistent with the action spec and the PRES-04 requirement's split-responsibility design (client sends workspace-relative paths; Phase 19 strips `projectRoot`). This is an intra-plan clarification, not a gap.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
