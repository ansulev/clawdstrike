---
phase: 04-lab-decomposition-app-navigation
plan: 02
subsystem: ui
tags: [zustand, react, command-registry, pane-system, navigation]

# Dependency graph
requires:
  - phase: 04-lab-decomposition-app-navigation
    provides: Direct routes for Hunt, Simulator, Swarm Board (04-01)
  - phase: 02-sidebar-panels-editor-tabs
    provides: Pane store with openApp method (02-01)
provides:
  - All 16 nav.* commands using pane openApp instead of react-router navigate
  - 8 new app.* commands for Mission Control, Approvals, Audit, Receipts, Topology, Swarm Board, Hunt, Simulator
  - Zero-argument registerNavigateCommands function (no react-router dependency)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Commands use usePaneStore.getState().openApp() for navigation instead of react-router navigate()"
    - "app.* command IDs for explicit Open X discoverability alongside existing nav.* IDs"

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/commands/navigate-commands.ts
    - apps/workbench/src/lib/commands/init-commands.tsx

key-decisions:
  - "Kept all 16 existing nav.* commands for backward compatibility while adding 8 new app.* commands"
  - "navigate-commands.ts no longer depends on react-router; uses Zustand getState() pattern directly"

patterns-established:
  - "openApp pattern: all navigation commands use usePaneStore.getState().openApp(route, label) instead of react-router navigate()"
  - "Dual command IDs: nav.X for backward compat, app.X for discoverability in command palette"

requirements-completed: [CMD-05, CMD-06]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 4 Plan 02: Navigate Commands + App Opening Commands Summary

**All 16 navigate commands rewritten to use pane openApp pattern, 8 new app-opening commands for command palette discoverability**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T18:11:59Z
- **Completed:** 2026-03-18T18:14:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote all 16 existing nav.* commands from react-router navigate() to usePaneStore.getState().openApp()
- Added 8 new app.* commands (missions, approvals, audit, receipts, topology, swarmBoard, hunt, simulator) under Navigate category
- Removed NavigateFunction dependency from navigate-commands.ts; function now takes zero arguments
- Updated init-commands.tsx wiring to call registerNavigateCommands() with no arguments

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite navigate-commands to use openApp pattern with 8 new app commands** - `eaaaf5ce6` (feat)
2. **Task 2: Update init-commands wiring and barrel export** - `316e87944` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/commands/navigate-commands.ts` - All 24 commands (16 nav.* + 8 app.*) using pane openApp pattern
- `apps/workbench/src/lib/commands/init-commands.tsx` - Updated registerNavigateCommands call to zero-argument signature

## Decisions Made
- Kept all 16 existing nav.* commands for backward compatibility while adding 8 new app.* commands with "Open X" titles
- navigate-commands.ts no longer depends on react-router; uses Zustand getState() pattern directly from pane store
- Barrel export (index.ts) unchanged since function name is the same, only its signature changed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pane store unit tests fail with path alias resolution error (`@/components/desktop/workbench-routes` not found by vitest) -- confirmed this is a pre-existing infrastructure issue unrelated to plan changes by testing with stashed changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- This was the final plan in the final phase of the IDE pivot workbench-dev roadmap
- All navigation is now command-driven and pane-aware
- Every app is discoverable via command palette under Navigate category
- Pre-existing vitest path alias issue should be resolved in a future infrastructure task

## Self-Check: PASSED

- All source files exist on disk
- Both task commits verified in git log (eaaaf5ce6, 316e87944)
- SUMMARY.md created successfully

---
*Phase: 04-lab-decomposition-app-navigation*
*Completed: 2026-03-18*
