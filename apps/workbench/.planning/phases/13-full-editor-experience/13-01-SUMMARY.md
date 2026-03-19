---
phase: 13-full-editor-experience
plan: 01
subsystem: ui
tags: [react, resizable-panels, split-editor, zustand, guard-cards]

# Dependency graph
requires:
  - phase: 10-live-codemirror-editor
    provides: YamlEditor (CodeMirror) wired to policy-edit-store in FileEditorShell
  - phase: 06-detection-engineering-inline
    provides: EditorVisualPanel with guard cards, drag-to-reorder, enable/disable toggles
provides:
  - Visual/YAML split toggle in FileEditorToolbar for policy files
  - Resizable split layout with EditorVisualPanel + YamlEditor in FileEditorShell
affects: [13-02-PLAN, 13-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional ResizablePanelGroup rendering gated by splitActive + isPolicyFileType"
    - "EditorVisualPanel reads Zustand stores directly (no props), so split rendering requires no data plumbing"

key-files:
  created: []
  modified:
    - apps/workbench/src/features/editor/file-editor-toolbar.tsx
    - apps/workbench/src/features/editor/file-editor-shell.tsx

key-decisions:
  - "EditorVisualPanel rendered directly in split (not via legacy SplitEditor component which is coupled to MultiPolicyProvider)"
  - "Split toggle placed after Format button, before ToolbarDivider in policy-only button group"
  - "ResizableHandle uses gold accent color (#d4a84b) matching existing split-editor.tsx styling"

patterns-established:
  - "Split toggle pattern: local useState in shell, callback prop to toolbar, conditional ResizablePanelGroup render"

requirements-completed: [EDIT-01, EDIT-02, EDIT-08]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 13 Plan 01: Visual/YAML Split Editor Summary

**Resizable Visual/YAML split in FileEditorShell with EditorVisualPanel guard cards alongside CodeMirror YAML editor, gated to policy file types**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T00:52:08Z
- **Completed:** 2026-03-19T00:54:10Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Policy files show a Visual/YAML split toggle button (IconLayoutColumns) in the toolbar
- Clicking the toggle renders EditorVisualPanel (45% left) alongside YamlEditor (55% right) in a resizable horizontal split
- Guard cards with enable/disable toggles, config fields, and drag-to-reorder render via EditorVisualPanel
- Non-policy files do not show the split toggle (it is inside the isPolicy guard block)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add split toggle to FileEditorToolbar and split state to FileEditorShell** - `91335c020` (feat)

## Files Created/Modified
- `apps/workbench/src/features/editor/file-editor-toolbar.tsx` - Added onToggleSplit/splitActive props, IconLayoutColumns split toggle button in policy-only section
- `apps/workbench/src/features/editor/file-editor-shell.tsx` - Added splitActive state, ResizablePanelGroup/EditorVisualPanel imports, conditional split rendering

## Decisions Made
- EditorVisualPanel rendered directly in the split rather than using the legacy SplitEditor component, which is coupled to the MultiPolicyProvider flow
- Split toggle button placed after Format button and before the ToolbarDivider, keeping it visually grouped with editing controls
- ResizableHandle styling uses gold accent color (#d4a84b) for active/hover states, matching the existing split-editor.tsx pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Split editor foundation is in place for Phase 13 Plan 02 (Run button with quick test presets, TestRunnerPanel)
- Phase 13 Plan 03 (sidebar toggle buttons, native validation, auto-versioning) can proceed independently

## Self-Check: PASSED

- FOUND: 13-01-SUMMARY.md
- FOUND: file-editor-shell.tsx
- FOUND: file-editor-toolbar.tsx
- FOUND: commit 91335c020

---
*Phase: 13-full-editor-experience*
*Completed: 2026-03-19*
