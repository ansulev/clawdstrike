---
phase: 01-viewregistry-foundation
plan: 01
subsystem: ui
tags: [react, useSyncExternalStore, error-boundary, suspense, plugin-views, registry]

# Dependency graph
requires: []
provides:
  - ViewRegistry singleton (registerView, getView, getViewsBySlot, onViewRegistryChange, useViewsBySlot)
  - ViewSlot union type covering 7 contribution slots
  - ViewProps and ViewRegistration interfaces
  - ViewContainer component with ErrorBoundary + Suspense isolation
affects: [01-02, phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns: [Map + snapshot + listeners registry, useSyncExternalStore hook, class-based ErrorBoundary with resetKey remount, slot-appropriate loading fallbacks]

key-files:
  created:
    - apps/workbench/src/lib/plugins/view-registry.ts
    - apps/workbench/src/lib/plugins/__tests__/view-registry.test.ts
    - apps/workbench/src/components/plugins/view-container.tsx
    - apps/workbench/src/components/plugins/__tests__/view-container.test.tsx
  modified: []

key-decisions:
  - "ViewRegistry uses frozen empty array singleton for empty slot queries, ensuring reference stability for useSyncExternalStore"
  - "ViewErrorBoundary uses resetKey + key prop pattern to force full component remount on Reload View click"
  - "Default priority is 100 (not 0) so plugins without explicit priority sort after built-in views"

patterns-established:
  - "View registration: registerView() -> Map + snapshot cache -> notify listeners -> useSyncExternalStore"
  - "Plugin view wrapping: ViewErrorBoundary(ErrorBoundary) > Suspense(slot-fallback) > PluginComponent(viewId, isActive, storage)"
  - "Slot-appropriate loading: full-panel spinner for editorTab/activityBarPanel, inline 10px spinner for statusBarWidget, medium for others"

requirements-completed: [VREG-01, VREG-02, VREG-03, VREG-04, VCONT-01, VCONT-02, VCONT-03]

# Metrics
duration: 9min
completed: 2026-03-19
---

# Phase 1 Plan 01: ViewRegistry + ViewContainer Summary

**ViewRegistry singleton with Map + snapshot + listeners pattern and ViewContainer with ErrorBoundary crash isolation + Suspense loading fallbacks for all 7 plugin view slots**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-19T12:11:04Z
- **Completed:** 2026-03-19T12:20:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ViewRegistry singleton replicating the proven status-bar-registry.ts pattern, with registerView/getView/getViewsBySlot/onViewRegistryChange/useViewsBySlot exports
- ViewContainer wrapping all plugin views in ErrorBoundary + Suspense with slot-appropriate loading fallbacks
- 14 unit tests covering registration, slot filtering, priority sorting, disposal, duplicate rejection, listener notifications, snapshot stability, error boundary catch/reset, and default storage

## Task Commits

Each task was committed atomically:

1. **Task 1: ViewRegistry with Map + snapshot + listeners pattern** - `b4ad2dfae` (feat)
2. **Task 2: ViewContainer with ErrorBoundary + Suspense isolation** - `a39616926` (feat)

_Both tasks followed TDD: tests written first (RED), implementation (GREEN), no refactor needed._

## Files Created/Modified
- `apps/workbench/src/lib/plugins/view-registry.ts` - ViewRegistry singleton with Map + snapshot + listeners, exports registerView, getView, getViewsBySlot, onViewRegistryChange, useViewsBySlot, ViewSlot, ViewProps, ViewRegistration
- `apps/workbench/src/lib/plugins/__tests__/view-registry.test.ts` - 9 unit tests for ViewRegistry
- `apps/workbench/src/components/plugins/view-container.tsx` - ViewContainer component with ViewErrorBoundary (class), ViewErrorFallback, ViewLoadingFallback
- `apps/workbench/src/components/plugins/__tests__/view-container.test.tsx` - 5 unit tests for ViewContainer

## Decisions Made
- Used frozen empty array singleton (`Object.freeze([])`) for empty slot queries to ensure reference stability with useSyncExternalStore
- ViewErrorBoundary uses `resetKey` state that increments on reset, used as `key` prop on children wrapper to force complete remount (not just state reset)
- Default priority set to 100 (not 0) so plugins without explicit priority sort after built-in views that use lower numbers
- No-op storage default (`get: () => undefined, set: () => {}`) so ViewContainer always provides storage prop without requiring callers to pass one

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React concurrent rendering test flake in ViewContainer reset test**
- **Found during:** Task 2 (ViewContainer tests)
- **Issue:** `ConditionalCrash` test component used a local `renderCount` variable to throw on first render, but React concurrent rendering retries the component multiple times, making the counter unreliable
- **Fix:** Changed to use module-level `shouldThrow` boolean flag that is explicitly flipped before clicking "Reload View"
- **Files modified:** `apps/workbench/src/components/plugins/__tests__/view-container.test.tsx`
- **Verification:** All 5 ViewContainer tests pass consistently
- **Committed in:** a39616926 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test approach adjustment for React concurrent rendering compatibility. No scope creep.

## Issues Encountered
None beyond the test fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ViewRegistry and ViewContainer are the foundation for all subsequent phases
- Plan 01-02 (SDK ViewsApi + PluginLoader view routing + status bar fix) can now build on these primitives
- Phase 2 (Editor Tab Views) and Phase 3 (Bottom Panel/Right Sidebar) both depend on these registrations

## Self-Check: PASSED

- [x] view-registry.ts exists
- [x] view-registry.test.ts exists (9 tests)
- [x] view-container.tsx exists
- [x] view-container.test.tsx exists (5 tests)
- [x] 01-01-SUMMARY.md exists
- [x] Commit b4ad2dfae exists (Task 1)
- [x] Commit a39616926 exists (Task 2)

---
*Phase: 01-viewregistry-foundation*
*Completed: 2026-03-19*
