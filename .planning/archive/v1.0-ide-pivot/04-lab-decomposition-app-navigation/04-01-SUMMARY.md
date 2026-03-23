---
phase: 04-lab-decomposition-app-navigation
plan: 01
subsystem: ui
tags: [react, react-router, lazy-loading, zustand, pane-system]

# Dependency graph
requires:
  - phase: 02-editor-pane-tabs-bottom-panel
    provides: pane store with openApp, normalizeWorkbenchRoute, getWorkbenchRouteLabel
provides:
  - Direct routes for /swarm-board, /hunt, /simulator as independent apps
  - Updated normalizeWorkbenchRoute that no longer folds lab sub-apps
  - Updated getWorkbenchRouteLabel with labels for new direct routes
  - Integration tests proving openApp works with new decomposed routes
affects: [04-lab-decomposition-app-navigation, command-palette, sidebar-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-import-with-suspense-for-direct-routes, independent-app-routing-over-container-tabs]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/desktop/workbench-routes.tsx
    - apps/workbench/src/features/panes/__tests__/pane-store.test.ts

key-decisions:
  - "Kept /lab route and LabLayout unchanged as convenience grouping; sub-apps are independently routable but Lab still works"
  - "Used Suspense wrappers at route level for lazy-loaded HuntLayout, SimulatorLayout, SwarmBoardPage"

patterns-established:
  - "Independent app routing: sub-apps that were previously tab-gated in a container can be promoted to direct routes while preserving the container as optional"

requirements-completed: [LAB-01, LAB-02, LAB-03, LAB-04]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 4 Plan 1: Lab Decomposition Summary

**Direct routes for Swarm Board, Hunt, and Simulator as independent pane-openable apps, breaking free from Lab container's segmented tab control**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T18:06:13Z
- **Completed:** 2026-03-18T18:09:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- /swarm-board, /hunt, /simulator each render their component directly as independent routes with lazy loading + Suspense
- normalizeWorkbenchRoute no longer folds /hunt into /lab?tab=hunt, /simulator into /lab?tab=simulate, or /swarm-board into /lab
- getWorkbenchRouteLabel returns "Swarm Board", "Hunt", "Simulator" for the new direct routes
- 5 new integration tests confirm openApp creates correct independent tabs and routes are not deduped with /lab
- /lab route preserved unchanged with LabLayout segmented tab control (LAB-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add direct routes and fix normalization for lab sub-apps** - `b312377f9` (feat)
2. **Task 2: Add openApp integration tests for new independent routes** - `140c6d815` (test)

## Files Created/Modified
- `apps/workbench/src/components/desktop/workbench-routes.tsx` - Added lazy imports for HuntLayout/SimulatorLayout/SwarmBoardPage, removed normalization folding, added route labels, replaced Navigate redirects with direct Suspense-wrapped renders
- `apps/workbench/src/features/panes/__tests__/pane-store.test.ts` - Added "lab decomposition routes" describe block with 5 tests for openApp with new independent routes

## Decisions Made
- Kept /lab route and LabLayout unchanged as convenience grouping; sub-apps are independently routable but Lab still works as a combined view
- Used Suspense wrappers at route level for all three lazy-loaded components (HuntLayout, SimulatorLayout, SwarmBoardPage) with minimal `<div className="flex-1" />` fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Direct routes are live; Plan 02 can add command palette entries and sidebar links for the new independent apps
- All existing pane-store tests continue to pass (18/18)

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 04-lab-decomposition-app-navigation*
*Completed: 2026-03-18*
