---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: milestone
status: in-progress
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-03-21T12:38:48Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 10
  completed_plans: 9
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Plugins can contribute React views to any UI slot — editor tabs, bottom panels, right sidebar, activity bar, gutters, context menus
**Current focus:** Phase 5 (Layout Wiring + SDK Injection) -- mounting orphaned components, ViewsApi injection, entrypoint fix

## Current Position

Phase: 5 of 5 (Layout Wiring + SDK Injection)
Plan: 2 of 2 complete (05-01 pending completion by other executor)
Status: Plan 05-02 complete. ViewsApi injected, entrypoint bug fixed.

Progress: [█████████ ] 90%

## Previous Milestones

### v1.0 — Plugin Foundation (Complete 2026-03-18)
6 phases: Open seams, manifest/registry, loader/trust, SDK, guard PoC, marketplace UI

### v2.0 — Plugin Sandboxing (Complete 2026-03-19)
5 phases: postMessage bridge, iframe sandbox, permissions, audit trail, emergency revocation

## Accumulated Context

### Decisions
- ViewRegistry extends proven status-bar-registry pattern (Map + snapshot + listeners)
- React.lazy + Suspense for in-process plugin views (no Module Federation)
- Keep-alive via display:none with LRU eviction for tab state preservation
- ErrorBoundary wrapping for all plugin views
- iframe sandbox for community views deferred to v3.1+
- Frozen empty array singleton for empty slot queries ensures useSyncExternalStore reference stability
- ViewErrorBoundary uses resetKey + key prop for full component remount on error reset
- Default priority 100 so plugins without explicit priority sort after built-in views
- Standalone ComponentType alias in SDK avoids @types/react dependency
- React.lazy wraps resolveViewEntrypoint for deferred manifest-declared view loading
- Status bar entrypoint resolution is async fire-and-forget with null fallback until resolved
- SDK view contributions accept ComponentType or lazy factory, manifest contributions use entrypoint strings
- View IDs namespaced as {pluginId}.{viewId} for uniqueness across plugins
- BuiltInTab/BuiltInPanel interfaces decouple components from specific built-in panels -- caller passes definitions
- Plugin view wrappers use useMemo to clone registration with injected slot-specific props (panelHeight, sidebarWidth)
- RightSidebarPanels returns a fragment for parent flex positioning instead of wrapping in a container
- Unified tab/panel descriptors merge built-in and plugin entries with type discriminator for render dispatch
- Monotonic counter (monotonicNow) for deterministic tab ordering instead of raw Date.now()
- Direct ErrorBoundary+Suspense wrapping in ViewTabRenderer instead of ViewContainer for full EditorTabProps support
- PluginEditorTabBridge pattern: thin component injecting setTitle/setDirty callbacks alongside ViewProps
- [Phase 02]: Monotonic counter for deterministic tab ordering instead of raw Date.now()
- [Phase 02]: activatePluginViewTab(null) on policy tab switch for clean bidirectional switching
- [Phase 02]: plugin: prefix on splitTabId for plugin view routing without multi-policy-store type changes
- [Phase 02]: ViewContainer in split pane (not ViewTabRenderer) for independent state per pane instance
- [Phase 04]: Separate active-plugin-view.ts module with useSyncExternalStore for cross-component active plugin panel state
- [Phase 04]: Plugin nav items use <button> instead of <Link> since they bypass react-router
- [Phase 04]: Built-in items inactive when plugin view active (routeActive && activePluginViewId === null)
- [Phase 04]: ActivityBarPluginView wrapper clones registration with injected isCollapsed via useMemo
- [Phase 04]: Plugin section uses distinct green accent (#6b8b55) for visual separation
- [Phase 04]: Compartment.of([]) in useMemo (static) with useEffect reconfigure for dynamic gutter extension updates
- [Phase 04]: Frozen empty array sentinel for empty gutter registry state ensures useSyncExternalStore reference stability
- [Phase 04]: Async gutter entrypoint resolution uses fire-and-forget pattern matching status bar routing
- [Phase 04]: evaluateWhenClause supports VS Code when-clause subset (key existence, !, ==, !=, &&) -- no || for v1
- [Phase 04]: PluginContextMenuItems is headless (returns raw elements) for embedding flexibility in various context menus
- [Phase 04]: Frozen empty array sentinel for empty context menu queries ensures useSyncExternalStore reference stability
- [Phase 05]: Inline types on PluginActivationContext.views to avoid circular dependency with SDK package
- [Phase 05]: resolveComponent heuristic: zero-arg functions treated as lazy factories wrapped in React.lazy
- [Phase 05]: Null component placeholder for route-based activity bar items (no entrypoint)

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-21T12:38:48Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
