---
phase: 01-open-closed-seams
plan: 01
subsystem: ui
tags: [typescript, guard-registry, open-closed-principle, plugin-extensibility, proxy-pattern]

requires:
  - phase: none
    provides: first plan in first phase

provides:
  - Open GuardId, GuardCategory, ConfigFieldType string types with BUILTIN_* const arrays
  - Dynamic Map-based guard registry with registerGuard/unregisterGuard API
  - Backward-compatible Proxy exports (GUARD_REGISTRY, ALL_GUARD_IDS, GUARD_DISPLAY_NAMES, GUARD_CATEGORIES)
  - registerGuardCategory for plugin-defined categories
  - "json" config field type for arbitrary JSON schemas
  - GuardConfigMap index signature for plugin guard configs

affects: [01-02, 01-03, 02-01, 03-01, 04-01, 05-01]

tech-stack:
  added: []
  patterns: [proxy-based-backward-compat, map-backed-registry, dispose-pattern-registration, open-string-types-with-builtin-const]

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/workbench/types.ts
    - apps/workbench/src/lib/workbench/guard-registry.ts
    - apps/workbench/src/lib/workbench/__tests__/guard-registry.test.ts
    - apps/workbench/src/lib/workbench/__tests__/simulation-engine.test.ts

key-decisions:
  - "Used Proxy pattern for GUARD_REGISTRY backward compat -- 19+ consumer files continue to use .filter(), .map(), .find() without changes"
  - "Added index signature [guardId: string] to GuardConfigMap -- allows plugin guard configs without breaking built-in type narrowing"
  - "registerGuard auto-creates categories and dispose cleans them up -- plugins don't need separate category registration"

patterns-established:
  - "Open string types with BUILTIN_* const arrays: type Foo = string + const BUILTIN_FOO_IDS = [...] as const"
  - "Proxy-based backward compat: export const X = createArrayProxy(() => Array.from(map.values()))"
  - "Dispose-pattern registration: registerX() returns () => void cleanup function"

requirements-completed: [SEAM-01, SEAM-02, SEAM-08, SEAM-09]

duration: 10min
completed: 2026-03-18
---

# Phase 1 Plan 01: Open Guard Pipeline Seams Summary

**GuardId/GuardCategory/ConfigFieldType opened to string types, GUARD_REGISTRY converted to dynamic Map with register/unregister API, 49 tests passing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T20:54:17Z
- **Completed:** 2026-03-18T21:04:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Opened GuardId, GuardCategory, ConfigFieldType from closed unions to string types, enabling plugin guards to register arbitrary IDs/categories
- Converted GUARD_REGISTRY from static const array to dynamic Map-based registry with registerGuard/unregisterGuard API
- Added "json" as a recognized ConfigFieldType for arbitrary plugin config schemas
- All 13 built-in guards auto-register at module load, behaving identically to before
- 19+ consumer files continue working via Proxy-based backward-compatible exports
- 49 tests pass including 16 new dynamic registration tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Open GuardId, GuardCategory, and ConfigFieldType types** - `980f96d77` (feat)
2. **Task 2: Convert GUARD_REGISTRY to dynamic Map-based registry** - `a68876b82` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/types.ts` - GuardId/GuardCategory/ConfigFieldType opened to string; BUILTIN_* const arrays added; GuardConfigMap index signature
- `apps/workbench/src/lib/workbench/guard-registry.ts` - Map-based registry, registerGuard/unregisterGuard/getAllGuards/registerGuardCategory API, Proxy backward compat
- `apps/workbench/src/lib/workbench/__tests__/guard-registry.test.ts` - 49 tests: built-in guards, dynamic registration, json config, custom categories, proxy liveness
- `apps/workbench/src/lib/workbench/__tests__/simulation-engine.test.ts` - Removed stale @ts-expect-error directives

## Decisions Made
- Used Proxy pattern for GUARD_REGISTRY backward compatibility -- 19+ consumer files continue using .filter(), .map(), .find() without code changes
- Added index signature `[guardId: string]: Record<string, unknown> | { enabled?: boolean } | undefined` to GuardConfigMap -- this allows plugin guard configs to be stored alongside built-in configs without breaking TypeScript narrowing for known guard keys
- registerGuard auto-creates categories when a guard's category doesn't exist yet, and the dispose function cleans up empty non-built-in categories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added GuardConfigMap index signature**
- **Found during:** Task 1 (opening GuardId to string)
- **Issue:** When GuardId became string, all code doing `guards[guard.id]` on `GuardConfigMap` produced TS errors because `GuardConfigMap` had no index signature
- **Fix:** Added `[guardId: string]: Record<string, unknown> | { enabled?: boolean } | undefined` index signature
- **Files modified:** apps/workbench/src/lib/workbench/types.ts
- **Verification:** TS error count returned to 130 baseline (zero new errors)
- **Committed in:** 980f96d77 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed stale @ts-expect-error directives in simulation-engine tests**
- **Found during:** Task 1 (opening GuardId to string)
- **Issue:** Two `@ts-expect-error` directives expected type errors for unknown guard IDs that no longer occur with open string types
- **Fix:** Removed the directives and a now-unnecessary `as string` cast
- **Files modified:** apps/workbench/src/lib/workbench/__tests__/simulation-engine.test.ts
- **Verification:** TS compilation clean (130 baseline)
- **Committed in:** 980f96d77 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for zero-regression type safety. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Guard pipeline seams are fully open -- plugins can register custom guards, categories, and config field types at runtime
- GUARD_REGISTRY backward compat verified via Proxy pattern -- no consumer file changes needed
- Ready for Plan 01-02 (file type and detection seams) and downstream phases

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/workbench/types.ts
- FOUND: apps/workbench/src/lib/workbench/guard-registry.ts
- FOUND: apps/workbench/src/lib/workbench/__tests__/guard-registry.test.ts
- FOUND: .planning/phases/01-open-closed-seams/01-01-SUMMARY.md
- FOUND: commit 980f96d77
- FOUND: commit a68876b82

---
*Phase: 01-open-closed-seams*
*Completed: 2026-03-18*
