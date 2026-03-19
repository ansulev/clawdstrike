---
phase: 10-live-codemirror-editor
plan: 02
subsystem: ui
tags: [codemirror, tauri, save, cmd-s, dirty-tracking, zustand]

requires:
  - phase: 10-live-codemirror-editor-01
    provides: YamlEditor (CodeMirror) wired to policy-edit-store in FileEditorShell
provides:
  - Cmd+S save handler in FileEditorShell (saveDetectionFile with correct fileType)
  - file.save and file.saveAs commands detect file-first tabs
  - Save As dialog for untitled files with filePath set after save
  - Dirty indicator clears after save (both edit store and tabs store)
affects: [11-visual-polish, 12-session-restore]

tech-stack:
  added: []
  patterns: [dynamic-import-saveDetectionFile, dual-store-dirty-clear]

key-files:
  created: []
  modified:
    - apps/workbench/src/features/editor/file-editor-shell.tsx
    - apps/workbench/src/lib/commands/file-commands.ts

key-decisions:
  - "Dynamic import of saveDetectionFile in handleSave (consistent with readDetectionFileByPath pattern)"
  - "file.save tries file-first tab logic before falling back to legacy saveFile"
  - "file.saveAs always passes null filePath to force Save As dialog"

patterns-established:
  - "Dual-store dirty clear: markClean(editStore) + setDirty(tabsStore) after save"
  - "File-first command fallback: check active tab in stores, fall back to legacy deps"

requirements-completed: [LIVE-05]

duration: 2min
completed: 2026-03-19
---

# Phase 10 Plan 2: Wire Cmd+S Save Summary

**Cmd+S save handler in FileEditorShell and file.save/file.saveAs commands wired to saveDetectionFile with dual-store dirty clear**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T00:18:37Z
- **Completed:** 2026-03-19T00:21:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Cmd+S in FileEditorShell saves the active file via Tauri saveDetectionFile with correct fileType
- Save As dialog shown for untitled files (no filePath); filePath set after save
- Dirty indicator clears on both policy-edit-store and policy-tabs-store after save
- file.save and file.saveAs commands from command palette work identically for file-first tabs
- Legacy fallback preserved for old-style editor tabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Cmd+S save handler to FileEditorShell** - `08070cf32` (feat)
2. **Task 2: Update file.save/file.saveAs commands for file-first tabs** - `fc2d4f90f` (feat)

**Plan metadata:** `7ad4aee6e` (docs: complete plan)

## Files Created/Modified
- `apps/workbench/src/features/editor/file-editor-shell.tsx` - Added handleSave callback and Cmd+S keydown listener
- `apps/workbench/src/lib/commands/file-commands.ts` - Updated file.save and file.saveAs to detect file-first tabs and save via saveDetectionFile

## Decisions Made
- Dynamic import of saveDetectionFile in handleSave callback (consistent with existing readDetectionFileByPath pattern in FileEditorShell)
- file.save tries file-first tab logic before falling back to legacy saveFile (backward compatible)
- file.saveAs always passes null filePath to force Save As dialog regardless of existing path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 (Live CodeMirror Editor) complete -- all 5 LIVE requirements satisfied
- Ready for Phase 11 (Visual Polish) and Phase 12 (Session Restore)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 10-live-codemirror-editor*
*Completed: 2026-03-19*
