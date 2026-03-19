---
phase: track-b-swarm
plan: 03
type: execute
wave: 2
depends_on: [track-b-swarm-01]
files_modified:
  - src/features/swarm/hooks/use-coordinator-board-bridge.ts
  - src/features/swarm/hooks/__tests__/use-coordinator-board-bridge.test.ts
  - src/components/workbench/swarm-board/swarm-board-page.tsx
autonomous: true
requirements: [SWARM-03, SWARM-04]

must_haves:
  truths:
    - "When SwarmCoordinator receives an intel message, a new artifact node appears on the board"
    - "When SwarmCoordinator receives a detection message, a new artifact node appears on the board"
    - "When SwarmCoordinator receives a coordination message, the relevant board node is updated"
    - "Auto-created nodes are positioned relative to existing swarm nodes (not stacked at origin)"
    - "Message handlers are registered on mount and unregistered on unmount (no leaks)"
  artifacts:
    - path: "src/features/swarm/hooks/use-coordinator-board-bridge.ts"
      provides: "React hook bridging SwarmCoordinator messages to board store"
      exports: ["useCoordinatorBoardBridge"]
    - path: "src/features/swarm/hooks/__tests__/use-coordinator-board-bridge.test.ts"
      provides: "Unit tests for the coordinator-board bridge"
  key_links:
    - from: "src/features/swarm/hooks/use-coordinator-board-bridge.ts"
      to: "src/features/swarm/swarm-coordinator.ts"
      via: "coordinator.onIntelReceived / onDetectionReceived handlers"
      pattern: "onIntelReceived|onDetectionReceived"
    - from: "src/features/swarm/hooks/use-coordinator-board-bridge.ts"
      to: "src/features/swarm/stores/swarm-board-store.tsx"
      via: "useSwarmBoardStore.getState().actions"
      pattern: "useSwarmBoardStore\\.getState"
    - from: "src/components/workbench/swarm-board/swarm-board-page.tsx"
      to: "src/features/swarm/hooks/use-coordinator-board-bridge.ts"
      via: "useCoordinatorBoardBridge() call in SwarmBoardCanvas"
      pattern: "useCoordinatorBoardBridge"
---

<objective>
Wire SwarmCoordinator's typed message handlers (onIntelReceived, onDetectionReceived, onSignalReceived) to the Zustand board store so that protocol-layer messages automatically create or update board nodes in real-time.

Purpose: The SwarmCoordinator has full typed pub/sub for intel, signal, and detection messages, but nothing connects those handlers to the board graph. This is the key Track B integration -- making the board a live visualization of swarm activity.

Output: A React hook (`useCoordinatorBoardBridge`) that registers coordinator message handlers and routes them to board store actions, plus integration into SwarmBoardPage.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/swarm/swarm-coordinator.ts
@src/features/swarm/stores/swarm-board-store.tsx
@src/features/swarm/swarm-board-types.ts
@src/features/swarm/stores/swarm-feed-store.tsx
@src/components/workbench/swarm-board/swarm-board-page.tsx

<interfaces>
<!-- SwarmCoordinator handler registration API -->

From src/features/swarm/swarm-coordinator.ts:
```typescript
export type IntelHandler = (swarmId: string, intel: Intel) => void;
export type DetectionHandler = (swarmId: string, detection: DetectionMessage) => void;
export type SignalHandler = (swarmId: string, signal: Signal) => void;

export class SwarmCoordinator {
  onIntelReceived(handler: IntelHandler): void;
  offIntelReceived(handler: IntelHandler): void;
  onDetectionReceived(handler: DetectionHandler): void;
  offDetectionReceived(handler: DetectionHandler): void;
  onSignalReceived(handler: SignalHandler): void;
  offSignalReceived(handler: SignalHandler): void;
  get joinedSwarmIds(): string[];
  get isConnected: boolean;
}

export interface DetectionMessage {
  ruleId: string;
  action: "publish" | "update" | "deprecate";
  format: "sigma" | "yara" | "clawdstrike_pattern" | "policy_patch";
  content: string;
  contentHash: string;
  ruleVersion: number;
  authorFingerprint: string;
  confidence: number;
}

export interface SwarmEnvelope {
  version: 1;
  type: "intel" | "signal" | "detection" | "coordination" | "status";
  payload: unknown;
  ttl: number;
  created: number;
}
```

