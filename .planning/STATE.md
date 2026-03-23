---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: completed
stopped_at: Completed 20-01-PLAN.md
last_updated: "2026-03-23T16:57:06.943Z"
last_activity: 2026-03-23 — Completed 20-02 Pane tab dots & activity bar pills
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)
**Core value:** Security operators work across multiple views simultaneously with IDE-grade workflows
**Current focus:** v2.0 Presence & Awareness — Phase 20: UI Presence Indicators

## Current Position

Phase: 20 of 21 (UI Presence Indicators) — third of 4 phases in v2.0
Plan: 2 of 3 in current phase
Status: Plan 20-02 complete, ready for Plan 20-03
Last activity: 2026-03-23 — Completed 20-02 Pane tab dots & activity bar pills

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 13min
- Total execution time: 0.67 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 18-server-foundation | 1 | 33min | 33min |
| Phase 19-client-connection-store P01 | 3min | 2 tasks | 2 files |
| Phase 19-client-connection-store P02 | 4min | 3 tasks | 3 files |
| Phase 20-ui-presence-indicators P02 | 2min | 2 tasks | 4 files |
| Phase 20 P02 | 2min | 2 tasks | 4 files |
| Phase 20-ui-presence-indicators P01 | 3min | 2 tasks | 5 files |

## Previous Milestones

**v1.0 -- IDE Pivot** (2026-03-18): 4 phases, 9 plans
**v1.1 -- IDE Completeness** (2026-03-19): 13 phases, ~28 plans
**v1.2 -- Explorer Polish** (partial): 1 phase, 1 plan
**v1.3 -- Live Features** (2026-03-22): 15 phases, 29+ plans
**v1.4 -- Cleanup & Store Migration** (2026-03-23): 3 phases, 5 plans

## Accumulated Context

### Decisions

- Awareness-only architecture (no CRDT/OT) — presence cursors, not collaborative editing
- Native browser WebSocket, not tauri-plugin-websocket — avoids IPC overhead
- Facet+StateEffect for CM6 cursor injection — prevents extension rebuild storm
- Server-assigned colors with 8-color palette -- confirmed in Phase 18: 8 colors, deterministic from fingerprint hex prefix
- Reuse fleet SSE auth patterns (getCredentials function ref, not cached token)
- WS route outside require_auth middleware (browser WS API cannot set headers); auth via ?token= query param
- axum ws feature enabled per-crate (hushd only), not workspace-wide
- [Phase 19]: Raw wire types keep snake_case field names; parseAnalystInfo converts to camelCase AnalystPresence
- [Phase 19]: PresenceSocket is standalone class (not React), consumed by Zustand store in Plan 19-02
- [Phase 19]: enableMapSet() from immer required for Map/Set mutations in Zustand presence store
- [Phase 19]: Module-level PresenceSocket singleton (same pattern as fleetEventStream)
- [Phase 19]: getPresenceSocket() exported for Phase 21 CM6 ViewPlugin (non-React consumer)
- [Phase 20]: PresenceTabDots uses button elements for accessibility; dot click navigates via usePaneStore.getState().openFile
- [Phase 20]: Activity bar pills placed below icon group with subtle gradient divider matching existing pattern
- [Phase 20]: Granular selectors for PresenceStatusIndicator: connectionState and analysts.size read separately to avoid re-render storms
- [Phase 20]: Local analyst filtered from roster: 'you' should not appear in 'who else is here' People panel

### Blockers/Concerns

- None

## Session Continuity

Last session: 2026-03-23T16:46:53.821Z
Stopped at: Completed 20-01-PLAN.md
Resume file: None
