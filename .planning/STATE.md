---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Cleanup & Store Migration
status: ready_to_plan
stopped_at: null
last_updated: "2026-03-22"
last_activity: 2026-03-22 -- Roadmap created for v1.4 (3 phases, 14 requirements)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)
**Core value:** Security operators work across multiple views simultaneously with IDE-grade workflows
**Current focus:** v1.4 Cleanup & Store Migration -- Phase 15 ready to plan

## Current Position

Phase: 15 (Test Fixes) -- first of 3 phases
Plan: --
Status: Ready to plan
Last activity: 2026-03-22 -- Roadmap created

Progress: [░░░░░░░░░░] 0%

## Previous Milestones

**v1.0 -- IDE Pivot** (2026-03-18): 4 phases, 9 plans, 45 reqs
**v1.1 -- IDE Completeness** (2026-03-18/19): 13 phases, ~28 plans, 50+ reqs
**v1.2 -- Explorer Polish** (partial, filter bar done): 1 phase, 1 plan
**v1.3 -- Live Features** (2026-03-22): 15 phases (incl. gap closure), 29+ plans, 23 reqs

## Accumulated Context

### Key Files for Cleanup Work
- `apps/workbench/src/features/policy/stores/multi-policy-store.tsx` -- 975-line bridge layer to delete
- `apps/workbench/src/features/policy/stores/policy-tabs-store.ts` -- canonical tab store (target)
- `apps/workbench/src/features/policy/stores/policy-edit-store.ts` -- canonical edit store (target)
- `apps/workbench/src/__tests__/App.test.tsx` -- failing (unmocked ActivityBar)
- `apps/workbench/src/components/desktop/__tests__/desktop-layout.test.tsx` -- stale mock
- `apps/workbench/src/features/search/stores/search-store.ts` -- needs AbortController
- `apps/workbench/src/features/bottom-pane/terminal-panel.tsx` -- hardcoded 800x240
- `apps/workbench/src/lib/commands/file-commands.ts` -- legacy newPolicy injection

### Decisions
- multi-policy-store.tsx is a bridge: useMultiPolicy()/useWorkbench() compose 3 underlying Zustand stores
- ~20 components still use bridge hooks; all new features/ code uses direct stores
- MultiPolicyProvider is already an empty fragment (<>{children}</>)
- Phase 15+16 are independent; Phase 17 depends on Phase 15 (tests catch regressions)

### Blockers/Concerns
None yet.

## Session Continuity

Last session: 2026-03-22
Stopped at: Roadmap created, ready to plan Phase 15
