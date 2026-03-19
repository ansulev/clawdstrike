---
phase: track-b-swarm
plan: 04
type: execute
wave: 3
depends_on: [track-b-swarm-03]
files_modified:
  - src/features/swarm/hooks/use-coordinator-board-bridge.ts
  - src/features/swarm/hooks/use-receipt-flow-bridge.ts
  - src/features/swarm/hooks/__tests__/use-receipt-flow-bridge.test.ts
  - src/components/workbench/swarm-board/swarm-board-page.tsx
  - src/components/workbench/swarm-board/edges/swarm-edge.tsx
autonomous: true
requirements: [SWARM-05, SWARM-06, SWARM-07]

must_haves:
  truths:
    - "When a session produces a receipt (via coordinator or feed), a receipt node auto-appears on the board linked to the session"
    - "Active coordination edges pulse with animated gradient showing message flow direction"
    - "Stats bar shows live coordinator connection status and message throughput"
    - "Receipt nodes created from live sessions show real guard results and verdict"
  artifacts:
    - path: "src/features/swarm/hooks/use-receipt-flow-bridge.ts"
      provides: "Hook bridging receipt events from feed store to board receipt nodes"
      exports: ["useReceiptFlowBridge"]
    - path: "src/features/swarm/hooks/__tests__/use-receipt-flow-bridge.test.ts"
      provides: "Tests for receipt flow bridge"
    - path: "src/components/workbench/swarm-board/edges/swarm-edge.tsx"
      provides: "Enhanced edge with live activity pulse animation"
  key_links:
    - from: "src/features/swarm/hooks/use-receipt-flow-bridge.ts"
      to: "src/features/swarm/stores/swarm-feed-store.tsx"
      via: "subscribe to findings changes"
      pattern: "useSwarmFeedStore\\.subscribe|findings"
    - from: "src/features/swarm/hooks/use-receipt-flow-bridge.ts"
      to: "src/features/swarm/stores/swarm-board-store.tsx"
      via: "create receipt nodes and edges"
      pattern: "useSwarmBoardStore\\.getState.*actions\\.addNode"
    - from: "src/components/workbench/swarm-board/edges/swarm-edge.tsx"
      to: "src/features/swarm/hooks/use-coordinator-board-bridge.ts"
      via: "edge data carries activity timestamp for pulse animation"
      pattern: "lastActivityAt|activityPulse"
---

<objective>
Add real-time receipt flow visualization, live edge animations for active coordination, and stats integration for the swarm board.

Purpose: The board currently shows static receipt nodes created manually. This plan makes receipts appear automatically when sessions produce them, adds visual life to coordination edges, and surfaces coordinator health in the stats bar -- making the board a true real-time operations dashboard.

Output: Receipt nodes auto-created from session activity, pulsing edges showing active message flow, enhanced stats bar with coordinator status.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/swarm/hooks/use-coordinator-board-bridge.ts
@src/features/swarm/stores/swarm-feed-store.tsx
@src/features/swarm/stores/swarm-board-store.tsx
@src/components/workbench/swarm-board/nodes/receipt-node.tsx
@src/components/workbench/swarm-board/swarm-board-page.tsx
@src/lib/workbench/detection-workflow/swarm-receipt-linking.ts

<interfaces>
<!-- Receipt-related types and APIs -->

From src/features/swarm/swarm-board-types.ts:
```typescript
export interface SwarmBoardNodeData {
  verdict?: "allow" | "deny" | "warn";
  guardResults?: Array<{ guard: string; allowed: boolean; duration_ms?: number }>;
  sessionId?: string;
  receiptCount?: number;
  // ...
}
```

From src/features/swarm/stores/swarm-feed-store.tsx:
```typescript
export interface SwarmFindingEnvelopeRecord {
  swarmId: string;
  envelope: FindingEnvelope;
  receivedAt: number;
  digest?: ProtocolDigest;
}
// Store has: findings[], actions.ingestFinding()
```

From src/components/workbench/swarm-board/edges/swarm-edge.tsx (existing):
```typescript
// SwarmEdge component with type-based styling, hover-reveal, midpoint dots
// Edge types: handoff (solid gold), spawned (dashed blue animated), artifact (dotted green), receipt (thin dotted muted)
```

