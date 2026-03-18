---
phase: 01-activity-bar-sidebar-shell
plan: 01
subsystem: ui
tags: [zustand, react, activity-bar, sidebar, immer, createSelectors]

# Dependency graph
requires: []
provides:
  - ActivityBarItemId type and ACTIVITY_BAR_ITEMS config array
  - useActivityBarStore Zustand store (activeItem, sidebarVisible, sidebarWidth)
  - ActivityBar component (48px vertical icon rail)
  - ActivityBarItem component (clickable icon with active indicator)
  - SidebarPanel component (panel switcher with ExplorerPanel integration)
  - SidebarResizeHandle component (drag-to-resize between 120-480px)
affects: [01-02-shell-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [activity-bar feature module with types/stores/components structure]

key-files:
  created:
    - apps/workbench/src/features/activity-bar/types.ts
    - apps/workbench/src/features/activity-bar/stores/activity-bar-store.ts
    - apps/workbench/src/features/activity-bar/components/activity-bar-item.tsx
    - apps/workbench/src/features/activity-bar/components/activity-bar.tsx
    - apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx
    - apps/workbench/src/features/activity-bar/components/sidebar-resize-handle.tsx
  modified:
    - apps/workbench/src/components/desktop/desktop-sidebar.tsx

key-decisions:
  - "Exported SystemHeartbeat from desktop-sidebar.tsx for reuse in activity bar (not yet extracted to standalone module)"
  - "ExplorerPanel in sidebar uses browse-only mode (onOpenFile is a no-op in Phase 1, full wiring deferred to shell integration)"
  - "Heartbeat rendered as button wrapping SystemHeartbeat component rather than using ActivityBarItem to preserve the complex SVG diamond sigil"

patterns-established:
  - "Activity bar feature module: types.ts defines IDs and config, stores/ has Zustand store, components/ has React components"
  - "ActivityBarItem pattern: role=tab, aria-selected, gold indicator bar, drop-shadow glow on active state"

requirements-completed: [ABAR-01, ABAR-02, ABAR-03, ABAR-04, ABAR-05, ABAR-06, STATE-01]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 1 Plan 01: Activity Bar Feature Module Summary

**Activity bar types, Zustand store (createSelectors + immer), and 4 UI components: 48px icon rail with 7 panels + settings + operator identity, sidebar panel switcher with ExplorerPanel, and drag-to-resize handle**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T13:38:13Z
- **Completed:** 2026-03-18T13:42:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created ActivityBarItemId union type (7 panel IDs) and ACTIVITY_BAR_ITEMS config array (6 sigil entries, heartbeat special-cased)
- Implemented activity-bar-store with createSelectors + immer pattern: toggleItem, toggleSidebar, showPanel, setSidebarWidth, collapseSidebar actions
- Built 4 components matching UI-SPEC: ActivityBar (48px rail), ActivityBarItem (active indicator + glow), SidebarPanel (explorer + placeholders), SidebarResizeHandle (120px collapse threshold)
- Full ARIA accessibility: toolbar, tab, tabpanel, separator roles with proper attributes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create activity bar types and Zustand store** - `fb9efde16` (feat)
2. **Task 2: Create ActivityBar, ActivityBarItem, SidebarPanel, SidebarResizeHandle components** - `040c21b9a` (feat)

## Files Created/Modified
- `apps/workbench/src/features/activity-bar/types.ts` - ActivityBarItemId type and ACTIVITY_BAR_ITEMS config array
- `apps/workbench/src/features/activity-bar/stores/activity-bar-store.ts` - Zustand store with createSelectors + immer, defaults to explorer active at 240px
- `apps/workbench/src/features/activity-bar/components/activity-bar-item.tsx` - Individual clickable icon with active/hover/default states and gold indicator bar
- `apps/workbench/src/features/activity-bar/components/activity-bar.tsx` - 48px vertical icon rail: heartbeat + 6 sigils + settings + operator identity
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` - Panel switcher: ExplorerPanel for explorer, placeholders for 6 other panels
- `apps/workbench/src/features/activity-bar/components/sidebar-resize-handle.tsx` - 4px drag zone with 120-480px range, collapse threshold, visible line feedback
- `apps/workbench/src/components/desktop/desktop-sidebar.tsx` - Exported SystemHeartbeat function for reuse

## Decisions Made
- Exported SystemHeartbeat from desktop-sidebar.tsx rather than extracting to standalone module (simpler for Phase 1; full extraction can happen when desktop-sidebar is deprecated)
- ExplorerPanel in sidebar panel uses browse-only mode with no-op onOpenFile (full file-opening integration deferred to Plan 02 shell integration)
- Heartbeat item rendered as a button wrapping SystemHeartbeat with collapsed={true} rather than using ActivityBarItem, preserving the complex diamond SVG sigil with breathing animations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported SystemHeartbeat from desktop-sidebar.tsx**
- **Found during:** Task 2 (ActivityBar component creation)
- **Issue:** SystemHeartbeat was a local (non-exported) function in desktop-sidebar.tsx; ActivityBar needed to import it
- **Fix:** Added `export` keyword to SystemHeartbeat function declaration
- **Files modified:** apps/workbench/src/components/desktop/desktop-sidebar.tsx
- **Verification:** TypeScript compiles without errors, existing DesktopSidebar usage unchanged
- **Committed in:** 040c21b9a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- single keyword addition to enable import. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 activity bar feature files ready for Plan 02 shell integration
- Plan 02 will wire ActivityBar, SidebarPanel, and SidebarResizeHandle into desktop-layout.tsx
- ExplorerPanel file-opening will need wiring through the pane/editor system during integration

## Self-Check: PASSED

All 7 files verified present. Both task commits (fb9efde16, 040c21b9a) verified in git log.

---
*Phase: 01-activity-bar-sidebar-shell*
*Completed: 2026-03-18*
