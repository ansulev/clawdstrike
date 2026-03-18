---
phase: 04-file-tree-mutations
plan: 01
subsystem: ui
tags: [tauri, fs, explorer, context-menu, zustand, tree-mutation]

requires:
  - phase: none
    provides: n/a
provides:
  - Tauri fs bridge wrappers for create/rename/delete detection files
  - Project store createFile/renameFile/deleteFile actions with immutable tree mutation
  - Explorer context menu (right-click) with New File, Rename, Delete
  - Inline name input component for file creation
  - New File toolbar button in Explorer header
affects: [04-02-file-tree-mutations, editor-integration]

tech-stack:
  added: [fs:allow-rename, fs:allow-remove tauri permissions]
  patterns: [mutateTree immutable tree walker, insertIntoDir for sorted child insertion, context menu pattern reuse from PaneTabContextMenu]

key-files:
  created:
    - apps/workbench/src/components/workbench/explorer/explorer-context-menu.tsx
    - apps/workbench/src/components/workbench/explorer/inline-name-input.tsx
  modified:
    - apps/workbench/src-tauri/capabilities/default.json
    - apps/workbench/src/lib/tauri-bridge.ts
    - apps/workbench/src/features/project/stores/project-store.tsx
    - apps/workbench/src/components/workbench/explorer/explorer-panel.tsx
    - apps/workbench/src/components/workbench/explorer/explorer-tree-item.tsx
    - apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx

key-decisions:
  - "createDetectionFile composes saveDetectionFile with FILE_TYPE_REGISTRY defaultContent -- no new Tauri command needed"
  - "mutateTree helper uses immutable shallow-copy-on-write to avoid direct state mutation in Zustand"
  - "Context menu follows exact PaneTabContextMenu pattern for visual consistency"
  - "Default file type for New File is clawdstrike_policy -- extension determines actual type"

patterns-established:
  - "ExplorerContextMenu: reusable right-click menu for tree items with separator support and danger variant"
  - "InlineNameInput: auto-focus, auto-select, Enter-submit, Escape/blur-cancel pattern for inline rename/create"
  - "Tree mutation helpers (mutateTree, insertIntoDir, sortChildren) for immutable ProjectFile[] updates"

requirements-completed: [TREE-01]

duration: 6min
completed: 2026-03-18
---

# Phase 4 Plan 1: File Tree Mutations -- New File Infrastructure Summary

**Tauri fs bridge wrappers for create/rename/delete, project store tree mutation actions, Explorer context menu, and inline name input for New File creation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T19:35:21Z
- **Completed:** 2026-03-18T19:41:49Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Tauri capabilities expanded with fs:allow-rename and fs:allow-remove permissions
- Three new tauri-bridge wrappers (createDetectionFile, renameDetectionFile, deleteDetectionFile) following lazy-import pattern
- Project store extended with createFile, renameFile, deleteFile actions using immutable tree mutation helpers
- Explorer panel gains New File toolbar button (IconFilePlus) and right-click context menu
- InlineNameInput component with auto-focus, Enter/Escape handling for file naming
- ExplorerPanelConnected wires creation flow: store action -> Tauri fs -> tree update -> open in editor

## Task Commits

Both tasks were already committed as part of prior feature implementation commits:

1. **Task 1: Tauri fs permissions + bridge wrappers + project store mutation actions** - `059e0da26` / `dd527f241` (pre-existing)
2. **Task 2: Explorer context menu + New File toolbar button + inline name input** - `3ffac0540` / `dd527f241` (pre-existing)

Note: All plan artifacts were verified present in HEAD. The implementation was completed as part of earlier workbench feature commits.

## Files Created/Modified
- `apps/workbench/src-tauri/capabilities/default.json` - Added fs:allow-rename and fs:allow-remove permissions
- `apps/workbench/src/lib/tauri-bridge.ts` - Added createDetectionFile, renameDetectionFile, deleteDetectionFile wrappers
- `apps/workbench/src/features/project/stores/project-store.tsx` - Added createFile, renameFile, deleteFile actions with mutateTree, insertIntoDir, sortChildren helpers
- `apps/workbench/src/components/workbench/explorer/explorer-context-menu.tsx` - New: right-click context menu for tree items (New File, Rename, Delete)
- `apps/workbench/src/components/workbench/explorer/inline-name-input.tsx` - New: auto-focus inline input for file naming
- `apps/workbench/src/components/workbench/explorer/explorer-panel.tsx` - Added New File toolbar button, context menu state, InlineNameInput rendering
- `apps/workbench/src/components/workbench/explorer/explorer-tree-item.tsx` - Added onContextMenu prop forwarding
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` - Wired onCreateFile to store action and editor open

## Decisions Made
- createDetectionFile composes saveDetectionFile with FILE_TYPE_REGISTRY defaultContent rather than introducing a new Tauri command
- mutateTree helper uses immutable shallow-copy-on-write pattern for Zustand state correctness
- Context menu styling matches existing PaneTabContextMenu exactly (bg-[#131721], border-[#2d3240], gold hover, red danger variant)
- Default file type for toolbar New File is clawdstrike_policy; file extension determines actual type via inferFileTypeFromPath

## Deviations from Plan

None - plan executed exactly as written. All artifacts were pre-existing in HEAD from prior implementation commits.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TREE-01 complete: New File creation from toolbar and context menu works end-to-end
- Plan 04-02 can proceed with inline rename (F2), delete confirmation dialog, and file status indicators
- Tree mutation helpers (mutateTree, insertIntoDir, sortChildren) are ready for reuse by Plan 02

---
*Phase: 04-file-tree-mutations*
*Completed: 2026-03-18*
