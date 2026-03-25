# Roadmap: @clawdstrike/swarm-engine

## Overview

Build a browser/Tauri-safe TypeScript swarm orchestration engine extracted from ruflo's battle-tested `@claude-flow/swarm`, integrated with ClawdStrike's guard pipeline so every mutable agent action is policy-evaluated and receipt-signed. The build follows the dependency chain: types and event primitives first, then core subsystem extraction (agent, task, topology), then the orchestrator facade with protocol wiring, then tree-shakeable opt-ins (consensus, shared memory), then React integration with the existing SwarmBoard, and finally backward-compatibility validation with Tauri transport.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Package scaffold, unified type system, TypedEventEmitter, event discriminated union, guarded payload base
- [ ] **Phase 2: Core Subsystems** - Extract AgentRegistry, TaskGraph, and TopologyManager from ruflo with browser-safe adaptations
- [ ] **Phase 3: Orchestrator + Protocol** - SwarmOrchestrator facade composing subsystems, AgentPool, ProtocolBridge with SwarmEnvelope v2, transport compatibility
- [ ] **Phase 4: Consensus + Shared Memory** - Tree-shakeable opt-in subsystems: Raft/PBFT/Gossip consensus and HNSW/KnowledgeGraph/IndexedDB shared memory
- [ ] **Phase 5: React Integration** - SwarmEngineProvider, engine-to-board bridge, topology-driven layout, convenience hooks, board extensions
- [ ] **Phase 6: Validation + Tauri Transport** - Backward compatibility verification, TauriIpcTransport, all 745 existing tests pass

## Phase Details

### Phase 1: Foundation
**Goal**: The type system, event primitives, and guarded payload contract are defined and tested -- every subsequent module imports from these foundations without ambiguity
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05
**Success Criteria** (what must be TRUE):
  1. `packages/swarm-engine/` builds with `tsc` to ESM-only output, has zero runtime dependencies, and `sideEffects: false` in package.json
  2. All entity types from TYPE-SYSTEM.md are importable from `@clawdstrike/swarm-engine` -- flat ULID IDs (`agt_`, `tsk_`, `swe_`, `top_`, `csn_`, `msg_`), Record over Map, Unix ms timestamps
  3. TypedEventEmitter emits strongly-typed events via EventTarget, supports per-event cleanup, listenerCount(), dispose(), and freezes event detail to prevent cross-listener mutation
  4. SwarmEngineEvent discriminated union with `kind` field covers all engine event shapes with past-tense naming convention
  5. GuardedPayload base interface with `action` discriminant and optional `EnvelopeReceipt` is importable and type-checks against existing receipt types
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Package scaffold, unified type system (TYPE-SYSTEM.md sections 2-13), ULID generator, GuardedPayload + EnvelopeReceipt
- [ ] 01-02-PLAN.md — TypedEventEmitter (EventTarget wrapper with per-event cleanup + detail freezing), SwarmEngineEvent discriminated union (19 event kinds), SwarmEngineEventMap

### Phase 2: Core Subsystems
**Goal**: Agents can be registered and managed, tasks can be scheduled in a dependency DAG with priority ordering, and topology can be configured across all 5 modes -- all extracted from ruflo source with browser-safe adaptations
**Depends on**: Phase 1
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TOPO-01, TOPO-02, TOPO-03, TOPO-04, TOPO-05
**Success Criteria** (what must be TRUE):
  1. AgentRegistry can register, spawn, terminate, and query agents with the 11-state status machine, heartbeat-based health checks, 14 roles, capability declarations, and per-agent metrics -- all emitting typed events
  2. TaskGraph resolves dependency ordering (topological sort), detects cycles, schedules across 5 priority levels via the extracted Deque/PriorityQueue, auto-assigns tasks to capable agents, handles timeout/retry with categorized errors, and reports progress as guard-exempt events
  3. TopologyManager supports mesh, hierarchical, centralized, hybrid, and adaptive modes with O(1) role index, BFS shortest path, leader election, dynamic rebalancing on join/leave, partition strategies, and failover on unhealthy agents
  4. All three subsystems use the TypedEventEmitter from Phase 1 (not Node.js EventEmitter), accept Record-based state (not Map), and have zero Node.js imports
  5. TopologyState, AgentSession, and TaskGraph state are JSON-serializable for transport via SwarmEnvelope
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Deque/PriorityQueue extraction from ruflo, new types (TaskErrorCategory, AgentRegistration, TaskSubmission, HealthCheckStatus), TaskProgressEvent
- [ ] 02-02-PLAN.md — AgentRegistry port from ruflo (544 lines) with browser-safe adaptations, full AgentSession lifecycle, health checks
- [ ] 02-03-PLAN.md — TaskGraph port from ruflo (605 lines) with DAG, cycle detection, 5-level priority queue, capability-based assignment, timeout/retry
- [ ] 02-04-PLAN.md — TopologyManager port from ruflo (656 lines) with 5 modes including new adaptive, O(1) role index, BFS, leader election

