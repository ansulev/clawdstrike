---
phase: 07-detection-editor-integration
plan: 04
subsystem: ui
tags: [zustand, pane-store, hunt, draft-detection, navigation]

requires:
  - phase: 07-detection-editor-integration
    provides: "Pane routes and navigate commands for editor, guards, compare, etc."
provides:
  - "Hunt -> Editor pipeline: Draft Detection button navigates to editor pane tab"
affects: []

tech-stack:
  added: []
  patterns:
    - "usePaneStore.getState().openApp() for cross-feature navigation callbacks"

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/hunt/hunt-layout.tsx

key-decisions:
  - "Used usePaneStore.getState().openApp() (Zustand getState pattern) to avoid hook dependency in callback"

patterns-established:
  - "Cross-feature navigation: pass openApp callback to hooks that need to switch pane tabs"

requirements-completed: [DINT-06]

duration: 1min
completed: 2026-03-18
---

# Phase 7 Plan 4: Hunt Draft-Detection Pipeline Summary

**Wired Hunt "Draft Detection" button to navigate to editor pane tab via usePaneStore.getState().openApp("/editor")**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T20:26:35Z
- **Completed:** 2026-03-18T20:27:37Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Connected the Hunt -> Policy Editor pipeline so "Draft Detection" creates a new policy tab AND navigates to the editor
- Replaced the `onNavigateToEditor: undefined` stub with a working `openApp("/editor", "Editor")` callback
- The useDraftDetection hook already handled creating the policy tab via multiDispatch; now the navigation callback fires afterward

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire onNavigateToEditor in hunt-layout.tsx to openApp** - `f15bce294` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/hunt/hunt-layout.tsx` - Added usePaneStore import, wired onNavigateToEditor to openApp("/editor", "Editor")

## Decisions Made
- Used `usePaneStore.getState().openApp()` (Zustand getState() pattern) rather than calling the hook in render scope -- consistent with existing navigate-commands pattern and avoids unnecessary re-renders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 is now complete (all 4 plans done)
- All detection editor integration features are wired: routes, commands, right sidebar panels, visual builders, TrustPrint tools, and Hunt pipeline
- The workbench v1.1 milestone has Phases 3 (Quick Navigation), 6 (Detection Engineering Inline) remaining

## Self-Check: PASSED

- FOUND: hunt-layout.tsx
- FOUND: f15bce294 (task 1 commit)
- FOUND: 07-04-SUMMARY.md

---
*Phase: 07-detection-editor-integration*
*Completed: 2026-03-18*
