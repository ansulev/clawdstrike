---
phase: 08-file-first-editor
plan: 04
subsystem: ui
tags: [react-router, zustand, pane-store, breadcrumb, file-routes]

requires:
  - phase: 08-file-first-editor
    provides: openFile method on pane-store, FileEditorShell component, /file/* route, PaneTab dirty dot + file-type colors, FileEditorToolbar
provides:
  - All file-opening entry points use /file/{path} routes instead of /editor
  - /editor route redirects to /home
  - BreadcrumbBar handles /file/ routes with __new__ file support
  - nav.editor command removed; PolicyEditor lazy import removed from routes
affects: [workbench-ui, file-editor, navigation]

tech-stack:
  added: []
  patterns:
    - "openFile() as the canonical file-opening API (replaces openApp /editor)"
    - "/editor redirect to /home via normalizeWorkbenchRoute and route object"
    - "BreadcrumbBar route-driven (/file/ prefix) instead of tab-driven (/editor check)"

key-files:
  created: []
  modified:
    - apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx
    - apps/workbench/src/features/navigation/quick-open-dialog.tsx
    - apps/workbench/src/features/search/components/search-panel.tsx
    - apps/workbench/src/components/workbench/hunt/hunt-layout.tsx
    - apps/workbench/src/components/desktop/workbench-routes.tsx
    - apps/workbench/src/features/navigation/breadcrumb-bar.tsx
    - apps/workbench/src/lib/commands/navigate-commands.ts
    - apps/workbench/src/features/panes/__tests__/pane-store.test.ts

key-decisions:
  - "Hunt onNavigateToEditor checks getActiveTab for filePath vs __new__ tab ID for correct route"
  - "BreadcrumbBar extracts file path from route string (not from policy-tabs-store activeTab)"
  - "nav.editor removed entirely (Meta+1 keybinding unassigned; Cmd+P is primary file opener)"
  - "Legacy navigate('/editor') calls naturally redirect via route system -- no inline migration needed"

patterns-established:
  - "openFile() is the single entry point for opening files from any feature"
  - "Route-driven breadcrumbs: BreadcrumbBar reads path from route, not from store state"

requirements-completed: [FLAT-01, FLAT-04, FLAT-08]

duration: 7min
completed: 2026-03-18
---

# Phase 8 Plan 4: File-First Editor Cutover Summary

**All file-opening call sites rewired from openApp("/editor") to openFile() with /file/{path} routes; /editor redirects to /home; BreadcrumbBar route-aware; nav.editor removed**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T21:51:25Z
- **Completed:** 2026-03-18T21:58:17Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Explorer, Quick Open, Search, and Hunt all open files via pane-store.openFile() with /file/{path} routes
- /editor route redirects to /home via both normalizeWorkbenchRoute and route object Navigate
- BreadcrumbBar renders file path segments for /file/ routes and "Untitled" for __new__ files
- nav.editor command removed from navigate-commands; PolicyEditor lazy import removed from routes
- 25 pane-store tests pass including 4 new normalizeWorkbenchRoute redirect tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire Explorer, Quick Open, Search, Hunt** - `3c49100ba` (feat)
2. **Task 2: Redirect /editor, BreadcrumbBar, nav.editor, tests** - `bcc3ed174` (feat)

## Files Created/Modified
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` - Explorer openFile wiring
- `apps/workbench/src/features/navigation/quick-open-dialog.tsx` - QuickOpen openFile wiring
- `apps/workbench/src/features/search/components/search-panel.tsx` - Search result openFile wiring
- `apps/workbench/src/components/workbench/hunt/hunt-layout.tsx` - Hunt draft-detection navigation with __new__ support
- `apps/workbench/src/components/desktop/workbench-routes.tsx` - /editor redirect, PolicyEditor import removed
- `apps/workbench/src/features/navigation/breadcrumb-bar.tsx` - Route-driven /file/ breadcrumbs
- `apps/workbench/src/lib/commands/navigate-commands.ts` - nav.editor command removed
- `apps/workbench/src/features/panes/__tests__/pane-store.test.ts` - Updated tests, added redirect tests

## Decisions Made
- Hunt `onNavigateToEditor` checks `getActiveTab()` for `filePath` vs `__new__` tab ID for correct route generation
- BreadcrumbBar extracts file path from the route string directly (not from policy-tabs-store activeTab), making it route-driven
- `nav.editor` removed entirely; Meta+1 keybinding left unassigned (Cmd+P Quick Open is the primary file opener)
- Legacy `navigate("/editor")` calls in other components naturally redirect via the route system -- no inline migration needed for this plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 (File-First Editor) is now complete -- all 4 plans delivered
- v1.1 milestone complete: all 8 phases, 19 plans executed
- Legacy navigate("/editor") calls in policy-editor.tsx, swarm-board, library, etc. gracefully redirect to /home

## Self-Check: PASSED

All 8 modified files verified on disk. Both task commits (3c49100ba, bcc3ed174) verified in git log.

---
*Phase: 08-file-first-editor*
*Completed: 2026-03-18*
