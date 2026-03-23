---
phase: 20-ui-presence-indicators
plan: 02
subsystem: ui
tags: [react, zustand, presence, pane-tabs, activity-bar, real-time]

# Dependency graph
requires:
  - phase: 19-client-connection-store
    provides: "PresenceStore with analysts Map, viewersByFile index, localAnalystId"
provides:
  - "PresenceTabDots component rendering clickable colored dots per file tab"
  - "PresenceActivityPills component rendering analyst pills in activity bar"
affects: [21-cm6-cursor-decoration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Presence indicator components consuming Zustand store selectors", "Cross-store navigation (presence -> pane-store openFile)"]

key-files:
  created:
    - apps/workbench/src/features/presence/components/presence-tab-dots.tsx
    - apps/workbench/src/features/presence/components/presence-activity-pills.tsx
  modified:
    - apps/workbench/src/features/panes/pane-tab.tsx
    - apps/workbench/src/features/activity-bar/components/activity-bar.tsx

key-decisions:
  - "PresenceTabDots uses button elements (not spans) for accessibility and click handling"
  - "Dot click navigates to analyst's active file via usePaneStore.getState().openFile (locked decision)"
  - "Activity bar pills placed below icon group with subtle gradient divider matching existing gold divider pattern"

patterns-established:
  - "Presence indicator pattern: read from usePresenceStore, filter out localAnalystId, render with analyst.color"
  - "Cross-store click handler: stopPropagation + usePaneStore.getState().openFile for external navigation"

requirements-completed: [UI-02, UI-03]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 20 Plan 02: Pane Tab Presence Dots & Activity Bar Analyst Pills Summary

**Clickable colored presence dots on pane tabs (max 3 + overflow) and stacked analyst pills in activity bar (max 5 + overflow), both excluding local analyst**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T16:42:24Z
- **Completed:** 2026-03-23T16:44:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PresenceTabDots component shows up to 3 colored dots on file tabs for remote viewers, with +N overflow
- Each presence dot is a clickable button that navigates to the analyst's current file via usePaneStore.openFile
- PresenceActivityPills component shows up to 5 colored 8px circles in the activity bar for online remote analysts
- Both components filter out the local analyst and return null when solo (clean offline/solo UX)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PresenceTabDots with click-to-navigate and integrate into PaneTab** - `426df0452` (feat)
2. **Task 2: Create PresenceActivityPills and integrate into ActivityBar** - `1dc9143bd` (feat)

## Files Created/Modified
- `apps/workbench/src/features/presence/components/presence-tab-dots.tsx` - Clickable colored dots for file tab remote viewers with max 3 + overflow
- `apps/workbench/src/features/presence/components/presence-activity-pills.tsx` - Colored 8px pills in activity bar for online remote analysts with max 5 + overflow
- `apps/workbench/src/features/panes/pane-tab.tsx` - Integrated PresenceTabDots between label and close button
- `apps/workbench/src/features/activity-bar/components/activity-bar.tsx` - Integrated PresenceActivityPills with subtle gradient divider below icon group

## Decisions Made
- Used `<button>` elements for presence dots (not `<span>`) for proper accessibility and click handling
- Click handler uses `usePaneStore.getState().openFile` (imperative outside React render) per locked decision
- Activity bar pills use subtle `rgba(111,127,154,0.12)` gradient divider matching the existing gold divider pattern but in a neutral tone

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both presence indicator components are ready for Phase 21 (CM6 cursor decorations)
- The presence store's cursor and selection data is already flowing but not yet consumed by any UI
- PresenceTabDots established the cross-store navigation pattern that Phase 21 may also use

## Self-Check: PASSED

All 4 created/modified files verified on disk. Both task commits (426df0452, 1dc9143bd) verified in git log.

---
*Phase: 20-ui-presence-indicators*
*Completed: 2026-03-23*
