---
phase: 05-emergency-revocation
plan: 01
subsystem: plugins
tags: [revocation, localStorage, bridge, lifecycle, security]

# Dependency graph
requires:
  - phase: 04-plugin-audit-trail
    provides: receipt middleware, bridge host with receipt integration
provides:
  - PluginRevocationStore with revoke/isRevoked/lift/getAll/sync
  - "revoked" PluginLifecycleState
  - Bridge host PLUGIN_REVOKED guard
  - PluginLoader.revokePlugin() with 5-second drain timeout
affects: [05-02-hushd-sse-revocation]

# Tech tracking
tech-stack:
  added: []
  patterns: [revocation-store localStorage pattern, bridge-level revocation guard, drain timeout for graceful deactivation]

key-files:
  created:
    - apps/workbench/src/lib/plugins/revocation-store.ts
    - apps/workbench/src/lib/plugins/__tests__/revocation-store.test.ts
    - apps/workbench/src/lib/plugins/__tests__/revocation-integration.test.ts
  modified:
    - apps/workbench/src/lib/plugins/types.ts
    - apps/workbench/src/lib/plugins/bridge/bridge-host.ts
    - apps/workbench/src/lib/plugins/plugin-loader.ts

key-decisions:
  - "Revocation check runs BEFORE permission check in bridge host -- revoked plugins are blocked at the earliest possible point (REVOKE-06)"
  - "revocationStore option on BridgeHostOptions uses duck-typed interface { isRevoked(pluginId: string): boolean } for testability"
  - "revokePlugin sets state to 'revoked' immediately, then waits 5s drain before deactivation -- bridge rejects new calls during drain"
  - "PluginRevocationStore follows receipt-store.ts localStorage pattern with in-memory Map cache"

patterns-established:
  - "Revocation guard pattern: check revocation before permission in bridge dispatch pipeline"
  - "Drain timeout pattern: mark revoked immediately, wait REVOKE_DRAIN_TIMEOUT_MS, then deactivate"
  - "Revocation store singleton: getPluginRevocationStore() factory, same as getPluginReceiptStore()"

requirements-completed: [REVOKE-03, REVOKE-04, REVOKE-06]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 5 Plan 1: Client-side Revocation Infrastructure Summary

**PluginRevocationStore with localStorage persistence, bridge-level PLUGIN_REVOKED guard, and PluginLoader.revokePlugin with 5-second drain timeout**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T06:15:54Z
- **Completed:** 2026-03-19T06:21:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PluginRevocationStore with revoke/isRevoked/lift/getAll/sync and localStorage persistence
- "revoked" added to PluginLifecycleState union type
- Bridge host revocation guard rejects messages for revoked plugins with PLUGIN_REVOKED error code
- PluginLoader.revokePlugin() stores revocation, sets "revoked" state, waits 5-second drain, then deactivates
- 15 new tests (9 store + 6 integration), all 278 total plugin tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: PluginRevocationStore + "revoked" lifecycle state** - `e1cfb9d16` (feat)
2. **Task 2: Bridge host revocation guard + PluginLoader.revokePlugin with drain** - `8fa0ecbfd` (feat)

_Both tasks used TDD: RED (failing tests) then GREEN (implementation) in single commits._

## Files Created/Modified
- `apps/workbench/src/lib/plugins/revocation-store.ts` - PluginRevocationStore class with localStorage persistence, time-limited expiry, sync for remote entries
- `apps/workbench/src/lib/plugins/types.ts` - Added "revoked" to PluginLifecycleState union
- `apps/workbench/src/lib/plugins/bridge/bridge-host.ts` - Added revocationStore option and PLUGIN_REVOKED check before permission enforcement
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Added revokePlugin() method with REVOKE_DRAIN_TIMEOUT_MS, passes revocationStore to bridge host
- `apps/workbench/src/lib/plugins/__tests__/revocation-store.test.ts` - 9 tests for store operations, persistence, expiry, sync, and type check
- `apps/workbench/src/lib/plugins/__tests__/revocation-integration.test.ts` - 6 tests for bridge revocation guard and loader drain behavior

## Decisions Made
- Revocation check runs BEFORE permission check in bridge host dispatch pipeline -- revoked plugins are blocked at the earliest point (REVOKE-06)
- revocationStore option on BridgeHostOptions uses duck-typed interface `{ isRevoked(pluginId: string): boolean }` for testability
- revokePlugin sets state to "revoked" immediately, then waits 5s drain before deactivation -- bridge rejects new calls during drain
- PluginRevocationStore follows the same localStorage + in-memory cache pattern as receipt-store.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Revocation infrastructure is complete and ready for Plan 02 (hushd SSE wiring)
- PluginRevocationStore.sync() method is ready to receive remote revocation entries from SSE events
- All existing tests pass with zero regressions

---
*Phase: 05-emergency-revocation*
*Completed: 2026-03-19*
