---
phase: track-b-swarm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/swarm/stores/swarm-board-store.tsx
  - src/features/swarm/stores/__tests__/swarm-board-store.test.ts
  - src/components/workbench/swarm-board/swarm-board-page.tsx
autonomous: true
requirements: [SWARM-01]

must_haves:
  truths:
    - "Board state is accessible from any component via Zustand, not just within SwarmBoardProvider tree"
    - "All 14 existing dispatch actions continue to work identically"
    - "localStorage persistence still works with debounced writes"
    - "Session spawn/kill lifecycle still functions via PTY integration"
    - "Existing 311+ tests still pass after migration"
  artifacts:
    - path: "src/features/swarm/stores/swarm-board-store.tsx"
      provides: "Zustand board store with createSelectors"
      exports: ["useSwarmBoardStore", "SwarmBoardProvider"]
    - path: "src/features/swarm/stores/__tests__/swarm-board-store.test.ts"
      provides: "Unit tests for Zustand board store"
  key_links:
    - from: "src/features/swarm/stores/swarm-board-store.tsx"
      to: "src/components/workbench/swarm-board/swarm-board-page.tsx"
      via: "useSwarmBoardStore hook import"
      pattern: "useSwarmBoardStore"
    - from: "src/features/swarm/stores/swarm-board-store.tsx"
      to: "localStorage"
      via: "debounced persistence in subscribe middleware"
      pattern: "localStorage\\.setItem"
---

<objective>
Migrate the SwarmBoard store from React Context + useReducer to Zustand with createSelectors, matching the established project pattern from swarm-store.tsx and swarm-feed-store.tsx.

Purpose: The current Context+useReducer board store is only accessible within the SwarmBoardProvider tree. This blocks cross-tree access needed for editor-to-board integration (SWARM-02) and coordinator-to-board wiring (SWARM-03). Zustand stores are globally accessible.

Output: A Zustand-based board store that is a drop-in replacement for the existing Context+useReducer store, preserving all 14 action types, localStorage persistence, session spawn/kill lifecycle, and mock board seeding.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/swarm/stores/swarm-board-store.tsx
@src/features/swarm/stores/swarm-store.tsx
@src/features/swarm/swarm-board-types.ts
@src/lib/create-selectors.ts
@src/components/workbench/swarm-board/swarm-board-page.tsx

<interfaces>
<!-- Existing Zustand pattern to follow (from swarm-store.tsx) -->

From src/lib/create-selectors.ts:
```typescript
export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }
  return store;
};
```

From src/features/swarm/swarm-board-types.ts:
```typescript
export type SwarmNodeType = "agentSession" | "terminalTask" | "artifact" | "diff" | "note" | "receipt";
export type SessionStatus = "idle" | "running" | "blocked" | "completed" | "failed";
export type RiskLevel = "low" | "medium" | "high";
export interface SwarmBoardNodeData { /* superset with 30+ optional fields */ }
export interface SwarmBoardEdge { id: string; source: string; target: string; label?: string; type?: "handoff" | "spawned" | "artifact" | "receipt"; }
export interface SwarmBoardState { boardId: string; repoRoot: string; nodes: Node<SwarmBoardNodeData>[]; edges: SwarmBoardEdge[]; selectedNodeId: string | null; inspectorOpen: boolean; }
```

