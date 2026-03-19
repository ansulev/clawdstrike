---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Plugin-Contributed Views
status: in_progress
stopped_at: Completed 01-01-PLAN.md
last_updated: "2026-03-19T12:20:56.000Z"
last_activity: 2026-03-19 -- Completed 01-01 ViewRegistry + ViewContainer (9 min)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Plugins can contribute React views to any UI slot — editor tabs, bottom panels, right sidebar, activity bar, gutters, context menus
**Current focus:** Phase 1 ViewRegistry Foundation

## Current Position

Phase: 1 of 4 (ViewRegistry Foundation)
Plan: 1 of 2 complete
Status: In progress

Progress: [█░░░░░░░░░] 12%

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

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-19
Stopped at: Completed 01-01-PLAN.md
Resume file: .planning/phases/01-viewregistry-foundation/01-02-PLAN.md
