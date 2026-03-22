---
phase: 13-realtime-swarm-visualization
plan: 01
subsystem: ui
tags: [react-flow, zustand, css-animations, swarm-board, policy-evaluation, receipts]

# Dependency graph
requires:
  - phase: 12-editor-to-swarm-bridge
    provides: SwarmBoard canvas, coordinator, receipt flow bridge
provides:
  - PolicyEvaluatedEvent type and handler system on SwarmCoordinator
  - usePolicyEvalBoardBridge hook for evaluating glow state
  - "evaluating" SessionStatus with gold glow CSS (2s cycle)
  - Animated receipt edges with purple flowing dash-offset (1.5s cycle)
  - receiptEdgeTimestamps singleton for edge activity pulse tracking
affects: [13-02-PLAN, swarm-board, coordinator]

# Tech tracking
tech-stack:
  added: []
  patterns: [event-handler-bridge-hook, module-level-timestamp-map, css-keyframe-status-animation]

key-files:
  created:
    - apps/workbench/src/features/swarm/hooks/use-policy-eval-board-bridge.ts
  modified:
    - apps/workbench/src/features/swarm/swarm-coordinator.ts
    - apps/workbench/src/features/swarm/swarm-board-types.ts
    - apps/workbench/src/components/workbench/swarm-board/nodes/agent-session-node.tsx
    - apps/workbench/src/components/workbench/swarm-board/swarm-board-page.tsx
    - apps/workbench/src/components/workbench/swarm-board/edges/swarm-edge.tsx
    - apps/workbench/src/features/swarm/hooks/use-receipt-flow-bridge.ts

key-decisions:
  - "evaluating status uses gold #d4a84b with 2s breathe cycle (faster than 3s running cycle)"
  - "Receipt edges purple #8b5cf6 with flowing dash-offset animation at 1.5s linear infinite"
  - "Module-level receiptEdgeTimestamps Map for cross-component activity tracking (no store overhead)"
  - "PolicyEvaluated events support both transport routing and direct in-process emit"

patterns-established:
  - "Event bridge hook pattern: coordinator event -> store updateNode with auto-restore timeout"
  - "Module-level Map export for ephemeral cross-component state (receiptEdgeTimestamps)"

requirements-completed: [SWARM-04, SWARM-05]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 13 Plan 01: Realtime Swarm Visualization Summary

**Policy evaluation gold glow on agent nodes (2s cycle) and purple animated receipt edge flow (1.5s dash-offset) with 3s activity pulse on creation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T02:58:39Z
- **Completed:** 2026-03-22T03:05:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Agent session nodes glow gold when evaluating a policy, with automatic 2s fade and status restore
- SwarmCoordinator gains full PolicyEvaluated event system (register, unregister, emit, transport routing)
- Receipt edges animate with flowing purple dash-offset continuously, and pulse brighter for 3 seconds after creation
- All Record<SessionStatus, ...> maps across codebase updated for the new evaluating status

## Task Commits

Each task was committed atomically:

1. **Task 1: Policy evaluation glow event + agent node evaluating state** - `758db9be5` (feat)
2. **Task 2: Animated receipt edges with flowing dash-offset and activity pulse** - `bf055b750` (feat)

## Files Created/Modified
- `apps/workbench/src/features/swarm/hooks/use-policy-eval-board-bridge.ts` - New bridge hook: coordinator policyEvaluated events to board node evaluating glow
- `apps/workbench/src/features/swarm/swarm-coordinator.ts` - PolicyEvaluatedEvent, handler registration, emit, coordination routing
- `apps/workbench/src/features/swarm/swarm-board-types.ts` - Added "evaluating" to SessionStatus union
- `apps/workbench/src/components/workbench/swarm-board/nodes/agent-session-node.tsx` - Gold glow CSS for evaluating status (color, pulse, label, border, 2s animation)
- `apps/workbench/src/components/workbench/swarm-board/swarm-board-page.tsx` - Wire usePolicyEvalBoardBridge, eval-glow keyframe, receiptEdgeTimestamps enrichment
- `apps/workbench/src/components/workbench/swarm-board/edges/swarm-edge.tsx` - Purple receipt edges, receiptEdgeFlow animation, higher base opacity
- `apps/workbench/src/features/swarm/hooks/use-receipt-flow-bridge.ts` - Export receiptEdgeTimestamps Map, stamp creation time on receipt edges
- `apps/workbench/src/components/workbench/swarm-board/nodes/terminal-task-node.tsx` - Added evaluating to STATUS_CONFIG
- `apps/workbench/src/components/workbench/swarm-board/swarm-board-left-rail.tsx` - Added evaluating to STATUS_DOT_COLOR
- `apps/workbench/src/components/workbench/swarm-board/__tests__/agent-session-node.test.tsx` - Added evaluating to statusColorMap
- `apps/workbench/src/lib/workbench/__tests__/swarm-board-types.test.ts` - Added evaluating to validStatuses, transitions, and statusColor

## Decisions Made
- Evaluating status uses gold #d4a84b with 2s breathe cycle (faster than the 3s running breathe to visually distinguish active evaluation)
- Receipt edge color changed from dim gray #5c6a80 to purple #8b5cf6 for visual identity
- Module-level Map (receiptEdgeTimestamps) used instead of store state for ephemeral timestamp tracking -- avoids re-render overhead for data that expires in 3 seconds
- PolicyEvaluated events dispatched both via transport routing (coordination channel) and direct emit (in-process swarms)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated all Record<SessionStatus, ...> maps for new evaluating status**
- **Found during:** Task 1 (after adding evaluating to SessionStatus union)
- **Issue:** TypeScript compilation failed in terminal-task-node.tsx, swarm-board-left-rail.tsx, agent-session-node.test.tsx, and swarm-board-types.test.ts because their Record<SessionStatus, ...> maps were missing the new "evaluating" key
- **Fix:** Added evaluating entries to STATUS_CONFIG, STATUS_DOT_COLOR, statusColorMap, validStatuses, validTransitions, and statusColor switch
- **Files modified:** terminal-task-node.tsx, swarm-board-left-rail.tsx, agent-session-node.test.tsx, swarm-board-types.test.ts
- **Verification:** TypeScript compiles clean (only pre-existing navigate-commands.ts error remains)
- **Committed in:** 758db9be5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary type-safety fix caused by adding to a union type. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in navigate-commands.ts (CommandCategory missing "Swarm") -- unrelated to this plan, not addressed
- Pre-existing test failures (69 tests, all ReferenceError: document is not defined) due to missing jsdom test environment config -- unrelated, not addressed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Policy evaluation glow and receipt edge animation are fully wired and ready for visual verification
- Plan 13-02 can build on this foundation for additional swarm visualization features
- SwarmCoordinator's PolicyEvaluated event system is extensible for future event types

---
*Phase: 13-realtime-swarm-visualization*
*Completed: 2026-03-22*