From src/features/swarm/stores/swarm-board-store.tsx (post Plan 01):
```typescript
export const useSwarmBoardStore; // Zustand store
// useSwarmBoardStore.getState().actions.addNode(config)
// useSwarmBoardStore.getState().actions.addEdge(edge)
// useSwarmBoardStore.getState().actions.updateNode(nodeId, patch)
// useSwarmBoardStore.getState().nodes -- current nodes array
```

From sentinel-types (Intel type):
```typescript
export interface Intel {
  id: string;
  type: string;
  severity: string;
  confidence: number;
  // ... other fields
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create useCoordinatorBoardBridge hook</name>
  <files>src/features/swarm/hooks/use-coordinator-board-bridge.ts, src/features/swarm/hooks/__tests__/use-coordinator-board-bridge.test.ts</files>
  <read_first>
    - src/features/swarm/swarm-coordinator.ts (full file -- handler registration API)
    - src/features/swarm/stores/swarm-board-store.tsx (Zustand store actions)
    - src/features/swarm/swarm-board-types.ts (node types and SwarmBoardNodeData)
    - src/lib/workbench/detection-workflow/swarm-detection-nodes.ts (existing node factory patterns)
  </read_first>
  <behavior>
    - Test 1: When intel is received, an artifact node with the intel's ID is added to the board
    - Test 2: When detection is received with action "publish", an artifact node with artifactKind="detection_rule" is added
    - Test 3: When detection is received with action "update", existing detection node is updated (not duplicated)
    - Test 4: When detection is received with action "deprecate", existing detection node status is set to "completed"
    - Test 5: Duplicate intel messages (same ID) do not create duplicate nodes
    - Test 6: Auto-positioned nodes offset from the rightmost existing node (not stacked at origin)
    - Test 7: On unmount, all handlers are unregistered from the coordinator
    - Test 8: When coordinator is null/undefined, hook is a no-op (no errors)
    - Test 9: Edge is created between the source agent session node and the new intel/detection node when swarmId matches a session's huntId
  </behavior>
  <action>
Create the file src/features/swarm/hooks/use-coordinator-board-bridge.ts:

```typescript
import { useEffect, useRef } from "react";
import type { SwarmCoordinator, IntelHandler, DetectionHandler, DetectionMessage } from "@/features/swarm/swarm-coordinator";
import { useSwarmBoardStore } from "@/features/swarm/stores/swarm-board-store";
import type { SwarmBoardNodeData } from "@/features/swarm/swarm-board-types";
import type { Intel } from "@/lib/workbench/sentinel-types";
```

The hook signature:
```typescript
export function useCoordinatorBoardBridge(coordinator: SwarmCoordinator | null): void;
```

Implementation:

1. Use `useEffect` with the coordinator as dependency. Inside:

2. **Intel handler**: When `onIntelReceived(swarmId, intel)` fires:
   - Check if a node with matching intel ID already exists: `store.nodes.some(n => n.data.documentId === intel.id)`. Skip if exists.
   - Calculate position: find the rightmost node on the board, place the new node 80px to the right and slightly below.
   - Create an artifact node via `actions.addNode({ nodeType: "artifact", title: intel.type || "Intel", position, data: { artifactKind: "detection_rule", documentId: intel.id, status: "idle", confidence: intel.confidence } })`.
   - If there's an agent session node whose `huntId` matches the swarmId, create an edge from that session to the new node: `actions.addEdge({ id: \`edge-intel-...\`, source: sessionNode.id, target: newNode.id, type: "artifact", label: "intel" })`.

3. **Detection handler**: When `onDetectionReceived(swarmId, detection)` fires:
   - If `detection.action === "publish"`: Create a new artifact node like intel, but with `format: detection.format`, `content: detection.content`.
   - If `detection.action === "update"`: Find existing node by `documentId === detection.ruleId`, call `actions.updateNode(nodeId, { confidence: detection.confidence, content: detection.content })`.
   - If `detection.action === "deprecate"`: Find existing node, set `status: "completed"`.

4. **Position calculation helper**:
```typescript
function nextNodePosition(nodes: Array<{ position: { x: number; y: number } }>): { x: number; y: number } {
  if (nodes.length === 0) return { x: 200, y: 200 };
  const maxX = Math.max(...nodes.map(n => n.position.x));
  const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;
  return { x: maxX + 320, y: avgY + (Math.random() - 0.5) * 100 };
}
```

5. **Cleanup**: In the useEffect cleanup, call `coordinator.offIntelReceived(handler)` and `coordinator.offDetectionReceived(handler)`.

6. Use `useRef` to hold stable handler references so cleanup works correctly.

Create the test file at src/features/swarm/hooks/__tests__/use-coordinator-board-bridge.test.ts using a mock SwarmCoordinator (mock onIntelReceived, onDetectionReceived, offIntelReceived, offDetectionReceived) and mock Zustand store state.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/features/swarm/hooks/__tests__/use-coordinator-board-bridge.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useCoordinatorBoardBridge" src/features/swarm/hooks/use-coordinator-board-bridge.ts
    - grep -q "onIntelReceived" src/features/swarm/hooks/use-coordinator-board-bridge.ts
    - grep -q "onDetectionReceived" src/features/swarm/hooks/use-coordinator-board-bridge.ts
    - grep -q "offIntelReceived" src/features/swarm/hooks/use-coordinator-board-bridge.ts
    - grep -q "useSwarmBoardStore" src/features/swarm/hooks/use-coordinator-board-bridge.ts
    - grep -q "addNode\|addEdge" src/features/swarm/hooks/use-coordinator-board-bridge.ts
  </acceptance_criteria>
  <done>useCoordinatorBoardBridge hook registers intel/detection handlers on the coordinator and routes them to board store actions, with proper cleanup on unmount</done>
</task>

<task type="auto">
  <name>Task 2: Integrate bridge hook into SwarmBoardPage</name>
  <files>src/components/workbench/swarm-board/swarm-board-page.tsx</files>
  <read_first>
    - src/components/workbench/swarm-board/swarm-board-page.tsx (full file)
    - src/features/swarm/hooks/use-coordinator-board-bridge.ts (hook from Task 1)
  </read_first>
  <action>
Add the coordinator bridge to SwarmBoardCanvas:

1. In the `SwarmBoardCanvas` function component, after the existing hooks, add:
```typescript
import { useCoordinatorBoardBridge } from "@/features/swarm/hooks/use-coordinator-board-bridge";
```

2. The coordinator instance needs to be accessible. Check if there's a coordinator context or singleton. From the research, the SwarmCoordinator is a class, likely instantiated somewhere. Options:
   - If a coordinator is available via a React context or store, use that.
   - If not, create a module-level singleton pattern (lazy init) or accept null (the hook handles null gracefully).

Look for coordinator usage patterns in the codebase. If no coordinator is instantiated yet (it's built but not wired), create a lightweight singleton:
```typescript
// In swarm-board-page.tsx or a new file:
const coordinator = useMemo(() => {
  // Only create for local-only swarms (InProcessEventBus)
  const bus = new InProcessEventBus();
  return new SwarmCoordinator(bus);
}, []);
```

3. Call the hook:
```typescript
useCoordinatorBoardBridge(coordinator);
```

4. This should be the ONLY change to SwarmBoardPage. The hook manages its own lifecycle.

5. If creating a coordinator singleton, place it in a new file `src/features/swarm/coordinator-instance.ts` to avoid polluting the page component. Export a `getCoordinator()` function.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/components/workbench/swarm-board/__tests__/swarm-board-page.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useCoordinatorBoardBridge" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "SwarmCoordinator\|coordinator" src/components/workbench/swarm-board/swarm-board-page.tsx
  </acceptance_criteria>
  <done>SwarmBoardPage calls useCoordinatorBoardBridge, coordinator messages now create/update board nodes in real-time</done>
</task>

</tasks>

<verification>
1. Bridge tests pass: `npx vitest run src/features/swarm/hooks/__tests__/use-coordinator-board-bridge.test.ts`
2. Page tests still pass: `npx vitest run src/components/workbench/swarm-board/__tests__/swarm-board-page.test.tsx`
3. TypeScript compiles: `npx tsc --noEmit --pretty 2>&1 | head -20`
4. Hook registers and unregisters handlers (verified in tests)
</verification>

<success_criteria>
- Coordinator intel messages create artifact nodes on the board
- Coordinator detection messages create/update/deprecate artifact nodes
- Duplicate messages are deduplicated (no double nodes)
- Auto-positioning places new nodes relative to existing ones
- Handlers are properly cleaned up on unmount
- SwarmBoardPage integrates the hook
</success_criteria>

<output>
After completion, create `.planning/phases/track-b-swarm/track-b-swarm-03-SUMMARY.md`
</output>
