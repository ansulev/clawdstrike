---
phase: 08-file-first-editor
plan: 02
subsystem: ui
tags: [react, tailwind, zustand, pane-tabs, dirty-indicator, file-type]

requires:
  - phase: 08-file-first-editor
    provides: PaneView dirty/fileType fields (08-01)
provides:
  - PaneTab with gold dirty dot and file-type color indicators
  - PaneTabBar new-file button creating untitled files as pane tabs
affects: [08-file-first-editor]

tech-stack:
  added: []
  patterns: [VS Code dirty-dot-in-close-button pattern, file-type color map]

key-files:
  created: []
  modified:
    - apps/workbench/src/features/panes/pane-tab.tsx
    - apps/workbench/src/features/panes/pane-tab-bar.tsx
    - apps/workbench/src/features/panes/pane-types.ts

key-decisions:
  - "FILE_TYPE_COLORS map uses direct hex values matching PolicyTabBar precedent (cyan/purple/green/amber)"
  - "Close button shows dirty dot that hides on group hover, X icon shows on group hover (VS Code pattern)"
  - "New-file button uses usePolicyTabsStore.newTab() to create untitled files, then opens via pane-store openApp"

patterns-established:
  - "File-type color map: centralized FILE_TYPE_COLORS constant for consistent file-type visual indicators"
  - "New-file route convention: /file/__new__/{tabId} for untitled files"

requirements-completed: [FLAT-04, FLAT-07]

duration: 3min
completed: 2026-03-18
---

# Phase 8 Plan 2: PaneTab Dirty/FileType Indicators + New-File Button Summary

**Gold dirty dot and file-type color indicators on PaneTab, plus new-file "+" button on PaneTabBar using policy-tabs-store bridge**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T21:34:38Z
- **Completed:** 2026-03-18T21:38:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PaneTab shows gold dirty dot (#d4a84b) before label when view has unsaved changes
- PaneTab shows colored file-type dot (cyan for policy, purple for sigma, green for yara, amber for ocsf) on /file/ routes
- Close button shows dirty dot in place of X when tab is active (toggles to X on hover, VS Code pattern)
- PaneTabBar has new-file "+" button that creates untitled files via usePolicyTabsStore.newTab()

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dirty dot and file-type color indicator to PaneTab** - `652d845e8` (feat - merged with 08-01 commit due to parallel execution)
2. **Task 2: Add new-file button to PaneTabBar** - `93d4b7774` (feat)

## Files Created/Modified
- `apps/workbench/src/features/panes/pane-tab.tsx` - FILE_TYPE_COLORS map, dirty dot, file-type dot, close button dirty state
- `apps/workbench/src/features/panes/pane-tab-bar.tsx` - IconPlus new-file button with policy-tabs-store bridge
- `apps/workbench/src/features/panes/pane-types.ts` - Extended PaneView with dirty? and fileType? fields

## Decisions Made
- FILE_TYPE_COLORS uses direct hex values matching existing PolicyTabBar conventions
- Close button dirty-dot uses group-hover/tab CSS toggle for simplicity
- New-file route uses /file/__new__/{tabId} convention for untitled files
- usePolicyTabsStore.newTab() is the creation entry point (reuses existing tab creation logic)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended PaneView type with dirty/fileType fields**
- **Found during:** Task 1
- **Issue:** Plan 08-01 (which adds dirty? and fileType? to PaneView) was listed as a parallel wave-1 plan but had already been partially committed. The PaneView type needed these fields for Task 1 to compile.
- **Fix:** Added dirty? and fileType? optional fields to PaneView interface
- **Files modified:** apps/workbench/src/features/panes/pane-types.ts
- **Verification:** TypeScript compiles, all 18 pane tests pass
- **Committed in:** 652d845e8 (merged with 08-01 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- the PaneView extension was planned for 08-01 and this plan simply ensured it existed. No scope creep.

## Issues Encountered
- Task 1 changes were absorbed into commit 652d845e8 (08-01's commit) due to a git stash/pop during pre-existing test failure verification. The changes are functionally correct and committed.
- Pre-existing test failures in App.test.tsx and desktop-layout.test.tsx (18 failures) confirmed as not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PaneTab and PaneTabBar visual enhancements complete
- Ready for Plan 08-03 (FileEditorToolbar extraction) and Plan 08-04 (route rewiring)
- All pane-related tests pass (18/18)

---
*Phase: 08-file-first-editor*
*Completed: 2026-03-18*
