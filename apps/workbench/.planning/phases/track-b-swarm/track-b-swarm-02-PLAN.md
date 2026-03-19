---
phase: track-b-swarm
plan: 02
type: execute
wave: 2
depends_on: [track-b-swarm-01]
files_modified:
  - src/lib/workbench/detection-workflow/use-swarm-launch.ts
  - src/components/workbench/swarm-board/swarm-board-inspector.tsx
  - src/lib/workbench/detection-workflow/__tests__/use-swarm-launch-bridge.test.ts
autonomous: true
requirements: [SWARM-02]

must_haves:
  truths:
    - "Editor can push nodes to the board AND the board reflects them without page reload"
    - "Board inspector 'Open in Editor' navigates to the editor with the correct file loaded"
    - "useSwarmLaunch navigates to /swarm-board (not /lab) after dispatching nodes"
    - "Bidirectional: editor -> board creates nodes, board -> editor opens files"
  artifacts:
    - path: "src/lib/workbench/detection-workflow/use-swarm-launch.ts"
      provides: "Updated swarm launch hook using Zustand store directly"
      exports: ["useSwarmLaunch", "SwarmLaunchActions"]
    - path: "src/components/workbench/swarm-board/swarm-board-inspector.tsx"
      provides: "Updated inspector with working board-to-editor navigation"
    - path: "src/lib/workbench/detection-workflow/__tests__/use-swarm-launch-bridge.test.ts"
      provides: "Tests for bidirectional bridge"
  key_links:
    - from: "src/lib/workbench/detection-workflow/use-swarm-launch.ts"
      to: "src/features/swarm/stores/swarm-board-store.tsx"
      via: "direct Zustand store import (no DOM events needed)"
      pattern: "useSwarmBoardStore\\.getState\\(\\)"
    - from: "src/components/workbench/swarm-board/swarm-board-inspector.tsx"
      to: "src/components/desktop/workbench-routes.tsx"
      via: "useNavigate('/editor') with file context"
      pattern: "navigate.*editor"
---

<objective>
Replace the one-way DOM event bridge (useSwarmLaunch -> board) with a direct Zustand store integration and add board-to-editor reverse navigation.

Purpose: Currently useSwarmLaunch fires a custom DOM event that no listener catches (the board store never registered for it), then writes to localStorage as fallback. With the Zustand migration from Plan 01, we can write directly to the board store from anywhere. Additionally, the inspector has placeholder "Open in Editor" buttons that navigate but don't carry file context.

Output: Bidirectional editor-board integration: editor pushes nodes directly via Zustand, board navigates to editor with file context.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/workbench/detection-workflow/use-swarm-launch.ts
@src/components/workbench/swarm-board/swarm-board-inspector.tsx
@src/features/swarm/stores/swarm-board-store.tsx
@src/features/swarm/swarm-board-types.ts

<interfaces>
<!-- From Plan 01 output: the Zustand store -->

From src/features/swarm/stores/swarm-board-store.tsx (post-migration):
```typescript
export const useSwarmBoardStore: UseBoundStore<StoreApi<SwarmBoardStoreState>>;
// Direct access: useSwarmBoardStore.getState().actions.addNode(config)
// Direct access: useSwarmBoardStore.getState().actions.addEdge(edge)
export function createBoardNode(config: CreateNodeConfig): Node<SwarmBoardNodeData>;
```

From src/components/workbench/swarm-board/swarm-board-inspector.tsx (line ~268):
```typescript
// Current placeholder navigations:
<TextAction label="Open in Editor" onClick={() => navigate("/editor")} />
<TextAction label="Run Lab" onClick={() => navigate("/lab")} />
```

