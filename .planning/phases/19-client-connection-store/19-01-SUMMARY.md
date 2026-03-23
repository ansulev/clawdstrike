---
phase: 19-client-connection-store
plan: 01
subsystem: ui
tags: [websocket, presence, wire-protocol, reconnect, heartbeat]

# Dependency graph
requires:
  - phase: 18-server-foundation
    provides: PresenceHub WS endpoint at /api/v1/presence with ServerMessage/ClientMessage enums
provides:
  - Wire protocol types (ServerMessageRaw, ClientMessage, AnalystPresence, AnalystInfoWire)
  - PresenceSocket WebSocket connection manager with jittered backoff and heartbeat
affects: [19-client-connection-store, 20-editor-decorations]

# Tech tracking
tech-stack:
  added: []
  patterns: [jittered-exponential-backoff, callback-based-socket-manager]

key-files:
  created:
    - apps/workbench/src/features/presence/types.ts
    - apps/workbench/src/features/presence/presence-socket.ts
  modified: []

key-decisions:
  - "Raw wire types keep snake_case field names; parseAnalystInfo converts to camelCase AnalystPresence"
  - "PresenceSocket is a standalone class (not React) to be consumed by Zustand store in Plan 19-02"

patterns-established:
  - "Wire protocol types mirror server serde output exactly, with separate raw and parsed representations"
  - "Jittered backoff: delay * (0.5 + Math.random() * 0.5) prevents thundering herd on server restart"

requirements-completed: [CONN-01, CONN-02]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 19 Plan 01: Presence Wire Protocol & Socket Summary

**WebSocket transport layer with typed wire protocol matching server enums, jittered exponential backoff, and 15-second heartbeat**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T16:07:03Z
- **Completed:** 2026-03-23T16:10:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Wire protocol types (ServerMessageRaw, ClientMessage) matching server's serde snake_case output field-for-field
- PresenceSocket class with native browser WebSocket, ?token= query param auth, and callback-based message routing
- Jittered exponential backoff reconnect (50-100% of base delay) preventing thundering herd on hushd restart
- 15-second heartbeat timer matching server's HEARTBEAT_INTERVAL_SECS constant

## Task Commits

Each task was committed atomically:

1. **Task 1: Create presence wire protocol types** - `d1ee52f0f` (feat)
2. **Task 2: Create PresenceSocket connection manager** - `6622af8c7` (feat)

## Files Created/Modified
- `apps/workbench/src/features/presence/types.ts` - Wire protocol types, AnalystPresence interface, parseAnalystInfo helper, constants
- `apps/workbench/src/features/presence/presence-socket.ts` - WebSocket lifecycle manager with reconnect, heartbeat, and message routing

## Decisions Made
- Raw wire types keep snake_case field names matching server output; parseAnalystInfo converts to camelCase for client consumption
- PresenceSocket follows FleetEventStream pattern (standalone class, not React) so Zustand store in Plan 19-02 can drive it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wire protocol types and PresenceSocket ready for consumption by presence-store (Plan 19-02)
- No blockers or concerns

---
*Phase: 19-client-connection-store*
*Completed: 2026-03-23*
