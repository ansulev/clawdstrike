# @clawdstrike/swarm-engine

## What This Is

A browser/Tauri-safe TypeScript package that extracts AI agent orchestration from ruflo's `@claude-flow/swarm` and integrates it with ClawdStrike's guard pipeline. The package provides swarm coordination (agent registry, task DAG, topology management, consensus algorithms, shared memory) with zero Node.js dependencies, designed to power ClawdStrike's SwarmBoard UI and eventually replace ruflo's own orchestration layer.

## Core Value

Every agent action passes through ClawdStrike's guard pipeline before execution — orchestration and security enforcement share a single wire format, a single transport, and a single audit trail. There is no "orchestration bus" separate from the "security bus."

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ ClawdStrike policy engine with 13 built-in guards — existing
- ✓ Ed25519 receipt signing and verification — existing
- ✓ SwarmBoard React Flow canvas with 6 node types and 4 edge types — existing
- ✓ SwarmCoordinator with TransportAdapter (InProcessEventBus, Gossipsub) — existing
- ✓ 4 bridge hooks (coordinator, policy-eval, receipt-flow, trust-graph) — existing
- ✓ Zustand SwarmBoardStore with 14 action types — existing
- ✓ SwarmEnvelope protocol v1 (intel, signal, detection, coordination, status channels) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] @clawdstrike/swarm-engine package with zero Node.js dependencies
- [ ] SwarmOrchestrator extracted from ruflo's UnifiedSwarmCoordinator (1,844 lines)
- [ ] AgentRegistry extracted from ruflo (544 lines) with configurable agent definitions
- [ ] TaskGraph (DAG) extracted from ruflo's TaskOrchestrator (605 lines)
- [ ] TopologyManager extracted from ruflo (656 lines) with mesh/hierarchical/centralized/hybrid modes
- [ ] AgentPool extracted from ruflo (476 lines) with auto-scaling and health checks
- [ ] Consensus algorithms (Raft, Byzantine/PBFT, Gossip) extracted from ruflo
- [ ] HNSW vector index + IndexedDB persistence for shared agent memory
- [ ] TypedEventEmitter replacing Node.js EventEmitter (browser-safe EventTarget)
- [ ] Unified type system merging ruflo and ClawdStrike types (flat ULID IDs, Record over Map, Unix ms timestamps)
- [ ] GuardEvaluator interface injected by host environment for guard pipeline integration
- [ ] SwarmEnvelope v2 protocol with 6 new channels (agent_lifecycle, task_orchestration, topology, consensus, memory, hooks)
- [ ] GuardedPayload base with EnvelopeReceipt for every mutable action
- [ ] SwarmEngineProvider wrapping SwarmBoardProvider in React component tree
- [ ] Engine-to-board event bridge (use-engine-board-bridge.ts) mapping engine events to Zustand actions
- [ ] Topology-driven React Flow layout using existing custom force/Sugiyama algorithms
- [ ] Protocol bridge mapping engine events to SwarmEnvelope transport
- [ ] 3 new SwarmBoard actions (topologyLayout, engineSync, guardEvaluate)
- [ ] "topology" edge type added to SwarmBoardEdge
- [ ] Extended parseSwarmTopic and routeMessage for new channels
- [ ] Backward-compatible getSwarmTopics with boolean shim
- [ ] TauriIpcTransport for desktop swarm communication

### Out of Scope

- Ruflo CLI commands (26 commands, 140+ subcommands) — Node.js-specific, stays in ruflo
- Ruflo daemon management (child_process) — Node.js-specific
- Ruflo MCP server management — Node.js-specific
- Ruflo SQLite memory backend — Node.js native module, ruflo keeps this
- Publishing to npm — workspace protocol deps for now
- AgentPoolConfig optimization — deferred until core engine stabilizes
- Phase 2: ruflo CLI importing swarm-engine — after package is stable
- Phase 3: shared @clawdstrike/swarm-types package — after interop validated