From src/lib/workbench/detection-workflow/use-swarm-launch.ts:
```typescript
export interface SwarmLaunchPayload {
  nodes: ReturnType<typeof createBoardNode>[];
  edges: Array<{ id: string; source: string; target: string; type: "artifact" | "receipt"; label?: string; }>;
}
export function useSwarmLaunch(options: SwarmLaunchOptions): SwarmLaunchActions;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace DOM event bridge with direct Zustand store writes in useSwarmLaunch</name>
  <files>src/lib/workbench/detection-workflow/use-swarm-launch.ts, src/lib/workbench/detection-workflow/__tests__/use-swarm-launch-bridge.test.ts</files>
  <read_first>
    - src/lib/workbench/detection-workflow/use-swarm-launch.ts (full file)
    - src/lib/workbench/__tests__/use-swarm-launch.test.ts (existing tests for reference)
    - src/features/swarm/stores/swarm-board-store.tsx (Zustand store API from Plan 01)
  </read_first>
  <behavior>
    - Test 1: dispatchSwarmNodes calls useSwarmBoardStore.getState().actions.addNode for each node
    - Test 2: dispatchSwarmNodes calls useSwarmBoardStore.getState().actions.addEdge for each edge
    - Test 3: openReviewSwarm navigates to "/swarm-board" (not "/lab")
    - Test 4: openReviewSwarmWithEvidence navigates to "/swarm-board"
    - Test 5: openReviewSwarmWithRun navigates to "/swarm-board"
    - Test 6: openReviewSwarmWithPublication navigates to "/swarm-board"
    - Test 7: Nodes dispatched via Zustand are immediately visible in store state
    - Test 8: localStorage fallback is removed (no direct localStorage.setItem calls)
  </behavior>
  <action>
Rewrite the `dispatchSwarmNodes` function in use-swarm-launch.ts:

1. Remove the `window.dispatchEvent(new CustomEvent(SWARM_LAUNCH_EVENT, ...))` call entirely.

2. Remove the localStorage direct-write fallback entirely (the Zustand store handles its own persistence).

3. Replace with direct Zustand store writes:
```typescript
import { useSwarmBoardStore } from "@/features/swarm/stores/swarm-board-store";

