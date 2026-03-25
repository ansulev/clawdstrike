# Requirements: @clawdstrike/swarm-engine

**Defined:** 2026-03-24
**Core Value:** Every agent action passes through ClawdStrike's guard pipeline — orchestration and security share a single wire format, transport, and audit trail.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: Package scaffolded at `packages/swarm-engine/` with ESM-only output, zero runtime deps, `sideEffects: false`
- [x] **FOUN-02**: Unified type system (`types.ts`) with all entity types from TYPE-SYSTEM.md — flat ULID IDs, Record over Map, Unix ms timestamps
- [x] **FOUN-03**: TypedEventEmitter wrapping EventTarget with dispose(), per-event cleanup, detail freezing to prevent cross-listener mutation
- [x] **FOUN-04**: SwarmEngineEvent discriminated union with `kind` field for all engine events (past tense naming)
- [x] **FOUN-05**: GuardedPayload base interface with `action` discriminant and optional `EnvelopeReceipt`

### Agent Lifecycle

- [x] **AGNT-01**: AgentRegistry extracted from ruflo (544 lines) with register, unregister, spawn, terminate, getState, heartbeat, health checks
- [x] **AGNT-02**: AgentSession unified type merging ruflo AgentState with ClawdStrike SwarmBoardNodeData
- [x] **AGNT-03**: 11-state AgentSessionStatus state machine (initializing through terminated/offline)
- [x] **AGNT-04**: 14-role AgentRole enum with sentinel bridge to ClawdStrike SentinelMode
- [x] **AGNT-05**: AgentCapabilities and AgentQualityScores for capability-based task routing
- [x] **AGNT-06**: AgentMetrics (tasks completed, success rate, tokens consumed, response time, health score)

### Task Orchestration

- [x] **TASK-01**: TaskGraph (DAG) extracted from ruflo TaskOrchestrator (605 lines) with dependency resolution, cycle detection, topological ordering
- [x] **TASK-02**: Priority queue with 5 levels (critical/high/normal/low/background) using extracted Deque/PriorityQueue from ruflo MessageBus
- [x] **TASK-03**: Task lifecycle state machine (9 states: created through timeout)
- [x] **TASK-04**: Auto-assignment matching Task.type against AgentCapabilities
- [x] **TASK-05**: Task timeout with configurable max retries and error categorization (guard_denied, timeout, runtime_error, dependency_failed, cancelled)
- [x] **TASK-06**: Task progress reporting (percent, currentStep, stepIndex/totalSteps) as guard-exempt events

### Topology

- [x] **TOPO-01**: TopologyManager extracted from ruflo (656 lines) with mesh, hierarchical, centralized, hybrid, and adaptive modes
- [x] **TOPO-02**: Adjacency list graph with O(1) role index, BFS shortest path, leader election
- [x] **TOPO-03**: Dynamic rebalancing on agent join/leave with partition strategy (hash/range/round-robin)
- [x] **TOPO-04**: Failover when agents go unhealthy — heartbeat timeout detection, task reassignment
- [x] **TOPO-05**: TopologyState snapshot serializable for transport via SwarmEnvelope

### Orchestrator

- [x] **ORCH-01**: SwarmOrchestrator facade composing AgentRegistry, TaskGraph, TopologyManager, AgentPool, and optional ConsensusEngine
- [x] **ORCH-02**: Full lifecycle (initialize, shutdown, pause, resume) with dispose() cleanup
- [x] **ORCH-03**: GuardEvaluator interface injected by host environment — engine calls evaluate() before every mutable action
- [x] **ORCH-04**: Guard pipeline flow: action → evaluate → receipt → allow/deny/warn → emit event
- [x] **ORCH-05**: SwarmEngineState root type combining all subsystem state, serializable to JSON
- [x] **ORCH-06**: SwarmEngineMetrics (uptime, active agents, task stats, guard evaluations, denial rate)

### Agent Pool

- [x] **POOL-01**: AgentPool extracted from ruflo (476 lines) with acquire/release, auto-scaling, health checks
- [x] **POOL-02**: Scale up/down with configurable thresholds and cooldown, LRU-based eviction
- [x] **POOL-03**: Health-check-driven circuit breaker — unhealthy agents removed from rotation

### Protocol

