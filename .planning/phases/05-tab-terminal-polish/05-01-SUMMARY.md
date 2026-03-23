---
phase: 05-tab-terminal-polish
plan: 01
subsystem: ui
tags: [react, zustand, tabs, context-menu, overflow, resize-observer]

# Dependency graph
requires: []
provides:
  - Tab overflow detection with scroll arrows and wheel scroll
  - Tab context menu with Close, Close Others, Close to the Right, Close Saved, Close All
  - Batch-close store actions (closeViewsToRight, closeSavedViews, closeOtherViews)
affects: [pane-system, tab-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ResizeObserver + scroll event for overflow detection
    - Conditional scroll arrows with smooth scrollBy
    - Context menu pattern matching policy-tab-bar (fixed z-100, mousedown/Escape dismiss)

key-files:
  created: []
  modified:
    - apps/workbench/src/features/panes/pane-tab-bar.tsx
    - apps/workbench/src/features/panes/pane-tab.tsx
    - apps/workbench/src/features/panes/pane-store.ts

key-decisions:
  - "closeSavedViews closes all non-active tabs (PaneView has no dirty state, so active = working on, others = saved)"
  - "Context menu defined as inline component in pane-tab-bar.tsx for co-location with tab rendering"

patterns-established:
  - "PaneTabContextMenu: reusable context menu pattern for pane tabs matching policy-tab-bar styling"

requirements-completed: [TAB-01, TAB-02, TAB-03]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 5 Plan 1: Tab Overflow & Context Menu Summary

**Tab overflow arrows via ResizeObserver + wheel scroll, context menu with Close to Right / Close Saved / Close All batch actions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T19:35:22Z
- **Completed:** 2026-03-18T19:40:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Tab bar detects overflow via ResizeObserver and shows left/right chevron arrows for scrolling
- Mouse wheel on tab bar scrolls tabs horizontally (deltaY converted to horizontal scroll)
- Right-click context menu on pane tabs with Close, Close Others, Close to the Right, Close Saved, Close All
- Three new batch-close store actions: closeViewsToRight, closeSavedViews, closeOtherViews

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tab overflow detection with scroll arrows and wheel scroll** - `dd527f2` (feat)
2. **Task 2: Add context menu with Close to the Right and Close Saved to pane tabs** - `3ffac05` (feat)

## Files Created/Modified
- `apps/workbench/src/features/panes/pane-tab-bar.tsx` - Added overflow detection (ResizeObserver + scroll listener), scroll arrows (IconChevronLeft/Right), wheel handler, and PaneTabContextMenu component
- `apps/workbench/src/features/panes/pane-tab.tsx` - Added onContextMenu prop forwarding to outer button element
- `apps/workbench/src/features/panes/pane-store.ts` - Added closeViewsToRight, closeSavedViews, closeOtherViews store actions

## Decisions Made
- closeSavedViews closes all non-active tabs since PaneView has no dirty state (unlike PolicyTab) -- active tab is the one being worked on, all others are treated as "saved"
- Context menu component (PaneTabContextMenu) defined inline in pane-tab-bar.tsx for co-location, following the same pattern as TabContextMenu in policy-tab-bar.tsx
- Used IconXboxX for Close Others, IconArrowBarRight for Close to the Right, IconChecks for Close Saved, IconTrash for Close All

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TS errors in tauri-bridge.ts (missing @tauri-apps/plugin-fs) and project-store.ts (missing file mutation methods) -- unrelated to this plan's changes
- Pre-existing vitest path resolution issue prevents pane-store tests from running (workbench-routes alias not resolved)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tab overflow and context menu complete, ready for Phase 5 Plan 2 (terminal splits and tab rename)
- All pane tab management features working: overflow navigation, batch close operations

## Self-Check: PASSED

All created/modified files verified on disk. All task commit hashes found in git log.

---
*Phase: 05-tab-terminal-polish*
*Completed: 2026-03-18*
