---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Plugin-Contributed Views
status: in_progress
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-03-19T12:33:00.000Z"
last_activity: 2026-03-19 -- Completed 01-02 SDK ViewsApi + PluginLoader view routing + status bar fix (9 min)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Plugins can contribute React views to any UI slot — editor tabs, bottom panels, right sidebar, activity bar, gutters, context menus
**Current focus:** Phase 1 ViewRegistry Foundation -- COMPLETE

## Current Position

Phase: 1 of 4 (ViewRegistry Foundation) -- COMPLETE
Plan: 2 of 2 complete
Status: Phase 1 complete, ready for Phase 2

Progress: [██░░░░░░░░] 25%

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

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-19
Stopped at: Completed 01-02-PLAN.md (Phase 1 complete)
Resume file: Phase 2 planning needed
