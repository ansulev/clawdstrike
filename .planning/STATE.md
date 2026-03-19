---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: milestone
status: in_progress
stopped_at: Completed 02-02-PLAN.md
last_updated: "2026-03-19T13:30:11Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Plugins can contribute React views to any UI slot — editor tabs, bottom panels, right sidebar, activity bar, gutters, context menus
**Current focus:** Phase 2 complete, Phase 4 remaining (Activity Bar, Gutters, Context Menus)

## Current Position

Phase: 2 of 4 (Editor Tab Views) -- Complete
Plan: 2 of 2 complete
Status: All planned phases complete (1, 2, 3). Phase 4 plans TBD.

Progress: [██████████] 100%

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

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-19T13:30:11Z
Stopped at: Completed 02-02-PLAN.md
Resume file: None
