---
phase: 13-realtime-swarm-visualization
plan: 02
subsystem: ui
tags: [react-flow, zustand, swarm-board, trust-graph, receipt-inspector, pane-system, css-animations]

# Dependency graph
requires:
  - phase: 13-realtime-swarm-visualization
    plan: 01
    provides: PolicyEvaluated event system, evaluating glow state, receipt edge animation
provides:
  - MemberJoinedEvent/MemberLeftEvent types and handler system on SwarmCoordinator
  - useTrustGraphBridge hook for live agent join/leave graph updates
  - ReceiptDetailPage component for receipt edge click inspection
  - /receipt/:id route registered in workbench-routes
  - onEdgeClick handler wired on ReactFlow for receipt edges
  - nodeEnter CSS keyframe for fade+scale entry animation
affects: [swarm-board, coordinator, pane-system, workbench-routes]

# Tech tracking
tech-stack:
  added: []
  patterns: [event-handler-bridge-hook, edge-click-to-pane-tab, delayed-node-removal]

key-files:
  created:
    - apps/workbench/src/features/swarm/hooks/use-trust-graph-bridge.ts
    - apps/workbench/src/components/workbench/swarm-board/receipt-detail-page.tsx
  modified:
    - apps/workbench/src/features/swarm/swarm-coordinator.ts
    - apps/workbench/src/components/workbench/swarm-board/swarm-board-page.tsx
    - apps/workbench/src/components/desktop/workbench-routes.tsx

key-decisions:
  - "Agent join/leave uses MemberJoined/MemberLeft events dispatched via coordination channel and direct emit"
  - "Left members fade to completed status (0.7 opacity) then remove after 3s delay"
  - "Receipt edge click uses usePaneStore.openApp for tab-based navigation (not router navigate)"
  - "nodeEnter CSS animation (0.3s ease-out, fade+scale) applied to all .react-flow__node elements"

patterns-established:
  - "Edge click to pane tab: onEdgeClick filters by edge type, opens detail page via pane store"
  - "Delayed node removal: updateNode status -> setTimeout removeNode for visible fade-out"

requirements-completed: [SWARM-06, SWARM-07]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 13 Plan 02: Live Trust Graph Bridge and Receipt Edge Inspector Summary

**Live agent join/leave trust graph updates via coordinator bridge hook, and receipt edge click-to-inspect via pane tab navigation to ReceiptDetailPage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T03:07:45Z
- **Completed:** 2026-03-22T03:12:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SwarmCoordinator gains full MemberJoined/MemberLeft event system (types, handlers, emit, transport routing)
- New useTrustGraphBridge hook bridges coordinator join/leave events to board store: adds agent nodes on join with trust edges, fades and removes on leave
- All newly added board nodes get a subtle 0.3s fade+scale entry animation via CSS keyframe
- Clicking a receipt-type edge on the swarm board opens a ReceiptDetailPage in a pane tab showing verdict, policy hash, evidence summary, timestamp, and signature
- Route /receipt/:id registered with lazy loading and proper label generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Live trust graph bridge (agent join/leave events)** - `fb253cdce` (feat)
2. **Task 2: Receipt edge click opens inspector pane tab** - `db0d21254` (feat)

## Files Created/Modified
- `apps/workbench/src/features/swarm/hooks/use-trust-graph-bridge.ts` - New bridge hook: coordinator member events to board node add/remove with delayed cleanup
- `apps/workbench/src/components/workbench/swarm-board/receipt-detail-page.tsx` - Readonly receipt detail panel with verdict badge, guard results list, signature display
- `apps/workbench/src/features/swarm/swarm-coordinator.ts` - MemberJoinedEvent, MemberLeftEvent, handler registration, emit, coordination routing
- `apps/workbench/src/components/workbench/swarm-board/swarm-board-page.tsx` - Wire useTrustGraphBridge, add onEdgeClick handler, nodeEnter CSS animation, import Edge + usePaneStore
- `apps/workbench/src/components/desktop/workbench-routes.tsx` - Lazy import ReceiptDetailPage, /receipt/:id route, label generation

## Decisions Made
- Agent join/leave events use the same pattern as PolicyEvaluated: coordination channel routing + direct emit for in-process swarms
- Left-member nodes transition to "completed" status (triggering 0.7 opacity per agent-session-node.tsx) then get removed after 3 seconds
- Receipt edge click uses usePaneStore.getState().openApp() for tab-based navigation, consistent with fleet-agent-detail pattern
- nodeEnter CSS animation applied globally to .react-flow__node class (0.3s ease-out fade from 0/0.85 to 1/1)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in navigate-commands.ts (CommandCategory missing "Swarm") -- unrelated to this plan, not addressed
- Pre-existing test failures (69 tests, all ReferenceError: document is not defined) due to missing jsdom test environment config -- unrelated, not addressed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 13 (Realtime Swarm Visualization) is fully complete: all 4 requirements (SWARM-04 through SWARM-07) delivered
- Trust graph updates live, receipt edges are inspectable, evaluation glow and receipt flow animations are active
- Foundation ready for any future swarm board enhancements

---
*Phase: 13-realtime-swarm-visualization*
*Completed: 2026-03-22*
