---
phase: 02-sidebar-panels-editor-tabs
plan: 03
subsystem: ui
tags: [react, zustand, sidebar-panels, compliance, fleet, library, tab-close, pane-store]

# Dependency graph
requires:
  - phase: 02-sidebar-panels-editor-tabs
    provides: HeartbeatPanel, SentinelPanel, FindingsPanel, pane-store openApp/closeView/setActiveView, PaneTabBar
provides:
  - LibraryPanel component with filterable policy catalog grouped by category
  - FleetPanel component with connection status, agent list, topology link
  - CompliancePanel component with framework score rings and score bars
  - MiniScoreRing export from framework-selector.tsx
  - SidebarPanel with all 7 real panels (zero PlaceholderPanels)
  - ExplorerPanel onOpenFile wired to openApp (SIDE-06)
  - tab.close command with Cmd+W keybinding
affects: [phase-03 right-sidebar, home-page, compliance-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [sidebar panel integration via switch statement, tab close via command registry]

key-files:
  created:
    - apps/workbench/src/features/activity-bar/panels/library-panel.tsx
    - apps/workbench/src/features/activity-bar/panels/fleet-panel.tsx
    - apps/workbench/src/features/activity-bar/panels/compliance-panel.tsx
  modified:
    - apps/workbench/src/components/workbench/compliance/framework-selector.tsx
    - apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx
    - apps/workbench/src/lib/commands/view-commands.ts
    - apps/workbench/src/lib/commands/init-commands.tsx

key-decisions:
  - "CompliancePanel reads active policy via useWorkbench().state.activePolicy.guards/settings"
  - "Per-requirement score bars show binary 0%/100% since scoreFramework returns met/gaps per requirement"
  - "FleetPanel uses useFleetConnectionStore.use.error() to determine connection dot color"

patterns-established:
  - "SidebarPanel switch renders all 7 panels by ActivityBarItemId"
  - "tab.close command wired via closeActiveTab dep in ViewCommandDeps"

requirements-completed: [SIDE-01, SIDE-02, SIDE-06, SIDE-07, SIDE-08, SIDE-09, SIDE-10, PANE-01, PANE-02, PANE-03, PANE-04, PANE-05]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 02 Plan 03: Sidebar Integration Summary

**LibraryPanel, FleetPanel, CompliancePanel with score rings, all 7 panels wired into SidebarPanel (zero placeholders), ExplorerPanel onOpenFile connected to openApp, and Cmd+W tab.close command**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T15:19:43Z
- **Completed:** 2026-03-18T15:26:59Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created LibraryPanel with filterable policy catalog grouped by category, shield icons, and openApp navigation
- Created FleetPanel with connection status dot, agent list with health dots and relative timestamps, topology link, and disconnected CTA
- Created CompliancePanel with MiniScoreRing framework selector, per-requirement score bars, and overall score footer
- Exported MiniScoreRing from framework-selector.tsx for reuse
- Replaced PlaceholderPanel entirely -- SidebarPanel now renders all 7 real panels via switch statement
- Wired ExplorerPanel onOpenFile to paneStore.openApp("/editor", file.name) completing SIDE-06
- Added tab.close command (Cmd+W) that closes the active tab in the active pane

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LibraryPanel, FleetPanel, CompliancePanel, export MiniScoreRing** - `2b258f0d1` (feat)
2. **Task 2: Wire all panels into SidebarPanel, connect ExplorerPanel onOpenFile, add tab.close** - `584c201c6` (feat)

## Files Created/Modified
- `apps/workbench/src/features/activity-bar/panels/library-panel.tsx` - LibraryPanel: filterable catalog with category groups, shield icons, openApp
- `apps/workbench/src/features/activity-bar/panels/fleet-panel.tsx` - FleetPanel: connection status, agent health dots, topology link, disconnected CTA
- `apps/workbench/src/features/activity-bar/panels/compliance-panel.tsx` - CompliancePanel: framework pills with MiniScoreRing, score bars, overall score
- `apps/workbench/src/components/workbench/compliance/framework-selector.tsx` - Added export keyword to MiniScoreRing function
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` - Replaced PlaceholderPanel with switch rendering all 7 panels, wired onOpenFile
- `apps/workbench/src/lib/commands/view-commands.ts` - Added closeActiveTab dep and tab.close command with Meta+W
- `apps/workbench/src/lib/commands/init-commands.tsx` - Wired closeActiveTab using getAllPaneGroups to find active pane

## Decisions Made
- CompliancePanel accesses the active policy via `useWorkbench().state.activePolicy` rather than directly reading sub-stores
- Per-requirement score bars show binary 0%/100% since the compliance-requirements scoreFramework returns met/gaps per requirement (not fractional scores)
- FleetPanel reads the `error` field from the fleet store to distinguish connected/error states in the connection dot color

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useWorkbench returns state wrapper, not direct activePolicy**
- **Found during:** Task 1 (CompliancePanel)
- **Issue:** Initial code used `const { activePolicy } = useWorkbench()` but WorkbenchContextValue exposes `state.activePolicy` not a direct property
- **Fix:** Changed to `const { state } = useWorkbench()` and accessed `state.activePolicy.guards` and `state.activePolicy.settings`
- **Files modified:** apps/workbench/src/features/activity-bar/panels/compliance-panel.tsx
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** 2b258f0d1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API shape correction. No scope creep.

## Issues Encountered
- Pre-existing test failures in App.test.tsx and desktop-layout.test.tsx (9 tests) -- the test mock for desktop-sidebar doesn't export SystemHeartbeat which was added in Phase 01/02. Confirmed these fail identically on the base commit before any of this plan's changes. Out of scope per deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 (Sidebar Panels + Editor Tabs) is now complete: all 7 sidebar panels render real content, all panel clicks open editor tabs, tab close works via Cmd+W
- Ready for Phase 03 (Right Sidebar / Inspector Panel) or Phase 04 (Lab decomposition)
- Pre-existing test mock issue should be addressed before Phase 03 (desktop-sidebar mock needs SystemHeartbeat export)

---
*Phase: 02-sidebar-panels-editor-tabs*
*Completed: 2026-03-18*