From current swarm-board-store.tsx (Context API to replace):
```typescript
export function useSwarmBoard(): SwarmBoardContextValue;
export function SwarmBoardProvider({ children }: { children: ReactNode }): JSX.Element;
export function createBoardNode(config: CreateNodeConfig): Node<SwarmBoardNodeData>;
export function generateNodeId(prefix?: string): string;
export function createMockBoard(): { nodes: Node<SwarmBoardNodeData>[]; edges: SwarmBoardEdge[]; };
export const MAX_ACTIVE_TERMINALS = 8;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate board store to Zustand with createSelectors</name>
  <files>src/features/swarm/stores/swarm-board-store.tsx, src/features/swarm/stores/__tests__/swarm-board-store.test.ts</files>
  <read_first>
    - src/features/swarm/stores/swarm-board-store.tsx (full file -- the store being migrated)
    - src/features/swarm/stores/swarm-store.tsx (reference Zustand pattern)
    - src/lib/create-selectors.ts (createSelectors utility)
    - src/features/swarm/swarm-board-types.ts (type definitions)
  </read_first>
  <behavior>
    - Test 1: useSwarmBoardStore.getState() returns SwarmBoardState with boardId, repoRoot, nodes, edges, selectedNodeId, inspectorOpen
    - Test 2: actions.addNode creates a node and it appears in getState().nodes
    - Test 3: actions.addNode with duplicate ID is a no-op
    - Test 4: actions.removeNode removes the node AND connected edges
    - Test 5: actions.removeNode clears selectedNodeId if the removed node was selected
    - Test 6: actions.updateNode patches data on the correct node
    - Test 7: actions.selectNode sets selectedNodeId and opens inspector
    - Test 8: actions.selectNode(null) clears selection and closes inspector
    - Test 9: actions.addEdge creates an edge; duplicate is no-op
    - Test 10: actions.removeEdge removes the edge
    - Test 11: actions.clearBoard empties nodes, edges, selection, inspector
    - Test 12: actions.setSessionStatus updates status on the node matching sessionId
    - Test 13: actions.setSessionMetadata patches data on the node matching sessionId
    - Test 14: actions.setRepoRoot updates repoRoot
    - Test 15: actions.loadState merges partial state
    - Test 16: createBoardNode factory returns properly shaped node
    - Test 17: createMockBoard returns seeded nodes and edges
  </behavior>
  <action>
Convert src/features/swarm/stores/swarm-board-store.tsx from Context+useReducer to Zustand:

1. Replace the useReducer + Context pattern with `create()` from zustand and wrap with `createSelectors()` from `@/lib/create-selectors`.

2. The Zustand store shape MUST be:
```typescript
interface SwarmBoardStoreState extends SwarmBoardState {
  // Derived (computed in selectors or getters)
  selectedNode: Node<SwarmBoardNodeData> | undefined;
  rfEdges: Edge[];

