---
phase: 19-client-connection-store
plan: 02
subsystem: ui
tags: [zustand, immer, websocket, presence, react-hooks]

# Dependency graph
requires:
  - phase: 19-client-connection-store
    provides: "Wire types (AnalystPresence, ServerMessageRaw), PresenceSocket class, parseAnalystInfo helper"
  - phase: 18-server-foundation
    provides: "hushd /api/v1/presence WebSocket endpoint"
provides:
  - "usePresenceStore — Zustand store with analysts Map, viewersByFile index, connection state"
  - "usePresenceConnection — bootstrap hook wiring PresenceSocket to store"
  - "getPresenceSocket() — non-React accessor for CM6 extension (Phase 21)"
affects: [20-presence-ui, 21-cm6-cursors]

# Tech tracking
tech-stack:
  added: []
  patterns: [enableMapSet for immer Map/Set drafting, module-level singleton socket pattern]

key-files:
  created:
    - apps/workbench/src/features/presence/stores/presence-store.ts
    - apps/workbench/src/features/presence/use-presence-connection.ts
  modified:
    - apps/workbench/src/App.tsx

key-decisions:
  - "enableMapSet() from immer required for Map/Set mutations in Zustand store"
  - "Module-level PresenceSocket singleton prevents duplicate WebSocket connections"
  - "getPresenceSocket() exported for Phase 21 CM6 ViewPlugin (non-React consumer)"

patterns-established:
  - "Immer enableMapSet() pattern: call at module top before store creation when using Map/Set in state"
  - "Fresh credential reads: getApiKey/getIdentity use getState() at call time, not captured values"

requirements-completed: [CONN-04, PRES-01]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 19 Plan 02: Presence Store & Bootstrap Hook Summary

**Zustand presence store with analysts Map, viewersByFile index, 9-message-type router, and bootstrap hook wiring PresenceSocket to store via fleet credentials**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T16:12:11Z
- **Completed:** 2026-03-23T16:15:44Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Zustand presence store with Map-based analysts roster and viewersByFile reverse index
- handleServerMessage router handling all 9 server message types with correct index maintenance
- Bootstrap hook creating singleton PresenceSocket, reading fleet credentials and operator identity fresh
- getPresenceSocket() exported for non-React consumers (Phase 21 CM6 extension)
- Graceful offline degradation: empty Maps and "idle" state when hushd unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Create presence-store Zustand store** - `1b49f5b86` (feat)
2. **Task 2: Create use-presence-connection bootstrap hook** - `38cd3482d` (feat)
3. **Task 3: Wire usePresenceConnection into App.tsx WorkbenchBootstraps** - `92326c7b3` (feat)

## Files Created/Modified
- `apps/workbench/src/features/presence/stores/presence-store.ts` - Zustand + immer store with analysts Map, viewersByFile index, handleServerMessage router, offline defaults
- `apps/workbench/src/features/presence/use-presence-connection.ts` - React hook bootstrapping PresenceSocket singleton, wiring messages to store
- `apps/workbench/src/App.tsx` - Added usePresenceConnection() call in WorkbenchBootstraps after useFleetConnection()

## Decisions Made
- Used enableMapSet() from immer for Map/Set mutation support (required for analysts Map and viewersByFile Set)
- Module-level singleton for PresenceSocket (same pattern as fleetEventStream in use-fleet-connection.ts)
- getPresenceSocket() exported as non-React escape hatch for Phase 21 CM6 ViewPlugin
- Fresh credential/identity reads via getState() at call time (not captured closures) to prevent stale credential bugs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Presence store is ready for Phase 20 (Presence UI) to consume via usePresenceStore selectors
- getPresenceSocket() ready for Phase 21 (CM6 cursor extension) to send cursor/selection messages
- All TypeScript compiles cleanly

## Self-Check: PASSED

All 3 created/modified files verified present on disk. All 3 task commits verified in git log.

---
*Phase: 19-client-connection-store*
*Completed: 2026-03-23*
