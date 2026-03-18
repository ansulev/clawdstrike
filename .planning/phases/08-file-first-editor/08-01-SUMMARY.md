---
phase: 08-file-first-editor
plan: 01
subsystem: ui
tags: [zustand, react-router, pane-system, file-editor, lazy-loading]

# Dependency graph
requires:
  - phase: 05-tab-terminal-polish
    provides: pane tab system with overflow, context menu, close actions
  - phase: 07-detection-editor-integration
    provides: standalone detection routes, right sidebar panels
provides:
  - FileEditorShell component bridging /file/* routes to policy-tabs-store
  - PaneView extended with dirty and fileType metadata
  - openFile pane-store helper for file-as-tab opening
  - /file/* route registered in WORKBENCH_ROUTE_OBJECTS
  - Dirty state sync subscription from policy-tabs-store to pane views
affects: [08-file-first-editor, pane-system, editor]

# Tech tracking
tech-stack:
  added: []
  patterns: [pane-to-policy-tabs bridge via route params, cross-store dirty sync subscription]

key-files:
  created:
    - apps/workbench/src/features/editor/file-editor-shell.tsx
  modified:
    - apps/workbench/src/features/panes/pane-types.ts
    - apps/workbench/src/features/panes/pane-store.ts
    - apps/workbench/src/components/desktop/workbench-routes.tsx
    - apps/workbench/src/features/panes/__tests__/pane-store.test.ts

key-decisions:
  - "useParams('*') splat for file path extraction in FileEditorShell (standard react-router pattern)"
  - "Zustand subscribe(state, prevState) for dirty sync (no subscribeWithSelector middleware needed)"
  - "openFile delegates to openApp for route dedup, then pushRecentFile for recent tracking"
  - "File routes pass through normalizeWorkbenchRoute unchanged (no switch-case collapsing)"

patterns-established:
  - "Cross-store sync: subscribe to policy-tabs-store tabs changes, update pane views dirty/fileType"
  - "File route convention: /file/{path} maps to file-editor-shell with splat param"
  - "Feature directory: src/features/editor/ for Phase 8 editor components"

requirements-completed: [FLAT-01, FLAT-05, FLAT-08]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 8 Plan 01: File-First Editor Foundation Summary

**FileEditorShell component with /file/* pane route, PaneView dirty/fileType metadata, openFile bridge, and cross-store dirty sync**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T21:34:46Z
- **Completed:** 2026-03-18T21:40:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created FileEditorShell bridging /file/* route params to policy-tabs-store tab lookup and content display
- Extended PaneView with dirty and fileType optional fields for file tab metadata
- Added openFile convenience method to pane-store with pushRecentFile integration
- Registered /file/* route in workbench-routes with passthrough normalization and filename label extraction
- Implemented dirty sync subscription from policy-tabs-store to pane views

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PaneView, /file/* route, FileEditorShell** - `652d845e8` (feat)
2. **Task 2: openFile helper, dirty sync, file route tests** - `f357a1bd5` (feat)

## Files Created/Modified
- `apps/workbench/src/features/editor/file-editor-shell.tsx` - FileEditorShell bridging /file/* route to policy-tabs-store
- `apps/workbench/src/features/panes/pane-types.ts` - PaneView extended with dirty/fileType fields
- `apps/workbench/src/features/panes/pane-store.ts` - openFile method and subscribeToDirtySync
- `apps/workbench/src/components/desktop/workbench-routes.tsx` - /file/* route, lazy import, normalize/label handling
- `apps/workbench/src/features/panes/__tests__/pane-store.test.ts` - 3 new tests for file route behavior

## Decisions Made
- Used `useParams("*")` splat for file path extraction in FileEditorShell (standard react-router pattern for wildcard routes)
- Used Zustand's basic `subscribe(state, prevState)` for dirty sync instead of `subscribeWithSelector` middleware (project doesn't use the middleware)
- `openFile` delegates to `openApp` for route dedup, then calls `pushRecentFile` (file loading deferred to FileEditorShell mount)
- File routes pass through `normalizeWorkbenchRoute` unchanged to preserve full file paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted dirty sync to Zustand 5 basic subscribe API**
- **Found during:** Task 2
- **Issue:** Plan specified `subscribe(selector, listener)` overload which requires `subscribeWithSelector` middleware; the policy-tabs-store doesn't use that middleware
- **Fix:** Used basic `subscribe((state, prevState) => ...)` with referential equality check on `state.tabs`
- **Files modified:** apps/workbench/src/features/panes/pane-store.ts
- **Verification:** All 21 pane-store tests pass
- **Committed in:** f357a1bd5

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary adaptation for Zustand API compatibility. Same behavior, different subscribe pattern.

## Issues Encountered
- Linter initially removed FileEditorShell lazy import (unused import removal). Resolved on second git add when all route references were in place.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FileEditorShell skeleton ready for Phase 8 Plan 02 (dirty dot + file-type color indicators on PaneTab)
- openFile bridge ready for Phase 8 Plan 04 (rewire Explorer/QuickOpen/Search/Hunt to /file/ routes)
- features/editor/ directory established for Plan 03 (FileEditorToolbar extraction)

## Self-Check: PASSED

All created files verified present. Both commit hashes confirmed in git log.

---
*Phase: 08-file-first-editor*
*Completed: 2026-03-18*
