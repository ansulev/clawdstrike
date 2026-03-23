---
phase: 05-tab-terminal-polish
plan: 02
subsystem: ui
tags: [react, zustand, terminal, split-view, inline-rename, tabler-icons]

# Dependency graph
requires:
  - phase: 05-tab-terminal-polish
    provides: bottom-pane store and terminal panel infrastructure
provides:
  - Terminal split view (two sessions side by side)
  - Terminal session tab rename via double-click
  - Split/unsplit toggle button in bottom pane header
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TerminalSessionView extracted component for reuse in split layout"
    - "RenameInput pattern reused from policy-tab-bar for terminal tabs"

key-files:
  created: []
  modified:
    - apps/workbench/src/features/bottom-pane/bottom-pane-store.ts
    - apps/workbench/src/features/bottom-pane/terminal-panel.tsx
    - apps/workbench/src/features/bottom-pane/bottom-pane.tsx

key-decisions:
  - "Split uses pair tuple [leftId, rightId] for simplicity over arbitrary N-way splits"
  - "Split auto-creates second session if fewer than 2 exist"
  - "Closing a split session exits split mode automatically"

patterns-established:
  - "RenameInput pattern: useState + useRef + select-on-mount + blur-to-commit for inline editing"
  - "Split state as nullable tuple in store, null = normal mode"

requirements-completed: [TERM-01, TERM-02]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 5 Plan 2: Terminal Split View & Tab Rename Summary

**Side-by-side terminal split toggle and double-click-to-rename session tabs with commit-on-blur**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T19:35:33Z
- **Completed:** 2026-03-18T19:38:02Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Terminal panel renders two sessions side by side when split mode is active
- Double-clicking a terminal session tab title enables inline rename with Enter/blur commit and Escape cancel
- Split button (IconLayoutColumns) in bottom pane header toggles split on/off
- Store properly exits split mode when a split session is closed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add terminal split and rename to store and terminal panel** - `63a5470e0` (feat)

## Files Created/Modified
- `apps/workbench/src/features/bottom-pane/bottom-pane-store.ts` - Added splitTerminalIds state, renameTerminal, splitTerminal, unsplitTerminal actions, updated closeTerminal and _reset
- `apps/workbench/src/features/bottom-pane/terminal-panel.tsx` - Added RenameInput component, TerminalSessionView helper, split layout rendering, double-click rename on tabs, highlight both split tabs
- `apps/workbench/src/features/bottom-pane/bottom-pane.tsx` - Added IconLayoutColumns split button before new-terminal button, reads splitTerminalIds for label toggle

## Decisions Made
- Split uses a `[string, string] | null` tuple rather than an array to keep the model simple (max 2 panes)
- Split auto-creates a second terminal session if fewer than 2 exist, matching VS Code behavior
- Closing either split session exits split mode rather than keeping remaining session in a degraded split state
- Reused the RenameInput pattern from policy-tab-bar.tsx for consistency across the IDE

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in tauri-bridge.ts (missing @tauri-apps/plugin-fs module) unrelated to this plan's changes; ignored per scope boundary rules

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 5 complete (both plans done) - tab overflow scrolling and terminal polish delivered
- Ready for Phase 6 (Detection Engineering Inline) or any independent phase

## Self-Check: PASSED

- FOUND: apps/workbench/src/features/bottom-pane/bottom-pane-store.ts
- FOUND: apps/workbench/src/features/bottom-pane/terminal-panel.tsx
- FOUND: apps/workbench/src/features/bottom-pane/bottom-pane.tsx
- FOUND: .planning/phases/05-tab-terminal-polish/05-02-SUMMARY.md
- FOUND: commit 63a5470e0

---
*Phase: 05-tab-terminal-polish*
*Completed: 2026-03-18*
