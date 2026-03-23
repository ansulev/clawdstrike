# Phase 13: Real-Time Swarm Visualization - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Live agent coordination visible on the swarm board graph — agent nodes pulse when evaluating policy, receipts animate as flowing edges, trust graph updates in real-time, and clicking a receipt edge opens an inspector pane tab.

</domain>

<decisions>
## Implementation Decisions

### Animation & Visual Style
- Agent nodes pulse with CSS keyframe glow ring (gold #d4a84b, 2s fade-in/out) when evaluating a policy
- Receipt edges animate with SVG dash-offset flowing source→target (purple receipt edge color, 1.5s cycle)
- Trust graph updates animate node entry/exit with fade+scale transitions via React Flow built-in capabilities
- Live updates driven by InProcessEventBus events from SwarmCoordinator — no SSE needed for local swarms

### Receipt Inspector
- Opens as pane tab at route `/receipt/{receiptId}` — consistent with IDE tab pattern
- Inspector shows receipt fields: verdict, policy hash, evidence summary, timestamp, Ed25519 signature in a readonly formatted panel
- Edge click handler: `onEdgeClick` on receipt-type edges → `usePaneStore.openApp("/receipt/{id}", "Receipt {shortId}")`
- Receipt data sourced from receipt-feed-store (existing Zustand store) or passed via route state

### Claude's Discretion
- Exact CSS keyframe timing curves and glow radius
- Receipt inspector layout details (field ordering, typography)
- Edge animation dash-array values and stroke width
- React Flow node/edge type registration patterns

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SwarmBoardCanvas` at `components/workbench/swarm-board/swarm-board-page.tsx` — ReactFlow canvas with custom nodeTypes/edgeTypes
- `useReceiptFlowBridge()` hook — adds receipt nodes from feed store to board
- `useCoordinatorBoardBridge(coordinator)` hook — registers onIntelReceived/onDetectionReceived handlers
- `SwarmCoordinator` singleton at `features/swarm/coordinator-instance.ts` — InProcessEventBus
- `swarmEdge` custom edge type in `components/workbench/swarm-board/edges/`
- `receipt` node type in `components/workbench/swarm-board/nodes/`
- `usePaneStore.openApp(route, label)` — opens new pane tab with dedup
- Edge types defined: `handoff` (blue), `spawned` (gold, animated), `artifact` (green), `receipt` (purple)

### Established Patterns
- Custom React Flow node components in `nodes/` subdirectory
- Custom edge components in `edges/` subdirectory with SVG path rendering
- `SwarmBoardStoreState.actions` for imperative board mutations
- CSS animations via Tailwind `animate-*` classes or inline `@keyframes`

### Integration Points
- `SwarmBoardCanvas` `onEdgeClick` prop — wire receipt edge clicks to inspector
- `SwarmCoordinator.onPolicyEvaluated` event (or equivalent) — trigger node glow
- `swarm-board-store.actions.addNode/removeNode` — dynamic trust graph updates
- `workbench-routes.tsx` — register `/receipt/:id` route for inspector

</code_context>

<specifics>
## Specific Ideas

- The `spawned` edge type already has animation (`animated: true` in React Flow) — use similar pattern for receipt edges
- Node glow can be a CSS class toggled via data attribute on the React Flow node wrapper
- Receipt inspector is a lightweight readonly component — simpler than finding detail page

</specifics>

<deferred>
## Deferred Ideas

- Networked swarm visualization (Gossipsub transport) — requires transport adapter swap
- Receipt chain verification (verify Ed25519 signature chain in inspector)
- Swarm replay (scrub through historical swarm session)
- 3D force-directed graph layout (R3F integration from huntronomer)

</deferred>
