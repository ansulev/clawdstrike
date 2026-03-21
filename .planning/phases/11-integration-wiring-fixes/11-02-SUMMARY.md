---
phase: 11-integration-wiring-fixes
plan: 02
subsystem: ui
tags: [react, zustand, pane-store, command-palette, navigation]

requires:
  - phase: 11-integration-wiring-fixes
    provides: pane-store openApp/openFile API, policy-tabs-store newTab API
provides:
  - All editor navigation uses pane-store (zero navigate("/editor") calls remain)
  - Dead PolicyEditor (1071 lines) removed
  - Command palette deduplicated (6 duplicate app.* commands removed)
affects: []

tech-stack:
  added: []
  patterns:
    - "usePaneStore.getState().openApp() for all editor/route navigation from commands"
    - "usePolicyTabsStore.getState().newTab() for creating new tabs from commands and UI callbacks"

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/commands/edit-commands.ts
    - apps/workbench/src/lib/commands/file-commands.ts
    - apps/workbench/src/lib/commands/policy-commands.ts
    - apps/workbench/src/lib/commands/init-commands.tsx
    - apps/workbench/src/lib/commands/navigate-commands.ts
    - apps/workbench/src/components/workbench/guards/guards-page.tsx
    - apps/workbench/src/components/workbench/library/library-gallery.tsx
    - apps/workbench/src/__tests__/App.test.tsx

key-decisions:
  - "policy.createSentinel and policy.connectFleet also migrated to pane-store since navigate was fully removed from PolicyCommandDeps"
  - "library-gallery multiDispatch and useMultiPolicy removed as unused after SigmaHQ import migrated to policy-tabs-store"
  - "App.test.tsx editor route test updated to expect /home redirect (matches current workbench-routes.tsx)"
  - "App.test.tsx compare test updated to expect standalone /compare route with CompareLayout mock"

patterns-established:
  - "pane-store openApp: all command-palette and UI-driven navigation uses usePaneStore.getState().openApp(route, label)"
  - "policy-tabs-store newTab: new tab creation from commands uses usePolicyTabsStore.getState().newTab(options) then opens via pane-store"

requirements-completed: [FLAT-07, FLAT-08]

duration: 5min
completed: 2026-03-21
---

# Phase 11 Plan 02: Navigate-to-Editor Wiring Fixes Summary

**Replaced 6 navigate("/editor") call sites with pane-store openApp, deleted 1071-line dead PolicyEditor, removed 6 duplicate command-palette entries**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T12:50:09Z
- **Completed:** 2026-03-21T12:55:33Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- All editor navigation now uses pane-store openApp/openFile instead of legacy navigate("/editor")
- edit.newTab creates tabs via usePolicyTabsStore.newTab() with pane-store routing to /file/__new__/{tabId}
- Dead PolicyEditor component (1071 lines) deleted -- no imports remained after file-first cutover
- 6 duplicate app.* commands removed from command palette (app.missions, app.approvals, app.audit, app.receipts, app.topology, app.simulator)
- NavigateFunction removed from all 3 command deps interfaces (EditCommandDeps, FileCommandDeps, PolicyCommandDeps)
- useNavigate removed from init-commands.tsx, guards-page.tsx, library-gallery.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace navigate("/editor") in command files and page components** - `1d377618f` (fix)
2. **Task 2: Delete dead PolicyEditor and consolidate duplicate commands** - `f834bca68` (refactor)

## Files Created/Modified
- `apps/workbench/src/lib/commands/edit-commands.ts` - edit.newTab uses pane-store, NavigateFunction removed
- `apps/workbench/src/lib/commands/file-commands.ts` - file.new/file.open use pane-store, NavigateFunction removed
- `apps/workbench/src/lib/commands/policy-commands.ts` - policy.validate uses pane-store, NavigateFunction removed
- `apps/workbench/src/lib/commands/init-commands.tsx` - navigate removed from all register calls and useEffect deps
- `apps/workbench/src/lib/commands/navigate-commands.ts` - 6 duplicate app.* commands removed
- `apps/workbench/src/components/workbench/guards/guards-page.tsx` - handleNavigateToEditor uses pane-store
- `apps/workbench/src/components/workbench/library/library-gallery.tsx` - SigmaHQ import uses policy-tabs-store + pane-store
- `apps/workbench/src/__tests__/App.test.tsx` - PolicyEditor mock removed, tests updated for current routing
- `apps/workbench/src/components/workbench/editor/policy-editor.tsx` - DELETED (1071 lines)

## Decisions Made
- policy.createSentinel and policy.connectFleet also migrated to pane-store since navigate was fully removed from PolicyCommandDeps (Rule 1: fixing all usages when removing the dep)
- library-gallery multiDispatch/useMultiPolicy cleaned up since only usage was the now-replaced SigmaHQ import callback
- App.test.tsx tests for /editor and /compare updated to reflect current routing behavior (/editor redirects to /home, /compare is standalone route)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migrated policy.createSentinel and policy.connectFleet to pane-store**
- **Found during:** Task 1 (policy-commands.ts)
- **Issue:** Plan only asked to replace navigate("/editor") on line 51, but removing navigate from PolicyCommandDeps also required replacing createSentinel (navigate("/sentinels/create")) and connectFleet (navigate("/settings"))
- **Fix:** Replaced both with usePaneStore.getState().openApp() calls
- **Files modified:** apps/workbench/src/lib/commands/policy-commands.ts
- **Verification:** No navigate calls remain in policy-commands.ts
- **Committed in:** 1d377618f (Task 1 commit)

**2. [Rule 1 - Bug] Cleaned up unused multiDispatch/useMultiPolicy in library-gallery**
- **Found during:** Task 1 (library-gallery.tsx)
- **Issue:** After replacing multiDispatch NEW_TAB with usePolicyTabsStore.newTab(), multiDispatch and useMultiPolicy became unused
- **Fix:** Removed const destructuring and import
- **Files modified:** apps/workbench/src/components/workbench/library/library-gallery.tsx
- **Verification:** No unused imports
- **Committed in:** 1d377618f (Task 1 commit)

**3. [Rule 1 - Bug] Updated App.test.tsx compare route test**
- **Found during:** Task 2 (App.test.tsx)
- **Issue:** Compare test expected /editor?panel=compare redirect but current routing sends /compare to standalone CompareLayout
- **Fix:** Added CompareLayout mock, updated test to check page-compare testid
- **Files modified:** apps/workbench/src/__tests__/App.test.tsx
- **Verification:** Test assertions match current workbench-routes.tsx behavior
- **Committed in:** f834bca68 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bug fixes)
**Impact on plan:** All auto-fixes necessary for correctness -- removing navigate from deps required updating all its usages, and test assertions needed to match current routing behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All navigate("/editor") calls eliminated from the codebase
- Command palette is clean with no duplicate entries
- Dead code removed, reducing bundle size

---
*Phase: 11-integration-wiring-fixes*
*Completed: 2026-03-21*

## Self-Check: PASSED
