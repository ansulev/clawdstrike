---
phase: 07-protocol-+-tech-debt-cleanup
plan: 01
subsystem: protocol
tags: [swarm-engine, event-mapping, transport, guard-pipeline, tech-debt]

# Dependency graph
requires:
  - phase: 06-validation-+-tauri-transport
    provides: TauriIpcTransport, full backward compatibility, 523 passing tests
provides:
  - Guard pipeline events (guard.evaluated, action.denied, action.completed) mapped to coordination channel
  - Public SwarmOrchestrator.getEvents() accessor replacing private field access
  - Complete 23-entry EVENT_TO_CHANNEL covering all SwarmEngineEventMap keys
  - TauriIpcTransport accepting both SwarmEnvelope and SwarmEngineEnvelope
  - events.test.ts exhaustive switch covering all 23 event kinds
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnySwarmEnvelope union type for backward-compatible envelope widening"
    - "Public accessor pattern (getEvents()) for cross-boundary subscriptions"

key-files:
  created: []
  modified:
    - packages/swarm-engine/src/protocol.ts
    - packages/swarm-engine/src/protocol.test.ts
    - packages/swarm-engine/src/orchestrator.ts
    - packages/swarm-engine/src/events.test.ts
    - apps/workbench/src/features/swarm/hooks/use-engine-board-bridge.ts
    - apps/workbench/src/features/swarm/transports/tauri-ipc-transport.ts

key-decisions:
  - "Guard events map to coordination channel (visible to all peers)"
  - "getEvents() uses import type for return annotation (no import change needed)"
  - "AnySwarmEnvelope union for TauriIpcTransport rather than replacing SwarmEnvelope entirely"

patterns-established:
  - "Public accessor pattern: getEvents() exposes TypedEventEmitter without breaking encapsulation"
  - "Envelope union widening: AnySwarmEnvelope = SwarmEnvelope | SwarmEngineEnvelope for backward compat"

requirements-completed: [PROT-02, PROT-04]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 7 Plan 1: Protocol + Tech Debt Cleanup Summary

**Guard pipeline events mapped to coordination channel, public getEvents() accessor replacing private field access, and TauriIpcTransport widened to accept SwarmEngineEnvelope 11-channel union**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T01:28:19Z
- **Completed:** 2026-03-25T01:32:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added guard.evaluated, action.denied, action.completed to EVENT_TO_CHANNEL mapped to "coordination" channel (23 total entries)
- Added SwarmOrchestrator.getEvents() public accessor, replaced all (engine as any).events casts in bridge hook
- Updated events.test.ts ALL_EVENT_KINDS to 23 entries with guard category covering 3 event kinds
- Widened TauriIpcTransport to accept SwarmEngineEnvelope via AnySwarmEnvelope union type

## Task Commits

Each task was committed atomically:

1. **Task 1: Add guard events to EVENT_TO_CHANNEL and public getEvents() accessor** - `d994ac65c` (feat)
2. **Task 2: Fix events.test.ts, bridge hook, and TauriIpcTransport types** - `d192fcdcd` (fix)

## Files Created/Modified
- `packages/swarm-engine/src/protocol.ts` - Added 3 guard event entries to EVENT_TO_CHANNEL
- `packages/swarm-engine/src/protocol.test.ts` - Added 3 guard event test cases, updated counts from 20 to 23
- `packages/swarm-engine/src/orchestrator.ts` - Added public getEvents() accessor
- `packages/swarm-engine/src/events.test.ts` - Updated ALL_EVENT_KINDS to 23 entries, added guard category
- `apps/workbench/src/features/swarm/hooks/use-engine-board-bridge.ts` - Replaced (engine as any).events with engine.getEvents()
- `apps/workbench/src/features/swarm/transports/tauri-ipc-transport.ts` - Added SwarmEngineEnvelope import, AnySwarmEnvelope union type

## Decisions Made
- Guard events (guard.evaluated, action.denied, action.completed) map to "coordination" channel because guard pipeline decisions are coordination-level concerns visible to all peers
- getEvents() return type uses TypedEventEmitter<SwarmEngineEventMap> via import type annotation -- no runtime import change needed since the method body returns this.events
- TauriIpcTransport uses AnySwarmEnvelope = SwarmEnvelope | SwarmEngineEnvelope union rather than replacing SwarmEnvelope entirely, maintaining TransportAdapter interface compatibility via TypeScript's bivariant parameter checking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This was the final plan in the final phase. All 7 phases (19 plans) are now complete.
- All 430 swarm-engine tests pass with correct counts and exhaustive coverage.
- PROT-02 and PROT-04 requirements satisfied: full event-to-envelope mapping and DenyNotification reaching transport.

## Self-Check: PASSED

All 6 modified files confirmed on disk. Both task commits (d994ac65c, d192fcdcd) found in git history.

---
*Phase: 07-protocol-+-tech-debt-cleanup*
*Completed: 2026-03-25*
