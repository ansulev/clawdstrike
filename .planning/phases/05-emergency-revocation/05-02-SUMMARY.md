---
phase: 05-emergency-revocation
plan: 02
subsystem: plugins
tags: [sse, eventsource, revocation, hushd, react, badge, reconnect-sync]

# Dependency graph
requires:
  - phase: 05-emergency-revocation (plan 01)
    provides: PluginRevocationStore, revokePlugin, "revoked" lifecycle state, bridge revocation guard
provides:
  - PluginRevocationClient -- SSE listener connecting to hushd /api/v1/events for plugin_revoked events
  - Reconnect sync diffing remote vs local revocation list via GET /api/v1/plugins/revocations
  - PluginRevocationBadge -- React component showing warning badge for revoked plugins
  - isPluginRevoked() helper for marketplace Install/Activate button disabling
  - PluginLoader.loadPlugin() revocation gate blocking loading of revoked plugins
affects: [marketplace-ui, plugin-loading, hushd-integration]

# Tech tracking
tech-stack:
  added: [EventSource (SSE)]
  patterns: [SSE reconnect with sync, fire-and-forget receipt generation, revocation gating at load boundary]

key-files:
  created:
    - apps/workbench/src/lib/plugins/revocation-client.ts
    - apps/workbench/src/components/plugin-revocation-badge.tsx
    - apps/workbench/src/lib/plugins/__tests__/revocation-client.test.ts
    - apps/workbench/src/components/__tests__/plugin-revocation-badge.test.tsx
  modified:
    - apps/workbench/src/lib/plugins/plugin-loader.ts

key-decisions:
  - "SSE reconnect strategy: on EventSource open event, always sync full revocation list from hushd to catch missed events during disconnect"
  - "Reconnect backoff: fixed 5-second delay (matching revokePlugin drain timeout), no exponential backoff for simplicity"
  - "Receipt for SSE revocations uses recordDenied('revocation.sse', {plugin_id}, 'revocation') -- fire-and-forget"
  - "PluginLoader.loadPlugin() checks isRevoked() before trust gate -- revoked plugins never start loading"
  - "isPluginRevoked helper exported for marketplace UI to disable buttons without importing revocation store directly"

patterns-established:
  - "SSE listener pattern: EventSource + typed event handlers + reconnect with full sync"
  - "Revocation gating: check revocation store at every load/activation boundary"

requirements-completed: [REVOKE-01, REVOKE-02, REVOKE-05]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 5 Plan 2: hushd SSE Revocation Listener + Reconnect Sync + Badge UI Summary

**PluginRevocationClient SSE listener for fleet-wide plugin_revoked events, offline-to-online reconnect sync, and PluginRevocationBadge warning component**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T06:23:44Z
- **Completed:** 2026-03-19T06:28:37Z
- **Tasks:** 2 (TDD, 4 commits total: 2 RED + 2 GREEN)
- **Files modified:** 5

## Accomplishments
- PluginRevocationClient connects to hushd SSE and dispatches plugin_revoked events to revokePlugin in real-time
- Reconnect sync fetches full revocation list from hushd, diffs via revocationStore.sync(), revokes new plugins, and lifts expired time-limited revocations
- PluginRevocationBadge shows warning badge with reason, duration (Permanent/Until date), and operator explanation
- isPluginRevoked() helper exported for marketplace buttons to check disabled state
- PluginLoader.loadPlugin() now blocks loading revoked plugins at earliest point (before trust gate)
- All 14 new tests pass (7 revocation-client + 7 badge), zero regressions across 63 related tests

## Task Commits

Each task was committed atomically (TDD: RED + GREEN):

1. **Task 1: PluginRevocationClient -- SSE listener + reconnect sync**
   - `951a70118` (test: add failing tests for PluginRevocationClient SSE listener)
   - `c3759a3d5` (feat: implement PluginRevocationClient SSE listener + reconnect sync)

2. **Task 2: PluginRevocationBadge UI component**
   - `de49506c8` (test: add failing tests for PluginRevocationBadge component)
   - `56de688b8` (feat: implement PluginRevocationBadge component with isPluginRevoked helper)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/revocation-client.ts` - SSE client connecting to hushd, handling plugin_revoked events, syncing on reconnect
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Added revocation gate at top of loadPlugin()
- `apps/workbench/src/components/plugin-revocation-badge.tsx` - Warning badge component + isPluginRevoked helper
- `apps/workbench/src/lib/plugins/__tests__/revocation-client.test.ts` - 7 tests for SSE client
- `apps/workbench/src/components/__tests__/plugin-revocation-badge.test.tsx` - 7 tests for badge component

## Decisions Made
- SSE reconnect strategy: on EventSource open, always sync full revocation list to catch missed events during disconnect
- Fixed 5-second reconnect delay (matching drain timeout) -- no exponential backoff for simplicity
- Receipt for SSE revocations uses recordDenied with "revocation.sse" action type
- PluginLoader checks revocation before trust gate -- revoked plugins blocked at earliest point
- isPluginRevoked helper enables marketplace button disabling without direct store imports

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 5 (Emergency Revocation) is now complete with all plans executed. The plugin sandboxing milestone (v2.0) is fully implemented:
- Phase 1: postMessage RPC Bridge
- Phase 2: iframe Sandbox
- Phase 3: Permission System
- Phase 4: Plugin Audit Trail
- Phase 5: Emergency Revocation

All success criteria met. Ready for milestone wrap-up and integration testing.

## Self-Check: PASSED

All files exist, all 4 commits verified, all 14 tests pass.

---
*Phase: 05-emergency-revocation*
*Completed: 2026-03-19*