## Context

**Source of extraction:** ruflo v3 `@claude-flow/swarm` (accessible from this workspace). The ARCHITECTURE.md plan has detailed extract/leave-behind/adapt tables for each of the 8 ruflo source modules.

**Porting approach:** Copy 90% verbatim from ruflo source, only adapt Node.js APIs to browser APIs and rename types per the unified type system. Exception: MessageBus is replaced (not ported) by the protocol bridge, since ClawdStrike already has TransportAdapter + InProcessEventBus.

**Existing infrastructure:**
- ClawdStrike workbench with SwarmBoard (React Flow, Zustand, 4 bridge hooks)
- SwarmCoordinator with TransportAdapter pattern (InProcessEventBus, Gossipsub via Speakeasy)
- Guard pipeline accessible via WASM (hush-wasm) or TS policy engine (clawdstrike-policy)
- Custom force layout in control-console (`forceLayout.ts`, ~90 lines)
- Sugiyama hierarchical layout in huntronomer worktree (`force-graph-engine.ts`)

**Plan documents:** `docs/plans/swarm-engine/` contains 4 reviewed specs:
- ARCHITECTURE.md — package structure, extraction criteria, guard integration, migration path
- TYPE-SYSTEM.md — canonical type definitions, event naming glossary, type mapping table
- INTEGRATION-SPEC.md — SwarmBoard provider, bridge hooks, layout, backward compat
- PROTOCOL-SPEC.md — SwarmEnvelope v2 channels, guarded payload pattern, transport compat

## Constraints

- **Zero Node.js deps**: Must run in browsers (Chrome 100+, Firefox 100+, Safari 16+) and Tauri WebView. No `events`, `fs`, `path`, `Buffer`, `setImmediate`, `require()`, or native bindings.
- **Bundle size**: <50KB gzipped for core (orchestrator + registry + task-graph + topology). ~37KB estimated for all modules.
- **Tree-shakeable**: ESM-only, `sideEffects: false`, subpath exports for consensus/memory.
- **Fail-closed**: ClawdStrike convention — invalid configs reject at load time, evaluation errors deny access.
- **Backward compatible**: SwarmBoard without SwarmEngineProvider must work exactly as before. All ~745 existing test cases must pass.
- **Type authority**: TYPE-SYSTEM.md is the single canonical source for all shared types.
- **Event naming**: Protocol actions use imperative dot notation (`agent.spawn`), engine events use past tense (`agent.spawned`).
- **ID convention**: Flat prefixed ULIDs — `agt_`, `tsk_`, `swe_`, `top_`, `csn_`, `msg_`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extract from ruflo, not rewrite | User feedback: "port means copy 90% verbatim." Ruflo's orchestration is battle-tested. | — Pending |
| Browser-safe EventTarget over Node EventEmitter | Must run in Tauri WebView and browsers. CustomEvent requires Node 18.7+ for Phase 2. | — Pending |
| Replace MessageBus, not port it | ClawdStrike already has TransportAdapter + InProcessEventBus. Deque/PriorityQueue data structures extracted to task-graph. | — Pending |
| Record over Map for serializable state | SwarmEnvelope transport requires JSON. Maps don't serialize. Runtime may use Map internally. | — Pending |
| Board data computed, not stored | Single source of truth in SwarmEngineState. SwarmBoardNodeData is a lossy projection at render time. | — Pending |
| No new layout dependencies | Reuse existing forceLayout.ts (control-console) and Sugiyama layout (huntronomer worktree). | — Pending |
| getSwarmTopics backward-compat shim | Old boolean signature detected at runtime, logged as deprecated, converted to options object. | — Pending |
| SwarmEngineProvider graceful degradation | Init failure (e.g., no IndexedDB) falls back to manual mode with error state, not crash. | — Pending |

---
*Last updated: 2026-03-24 after initialization*
