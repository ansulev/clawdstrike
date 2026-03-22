---
phase: 16-search-terminal-keybinding-fixes
plan: 01
subsystem: ui
tags: [zustand, search, terminal, keybinding, abortcontroller, xterm]

# Dependency graph
requires: []
provides:
  - "Race-condition-free search with AbortController cancellation and staleness guard"
  - "Dynamic terminal sizing via ResizeObserver (no hardcoded dimensions)"
  - "Single Meta+W keybinding (tab.close only, no conflict with edit.closeTab)"
affects: [17-command-modernization-store-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AbortController + staleness guard for Tauri IPC calls that don't support signal cancellation"
    - "Container-fill pattern: h-full w-full wrapper div + ResizeObserver for dynamic terminal sizing"

key-files:
  created: []
  modified:
    - "apps/workbench/src/features/search/stores/search-store.ts"
    - "apps/workbench/src/features/bottom-pane/terminal-panel.tsx"
    - "apps/workbench/src/lib/commands/edit-commands.ts"

key-decisions:
  - "AbortController cancels at consumer level (ignore stale result) since Tauri IPC does not accept AbortSignal"
  - "Removed width/height props entirely rather than making them dynamic -- TerminalRenderer internal ResizeObserver handles sizing"
  - "Removed keybinding from edit.closeTab rather than removing the command -- still accessible via command palette"

patterns-established:
  - "Tauri IPC staleness pattern: capture query-at-dispatch, compare to query-at-resolve, discard if mismatched"

requirements-completed: [SRCH-06, SRCH-07, TERM-03, KEY-01]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 16 Plan 01: Search, Terminal & Keybinding Fixes Summary

**AbortController-based search cancellation, dynamic terminal container sizing, and Meta+W conflict resolution across 3 targeted bug fixes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T23:54:50Z
- **Completed:** 2026-03-22T23:57:17Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Search store now cancels in-flight searches on new queries and discards stale results via dual staleness guard
- Terminal panel fills its container dynamically instead of rendering at fixed 800x240 pixels
- Meta+W resolves to exactly one command (tab.close) -- no more double-handler conflict on /editor route

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AbortController cancellation and staleness guard to search store** - `ae844979d` (fix)
2. **Task 2: Remove hardcoded terminal dimensions for dynamic container sizing** - `04fb2b0a9` (fix)
3. **Task 3: Remove Meta+W keybinding from edit.closeTab to resolve conflict** - `bc49f55cb` (fix)

## Files Created/Modified
- `apps/workbench/src/features/search/stores/search-store.ts` - Added module-level AbortController, staleness guard in performSearch, abort-on-clear
- `apps/workbench/src/features/bottom-pane/terminal-panel.tsx` - Removed width={800} height={240}, added h-full w-full wrapper div
- `apps/workbench/src/lib/commands/edit-commands.ts` - Removed keybinding: "Meta+W" from edit.closeTab command

## Decisions Made
- Used consumer-level abort (ignore stale result) since Tauri IPC does not accept AbortSignal -- the AbortController is a belt-and-suspenders mechanism alongside the primary queryAtDispatch staleness check
- Removed width/height props entirely rather than computing dynamic values -- TerminalRenderer already has an internal ResizeObserver that measures its container and calls fitAddon.fit()
- Kept edit.closeTab in the command registry for command palette access -- only removed its keybinding to eliminate the Meta+W conflict

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 16 complete (1/1 plans done)
- Phase 17 (Command Modernization & Store Migration) depends on Phase 15 (Test Fixes), not Phase 16
- All three fixes are independent and do not affect Phase 17 migration targets

## Self-Check: PASSED

All 3 modified files exist. All 3 task commits verified (ae844979d, 04fb2b0a9, bc49f55cb).

---
*Phase: 16-search-terminal-keybinding-fixes*
*Completed: 2026-03-22*
