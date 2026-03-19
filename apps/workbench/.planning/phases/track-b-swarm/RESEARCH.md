# Track B: Swarm Board Evolution - Research

**Researched:** 2026-03-19
**Domain:** SwarmBoard (@xyflow/react graph), multi-agent coordination, receipt flow visualization
**Confidence:** HIGH

## Summary

The SwarmBoard is a mature, well-tested React Flow canvas (311+ tests) with 6 custom node types, 4 edge types, full PTY terminal integration via Tauri, and a comprehensive inspector drawer. The existing codebase provides a solid foundation for Track B evolution: launching swarms from the editor, real-time agent coordination graphs, and receipt flow visualization.

The architecture is split across three layers: (1) a React Context + useReducer board store (`swarm-board-store.tsx`) managing graph state, node CRUD, and live session lifecycle; (2) a Zustand-based swarm CRUD store (`swarm-store.tsx`) managing swarm membership, trust graphs, and intel/detection references; and (3) a protocol/coordination layer (`swarm-protocol.ts`, `swarm-coordinator.ts`, `swarm-feed-store.tsx`) providing typed message envelopes, transport abstraction (Gossipsub/in-process), and feed synchronization with trust policy evaluation.

**Primary recommendation:** Evolve the existing board store from Context+useReducer to Zustand (matching the swarm-store migration pattern), wire the swarm coordinator's typed message handlers to the board graph in real-time, and extend the existing `useSwarmLaunch` hook to support bidirectional editor-to-board-to-editor navigation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | ^12.10.1 | Graph canvas (nodes, edges, minimap) | Already in use, well-integrated |
| zustand | ^5.0.12 | State management (swarm-store, command registry) | Project standard via createSelectors |
| motion (framer-motion) | ^12.33.0 | Inspector drawer animation | Already in use for slide transitions |
| react | ^19.0.0 | UI framework | Project standard |
| @tabler/icons-react | ^3.28.1 | Icon library | Project standard |
| ghostty-web | (workspace) | WASM-based terminal rendering | Already integrated in TerminalRenderer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | (workspace) | PTY backend, file dialogs | Desktop session spawn/kill |
| @tauri-apps/plugin-dialog | (workspace) | Native file/directory picker | Workspace root selection |

## Architecture Patterns

### Existing Project Structure (Swarm Feature)
```
src/
  features/swarm/
    stores/
      swarm-store.tsx         # Zustand: Swarm CRUD, membership, trust
      swarm-board-store.tsx   # Context+useReducer: Board graph state
      swarm-feed-store.tsx    # Zustand: Protocol feed, findings, replay
    swarm-protocol.ts         # Protocol types, canonical hashing
    swarm-coordinator.ts      # Transport adapter, pub/sub, outbox
    swarm-board-types.ts      # Node/edge/state type definitions
    swarm-sync.ts             # Feed replay planning/validation
    swarm-trust-policy.ts     # Finding/revocation trust evaluation
    swarm-blob-client.ts      # Blob lookup/pin for finding artifacts
  components/workbench/
    swarm-board/
      swarm-board-page.tsx    # Main canvas page (ReactFlowProvider)
      swarm-board-toolbar.tsx # Top bar: spawn, layout, zoom
      swarm-board-inspector.tsx # Right drawer: per-node detail views
      swarm-board-left-rail.tsx # Left panel: sessions, hunts, artifacts
      terminal-renderer.tsx   # ghostty-web terminal component
      nodes/                  # 6 custom node types + index registry
      edges/                  # SwarmEdge + index registry
      __tests__/              # 11 test files
    receipts/
      receipt-inspector.tsx   # Receipt generation, signing, fleet sync
      receipt-timeline.tsx    # Vertical timeline with expandable detail
      receipt-detail.tsx      # Full receipt detail card
      chain-verification.tsx  # Receipt chain hash verification view
  lib/workbench/
    detection-workflow/
      use-swarm-launch.ts     # Hook: editor -> board node creation
      swarm-detection-nodes.ts # Node factories for detection artifacts
      swarm-receipt-linking.ts # Receipt <-> publication node edges
      swarm-session-templates.ts # Pre-configured session templates
    terminal-service.ts       # Tauri PTY invoke bridge
    use-terminal-sessions.ts  # High-level session spawn hook
```

