---
phase: 04-consensus-+-shared-memory
plan: 01
subsystem: consensus
tags: [raft, byzantine, pbft, gossip, consensus, distributed-systems, typed-events]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypedEventEmitter, SwarmEngineEventMap, types (ConsensusProposal, ConsensusVote, ConsensusResult), generateSwarmId
provides:
  - RaftConsensus class with leader election, heartbeat, propose/vote, term management
  - ByzantineConsensus class with PBFT pre-prepare/prepare/commit phases, view change, primary election
  - GossipConsensus class with fanout, hop-limited propagation, convergence threshold
  - ConsensusEngine factory with algorithm selection (raft/byzantine/gossip, throws on paxos)
affects: [04-02-shared-memory, 04-03-hooks, 05-react-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [constructor-injected TypedEventEmitter, internal Map + public array boundary, event-driven consensus resolution]

key-files:
  created:
    - packages/swarm-engine/src/consensus/raft.ts
    - packages/swarm-engine/src/consensus/byzantine.ts
    - packages/swarm-engine/src/consensus/gossip.ts
    - packages/swarm-engine/src/consensus/index.ts
    - packages/swarm-engine/src/consensus/consensus.test.ts
  modified: []

key-decisions:
  - "Internal Map<string, ConsensusVote> for O(1) dedup, serialized to ConsensusVote[] on public boundary"
  - "Event-driven Promise resolution in awaitConsensus instead of ruflo setInterval(10ms) polling"
  - "checkConsensus called after self-vote in propose to handle single-node and small-cluster cases"
  - "Paxos throws Error('not yet implemented') instead of ruflo silent Raft fallback"

patterns-established:
  - "Constructor-injected TypedEventEmitter: all consensus classes receive events via constructor, never extend EventEmitter"
  - "Timer type pattern: ReturnType<typeof setTimeout> | null initialized to null, cleared in dispose()"
  - "dispose() clears timers only, never calls events.dispose() (shared emitter not owned)"

requirements-completed: [CONS-01, CONS-02, CONS-03, CONS-04, CONS-05]

# Metrics
duration: 12min
completed: 2026-03-24
---

# Phase 4 Plan 1: Consensus Subsystem Summary

**Three consensus algorithms (Raft, Byzantine/PBFT, Gossip) ported from ruflo with TypedEventEmitter injection, internal Map vote tracking, and event-driven resolution**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-24T23:13:53Z
- **Completed:** 2026-03-24T23:26:49Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Ported RaftConsensus with leader election, heartbeat, propose/vote/resolve lifecycle
- Ported ByzantineConsensus with PBFT 3-phase protocol, view change, quorum (2f+1)
- Ported GossipConsensus with fanout propagation, hop limit, convergence threshold
- ConsensusEngine factory delegates to implementations, throws on Paxos
- 44 tests covering factory, all 3 algorithms, and event lifecycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Port Raft and Byzantine consensus from ruflo** - `f03793bf3` (feat)
2. **Task 2: Port Gossip consensus + ConsensusEngine factory + tests** - `56fc122ad` (feat)

## Files Created/Modified
- `packages/swarm-engine/src/consensus/raft.ts` - RaftConsensus: leader election, heartbeat, propose/vote with typed events
- `packages/swarm-engine/src/consensus/byzantine.ts` - ByzantineConsensus: PBFT phases, view change, quorum calculation
- `packages/swarm-engine/src/consensus/gossip.ts` - GossipConsensus: fanout, hop-limited propagation, convergence
- `packages/swarm-engine/src/consensus/index.ts` - ConsensusEngine factory with algorithm selection
- `packages/swarm-engine/src/consensus/consensus.test.ts` - 44 tests covering all algorithms and lifecycle

## Decisions Made
- Internal Map<string, ConsensusVote> for O(1) dedup, serialized to ConsensusVote[] on public boundary (matches types.ts ConsensusProposal.votes: ConsensusVote[])
- Replaced ruflo's setInterval(10ms) polling in awaitConsensus with event-driven Promise resolution via TypedEventEmitter.on('consensus.resolved')
- Added checkConsensus call after self-vote in Raft/Gossip propose() to handle single-node clusters correctly
- Paxos algorithm throws explicit Error instead of ruflo's silent fallback to Raft

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Raft self-election failed for single-node cluster**
- **Found during:** Task 1 tests
- **Issue:** startElection() checked votesReceived >= votesNeeded only inside the peer loop; with 0 peers, loop body never executed
- **Fix:** Added pre-loop check: if self-vote alone meets votesNeeded, call becomeLeader immediately
- **Files modified:** packages/swarm-engine/src/consensus/raft.ts
- **Verification:** Raft becomes leader with 0 peers in tests
- **Committed in:** 56fc122ad (Task 2 commit)

**2. [Rule 1 - Bug] Proposals resolved during propose when threshold was low**
- **Found during:** Task 2 tests
- **Issue:** Self-vote in propose() never triggered checkConsensus, so single-node or low-threshold clusters left proposals pending incorrectly
- **Fix:** Added checkConsensus(proposalId) after self-vote in raft.ts and checkConvergence(proposalId) after self-vote in gossip.ts
- **Files modified:** packages/swarm-engine/src/consensus/raft.ts, packages/swarm-engine/src/consensus/gossip.ts
- **Verification:** 44/44 tests pass including convergence and threshold tests
- **Committed in:** 56fc122ad (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness in edge cases (single-node, low-threshold). No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Consensus subsystem complete with all 3 algorithms and factory
- Ready for Plan 04-02 (Shared Memory) and Plan 04-03 (Hooks)
- ConsensusEngine can be integrated into SwarmOrchestrator via constructor injection

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (f03793bf3, 56fc122ad) verified in git log.

---
*Phase: 04-consensus-+-shared-memory*
*Completed: 2026-03-24*
