---
phase: 05-react-integration
plan: 04
subsystem: ui
tags: [react, zustand, guard-pipeline, receipt, context-provider]

# Dependency graph
requires:
  - phase: 05-react-integration/03
    provides: SwarmEngineProvider, SwarmEngineContextValue, engineRef, useSwarmEngine hook
provides:
  - spawnEngineSession function on SwarmEngineContextValue for guard-wrapped session spawning
  - manualSpawnEngineSession passthrough for manual/error fallback mode
affects: [06-validation, swarm-board-canvas, swarm-toolbar]

# Tech tracking
tech-stack:
  added: []
  patterns: [spawnFn-injection for cross-context composition, useCallback guard wrapper, valueWithSpawn merge pattern]

key-files:
  created: []
  modified:
    - apps/workbench/src/features/swarm/stores/swarm-engine-provider.tsx

key-decisions:
  - "spawnEngineSession accepts spawnFn parameter instead of accessing session context directly -- avoids cross-provider coupling"
  - "manualSpawnEngineSession as module-level const reused across MANUAL_CONTEXT, success path, and error path"
  - "valueWithSpawn spread merge at render time ensures useCallback identity is stable while context value updates"
  - "GuardSimResult.guardId mapped to guard field and verdict!='deny' mapped to allowed field for guardEvaluate store action compatibility"

patterns-established:
  - "spawnFn injection: spawnEngineSession(spawnFn, opts) lets callers compose providers without tight coupling"
  - "Module-level passthrough: const manualSpawnEngineSession avoids re-creating identity in multiple setState calls"

requirements-completed: [INTG-04]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 5 Plan 4: spawnEngineSession Gap Closure Summary

**Guard-wrapped session spawning via spawnEngineSession on SwarmEngineContextValue with evaluateGuard before spawn, guardEvaluate receipt creation after spawn, and deny-only receipt node on blocked actions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T00:18:47Z
- **Completed:** 2026-03-25T00:21:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Closed INTG-04 gap: spawnEngineSession now exists and is accessible via useSwarmEngine()
- Guard pipeline evaluation (evaluateGuard) runs before any session is spawned
- Receipt node + edge created via existing guardEvaluate store action on allow
- Deny creates receipt-only node with no session spawned (fail-closed)
- Manual/error mode falls through to direct spawnFn(opts) with zero guard overhead

## Task Commits

Each task was committed atomically:

1. **Task 1: Add spawnEngineSession to SwarmEngineProvider and context** - `2462d1573` (feat)

## Files Created/Modified
- `apps/workbench/src/features/swarm/stores/swarm-engine-provider.tsx` - Added spawnEngineSession to interface, useCallback implementation, manualSpawnEngineSession passthrough, updated all context value paths

## Decisions Made
- spawnEngineSession accepts `(spawnFn, opts)` rather than accessing SwarmBoardSessionContext directly -- this avoids cross-provider coupling since spawnSession lives in a different context
- Module-level `manualSpawnEngineSession` constant reused in MANUAL_CONTEXT, success setContextValue, and error setContextValue to avoid identity churn
- `valueWithSpawn` spread at render time merges the stable useCallback into the context value, ensuring the function identity doesn't change across re-renders
- GuardSimResult fields mapped for guardEvaluate compatibility: `guardId` -> `guard`, `verdict !== "deny"` -> `allowed`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 fully complete (all 4 plans done)
- spawnEngineSession closes the last verification gap for INTG-04
- Ready for Phase 6: Validation + Tauri Transport

## Self-Check: PASSED

- FOUND: swarm-engine-provider.tsx
- FOUND: commit 2462d1573
- FOUND: 05-04-SUMMARY.md

---
*Phase: 05-react-integration*
*Completed: 2026-03-25*