### Pattern 1: Board Store (Current - Context+useReducer)
**What:** The SwarmBoardProvider wraps a useReducer with 14 action types, localStorage persistence with debounced writes, and convenience methods exposed via React Context.
**When to use:** This is the CURRENT pattern. It works but creates tight coupling since session spawn/kill logic lives in the provider.
**Key state shape:**
```typescript
interface SwarmBoardState {
  boardId: string;
  repoRoot: string;
  nodes: Node<SwarmBoardNodeData>[];
  edges: SwarmBoardEdge[];
  selectedNodeId: string | null;
  inspectorOpen: boolean;
}
```
**Key actions:** ADD_NODE, REMOVE_NODE, UPDATE_NODE, SET_NODES, ADD_EDGE, REMOVE_EDGE, SET_EDGES, SELECT_NODE, TOGGLE_INSPECTOR, SET_REPO_ROOT, LOAD, CLEAR_BOARD, SET_SESSION_STATUS, SET_SESSION_METADATA

### Pattern 2: Zustand Store (Target Migration Pattern)
**What:** The swarm-store.tsx and swarm-feed-store.tsx both use the Zustand + createSelectors pattern. This is the project standard for new stores.
**When to evolve:** When the board store needs to be accessed from outside the SwarmBoardProvider tree (which Track B requires for editor-to-board integration).

### Pattern 3: Cross-Tree Communication (useSwarmLaunch)
**What:** The `useSwarmLaunch` hook uses a custom DOM event (`workbench:swarm-launch-nodes`) plus localStorage fallback to push nodes into the board from outside the SwarmBoardProvider tree.
**When to use:** When the editor/lab needs to create board nodes without being inside the SwarmBoardProvider.
**Current limitation:** One-way only (editor -> board). No board -> editor navigation. Uses `onNavigate?.("/lab")` for routing.

### Pattern 4: Transport Abstraction (SwarmCoordinator)
**What:** The SwarmCoordinator class wraps a TransportAdapter interface with typed pub/sub for Intel, Signal, and Detection messages. Includes an InProcessEventBus for local-only swarms and a MessageOutbox for offline queuing.
**Integration point:** The coordinator's message handlers (`onIntelReceived`, `onDetectionReceived`, etc.) need to be wired to the board store to create real-time graph updates.

