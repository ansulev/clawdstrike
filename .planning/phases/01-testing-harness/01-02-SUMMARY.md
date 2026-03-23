---
phase: 01-testing-harness
plan: 02
subsystem: testing
tags: [vitest, assertion-helpers, manifest-validation, plugin-sdk, typescript, testing-utilities]

# Dependency graph
requires:
  - "01-01: createMockContext, createSpyContext, /testing sub-path export"
provides:
  - "assertContributions() -- validates plugin manifest contribution counts against expected values"
  - "assertManifestValid() -- wraps validateManifest with readable assertion error formatting"
  - "createTestManifest() -- re-exported from testing sub-path for convenience"
  - "validateManifest() -- self-contained SDK manifest validation (no workbench deps)"
  - "ManifestValidationError/ManifestValidationResult types"
affects: [02-cli-scaffolding, 05-plugin-playground]

# Tech tracking
tech-stack:
  added: []
  patterns: ["self-contained SDK validation: port workbench code, strip runtime-only deps", "assertion helper pattern: wrap validation with throw-on-failure for test ergonomics"]

key-files:
  created:
    - packages/sdk/plugin-sdk/src/manifest-validation.ts
    - packages/sdk/plugin-sdk/tests/testing-assertions.test.ts
  modified:
    - packages/sdk/plugin-sdk/src/testing.ts

key-decisions:
  - "Removed permissions validation entirely from SDK copy -- SDK PluginManifest has no permissions field, permissions are a workbench runtime concern"
  - "Re-exported createTestManifest from testing.ts so plugin authors get it via @clawdstrike/plugin-sdk/testing without a separate import"

patterns-established:
  - "SDK validation port: copy workbench validation, remove runtime-only concerns (permissions, bridge imports)"
  - "Assertion helpers: wrap validators with throw-on-failure, report all errors in one message"

requirements-completed: [TEST-05, TEST-06]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 1 Plan 2: Assertion Helpers Summary

**assertContributions and assertManifestValid assertion helpers with self-contained SDK manifest validation (no workbench deps)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T00:26:37Z
- **Completed:** 2026-03-23T00:30:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Ported workbench manifest-validation.ts to SDK as self-contained module (no KNOWN_PERMISSIONS, no bridge/permissions)
- Added assertContributions() that checks contribution counts with readable "expected N, got M" errors
- Added assertManifestValid() that wraps validateManifest with field-level assertion error formatting
- Re-exported createTestManifest from testing sub-path for plugin author convenience
- All 91 tests pass (16 new assertion tests + 75 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Self-contained manifest-validation.ts** - `e34396988` (feat)
2. **Task 2 RED: Failing assertion tests** - `0ece2f2a9` (test)
3. **Task 2 GREEN: assertContributions + assertManifestValid** - `4c320171d` (feat)

## Files Created/Modified
- `packages/sdk/plugin-sdk/src/manifest-validation.ts` - Self-contained validateManifest, createTestManifest, ManifestValidationError/Result types (303 lines)
- `packages/sdk/plugin-sdk/src/testing.ts` - Added assertContributions, assertManifestValid, re-exports from manifest-validation
- `packages/sdk/plugin-sdk/tests/testing-assertions.test.ts` - 16 tests: 8 for assertContributions, 8 for assertManifestValid (200 lines)

## Decisions Made
- Removed permissions validation from SDK manifest-validation.ts because the SDK's PluginManifest type has no `permissions` field -- permissions are a workbench runtime concern handled by the bridge/permissions module
- Re-exported createTestManifest through testing.ts so plugin authors get test fixtures from `@clawdstrike/plugin-sdk/testing` without needing a separate import path

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Testing module complete with mock/spy contexts (Plan 01) and assertion helpers (Plan 02)
- Phase 01 fully complete, ready for Phase 02 (CLI scaffolding)
- All testing utilities available via `@clawdstrike/plugin-sdk/testing` sub-path

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 01-testing-harness*
*Completed: 2026-03-23*