### Phase 3: Orchestrator + Protocol
**Goal**: A single SwarmOrchestrator facade composes all subsystems with guard pipeline integration, and the ProtocolBridge maps engine events to SwarmEnvelope v2 channels across existing transports
**Depends on**: Phase 2
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, POOL-01, POOL-02, POOL-03, PROT-01, PROT-02, PROT-03, PROT-04, PROT-05, PROT-06, PROT-07, TRNS-02, TRNS-03
**Success Criteria** (what must be TRUE):
  1. SwarmOrchestrator initializes, shuts down, pauses, resumes, and disposes cleanly -- composing AgentRegistry, TaskGraph, TopologyManager, AgentPool, and optional ConsensusEngine under a single lifecycle
  2. GuardEvaluator interface is injected by host environment and called before every mutable action -- missing evaluator denies all guarded actions (fail-closed), guard pipeline flow produces allow/deny/warn with EnvelopeReceipt
  3. AgentPool acquires and releases agents with auto-scaling (configurable thresholds + cooldown), LRU eviction, and circuit-breaker removal of unhealthy agents
  4. SwarmEnvelope v2 adds 6 new channels (agent_lifecycle, task_orchestration, topology, consensus, memory, hooks) with version-field discrimination, backward-compatible topic parsing, and DenyNotification on guard denial
  5. InProcessEventBus and Speakeasy Gossipsub handle new channel topics without modification -- existing transport remains topic-agnostic with TTL hop-decrement for Gossipsub
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Guard pipeline types (GuardEvaluator, AgentPoolConfig, DenyNotification, guard events) + AgentPool port from ruflo (acquire/release, auto-scaling, LRU eviction, circuit-breaker health checks)
- [ ] 03-02-PLAN.md — ProtocolBridge (event-to-envelope mapping), 10 topic builders, EVENT_TO_CHANNEL map, parseSwarmTopic (10 channels), getSwarmTopics (backward-compat boolean shim), TRNS-02/TRNS-03 verification
- [ ] 03-03-PLAN.md — SwarmOrchestrator facade (subsystem composition, lifecycle, guard pipeline integration, getState/getMetrics), index.ts re-exports for all Phase 3 modules

### Phase 4: Consensus + Shared Memory
**Goal**: Agents can participate in distributed consensus for governance decisions, and swarms have browser-native shared memory with vector search, knowledge graph, and persistent storage -- both subsystems are tree-shakeable opt-ins
**Depends on**: Phase 3
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04, CONS-05, MEMO-01, MEMO-02, MEMO-03, MEMO-04, MEMO-05
**Success Criteria** (what must be TRUE):
  1. ConsensusEngine factory produces Raft (leader election via randomized timeout, proposal/vote, term management), Byzantine/PBFT (pre-prepare/prepare/commit with view change), and Gossip (fanout, hop-limited propagation, convergence threshold) implementations with typed proposal lifecycle
  2. HNSW vector index performs cosine-similarity nearest-neighbor search on Float32Array vectors with neighbor pruning, entirely in pure TypeScript with no WASM or native dependency
  3. In-memory knowledge graph stores entity-relationship data with Map-based backing, and IndexedDB persistence backend snapshots vectors, graph, agent states, task graph, and consensus log -- with graceful fallback to in-memory when IndexedDB is unavailable
  4. Memory writes are guarded actions passing through the guard pipeline (mapped to file_write TestActionType), and namespaced memory supports tag-based search with TTL expiration
  5. Importing only `@clawdstrike/swarm-engine` (without `/consensus` or `/memory` subpath) does NOT bundle consensus or memory code -- tree-shaking verified via subpath exports
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Consensus subsystem: port Raft, Byzantine, Gossip from ruflo with TypedEventEmitter injection, ConsensusEngine factory
- [ ] 04-02-PLAN.md — Memory subsystem: HNSW verbatim copy, KnowledgeGraph, IdbBackend, SharedMemory manager with guard pipeline integration
- [ ] 04-03-PLAN.md — Subpath exports (./consensus, ./memory) in package.json, build verification, full test suite regression check

