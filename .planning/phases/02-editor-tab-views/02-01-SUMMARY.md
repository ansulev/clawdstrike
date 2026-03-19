---
phase: 02-editor-tab-views
plan: 01
subsystem: ui
tags: [react, useSyncExternalStore, keep-alive, lru-eviction, editor-tabs, plugin-views]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation
    provides: ViewRegistry (registerView, getView), ViewContainer (ErrorBoundary+Suspense), ViewProps interface
provides:
  - PluginViewTabStore with open/close/activate/LRU eviction for plugin editor tabs
  - ViewTabRenderer with keep-alive display:none pattern for state preservation
  - useSyncExternalStore hooks for reactive tab state access
  - setTitle/setDirty callbacks for plugin tab metadata updates
affects: [02-editor-tab-views/02-02, tab-bar-integration, split-pane-support]

# Tech tracking
tech-stack:
  added: []
  patterns: [monotonic-timestamp-counter, keep-alive-display-none, editor-tab-bridge-pattern]

key-files:
  created:
    - apps/workbench/src/lib/plugins/plugin-view-tab-store.ts
    - apps/workbench/src/lib/plugins/__tests__/plugin-view-tab-store.test.ts
    - apps/workbench/src/components/plugins/view-tab-renderer.tsx
    - apps/workbench/src/components/plugins/__tests__/view-tab-renderer.test.tsx
  modified: []

key-decisions:
  - "Monotonic counter instead of Date.now() for deterministic tab ordering in fast-call scenarios"
  - "Direct ErrorBoundary+Suspense wrapping in ViewTabRenderer instead of using ViewContainer, to pass full EditorTabProps (setTitle, setDirty) alongside ViewProps"
  - "PluginEditorTabBridge pattern: thin component that creates setTitle/setDirty callbacks and renders the plugin component with full EditorTabProps"

patterns-established:
  - "Monotonic timestamp: monotonicNow() ensures strictly increasing values for lastActiveAt ordering"
  - "Keep-alive via display:none: all open tabs rendered simultaneously, only active tab visible"
  - "EditorTabBridge: wraps plugin component to inject editor-specific callbacks alongside standard ViewProps"

requirements-completed: [ETAB-01, ETAB-02, ALIVE-01, ALIVE-02, ALIVE-03]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 2 Plan 1: PluginViewTabStore + ViewTabRenderer Summary

**Plugin editor tab state store with Map+snapshot+listeners pattern and keep-alive renderer using display:none for inactive tab state preservation with LRU eviction at 5 hidden tabs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T12:47:03Z
- **Completed:** 2026-03-19T12:53:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PluginViewTabStore tracks open plugin editor tabs with open/close/activate operations and LRU eviction of hidden tabs beyond 5
- ViewTabRenderer renders all open tabs simultaneously with display:none for inactive tabs, preserving React component state across tab switches
- Plugin tab components receive full EditorTabProps (viewId, isActive, storage, setTitle, setDirty)
- 26 tests across both modules, all passing with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: PluginViewTabStore (RED)** - `99af7615e` (test)
2. **Task 1: PluginViewTabStore (GREEN)** - `4142f3f42` (feat)
3. **Task 2: ViewTabRenderer (RED)** - `f5e7701a5` (test)
4. **Task 2: ViewTabRenderer (GREEN)** - `403f062bd` (feat)

_Note: TDD tasks have separate test and implementation commits_

## Files Created/Modified
- `apps/workbench/src/lib/plugins/plugin-view-tab-store.ts` - Module-level store with Map+snapshot+listeners for plugin editor tab state, LRU eviction, useSyncExternalStore hooks
- `apps/workbench/src/lib/plugins/__tests__/plugin-view-tab-store.test.ts` - 20 tests covering open/close/activate/LRU/setTitle/setDirty/snapshots
- `apps/workbench/src/components/plugins/view-tab-renderer.tsx` - Keep-alive renderer with display:none pattern, PluginEditorTabBridge for EditorTabProps, ErrorBoundary+Suspense per tab
- `apps/workbench/src/components/plugins/__tests__/view-tab-renderer.test.tsx` - 6 tests covering rendering, isActive prop, display:none, setTitle/setDirty callbacks

## Decisions Made
- Used monotonic counter (`monotonicNow()`) instead of raw `Date.now()` for `lastActiveAt` and `openedAt` timestamps, solving same-millisecond ordering ambiguity in fast sequential tab opens
- Implemented direct `EditorTabErrorBoundary` + `Suspense` wrapping in ViewTabRenderer rather than using the existing `ViewContainer`, because ViewContainer only passes `ViewProps` (viewId, isActive, storage) but editor tabs need additional `EditorTabProps` (setTitle, setDirty)
- Created `PluginEditorTabBridge` as a thin component that creates bound `setTitle`/`setDirty` callbacks and renders the plugin component with the full `EditorTabProps` interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed monotonic timestamp for deterministic ordering**
- **Found during:** Task 1 (PluginViewTabStore implementation)
- **Issue:** `Date.now()` returns identical millisecond values for rapid sequential calls, causing indeterminate `lastActiveAt` ordering. Test "closing the active tab activates the most recently active remaining tab" failed because tabs opened within the same millisecond had identical timestamps.
- **Fix:** Added `monotonicNow()` helper that guarantees strictly increasing values by tracking `lastTimestamp` and incrementing when `Date.now()` returns a non-advancing value.
- **Files modified:** `apps/workbench/src/lib/plugins/plugin-view-tab-store.ts`
- **Verification:** All 20 store tests pass
- **Committed in:** `4142f3f42`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness of LRU ordering. No scope creep.

## Issues Encountered
None beyond the monotonic timestamp fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PluginViewTabStore and ViewTabRenderer are ready for integration with the tab bar (02-02-PLAN.md)
- Tab bar integration needs to wire `openPluginViewTab`/`closePluginViewTab`/`activatePluginViewTab` to the existing tab bar UI
- Split-pane support (02-02) can use `openPluginViewTab` to open plugin views in pane instances

## Self-Check: PASSED

- All 5 files exist on disk
- All 4 task commits verified in git log (99af7615e, 4142f3f42, f5e7701a5, 403f062bd)
- 40 tests pass (20 store + 6 renderer + 9 registry + 5 container) with no regressions

---
*Phase: 02-editor-tab-views*
*Completed: 2026-03-19*
