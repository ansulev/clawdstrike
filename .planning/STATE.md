---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-03-PLAN.md
last_updated: "2026-03-21T14:38:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 13
  completed_plans: 11
  percent: 85
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Third-party detection format adapters (SPL, KQL, EQL, YARA-L) as plugins with cross-format translation
**Current focus:** Phase 5 YARA-L Adapter Plugin -- Plan 3 complete

## Current Position

Phase: 5 of 5 (YARA-L Adapter Plugin)
Plan: 3 of 3
Status: In progress

Progress: [████████░░] 85%

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

- [05-01] YARA-L parser uses regex-based best-effort parsing, sufficient for client-side simulation
- [05-01] Multi-variable YARA-L conditions use OR semantics between variable groups, AND within each group
- [05-01] UDM field resolution: dot-path traversal first, inverse Sigma mapping fallback second
- [05-01] Full implementation in single file pass (both tasks target same file)

- [03-01] Client-side KQL execution via where-clause parsing and clientSideKqlMatch (no native backend needed)
- [03-01] KQL parser handles 14 operators including negated forms, regex, and in-list
- [03-01] KQL->Sigma reverse mapping built dynamically from getAllFieldMappings() sentinel entries
- [03-01] Untranslatable KQL features (summarize, join, union, extend, ago, etc.) detected and reported
- [03-01] Sentinel Analytics Rule JSON uses standard queryFrequency/queryPeriod PT5H defaults
- [03-02] Round-trip reconstruction for KQL visual panel: parse -> edit -> reconstruct -> onSourceChange
- [03-02] Custom table names shown with '(custom)' suffix when not in predefined Sentinel table list
- [03-02] Extend expressions rendered read-only in visual panel (complex computed columns, editing deferred)
- [04-02] Two-mode EQL visual panel: SingleQueryEditor for simple queries, SequenceBuilder for sequences, branching on ast.type
- [04-02] ConditionRow shared between SingleQueryEditor and SequenceBuilder via StepConditions wrapper
- [04-02] Until clause uses collapsible UI with muted border color to differentiate from sequence steps
- [05-02] YARA-L visual panel uses internal regex parser with regenerator for round-trip editing
- [05-02] Event variables rendered as individual cards with inline-editable UDM field predicates
- [05-02] Optional match/outcome sections rendered as raw TextArea (less commonly used)
- [Phase 02]: [02-01] Regex-based SPL parsing; AND condition matching; CIM field mapping via translateField; plugin_trace with spl_match traceType; case-insensitive field lookup

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-21T14:30:00.000Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
