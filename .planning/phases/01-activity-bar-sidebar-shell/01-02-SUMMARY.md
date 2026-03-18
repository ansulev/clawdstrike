---
phase: 01-activity-bar-sidebar-shell
plan: 02
subsystem: ui
tags: [react, zustand, command-registry, activity-bar, sidebar, desktop-layout, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 01-activity-bar-sidebar-shell/01
    provides: ActivityBar, SidebarPanel, SidebarResizeHandle components and useActivityBarStore
provides:
  - IDE-style desktop shell with ActivityBar + SidebarPanel replacing DesktopSidebar
  - sidebar.toggle (Cmd+B) and sidebar.explorer (Cmd+Shift+E) commands
  - "Sidebar" command category in registry
affects: [02-panel-content, future-sidebar-panels]

# Tech tracking
tech-stack:
  added: []
  patterns: [sidebar commands wired via useActivityBarStore.getState().actions]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/desktop/desktop-layout.tsx
    - apps/workbench/src/lib/command-registry.ts
    - apps/workbench/src/lib/commands/view-commands.ts
    - apps/workbench/src/lib/commands/edit-commands.ts
    - apps/workbench/src/lib/commands/init-commands.tsx

key-decisions:
  - "Replaced DesktopSidebar with ActivityBar + SidebarPanel + SidebarResizeHandle in desktop-layout flex row"
  - "Moved sidebar toggle from edit-commands (edit.toggleSidebar dispatching SET_SIDEBAR_COLLAPSED) to view-commands (sidebar.toggle via activityBarStore)"
  - "sidebar.toggle uses View category; sidebar.explorer uses new Sidebar category"

patterns-established:
  - "Sidebar commands access store via useActivityBarStore.getState().actions pattern (not React hooks)"
  - "Global keyboard commands (Cmd+B, Cmd+Shift+E) registered in view-commands.ts with context: global"

requirements-completed: [CMD-01, CMD-02, STATE-03, SHELL-01, SHELL-02, SHELL-03, SHELL-04]

# Metrics
duration: 14min
completed: 2026-03-18
---

# Phase 1 Plan 02: Shell Integration Summary

**Wired ActivityBar + SidebarPanel into desktop-layout.tsx, registered sidebar.toggle (Cmd+B) and sidebar.explorer (Cmd+Shift+E) commands, removed legacy edit.toggleSidebar**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-18T13:45:51Z
- **Completed:** 2026-03-18T14:00:45Z
- **Tasks:** 3 (2 auto + 1 visual checkpoint)
- **Files modified:** 5

## Accomplishments
- Replaced DesktopSidebar with ActivityBar + SidebarPanel + SidebarResizeHandle in the desktop shell flex row
- Registered sidebar.toggle (Cmd+B) and sidebar.explorer (Cmd+Shift+E) as global commands via the command registry
- Removed legacy edit.toggleSidebar command and getSidebarCollapsed dep to eliminate Meta+B keybinding conflict
- Added "Sidebar" to CommandCategory union for future sidebar-related commands
- Visual checkpoint confirmed: all layout elements (Titlebar, StatusBar, PaneRoot, BottomPane) render correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Update desktop-layout.tsx to use ActivityBar + SidebarPanel** - `5cbb5c04c` (feat)
2. **Task 2: Register sidebar.toggle and sidebar.explorer commands, remove edit.toggleSidebar** - `3e89ae844` (feat)
3. **Task 3: Visual verification of activity bar + sidebar shell** - approved by user (no commit needed)

## Files Created/Modified
- `apps/workbench/src/components/desktop/desktop-layout.tsx` - Replaced DesktopSidebar import/usage with ActivityBar + SidebarPanel + SidebarResizeHandle
- `apps/workbench/src/lib/command-registry.ts` - Added "Sidebar" to CommandCategory union type
- `apps/workbench/src/lib/commands/view-commands.ts` - Added sidebar.toggle and sidebar.explorer commands, extended ViewCommandDeps with toggleSidebar/showExplorer
- `apps/workbench/src/lib/commands/edit-commands.ts` - Removed edit.toggleSidebar command and getSidebarCollapsed from EditCommandDeps
- `apps/workbench/src/lib/commands/init-commands.tsx` - Imported useActivityBarStore, wired toggleSidebar/showExplorer deps, removed getSidebarCollapsed

## Decisions Made
- Moved sidebar toggle from Edit category (dispatching SET_SIDEBAR_COLLAPSED to multi-policy store) to View category using the new activityBarStore -- cleaner separation of concerns
- sidebar.explorer uses the new "Sidebar" category while sidebar.toggle uses "View" -- matches VS Code convention where toggle visibility is a view action
- Commands access store via getState().actions pattern (not React hooks) since they execute outside React render context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 (Activity Bar + Sidebar Shell) is complete -- both plans executed successfully
- Desktop shell now has IDE-style chrome: ActivityBar (48px rail) + SidebarPanel (resizable) + editor area
- Keyboard shortcuts Cmd+B and Cmd+Shift+E are functional
- All 11 existing Zustand stores continue to work unchanged (STATE-03 satisfied)
- Ready for Phase 2 panel content implementation

## Self-Check: PASSED

All 5 modified files verified present. Both task commits (5cbb5c04c, 3e89ae844) verified in git log.

---
*Phase: 01-activity-bar-sidebar-shell*
*Completed: 2026-03-18*
