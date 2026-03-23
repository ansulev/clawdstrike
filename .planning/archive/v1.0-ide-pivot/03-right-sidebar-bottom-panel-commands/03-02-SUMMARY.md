---
phase: 03-right-sidebar-bottom-panel-commands
plan: 02
subsystem: ui
tags: [react, zustand, commands, right-sidebar, layout, keybindings]

# Dependency graph
requires:
  - phase: 03-right-sidebar-bottom-panel-commands
    plan: 01
    provides: RightSidebar, RightSidebarResizeHandle, right-sidebar-store, AuditTailPanel, bottom-pane audit tab
provides:
  - Right sidebar integrated into desktop layout (conditional rendering)
  - 8 Phase 3 commands registered (sidebar.toggleRight, 6 sidebar panel commands, view.toggleAudit)
  - Cmd+Shift+B keybinding for right sidebar toggle
  - All commands discoverable via command palette
affects: [phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [palette-only commands for sidebar panel switches, conditional layout rendering for sidebar visibility]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/desktop/desktop-layout.tsx
    - apps/workbench/src/lib/commands/view-commands.ts
    - apps/workbench/src/lib/commands/init-commands.tsx

key-decisions:
  - "No new decisions -- followed plan exactly as specified"

patterns-established:
  - "Sidebar panel commands use Sidebar category with no keybinding (palette-only, VS Code convention)"
  - "Right sidebar renders outside <main> in the flex row, spanning full height of main area"

requirements-completed: [RBAR-01, RBAR-02, RBAR-04, CMD-03, CMD-04, STATE-02]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 3 Plan 02: Layout Integration + Command Registration Summary

**Right sidebar conditionally rendered in desktop layout with 8 new commands (toggle right sidebar via Cmd+Shift+B, 6 sidebar panel switches, audit panel toggle) wired to stores**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T17:24:15Z
- **Completed:** 2026-03-18T17:27:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Right sidebar + resize handle conditionally rendered in desktop layout after `<main>`, spanning full height of the main area
- 8 new commands registered: sidebar.toggleRight (Meta+Shift+B), sidebar.sentinels, sidebar.findings, sidebar.library, sidebar.fleet, sidebar.compliance, sidebar.heartbeat, view.toggleAudit
- All command deps wired to existing store actions (right-sidebar-store, activity-bar-store, bottom-pane-store)
- TypeScript compiles without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate right sidebar into desktop layout** - `5861e57` (feat)
2. **Task 2: Register 8 Phase 3 commands and wire deps** - `4c71539` (feat)

## Files Created/Modified
- `apps/workbench/src/components/desktop/desktop-layout.tsx` - Added RightSidebar + RightSidebarResizeHandle imports, rightSidebarVisible state subscription, conditional rendering after main
- `apps/workbench/src/lib/commands/view-commands.ts` - Added 8 new deps to ViewCommandDeps, registered 8 new commands with proper categories and keybindings
- `apps/workbench/src/lib/commands/init-commands.tsx` - Added useRightSidebarStore import, wired 8 new deps to store actions

## Decisions Made
None - followed plan exactly as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 is now complete: right sidebar infrastructure (Plan 01) + layout integration and commands (Plan 02)
- All 8 Phase 3 commands are registered and discoverable via command palette
- Ready for Phase 4 (lab decomposition)

## Self-Check: PASSED

All files exist: desktop-layout.tsx, view-commands.ts, init-commands.tsx, 03-02-SUMMARY.md
All commits exist: 5861e57, 4c71539

---
*Phase: 03-right-sidebar-bottom-panel-commands*
*Completed: 2026-03-18*
