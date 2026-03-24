---
phase: 03-orchestrator-+-protocol
plan: 01
subsystem: orchestration
tags: [agent-pool, guard-evaluator, auto-scaling, health-checks, typed-events]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypedEventEmitter, SwarmEngineEventMap, generateSwarmId
  - phase: 02-core-subsystems
    provides: AgentRegistry pattern (constructor injection, dispose convention)
provides:
  - GuardEvaluator interface for host injection (fail-closed pattern)
  - AgentPoolConfig and AgentPoolState serializable types
  - DenyNotification protocol type (PROTOCOL-SPEC section 4.5)
  - Guard pipeline events (guard.evaluated, action.denied, action.completed)
  - AgentPool class with acquire/release, auto-scaling, LRU eviction, health checks
affects: [03-orchestrator-+-protocol, 05-react-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constructor-injected TypedEventEmitter (same as AgentRegistry)"
    - "Record-based getState() for JSON serialization (Map internally)"
    - "LRU eviction on scale-down (sort by lastUsed ascending)"
    - "Health check circuit breaker (degradation -> replacement)"
    - "Cooldown enforcement between scale operations"

key-files:
  created:
    - packages/swarm-engine/src/agent-pool.ts
    - packages/swarm-engine/src/agent-pool.test.ts
    - packages/swarm-engine/src/guard-types.test.ts
  modified:
    - packages/swarm-engine/src/types.ts
    - packages/swarm-engine/src/events.ts

key-decisions:
  - "Pool getEvents() accessor exposes shared emitter for orchestrator coordination"
  - "Pool does not emit agent.spawned/terminated (AgentRegistry responsibility per plan)"
  - "Synchronous acquire/release/add/remove/scale -- no async needed for logical pool state"
  - "Health check threshold is 3x healthCheckIntervalMs (strict greater-than comparison)"

patterns-established:
  - "AgentPool constructor injection: new AgentPool(events, config)"
  - "Scale cooldown: lastScaleOperation timestamp with configurable cooldownMs"
  - "LRU eviction: sort available agents by lastUsed, remove oldest first"

requirements-completed: [ORCH-03, ORCH-04, POOL-01, POOL-02, POOL-03]

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 3 Plan 1: Guard Pipeline Types and AgentPool Summary

**GuardEvaluator interface, DenyNotification protocol type, guard pipeline events, and full AgentPool with auto-scaling/LRU eviction/health-check circuit breaker ported from ruflo**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T22:26:56Z
- **Completed:** 2026-03-24T22:37:36Z
- **Tasks:** 2 (both TDD: RED -> GREEN)
- **Files modified:** 5

## Accomplishments
- GuardEvaluator, AgentPoolConfig, AgentPoolState, DenyNotification interfaces in types.ts
- Guard pipeline events (guard.evaluated, action.denied, action.completed) added to events.ts union and event map
- AgentPool ported from ruflo (484 lines) with all browser-safe adaptations applied
- 38 new tests across 2 test files (10 type-level + 28 behavioral)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add guard pipeline types and events** - `eea2974d1` (test: RED) + `620cfbad7` (feat: GREEN)
2. **Task 2: Port AgentPool from ruflo** - `ca8aae494` (test: RED) + `43c18c185` (feat: GREEN)

_TDD tasks have test commit (RED) followed by implementation commit (GREEN)._

## Files Created/Modified
- `packages/swarm-engine/src/types.ts` - Added GuardEvaluator, AgentPoolConfig, AgentPoolState, DenyNotification
- `packages/swarm-engine/src/events.ts` - Added GuardEvaluatedEvent, ActionDeniedEvent, ActionCompletedEvent + map entries
- `packages/swarm-engine/src/agent-pool.ts` - Full AgentPool class (484 lines)
- `packages/swarm-engine/src/agent-pool.test.ts` - 28 AgentPool behavioral tests (427 lines)
- `packages/swarm-engine/src/guard-types.test.ts` - 10 type-level tests (243 lines)

## Decisions Made
- Pool getEvents() accessor exposes shared emitter for orchestrator coordination (satisfies noUnusedLocals)
- Pool does NOT emit agent.spawned/terminated -- those are AgentRegistry's responsibility per plan
- Synchronous acquire/release/add/remove/scale -- no async needed for logical pool state
- Health check uses strict greater-than comparison (timeSinceLastHeartbeat > threshold), not >=

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed utilization test racing with auto-scaling**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** Test expected utilization=1.0 after acquiring 2/2 agents, but auto-scaling triggered (util >= 0.8 threshold) and created a 3rd agent, making utilization 0.666
- **Fix:** Used scaleUpThreshold: 1.0 in test to prevent auto-scaling interference
- **Files modified:** packages/swarm-engine/src/agent-pool.test.ts
- **Committed in:** 43c18c185

**2. [Rule 1 - Bug] Fixed health check timing in tests**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** Test advanced time by 30001ms but health check uses strict `>` not `>=`, so 30000ms exactly didn't trigger degradation
- **Fix:** Advanced time to 40001ms (4 health check intervals) to reliably exceed threshold
- **Files modified:** packages/swarm-engine/src/agent-pool.test.ts
- **Committed in:** 43c18c185

---

**Total deviations:** 2 auto-fixed (2 test timing bugs)
**Impact on plan:** Both fixes corrected test logic, not production code. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GuardEvaluator interface ready for SwarmOrchestrator injection (Plan 03-02)
- AgentPool ready for orchestrator composition (Plan 03-02)
- Guard pipeline events ready for protocol bridge (Plan 03-03)
- DenyNotification type ready for protocol bridge (Plan 03-03)

---
*Phase: 03-orchestrator-+-protocol*
*Completed: 2026-03-24*
