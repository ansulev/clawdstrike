---
phase: 02-labeled-filter-bar
plan: 01
subsystem: ui
tags: [react, explorer, filter-bar, file-types, tailwind]

# Dependency graph
requires:
  - phase: 01-file-folder-icons
    provides: FileTypeIcon component and FILE_TYPE_REGISTRY with shortLabel/iconColor
provides:
  - FormatToggle pill component with label + count
  - countFilesByType utility for recursive file counting by FileType
  - Footer with conditional filtered/total count and singular/plural grammar
affects: [03-tree-visual-refinement]

# Tech tracking
tech-stack:
  added: []
  patterns: [labeled toggle pill pattern with inline style for dynamic color]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/explorer/explorer-panel.tsx

key-decisions:
  - "Used inline style for dynamic color (iconColor varies per type) rather than Tailwind arbitrary values"
  - "Pill shows shortLabel not full label to conserve horizontal space in narrow sidebar"
  - "Footer count switches between filtered and total based on formatFilter state"

patterns-established:
  - "FormatToggle pill: border + bg + text color driven by FILE_TYPE_REGISTRY descriptor"
  - "countFilesByType: recursive tree walk returning Record<FileType, number>"

requirements-completed: [FILT-01, FILT-02, FILT-03, FILT-04]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 2 Plan 01: Labeled Filter Bar Summary

**Labeled pill toggles (Policy, Sigma, YARA, OCSF) with file counts replacing anonymous colored dots, plus corrected footer grammar**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-19T12:40:00Z
- **Completed:** 2026-03-19T12:53:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 1

## Accomplishments
- Replaced FormatDot colored circles with FormatToggle labeled pill buttons
- Each pill shows the type's shortLabel and parenthesized file count from countFilesByType
- Active pill: filled background in type color, white text, subtle shadow
- Inactive pill: transparent background, type-colored border at 25% opacity, type-colored text
- Footer now shows filtered count when a format filter is active, total count otherwise
- Fixed singular/plural grammar ("1 file" vs "5 files") and removed dangling type label

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace FormatDot with FormatToggle pills and add countFilesByType** - `1bab85928` (feat)
2. **Task 2: Visual verification** - checkpoint approved by user

**Phase 4 companion commit:** `5d255daed` (feat: context menu with root/file/folder variants -- pre-existing Phase 4 work committed alongside)

## Files Created/Modified
- `apps/workbench/src/components/workbench/explorer/explorer-panel.tsx` - Replaced FormatDot with FormatToggle, added countFilesByType, updated footer

## Decisions Made
- Used inline `style` for dynamic color since `descriptor.iconColor` varies per FileType and Tailwind arbitrary values would be verbose
- Showed `shortLabel` ("Policy", "Sigma", "YARA", "OCSF") instead of full label to fit narrow sidebar
- Footer conditionally renders filtered or total count based on `formatFilter` state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ExplorerContextMenu API mismatch**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** The ExplorerContextMenu component had been refactored (Phase 4 work) to use a `ContextMenuTarget` discriminated union with a `target` prop, but explorer-panel.tsx still used the old `{ file, x, y }` shape and passed `menu` instead of `target`. This caused TypeScript compilation failure.
- **Fix:** Updated explorer-panel.tsx to import `ContextMenuTarget`, use discriminated union state, pass `target` prop, and wire all new callbacks (onOpen, onRevealInFinder, onRemoveRoot, onRefreshRoot, onCollapseChildren, onNewFolder). Committed companion Phase 4 files (context-menu.tsx, sidebar-panel.tsx) in a separate commit.
- **Files modified:** explorer-panel.tsx (part of task commit), explorer-context-menu.tsx + sidebar-panel.tsx (separate Phase 4 commit)
- **Verification:** TypeScript compiles cleanly with `npx tsc --noEmit`
- **Committed in:** `5d255daed` (Phase 4 companion) + `1bab85928` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Blocking fix was necessary for TypeScript compilation. The context menu refactoring was pre-existing Phase 4 work that happened to be uncommitted. No scope creep.

## Issues Encountered
- The linter auto-committed changes from multiple tasks into a single commit, requiring a `git reset --soft HEAD~1` to separate Phase 4 context menu work from Phase 2 filter bar work into proper individual commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Filter bar is complete and ready for use alongside Phase 3 tree visual refinements
- The countFilesByType pattern can be reused for any per-type statistics needed in future phases
- Phase 4 context menu work was committed as a companion -- Phase 4 may already be partially complete

---
*Phase: 02-labeled-filter-bar*
*Completed: 2026-03-19*