### Phase 5: React Integration
**Goal**: The SwarmBoard canvas renders live engine state with topology-driven layout, connected through the established provider/bridge pattern, and developers access engine subsystems via typed convenience hooks
**Depends on**: Phase 4
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06, INTG-07, INTG-08, INTG-09
**Success Criteria** (what must be TRUE):
  1. SwarmEngineProvider wraps SwarmBoardProvider, handles initialization errors with degraded-state fallback to manual mode (not crash), and provides engine context to child components
  2. Engine-to-board bridge maps all engine events to Zustand store actions, deduplicates nodes by agentId/taskId before creation, and applies "evaluating" gold glow pulse on guard.evaluate events
  3. Topology-driven layout automatically positions React Flow nodes using force-directed layout for mesh, Sugiyama for hierarchical, radial for centralized, and hybrid combination -- using existing ported algorithms (no new layout dependencies)
  4. spawnEngineSession wraps spawnSession with guard evaluation and receipt node creation, 3 new board actions (topologyLayout, engineSync, guardEvaluate) dispatch correctly, and "topology" edge type renders
  5. useSwarmEngine(), useAgentRegistry(), useTaskGraph(), and useTopology() hooks return typed subsystem accessors from engine context
**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — Workspace wiring, type extensions (topology edge, engine metadata fields), 3 new store actions (topologyLayout, engineSync, guardEvaluate) + dispatch shim
- [ ] 05-02-PLAN.md — Topology layout module: port forceLayout.ts + Sugiyama + hub-spoke + hybrid algorithms with tests
- [ ] 05-03-PLAN.md — SwarmEngineProvider + convenience hooks, engine-to-board event bridge with dedup and glow, SwarmBoardPage wiring
- [ ] 05-04-PLAN.md — Gap closure: spawnEngineSession wrapping spawnSession with guard evaluation and receipt node creation (INTG-04)

### Phase 6: Validation + Tauri Transport
**Goal**: The entire package is proven backward-compatible with all existing SwarmBoard functionality, TauriIpcTransport enables desktop swarm communication, and no existing test regresses
**Depends on**: Phase 5
**Requirements**: TRNS-01, BKWD-01, BKWD-02, BKWD-03, BKWD-04, BKWD-05
**Success Criteria** (what must be TRUE):
  1. All ~745 existing test cases pass without modification
  2. SwarmBoard without SwarmEngineProvider renders and behaves exactly as before -- no runtime errors, no missing props, no changed behavior
  3. Existing bridge hooks (coordinator, policy-eval, receipt-flow, trust-graph) work unchanged alongside the new engine bridge
  4. SwarmBoardAction type is extended (not modified) -- existing action type values preserved, detection workflow (_dispatchSwarmNodes) unaffected
  5. TauriIpcTransport implements TransportAdapter via Tauri invoke/listen APIs for desktop swarm communication
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | - |
| 2. Core Subsystems | 4/4 | Complete | - |
| 3. Orchestrator + Protocol | 3/3 | Complete | - |
| 4. Consensus + Shared Memory | 3/3 | Complete | - |
| 5. React Integration | 3/4 | Gap closure | - |
| 6. Validation + Tauri Transport | 0/2 | Not started | - |
