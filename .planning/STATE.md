---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Detection Adapter Plugins
status: not_started
stopped_at: Milestone activated
last_updated: "2026-03-21T00:00:00.000Z"
last_activity: 2026-03-21 -- v4.0 Detection Adapter Plugins milestone activated
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Third-party detection format adapters (SPL, KQL, EQL, YARA-L) as plugins with cross-format translation
**Current focus:** Phase 1 Core Detection Plugin Infrastructure

## Current Position

Phase: 1 of 5 (Core Detection Plugin Infrastructure)
Plan: Not yet planned
Status: Not started

Progress: [░░░░░░░░░░] 0%

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

### Pending Todos
None.

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-03-21
Stopped at: v4.0 milestone activated
Resume file: .planning/ROADMAP.md
