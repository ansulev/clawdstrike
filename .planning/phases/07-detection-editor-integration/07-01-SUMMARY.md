---
phase: 07-detection-editor-integration
plan: 01
subsystem: ui
tags: [react, lazy-routes, pane-system, command-palette, guards, compare, mitre]

# Dependency graph
requires:
  - phase: pane-system (v1.0)
    provides: openApp, pane tab system, route normalization
provides:
  - 5 standalone pane routes: /guards, /compare, /live-agent, /sdk-integration, /coverage
  - 5 navigate commands: nav.guards, nav.compare, nav.liveAgent, nav.sdkIntegration, nav.coverage
  - Backward compat: /editor?panel=guards -> /guards, /editor?panel=compare -> /compare
affects: [policy-editor-refactor, detection-views, coverage-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-route-promotion, standalone-pane-views]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/desktop/workbench-routes.tsx
    - apps/workbench/src/lib/commands/navigate-commands.ts

key-decisions:
  - "MitreHeatmap standalone route renders with empty tabs array (valid blank ATT&CK matrix view)"
  - "/editor?panel=guards and /editor?panel=compare normalized to /guards and /compare for backward compat"

patterns-established:
  - "Lazy route promotion: convert Navigate redirects to lazy-loaded component routes for pane independence"

requirements-completed: [DINT-01, DINT-02, DINT-05, DINT-07]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 7 Plan 1: Detection Editor Integration Summary

**5 detection views (Guards, Compare, LiveAgent, SDK, Coverage) promoted from editor-embedded overlays to independent lazy-loaded pane routes with command palette navigation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T20:20:51Z
- **Completed:** 2026-03-18T20:23:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Guards browser and Compare/diff view promoted from Navigate redirects to standalone route entries
- Live Agent, SDK Integration, and Coverage heatmap added as 3 new independently routable views
- All 5 views accessible via command palette (Cmd+K) through nav.guards, nav.compare, nav.liveAgent, nav.sdkIntegration, nav.coverage
- Backward compatibility preserved: /editor?panel=guards and /editor?panel=compare now normalize to /guards and /compare

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 5 lazy routes to workbench-routes.tsx** - `daf56e1b4` (feat)
2. **Task 2: Register navigate commands** - `0e0f96ab0` (feat)

## Files Created/Modified
- `apps/workbench/src/components/desktop/workbench-routes.tsx` - 5 new lazy imports, route entries replacing Navigate redirects, updated normalizer and label functions
- `apps/workbench/src/lib/commands/navigate-commands.ts` - 5 new nav.* commands using openApp pattern

## Decisions Made
- MitreHeatmap standalone route renders with empty `tabs` array, showing the full ATT&CK matrix with no gap highlights -- valid standalone view; rich data version remains in PolicyEditor
- /editor?panel=guards and /editor?panel=compare backward compatibility handled in normalizeWorkbenchRoute (early return before switch)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 detection views are independently routable and pane-openable
- Ready for Phase 07 Plan 2 (further detection editor integration work)
- PolicyEditor still has its own internal guards/compare toggles which can be deprecated in a future plan

---
*Phase: 07-detection-editor-integration*
*Completed: 2026-03-18*
