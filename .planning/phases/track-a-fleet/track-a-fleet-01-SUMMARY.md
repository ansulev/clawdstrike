---
phase: track-a-fleet
plan: 01
subsystem: fleet
tags: [sse, zustand, real-time, hushd, drift-detection, event-stream]

# Dependency graph
requires: []
provides:
  - "FleetEventStream class for fetch-based SSE with Bearer auth"
  - "Fleet event reducer (mergeHeartbeat, reduceFleetEvent) for agent state updates"
  - "SSE integration in fleet Zustand store (additive to polling)"
  - "Drift detection via expected_policy_version query param"
affects: [track-a-fleet-02, fleet-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch-based SSE streaming for authenticated endpoints (no EventSource)"
    - "Pure reducer functions for SSE event -> state merging"
    - "Exponential backoff reconnect with full re-sync on reconnect"
    - "Module-level FleetEventStream instance managed alongside polling timers"

key-files:
  created:
    - "apps/workbench/src/features/fleet/fleet-event-stream.ts"
    - "apps/workbench/src/features/fleet/fleet-event-reducer.ts"
    - "apps/workbench/src/features/fleet/__tests__/fleet-event-stream.test.ts"
    - "apps/workbench/src/features/fleet/__tests__/fleet-event-reducer.test.ts"
    - "apps/workbench/src/features/fleet/__tests__/drift-detection.test.ts"
  modified:
    - "apps/workbench/src/features/fleet/fleet-client.ts"
    - "apps/workbench/src/features/fleet/use-fleet-connection.ts"

key-decisions:
  - "Import consumeSseMessages/resolveProxyBase from live-agent-tab.tsx rather than copying (no circular dep)"
  - "SSE event types filter includes agent_heartbeat, check, policy_updated, policy_reloaded, policy_bundle_update, session_posture_transition"
  - "Credentials accessed via getApiKey callback in SSE stream, never stored in state"
  - "expectedPolicyVersion derived from remotePolicyInfo.policyHash or .version"

patterns-established:
  - "FleetEventStream: standalone class for SSE lifecycle (not a React hook)"
  - "reduceFleetEvent: pure function reducer for SSE events into AgentInfo[] + refresh signals"

requirements-completed: [FLEET-01, FLEET-02, FLEET-03, FLEET-04]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Track A Fleet Plan 01: SSE Streaming + Drift Detection Summary

**Fetch-based SSE streaming from hushd /api/v1/events with heartbeat reducer, exponential backoff reconnect, and server-side drift detection via expected_policy_version query param**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-19T13:52:46Z
- **Completed:** 2026-03-19T14:01:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- FleetEventStream class connects to hushd SSE with Bearer auth, parses named events, and reconnects with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Pure fleet event reducer merges heartbeats into agents array (update existing or append new), signals policy refresh on policy_updated/reloaded events
- fetchAgentList now passes expected_policy_version query param so hushd computes drift server-side
- SSE stream integrated into fleet Zustand store alongside existing polling (additive, not replacement)
- 16 new tests + 1 existing fleet dashboard test all pass, zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fleet event reducer + SSE stream module** (TDD)
   - `be4e84485` test: add failing tests for fleet event reducer and SSE stream
   - `b3fdd8f84` feat: implement fleet event reducer and SSE stream module
2. **Task 2: Fix drift detection + integrate SSE into fleet store** (TDD)
   - `bb203d5eb` test: add failing tests for drift detection query param
   - `1bd6d4945` feat: fix drift detection and integrate SSE into fleet store

## Files Created/Modified
- `apps/workbench/src/features/fleet/fleet-event-stream.ts` - SSE connection lifecycle manager (FleetEventStream class)
- `apps/workbench/src/features/fleet/fleet-event-reducer.ts` - Pure reducer for SSE events into AgentInfo[] state
- `apps/workbench/src/features/fleet/fleet-client.ts` - Added expectedPolicyVersion optional param to fetchAgentList
- `apps/workbench/src/features/fleet/use-fleet-connection.ts` - SSE integration, sseState field, drift query param in pollAgents
- `apps/workbench/src/features/fleet/__tests__/fleet-event-stream.test.ts` - 6 tests for SSE stream
- `apps/workbench/src/features/fleet/__tests__/fleet-event-reducer.test.ts` - 7 tests for event reducer
- `apps/workbench/src/features/fleet/__tests__/drift-detection.test.ts` - 3 tests for drift detection

## Decisions Made
- Imported consumeSseMessages and resolveProxyBase from live-agent-tab.tsx rather than duplicating the code. No circular dependency risk since fleet-event-stream.ts does not import from use-fleet-connection.ts.
- SSE URL uses encodeURIComponent for the event_types filter parameter (proper URL encoding).
- expectedPolicyVersion derived from remotePolicyInfo.policyHash (preferred) falling back to .version. This matches the hushd server expectation for the expected_policy_version query param.
- FleetEventStream is a class (not a React hook) so it can be managed as a module-level singleton alongside the polling timers.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SSE data layer is live and integrated. Fleet dashboard can now show real-time agent status updates.
- Track-a-fleet-02 (dashboard UI enhancements) can build on the sseState field and real-time agent data.
- Polling continues as fallback when SSE disconnects, ensuring the dashboard remains functional.

## Self-Check: PASSED

All 6 created files exist. All 4 task commits verified in git log.

---
*Phase: track-a-fleet*
*Completed: 2026-03-19*
