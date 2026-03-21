---
phase: 05-layout-wiring-sdk-injection
plan: 02
subsystem: ui
tags: [react, plugin-sdk, views-api, activity-bar, lazy-loading]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation
    provides: ViewRegistry registerView(), view-registry.ts, status-bar-registry
  - phase: 04-activity-bar-gutters-context-menus
    provides: Activity bar routing in plugin-loader.ts routeContributions
provides:
  - Concrete ViewsApi injected into PluginActivationContext
  - buildViewsApi() private method on PluginLoader class
  - entrypoint field on ActivityBarItemContribution (workbench + SDK)
  - Fixed activity bar lazy loading (entrypoint not href)
affects: [plugin-sdk, plugin-loader, activity-bar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ViewsApi facade: buildViewsApi() constructs per-plugin views namespace backed by registerView/statusBarRegistry"
    - "Entrypoint/href separation: entrypoint for module loading, href for route navigation"

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/types.ts
    - packages/sdk/plugin-sdk/src/types.ts

key-decisions:
  - "Inline types on PluginActivationContext.views to avoid circular dependency with SDK package"
  - "resolveComponent heuristic: zero-arg functions treated as lazy factories wrapped in React.lazy"
  - "Null component placeholder for route-based activity bar items (no entrypoint)"

patterns-established:
  - "buildViewsApi pattern: PluginLoader constructs per-plugin views facade injected into activation context"
  - "entrypoint/href separation: entrypoint for module loading, href for route navigation on ActivityBarItemContribution"

requirements-completed: [BPAN-01, BPAN-02, RSIDE-01, RSIDE-02, CTXM-03]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 5 Plan 2: ViewsApi Injection + Entrypoint Bug Fix Summary

**Concrete ViewsApi implementation injected into PluginActivationContext with registerEditorTab/registerBottomPanelTab/registerRightSidebarPanel/registerStatusBarWidget methods, plus entrypoint field fix on ActivityBarItemContribution to separate module loading from route navigation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T23:56:25Z
- **Completed:** 2026-03-21T12:38:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PluginActivationContext now has a `views` property with 4 registration methods, making `context.views.registerEditorTab()` functional during plugin activate()
- PluginLoader constructs a concrete ViewsApi via `buildViewsApi()` that backs each method with registerView or statusBarRegistry.register, namespacing IDs as {pluginId}.{viewId}
- ActivityBarItemContribution has an optional `entrypoint` field in both workbench and SDK types, separating module loading from route navigation
- Plugin-loader uses `item.entrypoint` (when present) instead of `item.href` for lazy component loading, fixing the bug where route paths like "/guards" were passed to `import()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Inject ViewsApi into PluginActivationContext** - `71ff07f39` (feat)
2. **Task 2: Fix href/entrypoint bug on ActivityBarItemContribution** - `ab5edfa6c` (fix)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Added views property to PluginActivationContext interface, buildViewsApi() method, views injection in activation context, fixed activity bar routing to use entrypoint
- `apps/workbench/src/lib/plugins/types.ts` - Added optional entrypoint field to ActivityBarItemContribution
- `packages/sdk/plugin-sdk/src/types.ts` - Added optional entrypoint field to SDK ActivityBarItemContribution

## Decisions Made
- Used inline types on PluginActivationContext.views instead of importing from SDK package to avoid circular dependencies (workbench should not import from @clawdstrike/plugin-sdk)
- resolveComponent uses a zero-arg function heuristic to distinguish lazy factories from React components, wrapping lazy factories in React.lazy
- Route-based activity bar items (href only, no entrypoint) get a `() => null` component placeholder since DesktopLayout routes handle their rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ViewsApi injection is complete, closing the last gap from the v3.0 audit
- Both imperative (activate() hook) and declarative (manifest contributions) plugin registration paths are now fully functional
- All 189 plugin-specific tests pass; pre-existing failures in unrelated test files (swarm-board, crash-recovery) are out of scope

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/plugins/plugin-loader.ts
- FOUND: apps/workbench/src/lib/plugins/types.ts
- FOUND: packages/sdk/plugin-sdk/src/types.ts
- FOUND: .planning/phases/05-layout-wiring-sdk-injection/05-02-SUMMARY.md
- FOUND: commit 71ff07f39 (Task 1)
- FOUND: commit ab5edfa6c (Task 2)

---
*Phase: 05-layout-wiring-sdk-injection*
*Completed: 2026-03-21*
