---
phase: 18-server-foundation
plan: 01
subsystem: api
tags: [websocket, presence, dashmap, broadcast, axum, tokio]

# Dependency graph
requires: []
provides:
  - PresenceHub struct with DashMap room management and heartbeat TTL
  - ServerMessage/ClientMessage wire protocol enums with JSON type discriminator
  - /api/v1/presence WebSocket endpoint with query-param auth
  - normalize_path utility for workspace-relative file paths
  - assign_color deterministic palette assignment from fingerprint
  - spawn_heartbeat_reaper background task for stale analyst eviction
affects: [19-client-connection, 20-editor-cursors, 21-presence-ui]

# Tech tracking
tech-stack:
  added: [axum-ws]
  patterns: [DashMap-based concurrent room state, broadcast channel fan-out, query-param WS auth]

key-files:
  created:
    - crates/services/hushd/src/api/presence.rs
  modified:
    - crates/services/hushd/src/state.rs
    - crates/services/hushd/src/api/mod.rs
    - crates/services/hushd/Cargo.toml

key-decisions:
  - "WS route placed outside require_auth middleware layer (browser WS API cannot set custom headers); auth handled internally via ?token= query param"
  - "axum ws feature added to hushd Cargo.toml (not workspace-wide) to minimize dependency scope"
  - "PresenceHub field added to AppState and reaper spawned in AppState::new() for simplicity"

patterns-established:
  - "Query-param auth for WebSocket endpoints: ws_handler validates ?token= internally rather than relying on header-based middleware"
  - "DashMap + broadcast::channel pattern for concurrent room state with fan-out to subscribers"

requirements-completed: [PRES-05, PRES-02, PRES-04, PRES-03]

# Metrics
duration: 33min
completed: 2026-03-23
---

# Phase 18 Plan 01: PresenceHub Summary

**WebSocket presence endpoint with DashMap room management, heartbeat reaper, 8-color palette assignment, and 20 unit tests**

## Performance

- **Duration:** 33 min
- **Started:** 2026-03-23T15:08:01Z
- **Completed:** 2026-03-23T15:41:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PresenceHub tracks analyst connections in DashMap with per-file rooms and heartbeat-based stale detection (45s TTL)
- ServerMessage/ClientMessage enums serialize with `{"type":"snake_case"}` JSON discriminator; ClientMessage uses deny_unknown_fields (fail-closed)
- /api/v1/presence WebSocket endpoint with query-param auth registered outside header-based auth middleware
- 20 unit tests covering hub join/leave/view_file/leave_file, normalize_path (absolute/Windows/relative), assign_color determinism, stale detection, and serde round-trips

## Task Commits

Each task was committed atomically:

1. **Task 1: PresenceHub struct, types, room management, heartbeat reaper, path normalization** - `8c468185e` (feat)
2. **Task 2: Wire PresenceHub into AppState and router** - `339dbbf14` (feat)

## Files Created/Modified
- `crates/services/hushd/src/api/presence.rs` - PresenceHub, ServerMessage/ClientMessage enums, ws_handler, spawn_heartbeat_reaper, normalize_path, assign_color, 20 tests
- `crates/services/hushd/src/state.rs` - Added presence_hub: Arc<PresenceHub> field, initialization, reaper spawn
- `crates/services/hushd/src/api/mod.rs` - Added pub mod presence; added /api/v1/presence WS route
- `crates/services/hushd/Cargo.toml` - Enabled axum ws feature
- `Cargo.lock` - Updated lockfile for ws feature

## Decisions Made
- WS route placed outside require_auth middleware (browser WS API cannot set headers); auth validated internally via ?token= query param, consistent with how browser-based WebSocket clients connect
- axum ws feature enabled only for hushd crate (not workspace-wide) to keep dependency scope minimal
- PresenceHub wired into AppState directly rather than through a separate init function, and reaper spawned inside AppState::new() for simplicity (matches existing patterns like SIEM exporter manager spawn)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PresenceHub wired into AppState during Task 1**
- **Found during:** Task 1 (presence.rs creation)
- **Issue:** presence.rs references `state.presence_hub` in the ws_handler, but AppState didn't have that field yet. Module would not compile without it.
- **Fix:** Added `presence_hub: Arc<PresenceHub>` field to AppState, initialization in `AppState::new()`, and heartbeat reaper spawn -- all originally planned for Task 2
- **Files modified:** crates/services/hushd/src/state.rs
- **Verification:** cargo test -p hushd passes (241 unit + 92 integration tests)
- **Committed in:** 8c468185e (Task 1 commit)

**2. [Rule 3 - Blocking] Enabled axum ws feature**
- **Found during:** Task 1 (compilation)
- **Issue:** `axum::extract::ws` module gated behind `ws` feature, not enabled in workspace default
- **Fix:** Added `features = ["ws"]` to hushd's axum dependency in Cargo.toml
- **Files modified:** crates/services/hushd/Cargo.toml
- **Verification:** Compilation succeeds, all WS types available
- **Committed in:** 8c468185e (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were necessary for compilation. Task 2 scope reduced to only router registration since AppState wiring was pulled forward. No scope creep.

## Issues Encountered
None - all issues were blocking compilation problems resolved via Rule 3 auto-fixes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /api/v1/presence WebSocket endpoint is registered and ready for client connections
- Phase 19 (Client Connection & Store) can build the Zustand store that connects to this endpoint
- Wire protocol (ServerMessage/ClientMessage) is fully specified with JSON type discriminators

## Self-Check: PASSED

- FOUND: crates/services/hushd/src/api/presence.rs
- FOUND: .planning/phases/18-server-foundation/18-01-SUMMARY.md
- FOUND: commit 8c468185e (Task 1)
- FOUND: commit 339dbbf14 (Task 2)

---
*Phase: 18-server-foundation*
*Completed: 2026-03-23*