### Anti-Patterns to Avoid
- **Do NOT create a second graph library.** The entire visual layer is @xyflow/react. All new node types must register via the `swarmBoardNodeTypes` map.
- **Do NOT bypass the board store for node mutations.** All node/edge changes must flow through dispatch actions (or the Zustand equivalent after migration).
- **Do NOT poll for terminal output.** The terminal service uses Tauri event subscriptions; the pattern is `terminalService.onOutput(sessionId, callback)`.
- **Do NOT create inline node types.** Each node type is a separate file in `nodes/` registered in `nodes/index.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph layout | Custom force-directed layout | @xyflow/react built-in fitView + existing handleAutoLayout | Auto-layout already implemented in toolbar with typed grid positions per node type |
| Terminal emulation | Custom ANSI parser | ghostty-web WASM Terminal | Already integrated with canvas-based rendering, theme, and resize handling |
| Message hashing | Custom SHA-256 | `hashProtocolPayload` from swarm-protocol.ts | Uses canonical JSON (sorted keys) + SubtleCrypto; matches `@backbay/witness` verifier spec |
| Edge animation | CSS keyframes per edge | SwarmEdge component with `swarmEdgePulse` animation | Already handles per-type styling, hover-reveal, and midpoint dots |
| Session lifecycle | Manual PTY management | useTerminalSessions hook + SwarmBoardProvider's spawn/kill/monitor | Handles worktree creation, exit monitoring, cleanup of PTY + worktree on kill |
| Trust evaluation | Custom issuer validation | `evaluateFindingTrustPolicy` from swarm-trust-policy.ts | Handles blocked/trusted issuers, attestation verification, witness proofs |

## Common Pitfalls

### Pitfall 1: Board Store Not Accessible Outside Provider Tree
**What goes wrong:** The board store uses React Context, so components outside the SwarmBoardProvider tree cannot read or write board state.
**Why it happens:** The SwarmBoardPage wraps everything in SwarmBoardProvider, but the editor and lab views live in separate route trees.
**How to avoid:** Use the `useSwarmLaunch` custom event pattern for cross-tree writes. For Track B, consider migrating to Zustand to enable direct store access from anywhere.
**Warning signs:** Trying to call `useSwarmBoard()` from the editor throws "must be used within SwarmBoardProvider".

### Pitfall 2: Session ID Staling on Page Reload
**What goes wrong:** PTY sessions don't survive page reloads, but localStorage-persisted nodes still reference old sessionIds.
**Why it happens:** The board store persists nodes/edges to localStorage but strips sessionIds on load (sanitizes "running" to "idle").
**How to avoid:** The persistence layer already handles this (line 255-267 of swarm-board-store.tsx). New features must not bypass this sanitization.
**Warning signs:** TerminalRenderer mounting with a stale sessionId produces garbled output or connection errors.

### Pitfall 3: React Flow Node Type Registration
**What goes wrong:** Adding a new node type but forgetting to register it in `nodes/index.ts` causes React Flow to render an invisible/default node.
**Why it happens:** React Flow requires a `nodeTypes` map that must include every `type` value used on nodes.
**How to avoid:** Always: (1) create the component in `nodes/`, (2) export from `nodes/index.ts`, (3) add to `swarmBoardNodeTypes` map, (4) add to `SwarmNodeType` union in `swarm-board-types.ts`.
**Warning signs:** Node renders as a tiny default rectangle instead of the custom component.

### Pitfall 4: useSwarmLaunch localStorage Race
**What goes wrong:** The `dispatchSwarmNodes` function writes directly to localStorage as a fallback. If the board store is mounted and also reading localStorage, they can race.
**Why it happens:** The board store uses debounced writes (500ms) while `dispatchSwarmNodes` writes immediately.
**How to avoid:** The custom DOM event path (`SWARM_LAUNCH_EVENT`) takes priority when the provider is mounted. Only the localStorage path is the fallback. Don't add more direct localStorage writers.

### Pitfall 5: Terminal Session Limit
**What goes wrong:** Spawning more than MAX_ACTIVE_TERMINALS (8) concurrent sessions. The UI disables spawn buttons at the limit.
**Why it happens:** Each session holds a PTY file descriptor in the Rust backend; too many can exhaust OS resources.
**How to avoid:** The `canSpawnMore` flag from `useTerminalSessions` already enforces this. New spawn surfaces must check it.

### Pitfall 6: SwarmBoardNodeData Superset Pattern
**What goes wrong:** Accessing a field that doesn't exist on a particular node type (e.g., `data.guardResults` on a note node).
**Why it happens:** All node types share a single `SwarmBoardNodeData` interface as a superset with optional fields.
**How to avoid:** Always check the `nodeType` discriminant before accessing type-specific fields. The inspector already does this via `NODE_TYPE_META` routing.

## Component Catalog

### Node Types (6)
| Type | Component | File | Visual | Key Data Fields |
|------|-----------|------|--------|-----------------|
| agentSession | AgentSessionNode | nodes/agent-session-node.tsx | Bloomberg terminal: status dot, model badge, branch, terminal preview, metrics | sessionId, agentModel, branch, worktreePath, previewLines, risk, policyMode |
| terminalTask | TerminalTaskNode | nodes/terminal-task-node.tsx | Compact: status badge, task prompt, elapsed time | taskPrompt, status |
| artifact | ArtifactNode | nodes/artifact-node.tsx | File icon by type, filename, path | filePath, fileType, artifactKind, documentId |
| diff | DiffNode | nodes/diff-node.tsx | +/- summary, file list | diffSummary (added, removed, files) |
| note | NoteNode | nodes/note-node.tsx | Editable textarea with save/cancel, gold tint | content, editing |
| receipt | ReceiptNode | nodes/receipt-node.tsx | Verdict stamp (ALLOW/DENY/WARN), guard list, signature | verdict, guardResults, sessionId |

### Edge Types (4)
| Type | Visual | Use Case |
|------|--------|----------|
| handoff | Solid gold line with arrow | Agent-to-agent coordination |
| spawned | Dashed blue line, animated pulse | Agent spawns task/subtask |
| artifact | Dotted green line | Agent produces artifact/file |
| receipt | Thin dotted muted line | Guard receipt association |

### Store APIs

#### swarm-board-store (Context+useReducer)
| Method | Signature | Purpose |
|--------|-----------|---------|
| addNode | (config: CreateNodeConfig) => Node | Create + dispatch ADD_NODE |
| removeNode | (nodeId: string) => void | Dispatch REMOVE_NODE (auto-removes connected edges) |
| updateNode | (nodeId: string, patch) => void | Dispatch UPDATE_NODE |
| selectNode | (nodeId: string \| null) => void | Select node + open/close inspector |
| addEdge | (edge: SwarmBoardEdge) => void | Dispatch ADD_EDGE |
| removeEdge | (edgeId: string) => void | Dispatch REMOVE_EDGE |
| clearBoard | () => void | Remove all nodes/edges |
| spawnSession | (opts: SpawnSessionOptions) => Promise<Node> | Create PTY session + board node |
| spawnClaudeSession | (opts: SpawnClaudeSessionOptions) => Promise<Node> | Create worktree + PTY + Claude CLI |
| spawnWorktreeSession | (opts: SpawnWorktreeSessionOptions) => Promise<Node> | Create worktree + PTY shell |
| killSession | (nodeId: string) => Promise<void> | Kill PTY + cleanup worktree + update node |

#### swarm-store (Zustand)
| Selector/Action | Purpose |
|-----------------|---------|
| swarms, activeSwarm, loading | Read state |
| actions.createSwarm | Create new swarm with policies |
| actions.addMember / removeMember | Membership management |
| actions.addTrustEdge / removeTrustEdge | Trust graph management |
| actions.addIntelRef / addDetectionRef | Intel/detection sharing |
| actions.updatePolicy | Governance policy updates |
| actions.addInvitation / revokeInvitation | Invitation lifecycle |

#### swarm-feed-store (Zustand)
| Selector/Action | Purpose |
|-----------------|---------|
| findings, findingsByFeed | Read findings |
| heads, revocations | Feed state |
| actions.ingestFinding | Validate + store finding envelope |
| actions.ingestHead | Validate + update head announcement |
| actions.ingestRevocation | Validate + revoke finding |
| actions.replaySyncBatch | Batch replay with validation |
| actions.setTrustPolicy | Update hub trust policy |

#### SwarmCoordinator (Class)
| Method | Purpose |
|--------|---------|
| joinSwarm / leaveSwarm | Subscribe/unsubscribe to swarm topics |
| publishIntel / publishSignal / publishDetection | Send typed messages |
| onIntelReceived / onSignalReceived / onDetectionReceived | Register typed handlers |
| flushOutbox | Drain offline queue on reconnect |
| startReconnect / stopReconnect | Exponential backoff reconnection |

### Integration Points for Track B

#### 1. Editor -> Board (Existing)
- `useSwarmLaunch` hook creates artifact/evidence/lab/publication nodes
- Dispatches via custom DOM event `workbench:swarm-launch-nodes`
- Falls back to localStorage merge for unmounted board
- Navigates to `/lab` after dispatch
- **Gap:** Navigates to `/lab`, not `/board`. No bidirectional flow.

#### 2. Board -> Session (Existing)
- Toolbar spawns Claude/Terminal/Worktree sessions directly on the board
- Session options popover for advanced config (prompt, branch, shell)
- TerminalRenderer connects to PTY via ghostty-web WASM
- Exit monitoring auto-transitions node status

#### 3. Receipt Flow (Existing on Board)
- ReceiptNode displays verdict, guard results, signature hash
- Inspector shows per-guard detail with pass/fail, duration_ms
- `swarm-receipt-linking.ts` can connect receipt -> publication nodes
- **Gap:** No real-time receipt creation from session activity. Receipts are currently created manually via the receipt-inspector or from useSwarmLaunch.

#### 4. Protocol -> Board (Not Yet Wired)
- SwarmCoordinator has typed handlers for intel/signal/detection messages
- SwarmFeedStore ingests findings with trust policy evaluation
- **Gap:** No code currently connects coordinator message handlers to board node creation/updates. This is the key Track B integration.

#### 5. Detection Workflow Integration (Existing)
- `swarm-detection-nodes.ts`: Factories for detection_rule, evidence_pack, lab_run, publication_manifest, conversion_output nodes
- `swarm-session-templates.ts`: Pre-configured templates for review/harden/publish/convert workflows
- Inspector has detection-specific sub-views (FormatBadge, PublishStateBadge, dataset counts, lab run summary, publication hashes)

## Data Flow Diagram

```
Editor/Lab                    SwarmBoard                      Protocol Layer
-----------                   ----------                      --------------
useSwarmLaunch ----event----> SwarmBoardProvider              SwarmCoordinator
  creates nodes               |                                |
  |                           boardReducer                     onIntelReceived
  |                           ADD_NODE/ADD_EDGE                onDetectionReceived
  |                           |                                |
  |                           nodes[] / edges[]                [NOT YET WIRED]
  |                           |                                |
  |                           ReactFlow canvas                 SwarmFeedStore
  |                           |                                ingestFinding
  |                           SwarmBoardInspector              |
  |                           per-node detail views            findings[]
  |                           |
  |                           TerminalRenderer
  |                           ghostty-web + PTY
  |                           |
  |                           terminalService
  |                           Tauri invoke bridge
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xterm.js | ghostty-web (Ghostty VT100 WASM) | Phase 2 | Canvas-based rendering, no CSS needed, better perf |
| swarm-board-store as Context+useReducer | Should migrate to Zustand | Pending | Enables cross-tree access for editor integration |
| Manual node creation only | useSwarmLaunch DOM event bridge | Detection workflow phase | Editor can push nodes to board across route trees |
| Ephemeral board state | localStorage persistence | Phase 1 | Board survives page reloads (with session sanitization) |