- [x] **PROT-01**: SwarmEnvelope v2 extending type union with 6 new channels (agent_lifecycle, task_orchestration, topology, consensus, memory, hooks)
- [x] **PROT-02**: ProtocolBridge mapping engine events to SwarmEnvelope transport via publish function
- [x] **PROT-03**: GuardedPayload with EnvelopeReceipt for every mutable action, guard-exempt flag for read-only actions
- [x] **PROT-04**: DenyNotification on coordination channel when guard pipeline returns deny
- [x] **PROT-05**: Extended parseSwarmTopic and routeMessage for new channels
- [x] **PROT-06**: Backward-compatible getSwarmTopics with boolean shim and deprecation warning
- [x] **PROT-07**: Topic builder functions for all 6 new channels

### Consensus

- [x] **CONS-01**: ConsensusEngine factory with algorithm selection (Raft, Byzantine/PBFT, Gossip)
- [x] **CONS-02**: Raft consensus — leader election via randomized timeout, proposal/vote, term management
- [x] **CONS-03**: Byzantine consensus — PBFT pre-prepare/prepare/commit phases, view change timeout
- [x] **CONS-04**: Gossip consensus — fanout, hop-limited propagation, convergence threshold
- [x] **CONS-05**: Typed proposal lifecycle (propose → vote → commit/abort) with quorum thresholds

### Shared Memory

- [x] **MEMO-01**: Pure-math HNSW vector index with Float32Array vectors, cosine similarity, neighbor pruning
- [x] **MEMO-02**: In-memory knowledge graph (Map-based entity-relationship store)
- [x] **MEMO-03**: IndexedDB persistence backend for vectors, graph, agent states, task graph, consensus log
- [x] **MEMO-04**: Namespaced memory with tag-based search and TTL-based expiration
- [x] **MEMO-05**: Memory writes are guarded actions (maps to file_write TestActionType)

### React Integration

- [x] **INTG-01**: SwarmEngineProvider wrapping SwarmBoardProvider with error/degraded state handling and manual mode fallback
- [x] **INTG-02**: Engine-to-board event bridge (use-engine-board-bridge.ts) mapping all engine events to Zustand store actions via getState()
- [x] **INTG-03**: Topology-driven React Flow layout using ported forceLayout.ts and Sugiyama algorithms (4 topology types)
- [x] **INTG-04**: spawnEngineSession wrapping existing spawnSession with guard evaluation and receipt node creation
- [x] **INTG-05**: 3 new SwarmBoard actions (topologyLayout, engineSync, guardEvaluate) with dispatch shim
- [x] **INTG-06**: "topology" edge type added to SwarmBoardEdge.type union
- [x] **INTG-07**: useSwarmEngine(), useAgentRegistry(), useTaskGraph(), useTopology() convenience hooks
- [x] **INTG-08**: Deduplication in bridge — check for existing nodes by agentId/taskId before creating duplicates
- [x] **INTG-09**: "evaluating" gold glow pulse (2s) on guard.evaluate events matching usePolicyEvalBoardBridge pattern

### Transport

- [x] **TRNS-01**: TauriIpcTransport implementing TransportAdapter via Tauri invoke/listen APIs
- [x] **TRNS-02**: InProcessEventBus handles new topics without modification (topic-agnostic)
- [x] **TRNS-03**: Speakeasy Gossipsub adapter handles new channels with TTL hop-decrement

### Backward Compatibility

- [ ] **BKWD-01**: All ~745 existing test cases pass without modification
- [ ] **BKWD-02**: SwarmBoard without SwarmEngineProvider works exactly as before
- [ ] **BKWD-03**: Existing bridge hooks (coordinator, policy-eval, receipt-flow, trust-graph) unchanged
- [ ] **BKWD-04**: SwarmBoardAction type extended (not modified) — existing action types preserved
- [ ] **BKWD-05**: Detection workflow (use-swarm-launch.ts) unaffected — _dispatchSwarmNodes still works

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Ruflo CLI Integration (Phase 2 migration)

- **RUFL-01**: Ruflo CLI imports @clawdstrike/swarm-engine replacing its own coordinator
- **RUFL-02**: Node.js adapters: SQLite memory backend, process.spawn for agent execution
- **RUFL-03**: CustomEvent polyfill for Node < 18.7

### Shared Types Package

- **TYPE-01**: Extract @clawdstrike/swarm-types as types-only package for ruflo/ClawdStrike interop

### Advanced Features

