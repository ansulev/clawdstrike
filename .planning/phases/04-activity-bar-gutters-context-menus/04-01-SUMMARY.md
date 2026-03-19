---
phase: 04-activity-bar-gutters-context-menus
plan: 01
subsystem: ui
tags: [react, plugin-views, sidebar, activity-bar, view-registry, useSyncExternalStore]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation
    provides: ViewRegistry singleton, useViewsBySlot hook, ViewContainer with ErrorBoundary/Suspense
  - phase: 03-bottom-panel-right-sidebar
    provides: Plugin view wrapper pattern (useMemo registration cloning for slot-specific props)
provides:
  - Plugin activity bar panel views in DesktopSidebar navigation
  - ActivePluginView external store for tracking active plugin panel ID
  - ActivityBarPluginView wrapper injecting isCollapsed prop
  - Bidirectional switching between plugin panels and built-in route-based content
affects: [04-02-PLAN, 04-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [useSyncExternalStore external store for active plugin view state, button-based nav items for non-route plugin panels]

key-files:
  created:
    - apps/workbench/src/components/desktop/active-plugin-view.ts
    - apps/workbench/src/components/desktop/__tests__/desktop-sidebar-plugins.test.tsx
  modified:
    - apps/workbench/src/components/desktop/desktop-sidebar.tsx
    - apps/workbench/src/components/desktop/desktop-layout.tsx

key-decisions:
  - "Separate active-plugin-view.ts module with useSyncExternalStore rather than prop drilling or workbench store integration"
  - "Plugin nav items use <button> instead of <Link> since they bypass react-router"
  - "Built-in items remain inactive visually when a plugin view is active (routeActive && activePluginViewId === null)"
  - "ActivityBarPluginView wrapper clones registration with injected isCollapsed via useMemo, matching Phase 3 pattern"
  - "Plugin section uses distinct green accent (#6b8b55) to visually separate from built-in sections"
  - "PluginNavIcon renders first letter of label as fallback icon, avoiding dynamic Tabler icon imports"

patterns-established:
  - "active-plugin-view store: lightweight useSyncExternalStore module for cross-component state without a full store"
  - "Button-based sidebar items for plugin views that don't navigate to routes"

requirements-completed: [ABAR-01, ABAR-02, ABAR-03]

# Metrics
duration: 42min
completed: 2026-03-19
---

# Phase 4 Plan 1: Activity Bar Plugin Views Summary

**Plugin-contributed activity bar panel views in DesktopSidebar with useSyncExternalStore active-view tracking and ViewContainer rendering in DesktopLayout**

## Performance

- **Duration:** 42 min
- **Started:** 2026-03-19T13:57:44Z
- **Completed:** 2026-03-19T14:40:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Plugin activity bar panel views from ViewRegistry appear in DesktopSidebar alongside built-in navigation items in a dedicated "Plugins" section
- Clicking a plugin item renders its component in the main content area via ViewContainer, bypassing react-router
- Built-in Link clicks clear the active plugin view, restoring Outlet-based route rendering
- Plugin panel components receive ActivityBarPanelProps with isCollapsed from workbench state
- 9 tests covering all integration scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plugin items to DesktopSidebar and plugin panel rendering to DesktopLayout** - `62c45e4c5` (feat)
2. **Task 2: Tests for plugin activity bar integration** - `8e56cd636` (test)

## Files Created/Modified
- `apps/workbench/src/components/desktop/active-plugin-view.ts` - Lightweight useSyncExternalStore module for activePluginViewId state
- `apps/workbench/src/components/desktop/desktop-sidebar.tsx` - Dynamic plugin nav section from useViewsBySlot, button-based plugin items, bidirectional switching
- `apps/workbench/src/components/desktop/desktop-layout.tsx` - Plugin view rendering via ViewContainer when activePluginViewId is set, isCollapsed injection
- `apps/workbench/src/components/desktop/__tests__/desktop-sidebar-plugins.test.tsx` - 9 tests for plugin activity bar integration

## Decisions Made
- Created a separate `active-plugin-view.ts` module using `useSyncExternalStore` rather than adding state to the workbench store -- this keeps the state co-located with the components that need it and avoids modifying the 1800-line multi-policy-store
- Plugin items use `<button>` elements instead of `<Link>` since they don't navigate to routes -- this avoids react-router context issues and makes the intent clearer
- Built-in items check `routeActive && activePluginViewId === null` so they appear inactive when a plugin panel is displayed, even if the route technically matches
- The "Plugins" section uses a distinct green accent (#6b8b55) to visually differentiate from the red, brown, and purple built-in sections
- PluginNavIcon renders the first letter of the label as a fallback icon rather than trying to dynamically import Tabler icons by string name

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The pre-existing desktop-sidebar.test.tsx file cannot run due to `@tauri-apps/plugin-dialog` resolution failures (Vite import-analysis runs before vi.mock intercepts). This is a known infrastructure issue affecting all tests that transitively import tauri-bridge.ts. The new plugin test works around this by mocking all heavy dependencies at the module level directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Active plugin view state module is available for any future component that needs to know if a plugin panel is active
- The active-plugin-view.ts pattern (useSyncExternalStore for simple cross-component state) can be reused for gutter and context menu state
- Phase 4 Plan 2 (gutters) and Plan 3 (context menus) can proceed independently

## Self-Check: PASSED

All created files exist. All commit hashes verified in git log.

---
*Phase: 04-activity-bar-gutters-context-menus*
*Completed: 2026-03-19*