function dispatchSwarmNodes(payload: SwarmLaunchPayload): void {
  const { actions } = useSwarmBoardStore.getState();
  for (const node of payload.nodes) {
    actions.addNode({ nodeType: node.type as SwarmNodeType, title: (node.data as SwarmBoardNodeData).title, position: node.position, data: node.data as Partial<SwarmBoardNodeData> });
  }
  for (const edge of payload.edges) {
    actions.addEdge(edge);
  }
}
```

Actually, since `buildPayload` already creates fully-formed nodes via `createBoardNode`, the dispatch should add those pre-built nodes directly. Check if the Zustand store's addNode can accept a pre-built Node (not just CreateNodeConfig). If not, add a `addNodeDirect(node: Node<SwarmBoardNodeData>)` action to the store (in Plan 01's file, but adjust here).

SIMPLER APPROACH: The Zustand store should have both `addNode(config)` which creates + adds, and the raw state setter. Use the underlying `set()` to push pre-built nodes:

```typescript
function dispatchSwarmNodes(payload: SwarmLaunchPayload): void {
  const store = useSwarmBoardStore.getState();
  // Add pre-built nodes directly
  for (const node of payload.nodes) {
    // Reuse the ADD_NODE logic: skip duplicates, append
    if (!store.nodes.some(n => n.id === node.id)) {
      useSwarmBoardStore.setState(state => ({
        nodes: [...state.nodes, node]
      }));
    }
  }
  for (const edge of payload.edges) {
    store.actions.addEdge(edge);
  }
}
```

4. Change ALL navigation targets from `"/lab"` to `"/swarm-board"` in the hook callbacks (lines 270, 303, 325, 351).

5. Keep the `SWARM_LAUNCH_EVENT` constant exported (used in existing test file) but mark it as deprecated with a comment.

6. Remove the `STORAGE_KEY` reference from this file (it was for the localStorage fallback).

7. Create test file at src/lib/workbench/detection-workflow/__tests__/use-swarm-launch-bridge.test.ts.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/lib/workbench/detection-workflow/__tests__/use-swarm-launch-bridge.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useSwarmBoardStore" src/lib/workbench/detection-workflow/use-swarm-launch.ts
    - grep -q "/swarm-board" src/lib/workbench/detection-workflow/use-swarm-launch.ts
    - grep -v "^//" src/lib/workbench/detection-workflow/use-swarm-launch.ts | grep -cv "/lab" | grep -q "." || true
    - grep -q "addNode\|addEdge\|getState" src/lib/workbench/detection-workflow/use-swarm-launch.ts
  </acceptance_criteria>
  <done>useSwarmLaunch writes directly to Zustand board store, navigates to /swarm-board, no DOM events or localStorage fallback</done>
</task>

<task type="auto">
  <name>Task 2: Wire board-to-editor reverse navigation in inspector</name>
  <files>src/components/workbench/swarm-board/swarm-board-inspector.tsx</files>
  <read_first>
    - src/components/workbench/swarm-board/swarm-board-inspector.tsx (full file)
    - src/features/swarm/swarm-board-types.ts (SwarmBoardNodeData fields for filePath, documentId)
    - src/lib/commands/file-commands.ts (for file opening pattern if available)
  </read_first>
  <action>
Update the SwarmBoardInspector to provide meaningful board-to-editor navigation:

1. Find the "Open in Editor" TextAction buttons (around lines 268, 277, 287).

2. For artifact nodes with `filePath`, navigate to `/editor` AND open the file. The pattern from the codebase is:
```typescript
// From file-commands.ts pattern:
navigate("/editor");
// Opening a file in the editor requires the multi-policy-store or file-open mechanism.
// For now, use URL search params to pass the file path:
navigate(`/editor?file=${encodeURIComponent(d.filePath)}`);
```

Check how the editor route handles incoming file params. If the editor reads `searchParams.get("file")`, use that. Otherwise, use the command registry pattern:
```typescript
import { useCommandRegistry } from "@/features/commands/command-store";
// Then: commandRegistry.execute("file.open", { path: d.filePath });
```

If neither pattern is established, simply navigate to `/editor` with the file path as a search param. The editor can pick this up later (incremental improvement).

3. For receipt nodes, the "View Details" action should select the node and open the inspector (already works).

4. For diff nodes, navigate to the editor with the first file in diffSummary.files.

5. For agent session nodes with filesTouched, "Open in Editor" should navigate to the first file.

6. Add a "View on Board" reverse action: when navigating FROM the editor TO the board, pass the node ID as a search param so the board auto-selects and zooms to it:
```typescript
navigate(`/swarm-board?focus=${nodeId}`);
```
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/components/workbench/swarm-board/__tests__/swarm-board-inspector.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "filePath\|file=" src/components/workbench/swarm-board/swarm-board-inspector.tsx
    - grep -q "/editor" src/components/workbench/swarm-board/swarm-board-inspector.tsx
    - grep -q "encodeURIComponent\|documentId\|filePath" src/components/workbench/swarm-board/swarm-board-inspector.tsx
  </acceptance_criteria>
  <done>Inspector "Open in Editor" buttons carry file context, artifact nodes navigate with filePath, session nodes navigate with first fileTouched</done>
</task>

</tasks>

<verification>
1. Bridge tests pass: `npx vitest run src/lib/workbench/detection-workflow/__tests__/use-swarm-launch-bridge.test.ts`
2. Inspector tests pass: `npx vitest run src/components/workbench/swarm-board/__tests__/swarm-board-inspector.test.tsx`
3. No references to `"/lab"` remain in use-swarm-launch.ts (replaced with `/swarm-board`)
4. TypeScript compiles: `npx tsc --noEmit --pretty 2>&1 | head -20`
</verification>

<success_criteria>
- useSwarmLaunch writes directly to Zustand store (no DOM events, no localStorage fallback)
- Navigation targets changed from /lab to /swarm-board
- Inspector "Open in Editor" buttons carry file path context
- Bidirectional: editor -> board (nodes appear), board -> editor (file opens)
</success_criteria>

<output>
After completion, create `.planning/phases/track-b-swarm/track-b-swarm-02-SUMMARY.md`
</output>