  // Actions namespace (matching swarm-store.tsx pattern)
  actions: {
    addNode: (config: CreateNodeConfig) => Node<SwarmBoardNodeData>;
    removeNode: (nodeId: string) => void;
    updateNode: (nodeId: string, patch: Partial<SwarmBoardNodeData>) => void;
    selectNode: (nodeId: string | null) => void;
    addEdge: (edge: SwarmBoardEdge) => void;
    removeEdge: (edgeId: string) => void;
    clearBoard: () => void;
    setRepoRoot: (repoRoot: string) => void;
    loadState: (state: Partial<SwarmBoardState>) => void;
    setSessionStatus: (sessionId: string, status: SessionStatus, exitCode?: number) => void;
    setSessionMetadata: (sessionId: string, metadata: Partial<SwarmBoardNodeData>) => void;
    // Session lifecycle (kept for backward compat but NOT in the store itself -- these need Tauri)
  };
}
```

3. Each action in the `actions` namespace MUST replicate the EXACT logic from the existing `boardReducer` switch cases. Do not simplify or change behavior.

4. Persistence: Use zustand's `subscribe` to debounce writes to localStorage (same 500ms debounce, same STORAGE_KEY `"clawdstrike_workbench_swarm_board"`, same sanitization on load -- strip sessionIds, transition "running" to "idle").

5. Keep `createBoardNode`, `generateNodeId`, `createMockBoard`, and `MAX_ACTIVE_TERMINALS` as named exports (these are imported by other modules).

6. KEEP the `SwarmBoardProvider` component but make it a thin wrapper that:
   - Runs the auto-detect repoRoot effect on mount (terminalService.getCwd)
   - Manages the session spawn/kill lifecycle (PTY refs, exit monitoring, worktree tracking) -- these CANNOT live in the Zustand store because they hold mutable refs and async Tauri callbacks
   - Provides spawn/kill methods via a SEPARATE React Context (SwarmBoardSessionContext)
   - The existing `useSwarmBoard()` hook should still work by composing the Zustand store + session context

7. Export the raw Zustand store as `useSwarmBoardStore` for direct cross-tree access (this is the key unlock for SWARM-02 and SWARM-03).

8. Compute `rfEdges` as a derived value using zustand's subscribe pattern or a getter. Use the same `edgeColor` mapping logic.

9. Compute `selectedNode` as a derived getter from `selectedNodeId` + `nodes`.

IMPORTANT: The `useSwarmBoard()` hook MUST maintain backward compatibility. It should return the same `SwarmBoardContextValue` shape. Existing consumers (swarm-board-page.tsx, inspector, toolbar, left-rail) MUST NOT need changes beyond import path adjustments.

Create the test file at src/features/swarm/stores/__tests__/swarm-board-store.test.ts with all behavior tests listed above.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/features/swarm/stores/__tests__/swarm-board-store.test.ts --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useSwarmBoardStore" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "createSelectors" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "create(" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "useSwarmBoard" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "SwarmBoardProvider" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "MAX_ACTIVE_TERMINALS" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "createBoardNode" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "actions.addNode" src/features/swarm/stores/__tests__/swarm-board-store.test.ts
    - grep -q "actions.removeNode" src/features/swarm/stores/__tests__/swarm-board-store.test.ts
    - grep -q "actions.clearBoard" src/features/swarm/stores/__tests__/swarm-board-store.test.ts
  </acceptance_criteria>
  <done>Zustand board store created with createSelectors, all 14 action types replicated, persistence works, useSwarmBoard backward-compatible hook works, useSwarmBoardStore exported for cross-tree access, 17+ tests pass</done>
</task>

<task type="auto">
  <name>Task 2: Update SwarmBoardPage and consumers to use Zustand store</name>
  <files>src/components/workbench/swarm-board/swarm-board-page.tsx</files>
  <read_first>
    - src/components/workbench/swarm-board/swarm-board-page.tsx (full file)
    - src/features/swarm/stores/swarm-board-store.tsx (newly migrated store from Task 1)
  </read_first>
  <action>
Update SwarmBoardPage to work with the Zustand-based store:

1. The page still wraps in `SwarmBoardProvider` (which now just manages session lifecycle) and `ReactFlowProvider`.

2. The `SwarmBoardCanvas` component should continue using `useSwarmBoard()` -- it returns the same shape. No functional changes needed.

3. Verify that `useSwarmBoard()` call in SwarmBoardCanvas still provides: `state`, `dispatch` (can be a shim that calls store actions), `selectNode`, `removeNode`, `addNode`, `updateNode`, `rfEdges`, `killSession`, `spawnSession`.

4. If the `dispatch` function was being used directly anywhere in swarm-board-page.tsx (it IS -- for SET_NODES, SET_EDGES, ADD_EDGE), create a dispatch shim in the `useSwarmBoard()` return that routes `dispatch({ type: "SET_NODES", nodes })` to `useSwarmBoardStore.getState().actions.setNodes(nodes)` etc. This means adding `setNodes` and `setEdges` actions to the Zustand store if not already present.

5. CRITICAL: The `onNodesChange` callback at line 131 uses `dispatch({ type: "SET_NODES", nodes: updated })`. This must continue to work. Either:
   - a) The dispatch shim routes it, OR
   - b) Replace the raw dispatch calls with direct store action calls

Choose option (b) -- cleaner. Replace:
- `dispatch({ type: "SET_NODES", nodes: updated })` with `useSwarmBoardStore.getState().actions.setNodes(updated)`
- `dispatch({ type: "SET_EDGES", edges: newEdges })` with `useSwarmBoardStore.getState().actions.setEdges(newEdges)`
- `dispatch({ type: "ADD_EDGE", edge: {...} })` with `addEdge({...})`

6. Run the existing swarm-board-page.test.tsx to confirm no regressions.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/components/workbench/swarm-board/__tests__/swarm-board-page.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useSwarmBoard\|useSwarmBoardStore" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "SwarmBoardProvider" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "ReactFlowProvider" src/components/workbench/swarm-board/swarm-board-page.tsx
  </acceptance_criteria>
  <done>SwarmBoardPage works with the new Zustand store, all existing tests pass, no raw dispatch calls remain (replaced with direct action calls)</done>
</task>

</tasks>

<verification>
1. All existing swarm board tests pass: `npx vitest run src/components/workbench/swarm-board/__tests__/ --reporter=verbose`
2. New store tests pass: `npx vitest run src/features/swarm/stores/__tests__/swarm-board-store.test.ts --reporter=verbose`
3. TypeScript compiles: `npx tsc --noEmit --pretty 2>&1 | head -20`
4. `useSwarmBoardStore` is exported and can be called outside the provider tree
</verification>

<success_criteria>
- Board store uses Zustand with createSelectors (matching swarm-store.tsx pattern)
- useSwarmBoardStore exported for cross-tree access
- useSwarmBoard() backward-compatible hook still works
- SwarmBoardProvider still manages session lifecycle
- All 14 action types preserved
- localStorage persistence preserved
- All existing tests pass
- New store unit tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/track-b-swarm/track-b-swarm-01-SUMMARY.md`
</output>