- **ADVN-01**: Paxos consensus algorithm (monitor demand before building)
- **ADVN-02**: Hook system — pre/post edit hooks with content hashing, pre-task hooks with model tier routing
- **ADVN-03**: Neural pattern training triggers on post-edit/post-task hooks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Built-in LLM API client | Creates vendor lock-in, requires API keys in browser, inflates bundle. Agents are opaque workers. |
| Agent-to-agent conversation protocol | Encourages unbounded token consumption. Use typed task payloads instead. |
| SQLite/WebSQL persistence | Requires Node.js or deprecated browser APIs. Use IndexedDB. |
| npm package publishing | Workspace protocol deps are the Backbay convention. |
| Custom layout algorithms | Reuse existing forceLayout.ts and Sugiyama. Do not write new layout code. |
| Heavyweight observability SDK | Receipt system IS the observability layer. Export is host environment's job. |
| HTTP/REST API surface | This is a library, not a service. Host provides API if needed. |
| Agent "personality" or "memory persona" | Encourages prompt injection. Agents have roles and capabilities, not personalities. |
| Global mutable state store | Race condition factory. Use namespaced guarded memory writes. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| FOUN-04 | Phase 1 | Complete |
| FOUN-05 | Phase 1 | Complete |
| AGNT-01 | Phase 2 | Complete |
| AGNT-02 | Phase 2 | Complete |
| AGNT-03 | Phase 2 | Complete |
| AGNT-04 | Phase 2 | Complete |
| AGNT-05 | Phase 2 | Complete |
| AGNT-06 | Phase 2 | Complete |
| TASK-01 | Phase 2 | Complete |
| TASK-02 | Phase 2 | Complete |
| TASK-03 | Phase 2 | Complete |
| TASK-04 | Phase 2 | Complete |
| TASK-05 | Phase 2 | Complete |
| TASK-06 | Phase 2 | Complete |
| TOPO-01 | Phase 2 | Complete |
| TOPO-02 | Phase 2 | Complete |
| TOPO-03 | Phase 2 | Complete |
| TOPO-04 | Phase 2 | Complete |
| TOPO-05 | Phase 2 | Complete |
| ORCH-01 | Phase 3 | Complete |
| ORCH-02 | Phase 3 | Complete |
| ORCH-03 | Phase 3 | Complete |
| ORCH-04 | Phase 3 | Complete |
| ORCH-05 | Phase 3 | Complete |
| ORCH-06 | Phase 3 | Complete |
| POOL-01 | Phase 3 | Complete |
| POOL-02 | Phase 3 | Complete |
| POOL-03 | Phase 3 | Complete |
| PROT-01 | Phase 3 | Complete |
| PROT-02 | Phase 3 | Complete |
| PROT-03 | Phase 3 | Complete |
| PROT-04 | Phase 3 | Complete |
| PROT-05 | Phase 3 | Complete |
| PROT-06 | Phase 3 | Complete |
| PROT-07 | Phase 3 | Complete |
| TRNS-02 | Phase 3 | Complete |
| TRNS-03 | Phase 3 | Complete |
| CONS-01 | Phase 4 | Complete |
| CONS-02 | Phase 4 | Complete |
| CONS-03 | Phase 4 | Complete |
| CONS-04 | Phase 4 | Complete |
| CONS-05 | Phase 4 | Complete |
| MEMO-01 | Phase 4 | Complete |
| MEMO-02 | Phase 4 | Complete |
| MEMO-03 | Phase 4 | Complete |
| MEMO-04 | Phase 4 | Complete |
| MEMO-05 | Phase 4 | Complete |
| INTG-01 | Phase 5 | Complete |
| INTG-02 | Phase 5 | Complete |
| INTG-03 | Phase 5 | Complete |
| INTG-04 | Phase 5 | Complete |
| INTG-05 | Phase 5 | Complete |
| INTG-06 | Phase 5 | Complete |
| INTG-07 | Phase 5 | Complete |
| INTG-08 | Phase 5 | Complete |
| INTG-09 | Phase 5 | Complete |
| TRNS-01 | Phase 6 | Complete |
| BKWD-01 | Phase 6 | Pending |
| BKWD-02 | Phase 6 | Pending |
| BKWD-03 | Phase 6 | Pending |
| BKWD-04 | Phase 6 | Pending |
| BKWD-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 65 total
- Mapped to phases: 65
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
