---
phase: 20-ui-presence-indicators
plan: 01
subsystem: ui
tags: [react, zustand, presence, status-bar, sidebar, activity-bar]

requires:
  - phase: 19-client-connection-store
    provides: "PresenceSocket, presence-store with connectionState and analysts Map"
provides:
  - "PresenceStatusIndicator component (green/amber/red dot + online count in status bar)"
  - "AnalystRosterPanel sidebar component (clickable analyst rows with click-to-navigate)"
  - "'people' registered as ActivityBarItemId with sidebar panel wiring"
affects: [21-cm6-cursor-overlay, 20-ui-presence-indicators]

tech-stack:
  added: []
  patterns: ["Granular Zustand selectors for presence UI (scalar connectionState + analysts.size avoids Map subscription)", "Click-to-navigate pattern via usePaneStore.getState().openFile"]

key-files:
  created:
    - apps/workbench/src/features/presence/components/presence-status-indicator.tsx
    - apps/workbench/src/features/presence/components/analyst-roster-panel.tsx
  modified:
    - apps/workbench/src/components/desktop/status-bar.tsx
    - apps/workbench/src/features/activity-bar/types.ts
    - apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx

key-decisions:
  - "Granular selectors: connectionState and analysts.size read separately to avoid re-render storms from cursor/selection updates"
  - "Remote analysts only in roster: local analyst filtered out since 'you' should not appear in 'who else is here' list"

patterns-established:
  - "Presence UI selector pattern: read scalars from presence store, not full Map"
  - "Activity bar extension pattern: add to union type + ACTIVITY_BAR_ITEMS array + sidebar-panel switch"

requirements-completed: [CONN-03, UI-01, UI-04]

duration: 3min
completed: 2026-03-23
---

# Phase 20 Plan 01: Status Bar Presence Indicator & Analyst Roster Summary

**Status bar green/amber/red dot with online count and toggleable People sidebar panel listing remote analysts with click-to-navigate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T16:42:24Z
- **Completed:** 2026-03-23T16:45:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PresenceStatusIndicator in status bar shows colored dot (green=connected, amber=reconnecting, red=offline) with online analyst count
- Clicking the status bar indicator toggles the People sidebar panel via activity bar store
- AnalystRosterPanel lists all remote analysts sorted alphabetically with sigil color dot, name, current file path, and "online" badge
- Clicking an analyst row navigates to their current file via usePaneStore.openFile (per locked decision)
- Empty state shows "No other analysts connected" when solo
- "people" registered as a first-class ActivityBarItemId with IconUsers icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PresenceStatusIndicator and add to status bar** - `426df0452` (feat)
2. **Task 2: Register People panel and create AnalystRosterPanel with click-to-navigate** - `0424468e3` (feat)

## Files Created/Modified
- `apps/workbench/src/features/presence/components/presence-status-indicator.tsx` - Status bar widget with colored dot + count + toggle click
- `apps/workbench/src/features/presence/components/analyst-roster-panel.tsx` - Sidebar panel with sorted analyst list and click-to-navigate
- `apps/workbench/src/components/desktop/status-bar.tsx` - Added PresenceStatusIndicator between Fleet and MCP indicators
- `apps/workbench/src/features/activity-bar/types.ts` - Added "people" to ActivityBarItemId union and ACTIVITY_BAR_ITEMS array
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` - Added case "people" rendering AnalystRosterPanel

## Decisions Made
- Granular Zustand selectors for PresenceStatusIndicator: `connectionState` and `analysts.size` read separately to avoid subscribing to full Map (prevents re-render storms from cursor/selection updates)
- Local analyst filtered out of roster display since "you" should not appear in the "who else is here" list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Presence UI foundation complete: status bar indicator and analyst roster panel are functional
- Ready for Plan 20-02 (file-level presence dots) and Plan 20-03 (cursor overlay)
- PresenceStatusIndicator and AnalystRosterPanel both consume presence-store selectors established in Phase 19

---
*Phase: 20-ui-presence-indicators*
*Completed: 2026-03-23*
