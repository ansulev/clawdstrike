---
phase: 02-sidebar-panels-editor-tabs
plan: 01
subsystem: ui
tags: [zustand, pane-system, tabs, react, vitest, tdd]

requires:
  - phase: 01-activity-bar-sidebar-shell
    provides: PaneContainer, pane-store, pane-tree binary tree system
provides:
  - openApp(route, label) action for tab-based navigation from sidebar panels
  - closeView(paneId, viewId) action for tab close with neighbor selection
  - setActiveView(paneId, viewId) action for tab switching
  - PaneTabBar component rendering horizontal editor tabs
  - PaneTab component with close button, gold underline indicator
  - addViewToGroup and removeViewFromGroup tree helpers
affects: [02-sidebar-panels-editor-tabs, 03-right-sidebar-bottom-panel]

tech-stack:
  added: []
  patterns: [multi-view pane groups with tab bar UI, TDD for store actions]

key-files:
  created:
    - apps/workbench/src/features/panes/pane-tab.tsx
    - apps/workbench/src/features/panes/pane-tab-bar.tsx
  modified:
    - apps/workbench/src/features/panes/pane-tree.ts
    - apps/workbench/src/features/panes/pane-store.ts
    - apps/workbench/src/features/panes/pane-container.tsx
    - apps/workbench/src/features/panes/__tests__/pane-store.test.ts

key-decisions:
  - "Exported replaceNode from pane-tree.ts (was module-private) for use by addViewToGroup/removeViewFromGroup"
  - "closeView on empty pane with siblings delegates to existing closePane instead of creating new Home view"
  - "openApp searches all pane groups for route dedup, not just the active pane"

patterns-established:
  - "PaneTabBar + PaneTab: reusable tab components with ARIA tablist/tab/tabpanel roles"
  - "Tab close neighbor selection: prefer right, fall back to left, reset to Home if last"

requirements-completed: [PANE-01, PANE-02, PANE-03, PANE-04, PANE-05]

duration: 5min
completed: 2026-03-18
---

# Phase 02 Plan 01: Editor Tabs Summary

**Multi-tab pane system with openApp/closeView/setActiveView store actions, PaneTabBar horizontal tab strip, and PaneTab with gold underline indicator**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T15:06:25Z
- **Completed:** 2026-03-18T15:11:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Pane store enhanced with 3 new actions: openApp (add/focus tabs), closeView (remove with neighbor selection), setActiveView (switch tabs)
- PaneTabBar renders all views in a pane group as horizontal tabs with split and close-pane controls
- PaneTab shows 11px JetBrains Mono label, close button on hover/active, 2px gold underline for active tab
- Full ARIA accessibility: tablist, tab, tabpanel roles with aria-controls linkage
- 13 unit tests passing (3 original + 10 new covering all behaviors)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `f3a2641` (test)
2. **Task 1 GREEN: openApp, closeView, setActiveView + tree helpers** - `fd1723e` (feat)
3. **Task 2: PaneTabBar, PaneTab, PaneContainer update** - `f507409` (feat)

_TDD task had separate RED and GREEN commits._

## Files Created/Modified
- `apps/workbench/src/features/panes/pane-tab.tsx` - Individual tab component with close button, middle-click, gold underline
- `apps/workbench/src/features/panes/pane-tab-bar.tsx` - Horizontal tab strip container with split/close-pane controls
- `apps/workbench/src/features/panes/pane-tree.ts` - Exported replaceNode; added addViewToGroup, removeViewFromGroup helpers
- `apps/workbench/src/features/panes/pane-store.ts` - Added openApp, closeView, setActiveView actions to PaneStore
- `apps/workbench/src/features/panes/pane-container.tsx` - Replaced single-view header with PaneTabBar; added tabpanel role
- `apps/workbench/src/features/panes/__tests__/pane-store.test.ts` - 10 new tests for tab management actions

## Decisions Made
- Exported `replaceNode` from pane-tree.ts so `addViewToGroup` and `removeViewFromGroup` can use it (was module-private)
- `closeView` on the last view in a multi-pane layout delegates to `closePane` rather than creating a Home fallback (keeps split behavior consistent)
- `openApp` searches ALL pane groups for an existing view with the same normalized route to prevent duplicates across splits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test for duplicate tab detection after split**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Test assumed `splitPane` would clone Home view, but it clones the active view (Editor), creating a second `/editor` tab that invalidated the dedup assertion
- **Fix:** Updated test to switch active view to Home before splitting so sibling gets Home clone, making the dedup test valid
- **Files modified:** `apps/workbench/src/features/panes/__tests__/pane-store.test.ts`
- **Verification:** All 13 tests pass
- **Committed in:** fd1723e (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test logic)
**Impact on plan:** Test logic was corrected to match actual splitPane behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `openApp()` is available for all sidebar panels (Plan 02) to open detail views as editor tabs
- PaneTabBar renders correctly with single and multiple tabs
- All pane splitting, closing, and focus behavior continues to work
- Ready for Plan 02: sidebar panel implementations that call `openApp()`

## Self-Check: PASSED

All 7 files verified present. All 3 task commits verified in git log.
