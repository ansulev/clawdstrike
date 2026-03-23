---
phase: 15-test-fixes
plan: 01
subsystem: testing
tags: [vitest, jsdom, react-testing-library, zustand, mocking]

requires:
  - phase: none
    provides: independent cleanup phase
provides:
  - All 3 broken test suites fixed (App, desktop-layout, shortcut-provider)
  - ResizeObserver polyfill in global test setup
  - Correct vi.mock paths matching current component tree
affects: [17-command-modernization-store-migration]

tech-stack:
  added: []
  patterns:
    - "ResizeObserver polyfill in test/setup.ts for jsdom environments"
    - "Mock DesktopLayout with route-aware shell to avoid deep dependency chains"
    - "Use /editor/visual sub-route (not bare /editor) for editor context in tests"

key-files:
  created: []
  modified:
    - apps/workbench/src/test/setup.ts
    - apps/workbench/src/__tests__/App.test.tsx
    - apps/workbench/src/components/desktop/__tests__/desktop-layout.test.tsx
    - apps/workbench/src/components/desktop/__tests__/shortcut-provider.test.tsx

key-decisions:
  - "Mock DesktopLayout entirely in App.test.tsx to avoid cascading deep dependency chains (status-bar, titlebar, pane system)"
  - "Use /editor/visual route in shortcut-provider test to avoid /editor->/home redirect that breaks editor context"
  - "Add ResizeObserver no-op polyfill globally in setup.ts rather than per-test-file"

patterns-established:
  - "Pattern: When testing App.tsx, mock DesktopLayout with a route-aware shell that uses useRoutes + mocked page components"
  - "Pattern: For editor context shortcuts, use /editor/visual (or any /editor/* sub-route) since bare /editor redirects to /home"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 12min
completed: 2026-03-23
---

# Phase 15 Plan 01: Test Fixes Summary

**Fix 3 broken test suites by updating stale mocks, adding ResizeObserver polyfill, and using async-safe assertions for Zustand state**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-22T23:54:48Z
- **Completed:** 2026-03-23T00:07:11Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- All 136 workbench test files pass with 2370 tests and 0 failures
- App.test.tsx: 11 tests pass (was crashing with ResizeObserver/ActivityBar errors)
- desktop-layout.test.tsx: 8 tests pass (was failing from stale DesktopSidebar mock)
- shortcut-provider.test.tsx: 2 tests pass (was failing from sync assertion on async Zustand state)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ResizeObserver polyfill to test setup and fix App.test.tsx mocks** - `ae7652ba6` (fix)
2. **Task 2: Fix desktop-layout.test.tsx stale mocks and shortcut-provider.test.tsx async assertions** - `8371ba15f` (fix)
3. **Task 3: Full test suite validation** - no code changes (verification only)

## Files Created/Modified
- `apps/workbench/src/test/setup.ts` - Added ResizeObserver no-op polyfill for jsdom
- `apps/workbench/src/__tests__/App.test.tsx` - Mocked DesktopLayout with route-aware shell, added bootstrap hook mocks
- `apps/workbench/src/components/desktop/__tests__/desktop-layout.test.tsx` - Replaced stale desktop-sidebar mock with activity-bar/sidebar-panel/resize-handle mocks
- `apps/workbench/src/components/desktop/__tests__/shortcut-provider.test.tsx` - Added waitFor for async assertion, fixed syncRoute to /editor/visual

## Decisions Made
- **Mock DesktopLayout entirely in App.test.tsx:** The real DesktopLayout pulls in ~15 heavy dependencies (status-bar, titlebar, pane system, bottom-pane, right-sidebar, etc.) each with their own deep chains. Mocking individual components created a whack-a-mole cascade. Mocking DesktopLayout as a whole with an inline route-aware shell (using the same mocked page components) is cleaner and more maintainable.
- **Use /editor/visual instead of /editor for shortcut context:** The normalizeWorkbenchRoute function redirects bare `/editor` to `/home`, which means the "editor" shortcut context is never active. Using `/editor/visual` (a sub-route not caught by the exact-match redirect) preserves the editor context. This is the real root cause -- the plan diagnosed it as an async timing issue, but the command wasn't firing at all.
- **Global ResizeObserver polyfill:** Placed in setup.ts (loaded by all tests) rather than individual test files to prevent future jsdom crashes from any component using ResizablePanelGroup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shortcut-provider test using wrong route for editor context**
- **Found during:** Task 2 (shortcut-provider.test.tsx)
- **Issue:** Plan diagnosed the failure as async timing (Zustand re-render flush), but the actual root cause is that `syncRoute("/editor")` normalizes to "/home" via workbench-routes redirect, preventing the "editor" shortcut context from activating. The `policy.validate` command (context: "editor") never fires.
- **Fix:** Changed `syncRoute("/editor")` to `syncRoute("/editor/visual")` which doesn't trigger the redirect, keeping the editor context active. Also added `waitFor` as the plan suggested (still needed for the React re-render).
- **Files modified:** `apps/workbench/src/components/desktop/__tests__/shortcut-provider.test.tsx`
- **Committed in:** `8371ba15f`

**2. [Rule 3 - Blocking] Added comprehensive DesktopLayout mock in App.test.tsx**
- **Found during:** Task 1 (App.test.tsx)
- **Issue:** Plan suggested mocking ~18 individual transitive dependencies of DesktopLayout. After adding them, new failures cascaded (nativeValidation.topLevelErrors, forbidden_path guard config, DEFAULT_HINTS, etc.) because the real StatusBar and Titlebar pull in even deeper chains.
- **Fix:** Replaced per-component mocks with a single DesktopLayout mock that provides a route-aware shell using `useRoutes` + the already-mocked page components.
- **Files modified:** `apps/workbench/src/__tests__/App.test.tsx`
- **Committed in:** `ae7652ba6`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. The mock approach is simpler and more maintainable than the plan's per-component strategy.

## Issues Encountered
- **Pre-existing: @base-ui/react getAnimations()** - 7 "Uncaught Exception" errors from ScrollAreaViewport calling `viewport.getAnimations()` which jsdom doesn't implement. These cause vitest to exit with code 1 despite all tests passing. Pre-existing, not caused by our changes. Logged to deferred-items.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 136 test files pass, providing a safety net for Phase 17 store migration
- Phase 16 was already completed independently
- Phase 17 can proceed: tests will catch regressions from bridge hook migration

---
*Phase: 15-test-fixes*
*Completed: 2026-03-23*
