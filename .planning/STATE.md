---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
status: in_progress
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-03-21T13:51:38Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 13
  completed_plans: 7
  percent: 54
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Third-party detection format adapters (SPL, KQL, EQL, YARA-L) as plugins with cross-format translation
**Current focus:** Phase 4 EQL Adapter Plugin -- Plan 1 complete

## Current Position

Phase: 4 of 5 (EQL Adapter Plugin)
Plan: 1 of 3
Status: In progress

Progress: [████░░░░░░] 46%

## Previous Milestones

### v1.0 — Plugin Foundation (Complete 2026-03-18)
6 phases: Open seams, manifest/registry, loader/trust, SDK, guard PoC, marketplace UI

### v2.0 — Plugin Sandboxing (Complete 2026-03-19)
5 phases: postMessage bridge, iframe sandbox, permissions, audit trail, emergency revocation

### v3.0 — Plugin-Contributed Views (Complete 2026-03-21)
5 phases: ViewRegistry, editor tabs, bottom/right panels, activity bar/gutters/menus, gap closure

## Accumulated Context

### Decisions
- Hub-and-spoke translation through Sigma (avoid universal IR)
- Visual panel registry needed for format-specific builders
- Existing sigma-conversion.ts already outputs SPL/KQL/ES|QL — plugins add the inverse (parsing)
- Multi-event correlation (EQL sequences) is major impedance mismatch
- Field mapping table should be extensible
- [01-01] PublishTarget changed from union to extensible string with BUILTIN_PUBLISH_TARGETS const
- [01-01] Translation providers use array storage since one provider may handle multiple pairs
- [01-01] Visual panel registry throws on duplicate registration (fail-fast, matches registerFileType)
- [01-01] registerAdapter returns dispose function (backward compatible)
- [01-02] Merge-on-register for field mappings: plugins fill undefined platform fields without overwriting
- [01-02] Category-based grouping for field mappings (process/file/network/dns/registry/authentication)
- [01-02] FieldMappingTable uses confidence indicators (exact/approximate/unmapped) with colored dots
- [01-03] Subcomponents use DEFAULT_ACCENT; main panel uses accentColor prop with fallback
- [01-03] Side-effect imports in split-editor guarantee panel registration before getVisualPanel()
- [01-03] Plugin file types get json_export baseline + translatable targets from translation registry
- [01-03] detectionAdapters routing is declarative only; actual registration happens in plugin activate()

- [04-01] EQL parser uses separate AST node types (EqlSingleQuery vs EqlSequenceQuery) matching Elastic grammar
- [04-01] Client-side ECS field resolution supports both flat dotted keys and nested objects
- [04-01] Sequence draft triggers on multiple categories, defaults to sequence by host.id with 5m maxspan

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-21T13:51:15Z
Stopped at: Completed 04-01-PLAN.md
Resume file: .planning/phases/04-eql-adapter-plugin/04-02-PLAN.md
