---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Cleanup & Store Migration
status: executing
stopped_at: Completed 15-01-PLAN.md
last_updated: "2026-03-23T00:07:11Z"
last_activity: 2026-03-23 -- Executed 15-01 (test fixes: App, desktop-layout, shortcut-provider)
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 5
  completed_plans: 2
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)
**Core value:** Security operators work across multiple views simultaneously with IDE-grade workflows
**Current focus:** v1.4 Cleanup & Store Migration -- Phase 15 and 16 complete, Phase 17 remaining

## Current Position

Phase: 15 (Test Fixes) -- COMPLETE
Plan: 01/01 -- done
Status: Phase 15 complete, Phase 17 ready
Last activity: 2026-03-23 -- Executed 15-01 (test fixes: App, desktop-layout, shortcut-provider)

Progress: [████░░░░░░] 40%

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
- `apps/workbench/src/__tests__/App.test.tsx` -- FIXED: DesktopLayout mocked with route-aware shell
- `apps/workbench/src/components/desktop/__tests__/desktop-layout.test.tsx` -- FIXED: stale desktop-sidebar mock replaced
- `apps/workbench/src/features/search/stores/search-store.ts` -- FIXED: AbortController + staleness guard added
- `apps/workbench/src/features/bottom-pane/terminal-panel.tsx` -- FIXED: hardcoded 800x240 removed
- `apps/workbench/src/lib/commands/file-commands.ts` -- legacy newPolicy injection

### Decisions
- multi-policy-store.tsx is a bridge: useMultiPolicy()/useWorkbench() compose 3 underlying Zustand stores
- ~20 components still use bridge hooks; all new features/ code uses direct stores
- MultiPolicyProvider is already an empty fragment (<>{children}</>)
- Phase 15+16 are independent; Phase 17 depends on Phase 15 (tests catch regressions)
- AbortController cancels at consumer level (ignore stale result) since Tauri IPC does not accept AbortSignal
- Removed width/height props from TerminalRenderer -- internal ResizeObserver handles sizing
- edit.closeTab keybinding removed (not the command) to resolve Meta+W conflict with tab.close
- App.test.tsx: mock DesktopLayout entirely (route-aware shell) rather than per-component mocks to avoid cascading chains
- Test route for editor context: use /editor/visual (bare /editor redirects to /home, breaking editor shortcut context)
- ResizeObserver polyfill in test/setup.ts is a global no-op stub for all tests

### Blockers/Concerns
None yet.

## Session Continuity

Last session: 2026-03-23T00:07:11Z
Stopped at: Completed 15-01-PLAN.md
