---
phase: 03-dev-server
plan: 02
subsystem: dev-tooling
tags: [hmr, plugin-reload, storage-snapshot, lifecycle-events, vite-hmr-client]

requires:
  - phase: 03-dev-server
    provides: "vite-plugin-clawdstrike HMR events with PluginUpdateEvent type"
provides:
  - "Client-side HMR handler with full deactivate-unregister-reimport-register-load cycle"
  - "Storage snapshot utility for state preservation across hot reloads"
  - "DevLifecycleEvent emission for dev console consumption"
affects: [03-03, 05-plugin-playground]

tech-stack:
  added: []
  patterns: [hmr-handler-pattern, storage-snapshot, cache-bust-reimport, dev-lifecycle-events]

key-files:
  created:
    - apps/workbench/src/lib/plugins/dev/types.ts
    - apps/workbench/src/lib/plugins/dev/storage-snapshot.ts
    - apps/workbench/src/lib/plugins/dev/hmr-handler.ts
    - apps/workbench/src/lib/plugins/dev/index.ts
    - apps/workbench/src/lib/plugins/__tests__/storage-snapshot.test.ts
    - apps/workbench/src/lib/plugins/__tests__/hmr-handler.test.ts
  modified: []

key-decisions:
  - "Storage snapshot uses module-level write-through cache rather than direct StorageApi iteration"
  - "HMR handler copies manifest before mutation to avoid corrupting registry state"

patterns-established:
  - "Cache-bust pattern: append ?t={timestamp} to manifest.main for module re-import"
  - "DevLifecycleEvent pub/sub pattern for dev console: onDevLifecycleEvent() returns dispose function"
  - "Storage write-through cache: trackStorageWrite() called on each set(), getSnapshot() returns copy"

requirements-completed: [DEVS-03, DEVS-04]

duration: 2min
completed: 2026-03-23
---

# Phase 3 Plan 02: Client-side HMR Handler Summary

**Client-side HMR handler with deactivate-unregister-reimport-register-load cycle, write-through storage cache for state preservation, and typed lifecycle events for dev console**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T00:36:00Z
- **Completed:** 2026-03-23T00:37:39Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- Built full HMR reload cycle: deactivate old plugin, unregister, update manifest with cache-bust query param, re-register, re-load
- Implemented write-through storage cache with per-plugin isolation for state preservation across hot reloads
- Added DevLifecycleEvent pub/sub with typed events (hmr:start, deactivated, registered, hmr:complete, hmr:error)
- 25 tests passing across hmr-handler and storage-snapshot modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Dev types, storage snapshot, HMR handler, tests** - `0b48d43e9` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/dev/types.ts` - PluginUpdateEvent, DevLifecycleEvent, DevLifecycleEventType types
- `apps/workbench/src/lib/plugins/dev/storage-snapshot.ts` - Write-through cache with trackStorageWrite, getSnapshot, restoreToApi, clearSnapshot
- `apps/workbench/src/lib/plugins/dev/hmr-handler.ts` - handlePluginUpdate, setupPluginHmr, onDevLifecycleEvent
- `apps/workbench/src/lib/plugins/dev/index.ts` - Barrel export for dev module
- `apps/workbench/src/lib/plugins/__tests__/storage-snapshot.test.ts` - 12 tests for storage isolation and restoration
- `apps/workbench/src/lib/plugins/__tests__/hmr-handler.test.ts` - 13 tests for HMR lifecycle and error handling

## Decisions Made
- Storage snapshot uses a module-level write-through cache (Map<string, Map<string, unknown>>) rather than trying to iterate the StorageApi directly -- simpler and more robust since StorageApi does not expose iteration
- HMR handler spreads the manifest ({ ...registered.manifest }) before mutating main to avoid corrupting the registry's copy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HMR handler ready for use via setupPluginHmr() called during workbench dev initialization
- DevLifecycleEvent stream ready for Plan 03-03 dev console bottom panel
- Storage snapshot infrastructure ready for integration with dev-mode storage wrapper

## Self-Check: PASSED

All 6 created files verified on disk. Commit 0b48d43e9 verified in git log.

---
*Phase: 03-dev-server*
*Completed: 2026-03-23*