## Open Questions

1. **Board Store Migration to Zustand**
   - What we know: swarm-store.tsx and swarm-feed-store.tsx both use Zustand + createSelectors. The board store still uses Context+useReducer.
   - What's unclear: Should the migration happen as part of Track B or as a prerequisite?
   - Recommendation: Migrate as the first task of Track B. It unblocks cross-tree access needed for editor<->board integration.

2. **Real-Time Receipt Flow**
   - What we know: Receipts can be created via the receipt-inspector (Ed25519 signing via Rust engine). SwarmBoard has receipt nodes. `swarm-receipt-linking.ts` connects receipts to publications.
   - What's unclear: How should real-time receipts from live agent sessions appear on the board? Should the coordinator route them or should terminal output parsing detect them?
   - Recommendation: Use the SwarmCoordinator's message handlers to push receipt events to the board store when they arrive via the protocol layer.

3. **Coordinator -> Board Wiring**
   - What we know: SwarmCoordinator has `onIntelReceived`, `onDetectionReceived` handlers. SwarmFeedStore has `ingestFinding`.
   - What's unclear: Should new findings become board nodes automatically, or should there be a user-initiated "materialize" action?
   - Recommendation: Auto-create board nodes for coordination messages (receipts, task updates) but require manual materialization for findings/intel to avoid board clutter.

4. **Navigation Between Editor and Board**
   - What we know: `useSwarmLaunch` navigates to `/lab` after pushing nodes. No reverse navigation exists.
   - What's unclear: Should the board have "Open in Editor" actions? Should clicking an artifact node navigate to the editor?
   - Recommendation: Yes, add bidirectional navigation. The inspector footer already has placeholder `TextAction` buttons like "Open in Editor" that navigate via `useNavigate`.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of all files listed in the component catalog above
- `SWARM_BOARD_STATUS.md` -- comprehensive audit of implemented features vs product spec

### Secondary (MEDIUM confidence)
- Project memory notes on workbench dev roadmap and phase mapping
- Root `CLAUDE.md` for project conventions and structure

## Metadata

**Confidence breakdown:**
- Component catalog: HIGH -- direct code analysis of all 30+ files
- Store API inventory: HIGH -- complete type analysis of all 3 stores + coordinator
- Data flow: HIGH -- traced all dispatch paths and event bridges
- Integration points: HIGH -- identified all existing wiring and gaps
- Migration recommendations: MEDIUM -- based on project patterns, not user decisions

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable internal codebase, no external deps changing)
