---
phase: 01-testing-harness
plan: 01
subsystem: testing
tags: [vitest, mock, spy, plugin-sdk, typescript, testing-utilities]

# Dependency graph
requires: []
provides:
  - "createMockContext() — full PluginContext with no-op stubs for isolated plugin testing"
  - "createSpyContext() — PluginContext with spy tracking for all 9 API namespaces"
  - "MockStorageApi — Map-backed StorageApi with get/set/entries/clear"
  - "MockSecretsApi — async Map-backed SecretsApi with get/set/delete/has"
  - "@clawdstrike/plugin-sdk/testing sub-path export (tree-shaken from main SDK)"
affects: [01-02, 02-cli-scaffolding, 05-plugin-playground]

# Tech tracking
tech-stack:
  added: []
  patterns: ["spy-context pattern: { ctx, spy } destructured return", "removable disposable via array splice"]

key-files:
  created:
    - packages/sdk/plugin-sdk/src/testing.ts
    - packages/sdk/plugin-sdk/tests/testing.test.ts
  modified:
    - packages/sdk/plugin-sdk/package.json
    - packages/sdk/plugin-sdk/tsup.config.ts

key-decisions:
  - "SpyContext returns { ctx, spy } object rather than extending PluginContext with a spy property — cleaner separation and avoids runtime type augmentation"
  - "MockStorageApi and MockSecretsApi are exported classes (not just factory functions) so test authors can use instanceof checks and access entries()/clear()"

patterns-established:
  - "Spy tracking pattern: createSpyContext() returns { ctx, spy } where spy mirrors all 9 API namespace arrays"
  - "Removable disposable: every register() returns a function that splices the item from its tracking array"
  - "Test fixture helpers: makeCommand(), makeGuard(), etc. for reusable contribution factories in tests"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-04]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 1 Plan 1: Core Testing Module Summary

**Mock/spy PluginContext utilities with MockStorageApi, MockSecretsApi, createMockContext, createSpyContext, and tree-shaken /testing sub-path export**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T00:21:08Z
- **Completed:** 2026-03-23T00:24:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built complete testing module with 4 exports covering all 9 PluginContext API namespaces
- MockStorageApi and MockSecretsApi provide Map-backed implementations for isolated testing
- createSpyContext() tracks all registrations with disposables that remove items from tracking arrays
- /testing sub-path export is tree-shaken from main SDK (createPlugin not in testing.js)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `91e465d78` (test)
2. **Task 1 GREEN: Testing module implementation** - `8be86129d` (feat)
3. **Task 2: Wire /testing sub-path export** - `0dc3552d8` (feat)

## Files Created/Modified
- `packages/sdk/plugin-sdk/src/testing.ts` - MockStorageApi, MockSecretsApi, createMockContext, createSpyContext, SpyContext/SpyData interfaces (298 lines)
- `packages/sdk/plugin-sdk/tests/testing.test.ts` - 45 tests across 5 describe blocks covering all behaviors (446 lines)
- `packages/sdk/plugin-sdk/package.json` - Added ./testing exports map with types/import/require conditions
- `packages/sdk/plugin-sdk/tsup.config.ts` - Added src/testing.ts as second entry point

## Decisions Made
- SpyContext returns `{ ctx, spy }` destructured object rather than extending PluginContext with a spy property -- cleaner separation, avoids runtime type augmentation, makes it obvious which is the context vs. the spy
- MockStorageApi and MockSecretsApi are exported classes (not just factory functions) so test authors can use `instanceof` checks and access convenience methods like `entries()` and `clear()`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Testing utilities ready for Plan 01-02 (assertion helpers: assertContributions, assertManifestValid)
- createSpyContext() and createMockContext() available for Phase 2 (CLI scaffolding templates will import from `@clawdstrike/plugin-sdk/testing`)
- /testing sub-path export wired and verified

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 01-testing-harness*
*Completed: 2026-03-23*
