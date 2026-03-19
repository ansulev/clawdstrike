---
phase: 04-activity-bar-gutters-context-menus
plan: 03
subsystem: ui
tags: [react, context-menu, when-clause, useSyncExternalStore, plugin-sdk]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation
    provides: Map + snapshot + listeners registry pattern, ViewRegistry, PluginLoader routing
provides:
  - ContextMenuRegistry with registerContextMenuItem, getContextMenuItemsByMenu, useContextMenuItems
  - evaluateWhenClause function for visibility predicates
  - PluginContextMenuItems React component for rendering plugin context menu items
  - usePluginContextMenuItems hook for custom rendering
  - ContextMenuContribution SDK type and PluginLoader routing
affects: [workbench-context-menus, plugin-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [when-clause-evaluator, headless-context-menu-component]

key-files:
  created:
    - apps/workbench/src/lib/plugins/context-menu-registry.ts
    - apps/workbench/src/lib/plugins/__tests__/context-menu-registry.test.ts
    - apps/workbench/src/components/plugins/plugin-context-menu.tsx
    - apps/workbench/src/components/plugins/__tests__/plugin-context-menu.test.tsx
  modified:
    - packages/sdk/plugin-sdk/src/types.ts
    - packages/sdk/plugin-sdk/src/index.ts
    - apps/workbench/src/lib/plugins/types.ts
    - apps/workbench/src/lib/plugins/plugin-loader.ts

key-decisions:
  - "evaluateWhenClause supports key existence, negation, ==, !=, and && operators (VS Code when-clause subset)"
  - "PluginContextMenuItems is headless (returns menu item elements, not a full menu) for embedding flexibility"
  - "Frozen empty array sentinel for empty menu queries ensures useSyncExternalStore reference stability"

patterns-established:
  - "When-clause evaluator: simple expression language for visibility predicates without full expression parser"
  - "Headless context menu component: returns raw elements for embedding in various context menu implementations"

requirements-completed: [CTXM-01, CTXM-02, CTXM-03]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 4 Plan 3: Context Menu Registry Summary

**Plugin-contributed context menu items via ContextMenuRegistry with when-clause predicates, command execution, and headless React component**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-19T15:55:36Z
- **Completed:** 2026-03-19T16:08:07Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ContextMenuRegistry with Map + snapshot + listeners pattern supporting 5 menu targets (editor, sidebar, tab, finding, sentinel)
- When-clause evaluator supporting key existence, negation, equality, inequality, and AND operators
- PluginContextMenuItems headless component with when-clause filtering and command execution callbacks
- SDK types, workbench types, and PluginLoader routing for contextMenuItems contributions
- 30 total tests (23 registry + 7 component) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: ContextMenuRegistry + SDK types + PluginLoader routing** - `bce502e9c` (feat)
2. **Task 2: PluginContextMenuItems React component for menu rendering** - `27db74dbf` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/context-menu-registry.ts` - Central registry for plugin context menu items with when-clause evaluator
- `apps/workbench/src/lib/plugins/__tests__/context-menu-registry.test.ts` - 23 tests for registry and when-clause evaluation
- `apps/workbench/src/components/plugins/plugin-context-menu.tsx` - Headless component rendering plugin context menu items
- `apps/workbench/src/components/plugins/__tests__/plugin-context-menu.test.tsx` - 7 tests for component rendering and interaction
- `packages/sdk/plugin-sdk/src/types.ts` - Added ContextMenuContribution type
- `packages/sdk/plugin-sdk/src/index.ts` - Re-exported ContextMenuContribution
- `apps/workbench/src/lib/plugins/types.ts` - Added ContextMenuContribution and contextMenuItems to workbench types
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Added contextMenuItems routing in routeContributions

## Decisions Made
- evaluateWhenClause supports VS Code when-clause subset (key existence, !, ==, !=, &&) -- no || support needed for v1
- PluginContextMenuItems is headless (returns raw menu item elements) so consumers can embed in their own context menu rendering
- Frozen empty array sentinel for empty menu queries ensures useSyncExternalStore reference stability (matching view-registry pattern)
- ContextMenuContribution added to both SDK and workbench types for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ContextMenuContribution to workbench types.ts**
- **Found during:** Task 1 (SDK types and PluginLoader routing)
- **Issue:** Plan only specified adding ContextMenuContribution to SDK types, but the workbench has its own types.ts that PluginLoader imports from. Without the type in workbench types, the contextMenuItems field on PluginContributions would not compile.
- **Fix:** Added ContextMenuContribution interface and contextMenuItems field to workbench types.ts, updated CONTRIBUTION_POINT_KEYS array
- **Files modified:** apps/workbench/src/lib/plugins/types.ts
- **Verification:** PluginLoader imports compile, tests pass
- **Committed in:** bce502e9c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- the workbench internal types must mirror SDK types. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 is now complete (all 3 plans executed)
- All plugin contribution points implemented: ViewRegistry, Activity Bar, Gutters, Context Menus
- Context menu items are ready for embedding into existing workbench right-click menus

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log. SUMMARY.md exists.

---
*Phase: 04-activity-bar-gutters-context-menus*
*Completed: 2026-03-19*