From src/features/swarm/swarm-coordinator.ts:
```typescript
export class SwarmCoordinator {
  get isConnected: boolean;
  get outboxSize: number;
  get joinedSwarmIds: string[];
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create receipt flow bridge hook</name>
  <files>src/features/swarm/hooks/use-receipt-flow-bridge.ts, src/features/swarm/hooks/__tests__/use-receipt-flow-bridge.test.ts</files>
  <read_first>
    - src/features/swarm/stores/swarm-feed-store.tsx (first 120 lines -- findings state shape and actions)
    - src/features/swarm/stores/swarm-board-store.tsx (Zustand store -- addNode, addEdge actions)
    - src/components/workbench/swarm-board/nodes/receipt-node.tsx (receipt node visual for data shape reference)
    - src/lib/workbench/detection-workflow/swarm-receipt-linking.ts (existing receipt linking pattern)
    - src/features/swarm/swarm-board-types.ts (SwarmBoardNodeData receipt fields)
  </read_first>
  <behavior>
    - Test 1: When a new finding is ingested into swarm-feed-store, a receipt node is created on the board
    - Test 2: Receipt node has correct verdict extracted from finding envelope
    - Test 3: Receipt node is linked to the source agent session node via a "receipt" edge
    - Test 4: Agent session node's receiptCount is incremented when a receipt is created
    - Test 5: Duplicate findings (same digest) do not create duplicate receipt nodes
    - Test 6: Receipt node is positioned below the source session node
    - Test 7: On unmount, the subscription is cleaned up
  </behavior>
  <action>
Create src/features/swarm/hooks/use-receipt-flow-bridge.ts:

```typescript
import { useEffect, useRef } from "react";
import { useSwarmBoardStore } from "@/features/swarm/stores/swarm-board-store";
// Import the feed store -- check if it exports a Zustand store or uses a different pattern
```

The hook:
```typescript
export function useReceiptFlowBridge(): void;
```

Implementation approach:

1. Subscribe to the swarm-feed-store's `findings` array. When it grows (new findings appended), process the new entries.

2. Track `processedDigests` in a `useRef<Set<string>>` to avoid duplicating receipt nodes on re-renders.

3. For each new finding:
   a. Extract the verdict from the finding envelope. The FindingEnvelope from swarm-protocol.ts has a payload with assessment data. Map it to "allow" | "deny" | "warn" based on the finding's trust policy evaluation result.

   b. Extract guard results if available in the finding metadata.

   c. Find the source agent session node: look for an agentSession node on the board whose `huntId` matches the finding's swarmId, or whose `sessionId` is referenced.

   d. Create a receipt node:
   ```typescript
   const receiptNode = actions.addNode({
     nodeType: "receipt",
     title: `Receipt: ${verdict.toUpperCase()}`,
     position: { x: sessionNode.position.x, y: sessionNode.position.y + 340 },
     data: {
       verdict,
       guardResults,
       sessionId: sessionNode.data.sessionId,
       status: "completed",
     },
   });
   ```

   e. Create a receipt edge from the session to the receipt:
   ```typescript
   actions.addEdge({
     id: `edge-receipt-${receiptNode.id}-${sessionNode.id}`,
     source: sessionNode.id,
     target: receiptNode.id,
     type: "receipt",
     label: verdict,
   });
   ```

   f. Increment the session's receiptCount:
   ```typescript
   actions.updateNode(sessionNode.id, {
     receiptCount: (sessionNode.data.receiptCount ?? 0) + 1,
   });
   ```

4. Use zustand's `subscribe` with selector for `findings.length` to trigger processing only when new findings arrive.

5. Cleanup: unsubscribe on unmount.

Create test file with mock stores and verify all behavior tests.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/features/swarm/hooks/__tests__/use-receipt-flow-bridge.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useReceiptFlowBridge" src/features/swarm/hooks/use-receipt-flow-bridge.ts
    - grep -q "receipt" src/features/swarm/hooks/use-receipt-flow-bridge.ts
    - grep -q "addNode" src/features/swarm/hooks/use-receipt-flow-bridge.ts
    - grep -q "addEdge" src/features/swarm/hooks/use-receipt-flow-bridge.ts
    - grep -q "receiptCount" src/features/swarm/hooks/use-receipt-flow-bridge.ts
    - grep -q "processedDigests\|processed" src/features/swarm/hooks/use-receipt-flow-bridge.ts
  </acceptance_criteria>
  <done>Receipt flow bridge creates receipt nodes from feed store findings, links them to sessions, increments receiptCount, deduplicates</done>
</task>

<task type="auto">
  <name>Task 2: Add live edge activity pulse and integrate hooks into board page</name>
  <files>src/components/workbench/swarm-board/edges/swarm-edge.tsx, src/components/workbench/swarm-board/swarm-board-page.tsx</files>
  <read_first>
    - src/components/workbench/swarm-board/edges/swarm-edge.tsx (existing edge component -- full file)
    - src/components/workbench/swarm-board/swarm-board-page.tsx (full file -- SwarmBoardStatsBar at bottom)
    - src/features/swarm/hooks/use-coordinator-board-bridge.ts (coordinator bridge from Plan 03)
    - src/features/swarm/hooks/use-receipt-flow-bridge.ts (receipt bridge from Task 1)
  </read_first>
  <action>
Two changes in this task:

**A. Enhance SwarmEdge with activity pulse animation:**

1. Read the existing swarm-edge.tsx. It already has a `swarmEdgePulse` animation for "spawned" type edges.

2. Add a new activity-aware pulse: when `data.lastActivityAt` is within the last 3 seconds, apply a brighter pulse animation to the edge stroke. This signals "this connection just carried a message."

3. The coordinator-board-bridge (Plan 03) should be updated to set `lastActivityAt` on edges when messages flow. Add to use-coordinator-board-bridge.ts:
   - After creating a new node from an intel/detection message, find edges connected to the source session and update them:
   ```typescript
   // Mark the edge as recently active
   const edges = useSwarmBoardStore.getState().edges;
   const activeEdge = edges.find(e => e.source === sessionNodeId && e.target === newNodeId);
   // Store activity timestamp in edge data (extend SwarmBoardEdge type if needed)
   ```

   Actually, React Flow edges don't easily carry mutable data that triggers re-renders. Instead, use a simpler approach:

   - Add an `activeEdgeIds` set to the coordinator bridge hook (or a small Zustand atom).
   - When a message creates/updates a node, add the relevant edge ID to `activeEdgeIds`.
   - After 3 seconds, remove it.
   - Pass `activeEdgeIds` through edge data in swarm-board-page.tsx's `enrichedEdges` computation.
   - In SwarmEdge, if the edge ID is in activeEdgeIds, render with the pulse effect.

4. The pulse effect: Add a CSS animation to the edge path that fades a brighter stroke color:
```css
@keyframes edgeActivityPulse {
  0% { stroke-opacity: 0.4; stroke-width: 1; }
  50% { stroke-opacity: 1; stroke-width: 2.5; }
  100% { stroke-opacity: 0.4; stroke-width: 1; }
}
```
Apply when active. Duration: 1.5s, ease-in-out.

**B. Integrate receipt flow bridge + coordinator status in SwarmBoardPage:**

1. In `SwarmBoardCanvas`, add:
```typescript
import { useReceiptFlowBridge } from "@/features/swarm/hooks/use-receipt-flow-bridge";
useReceiptFlowBridge();
```

2. Update `SwarmBoardStatsBar` to show coordinator status. Add props:
   - `coordinatorConnected: boolean`
   - `outboxSize: number`
   - `joinedSwarms: number`

3. In SwarmBoardCanvas, read coordinator state and pass to stats bar:
```typescript
const coordinatorConnected = coordinator?.isConnected ?? false;
const outboxSize = coordinator?.outboxSize ?? 0;
const joinedSwarms = coordinator?.joinedSwarmIds.length ?? 0;
```

4. In SwarmBoardStatsBar, add segments:
   - If connected and joinedSwarms > 0: `"{joinedSwarms} swarm(s)"` in green
   - If outboxSize > 0: `"{outboxSize} queued"` in amber
   - If not connected: `"offline"` in muted red

5. The stats bar already has the dot-separated segment pattern. Follow the same style.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/components/workbench/swarm-board/__tests__/ --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useReceiptFlowBridge" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "coordinatorConnected\|outboxSize\|joinedSwarm" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "edgeActivityPulse\|activeEdge\|lastActivity" src/components/workbench/swarm-board/edges/swarm-edge.tsx
    - grep -q "offline\|queued\|swarm" src/components/workbench/swarm-board/swarm-board-page.tsx
  </acceptance_criteria>
  <done>Receipt flow bridge integrated, edge activity pulse animation working, stats bar shows coordinator connection status and swarm count</done>
</task>

</tasks>

<verification>
1. Receipt flow tests pass: `npx vitest run src/features/swarm/hooks/__tests__/use-receipt-flow-bridge.test.ts`
2. All swarm board tests pass: `npx vitest run src/components/workbench/swarm-board/__tests__/`
3. TypeScript compiles: `npx tsc --noEmit --pretty 2>&1 | head -20`
4. Edge pulse animation renders (visual verification in browser if available)
</verification>

<success_criteria>
- Receipt nodes auto-created when feed store ingests findings
- Receipt nodes linked to source sessions with receipt edges
- Session receiptCount incremented automatically
- Edges pulse when carrying active messages
- Stats bar shows coordinator status (connected/offline, swarm count, queue size)
- No duplicate receipt nodes from repeated findings
</success_criteria>

<output>
After completion, create `.planning/phases/track-b-swarm/track-b-swarm-04-SUMMARY.md`
</output>
