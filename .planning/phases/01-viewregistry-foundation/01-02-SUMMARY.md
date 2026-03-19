---
phase: 01-viewregistry-foundation
plan: 02
subsystem: ui
tags: [react, plugin-sdk, view-registry, plugin-loader, status-bar, lazy-loading]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation/01-01
    provides: ViewRegistry singleton with registerView, getView, getViewsBySlot, useViewsBySlot
provides:
  - ViewsApi interface on PluginContext with registerEditorTab, registerBottomPanelTab, registerRightSidebarPanel, registerStatusBarWidget
  - 6 view prop interfaces for plugin component authors (ViewProps, EditorTabProps, BottomPanelTabProps, RightSidebarPanelProps, ActivityBarPanelProps, StatusBarWidgetProps)
  - 4 SDK-side view contribution types accepting ComponentType or lazy factory
  - PluginLoader view routing for editorTabs, bottomPanelTabs, rightSidebarPanels, activityBarItems to ViewRegistry
  - Status bar entrypoint resolution replacing render: () => null placeholder
affects: [phase-02-editor-tab-views, phase-03-bottom-panel-right-sidebar, phase-04-activity-bar-gutters-context-menus]

# Tech tracking
tech-stack:
  added: []
  patterns: [React.lazy for deferred plugin view loading, async entrypoint resolution for status bar widgets, standalone ComponentType alias to avoid @types/react SDK dependency]

key-files:
  created:
    - packages/sdk/plugin-sdk/tests/views-api.test.ts
  modified:
    - packages/sdk/plugin-sdk/src/types.ts
    - packages/sdk/plugin-sdk/src/context.ts
    - packages/sdk/plugin-sdk/src/index.ts
    - packages/sdk/plugin-sdk/tests/create-plugin.test.ts
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts

key-decisions:
  - "Standalone ComponentType alias in SDK types.ts avoids @types/react dependency for the SDK package"
  - "React.lazy wraps resolveViewEntrypoint for deferred component loading of manifest-declared views"
  - "Status bar entrypoint resolution is async fire-and-forget with null fallback until resolved"

patterns-established:
  - "SDK view contributions accept ComponentType | lazy factory, while manifest contributions use entrypoint strings"
  - "View IDs namespaced as {pluginId}.{viewId} for uniqueness"

requirements-completed: [SDKV-01, SDKV-02, SDKV-03, VREG-05, SBAR-01]

# Metrics
duration: 9min
completed: 2026-03-19
---

# Phase 1 Plan 2: SDK ViewsApi + PluginLoader View Routing + Status Bar Fix Summary

**SDK ViewsApi with 4 register methods, 6 view prop interfaces, PluginLoader routing editorTabs/bottomPanelTabs/rightSidebarPanels/activityBarItems to ViewRegistry via React.lazy, and status bar entrypoint resolution replacing render: () => null**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-19T12:23:54Z
- **Completed:** 2026-03-19T12:33:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Plugin SDK PluginContext gains `views` namespace with `registerEditorTab`, `registerBottomPanelTab`, `registerRightSidebarPanel`, `registerStatusBarWidget` methods returning Disposable
- All 6 view prop interfaces exported for plugin component authors to type their components
- PluginLoader routes 4 manifest view contribution types to ViewRegistry with namespaced IDs
- Status bar items resolve their entrypoint module and render the real component instead of null

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ViewsApi and view prop types to the plugin SDK** - `d530b87d7` (test: RED), `85b3b9b4f` (feat: GREEN)
2. **Task 2: Wire PluginLoader to route view contributions to ViewRegistry and fix status bar** - `b32ad41ba` (test: RED), `ecbd54773` (feat: GREEN)

_Note: TDD tasks have RED (test) + GREEN (feat) commits_

## Files Created/Modified
- `packages/sdk/plugin-sdk/src/types.ts` - ViewProps, EditorTabProps, BottomPanelTabProps, RightSidebarPanelProps, ActivityBarPanelProps, StatusBarWidgetProps, SDK view contribution types, standalone ComponentType alias
- `packages/sdk/plugin-sdk/src/context.ts` - ViewsApi interface with 4 register methods, PluginContext.views field
- `packages/sdk/plugin-sdk/src/index.ts` - Re-exports of all new view types and ViewsApi
- `packages/sdk/plugin-sdk/tests/views-api.test.ts` - 13 tests for view prop interfaces, SDK view contributions, and ViewsApi
- `packages/sdk/plugin-sdk/tests/create-plugin.test.ts` - Updated makeMockContext with views namespace
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - View routing in routeContributions, resolveViewEntrypoint, fixed routeStatusBarItemContribution
- `apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts` - 6 new tests for view routing and status bar fix

## Decisions Made
- Used standalone `ComponentType` type alias in SDK types.ts to avoid requiring `@types/react` as an SDK dependency. Plugin authors will use their own React types; the SDK only needs the shape.
- Status bar entrypoint resolution is fire-and-forget async: registers with null render immediately, updates once the entrypoint module resolves. This avoids blocking plugin activation on module resolution.
- View entrypoints wrapped in `React.lazy()` for deferred loading -- the component is not fetched until first render.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added standalone ComponentType alias instead of importing from React**
- **Found during:** Task 1 (SDK types)
- **Issue:** `import type { ComponentType } from "react"` would fail because SDK package has no `@types/react` dependency and the project has no React types installed
- **Fix:** Defined `ComponentType<P>` as a local type alias in types.ts matching React's shape
- **Files modified:** packages/sdk/plugin-sdk/src/types.ts
- **Verification:** `tsc --noEmit` passes cleanly
- **Committed in:** 85b3b9b4f (Task 1 commit)

**2. [Rule 3 - Blocking] Updated existing test makeMockContext to include views namespace**
- **Found during:** Task 1 (SDK types)
- **Issue:** Adding `views: ViewsApi` to PluginContext as required field broke existing test helper `makeMockContext` which didn't include it
- **Fix:** Added views mock to makeMockContext in create-plugin.test.ts
- **Files modified:** packages/sdk/plugin-sdk/tests/create-plugin.test.ts
- **Verification:** All 25 SDK tests pass
- **Committed in:** 85b3b9b4f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: ViewRegistry + ViewContainer + SDK ViewsApi + PluginLoader routing all in place
- Phase 2 (Editor Tab Views) can proceed: ViewRegistry has "editorTab" slot, plugins can register views, components will lazy-load
- Phase 3 (Bottom Panel and Right Sidebar) can proceed in parallel: "bottomPanelTab" and "rightSidebarPanel" slots are routed

## Self-Check: PASSED

All 7 files verified present. All 4 commits verified in git log.

---
*Phase: 01-viewregistry-foundation*
*Completed: 2026-03-19*
