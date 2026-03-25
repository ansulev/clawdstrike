---
phase: 05-react-integration
plan: 03
subsystem: ui
tags: [react, zustand, swarm-engine, event-bridge, provider, hooks]

# Dependency graph
requires:
  - phase: 05-01
    provides: SwarmBoard store actions (topologyLayout, engineSync, guardEvaluate) and node data fields (agentId, taskId, engineManaged)
  - phase: 05-02
    provides: computeLayout topology layout module for mesh/hierarchical/centralized/hybrid algorithms
provides:
  - SwarmEngineProvider React context with orchestrator lifecycle management
  - useSwarmEngine, useAgentRegistry, useTaskGraph, useTopology convenience hooks
  - useEngineBoardBridge hook mapping 10 engine event types to store actions
  - SwarmBoardPage wired with engine provider and bridge
affects: [05-react-integration, 06-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [engine-provider-context, event-bridge-hook, evaluating-glow-pattern, dedup-by-id]

key-files:
  created:
    - apps/workbench/src/features/swarm/stores/swarm-engine-provider.tsx
    - apps/workbench/src/features/swarm/hooks/use-engine-board-bridge.ts
  modified:
    - apps/workbench/src/components/workbench/swarm-board/swarm-board-page.tsx

key-decisions:
  - "Access private events field via (engine as any).events for bridge subscriptions -- standard integration pattern"
  - "TopologyConfig uses actual type fields (maxAgents, replicationFactor, failoverEnabled, autoRebalance) not plan's simplified version"
  - "ConsensusConfig uses actual type fields (threshold, timeoutMs, maxRounds, requireQuorum) not plan's simplified version"
  - "mapEngineStatus covers all AgentSessionStatus values including busy->running and offline->failed"

patterns-established:
  - "Engine provider pattern: createContext + useEffect init with cancelled guard + shutdown cleanup"
  - "Event bridge pattern: engine.events.on() -> store.getState().actions.* with unsub collection"
  - "Evaluating glow: save restore status -> set evaluating -> 2s timeout -> restore (dedup on rapid re-eval)"

requirements-completed: [INTG-01, INTG-02, INTG-04, INTG-07, INTG-08, INTG-09]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 5 Plan 3: Engine Provider + Bridge + Page Wiring Summary

**SwarmEngineProvider managing orchestrator lifecycle, 10-event bridge with dedup and evaluating glow, wired into SwarmBoardPage alongside 4 existing bridges**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T00:02:17Z
- **Completed:** 2026-03-25T00:06:58Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- SwarmEngineProvider creates and manages SwarmOrchestrator with init failure fallback to manual mode
- useEngineBoardBridge maps all 10 engine event types to correct Zustand store actions with deduplication
- Guard evaluations trigger 2s gold evaluating glow with rapid-fire dedup (matching usePolicyEvalBoardBridge)
- SwarmBoardPage wraps with SwarmEngineProvider outermost, all 4 existing bridges untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: SwarmEngineProvider + convenience hooks** - `0122b0682` (feat)
2. **Task 2: Engine-to-board event bridge with dedup and glow** - `bb8de13c4` (feat)
3. **Task 3: Wire SwarmBoardPage + spawnEngineSession** - `06e8c3a65` (feat)

## Files Created/Modified
- `apps/workbench/src/features/swarm/stores/swarm-engine-provider.tsx` - SwarmEngineProvider context, 5 exported hooks, orchestrator lifecycle
- `apps/workbench/src/features/swarm/hooks/use-engine-board-bridge.ts` - 10-event bridge hook with dedup, glow, topology layout dispatch
- `apps/workbench/src/components/workbench/swarm-board/swarm-board-page.tsx` - Wrapped with SwarmEngineProvider, wired engine bridge in canvas

## Decisions Made
- Access private events field via `(engine as any).events` for bridge subscriptions -- the orchestrator does not expose a public events accessor, and this is the standard integration pattern for bridge hooks
- Used actual TopologyConfig and ConsensusConfig type fields from types.ts rather than the simplified version shown in the plan's inline config (which had incorrect field names)
- mapEngineStatus covers all 11 AgentSessionStatus values with explicit cases for busy->running and offline->failed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed config field names to match actual types**
- **Found during:** Task 1 (SwarmEngineProvider)
- **Issue:** Plan specified TopologyConfig fields `maxPartitions`, `quorumThreshold`, `proposalTimeoutMs`, `electionTimeoutMs` which do not exist on the actual types
- **Fix:** Used correct field names from types.ts: `maxAgents`, `replicationFactor`, `failoverEnabled`, `autoRebalance` for TopologyConfig; `threshold`, `timeoutMs`, `maxRounds`, `requireQuorum` for ConsensusConfig
- **Files modified:** swarm-engine-provider.tsx
- **Verification:** TypeScript types match, no compile errors
- **Committed in:** 0122b0682 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix -- using non-existent field names would cause TypeScript compilation failure. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (React Integration) is now complete with all 3 plans executed
- Engine provider, store actions, topology layout, and event bridge are all wired
- Ready for Phase 6 validation (backward compatibility, end-to-end testing)

---
*Phase: 05-react-integration*
*Completed: 2026-03-25*
