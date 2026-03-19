---
phase: track-a-fleet
plan: 02
type: execute
wave: 2
depends_on: [track-a-fleet-01]
files_modified:
  - apps/workbench/src/components/workbench/fleet/fleet-agent-detail.tsx
  - apps/workbench/src/components/workbench/fleet/fleet-topology-view.tsx
  - apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
  - apps/workbench/src/components/desktop/workbench-routes.tsx
  - apps/workbench/src/components/workbench/fleet/__tests__/fleet-agent-detail.test.tsx
  - apps/workbench/src/components/workbench/fleet/__tests__/fleet-topology.test.tsx
autonomous: false
requirements: [FLEET-05, FLEET-06, FLEET-07, FLEET-08]

must_haves:
  truths:
    - "Topology view shows agents as nodes with edges representing trust relationships"
    - "Agent detail panel shows full config, recent receipts, and policy diff"
    - "Push Policy button deploys the active policy to selected agents with confirmation dialog"
    - "Bulk select agents for batch policy push, restart, or retire operations"
  artifacts:
    - path: "apps/workbench/src/components/workbench/fleet/fleet-agent-detail.tsx"
      provides: "Full agent detail page accessible via /fleet/:id route"
      exports: ["FleetAgentDetail"]
    - path: "apps/workbench/src/components/workbench/fleet/fleet-topology-view.tsx"
      provides: "SVG canvas topology visualization of fleet agents"
      exports: ["FleetTopologyView"]
    - path: "apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx"
      provides: "Enhanced dashboard with SSE indicator, bulk select, quick deploy, topology tab"
      contains: ["sseState", "bulkSelect", "handleBulkDeploy"]
    - path: "apps/workbench/src/components/desktop/workbench-routes.tsx"
      provides: "New route for fleet/:id agent detail"
      contains: "fleet/:id"
  key_links:
    - from: "fleet-dashboard.tsx"
      to: "fleet-agent-detail.tsx"
      via: "pane navigation via openApp('/fleet/' + agentId)"
      pattern: "openApp.*fleet/"
    - from: "fleet-dashboard.tsx"
      to: "deploy-panel.tsx"
      via: "Quick Deploy button opens deploy dialog pre-filled with drift context"
      pattern: "deployPolicy|validateRemotely"
    - from: "fleet-dashboard.tsx"
      to: "use-fleet-connection.ts"
      via: "reads sseState for connection indicator"
      pattern: "sseState"
    - from: "fleet-agent-detail.tsx"
      to: "fleet-client.ts"
      via: "fetchAuditEvents + fetchReceipts for per-agent data"
      pattern: "fetchAuditEvents|fetchReceipts"
    - from: "fleet-topology-view.tsx"
      to: "use-fleet-connection.ts"
      via: "reads agents array for node layout"
      pattern: "useFleetConnectionStore"
---

<objective>
Build fleet visualization, agent detail page, and action controls on top of the live data layer.

Purpose: With real-time data flowing (Plan 01), this plan adds the operational surfaces: a topology view showing agent relationships, a detailed agent inspector with receipts and policy diff, one-click policy push with confirmation, and bulk agent operations. This transforms the fleet dashboard from "status monitor" to "operations center."

Output: Three new/enhanced components (topology, agent detail, dashboard actions), one new route, and a visual verification checkpoint.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/track-a-fleet/RESEARCH.md
@.planning/phases/track-a-fleet/track-a-fleet-01-SUMMARY.md

<interfaces>
<!-- Types from Plan 01 that this plan depends on -->

From apps/workbench/src/features/fleet/use-fleet-connection.ts (after Plan 01):
```typescript
export interface FleetConnectionState {
  connection: FleetConnectionInfo;
  isConnecting: boolean;
  error: string | null;
  pollError: string | null;
  secureStorageWarning: boolean;
  agents: AgentInfo[];
  remotePolicyInfo: RemotePolicyInfo | null;
  sseState: "idle" | "connecting" | "connected" | "disconnected" | "error";
}
```

From apps/workbench/src/features/fleet/fleet-client.ts:
```typescript
export interface AgentInfo {
  endpoint_agent_id: string;
  last_heartbeat_at: string;
  last_seen_ip?: string;
  last_session_id?: string;
  posture?: string;
  policy_version?: string;
  daemon_version?: string;
  runtime_count?: number;
  seconds_since_heartbeat?: number;
  online: boolean;
  drift: AgentDriftFlags;
}

export async function fetchAuditEvents(conn: FleetConnection, filters?: AuditFilters): Promise<AuditEvent[]>;
export async function fetchReceipts(conn: FleetConnection, opts?: { agent_id?: string; limit?: number }): Promise<FleetReceiptListResponse>;
export async function deployPolicy(conn: FleetConnection, yaml: string): Promise<DeployResponse>;
export async function validateRemotely(conn: FleetConnection, yaml: string): Promise<ValidateResponse>;
```

From apps/workbench/src/components/workbench/editor/deploy-panel.tsx:
```typescript
// Existing deploy confirmation pattern with type-to-confirm
const CONFIRM_TEXT = "deploy";
// Uses Dialog, DialogContent, DialogHeader, etc. from @/components/ui/dialog
```

From apps/workbench/src/features/panes/pane-store.ts:
```typescript
// Navigation pattern
usePaneStore.getState().openApp("/fleet/" + agentId, agentId);
```

From apps/workbench/src/components/desktop/workbench-routes.tsx:
```typescript
// Route pattern for parameterized routes
{ path: "sentinels/:id", element: <SentinelDetailPage /> }
{ path: "findings/:id", element: <FindingDetailPage /> }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Agent detail page + fleet topology view + route registration</name>
  <files>
    apps/workbench/src/components/workbench/fleet/fleet-agent-detail.tsx,
    apps/workbench/src/components/workbench/fleet/fleet-topology-view.tsx,
    apps/workbench/src/components/desktop/workbench-routes.tsx,
    apps/workbench/src/components/workbench/fleet/__tests__/fleet-agent-detail.test.tsx,
    apps/workbench/src/components/workbench/fleet/__tests__/fleet-topology.test.tsx
  </files>
  <read_first>
    apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx,
    apps/workbench/src/components/desktop/workbench-routes.tsx,
    apps/workbench/src/components/workbench/topology/delegation-page.tsx (first 100 lines for SVG canvas pattern),
    apps/workbench/src/features/fleet/fleet-client.ts (lines 849-870 for fetchAgentList, plus fetchAuditEvents and fetchReceipts exports),
    apps/workbench/src/features/activity-bar/panels/fleet-panel.tsx
  </read_first>
  <action>
    1. Create fleet-agent-detail.tsx:
       - Full-page component for `/fleet/:id` route
       - Use `useParams()` to get agent ID, look up agent from `useFleetConnectionStore.use.agents()`
       - If agent not found, show "Agent not found" with back link to /fleet
       - Layout: PageHeader with agent ID as title, status dot, posture badge
       - Three sections using the same card style as the existing dashboard:
         a. **Agent Info card**: endpoint_agent_id, last_heartbeat_at (relative + absolute), posture (colored badge), policy_version, daemon_version, last_seen_ip, runtime_count, seconds_since_heartbeat, online status dot
         b. **Drift Flags card**: Show policy_drift, daemon_drift, stale flags with red/green indicators. If policy_drift is true, show "Expected: {remotePolicyInfo.policyHash}" vs "Actual: {agent.policy_version}" diff. Add "Quick Deploy" button (see Task 2 for deploy logic -- just wire the click to open deploy dialog)
         c. **Recent Activity card**: On mount, fetch last 20 audit events for this agent via `fetchAuditEvents(conn, { agent_id: agentId, limit: 20 })`. Show as a compact table (timestamp, action_type, decision, target). Include loading skeleton during fetch.
       - Colors: Use the same palette from fleet-dashboard.tsx (STATUS_DOT_COLORS, POSTURE_COLORS)
       - Back button at top: `usePaneStore.getState().openApp("/fleet", "Fleet")`
       - Subscribe to SSE updates: agent data auto-refreshes via the store (no additional polling needed)

    2. Create fleet-topology-view.tsx:
       - SVG canvas component showing agents as circle nodes
       - Read agents from `useFleetConnectionStore.use.agents()`
       - Layout algorithm: simple force-directed or grid layout (prefer grid for clarity -- agents placed in rows of 6, 80px spacing)
       - Each node: 32px circle with fill color based on status (online=#3dbf84, stale=#d4a84b, offline=#c45c5c), agent ID text below
       - Nodes with policy_drift get a dashed orange ring (stroke-dasharray)
       - Edges: Draw lines between agents that share the same policy_version (same "trust group"). Use a light gray line (#2d3240) with 1px stroke
       - Click a node: `usePaneStore.getState().openApp("/fleet/" + agentId, agentId)` to open detail
       - Hover a node: Show tooltip with agent ID, posture, policy version
       - SVG viewBox auto-sizes to fit all nodes with 40px padding
       - No external dependencies -- use plain SVG like delegation-page.tsx does (NOT @xyflow/react)

    3. Register route in workbench-routes.tsx:
       - Add lazy import: `const FleetAgentDetail = lazy(() => import("@/components/workbench/fleet/fleet-agent-detail").then(m => ({ default: m.FleetAgentDetail })));`
       - Add route BEFORE the existing fleet route: `{ path: "fleet/:id", element: <FleetAgentDetail /> }`
       - Update the `routeTitle` function to handle fleet/:id pattern: `if (url.pathname.startsWith("/fleet/")) return url.pathname.split("/").pop() ?? "Agent";`

    4. Tests:
       - fleet-agent-detail.test.tsx: Mock useFleetConnectionStore to return a known agent, render FleetAgentDetail, verify agent ID is displayed, status dot color matches, drift section shows flags. Mock useParams to return the agent ID.
       - fleet-topology.test.tsx: Render FleetTopologyView with 3 mocked agents, verify SVG renders with 3 circle elements, verify click handler calls openApp.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/components/workbench/fleet/__tests__/fleet-agent-detail.test.tsx src/components/workbench/fleet/__tests__/fleet-topology.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "FleetAgentDetail" apps/workbench/src/components/workbench/fleet/fleet-agent-detail.tsx
    - grep -q "useParams" apps/workbench/src/components/workbench/fleet/fleet-agent-detail.tsx
    - grep -q "fetchAuditEvents" apps/workbench/src/components/workbench/fleet/fleet-agent-detail.tsx
    - grep -q "FleetTopologyView" apps/workbench/src/components/workbench/fleet/fleet-topology-view.tsx
    - grep -q "svg" apps/workbench/src/components/workbench/fleet/fleet-topology-view.tsx
    - grep -q "fleet/:id" apps/workbench/src/components/desktop/workbench-routes.tsx
    - grep -q "FleetAgentDetail" apps/workbench/src/components/desktop/workbench-routes.tsx
  </acceptance_criteria>
  <done>
    Agent detail page shows full agent info with drift flags, recent audit events, and policy diff. Topology view renders agents as SVG nodes with status colors, drift indicators, and click-to-detail navigation. Route registered at /fleet/:id. Tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Dashboard enhancements -- SSE indicator, bulk select, quick deploy, topology tab</name>
  <files>
    apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx,
    apps/workbench/src/components/workbench/fleet/__tests__/fleet-dashboard.test.tsx
  </files>
  <read_first>
    apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx (full file),
    apps/workbench/src/components/workbench/editor/deploy-panel.tsx (first 100 lines for deploy dialog pattern),
    apps/workbench/src/components/workbench/fleet/fleet-topology-view.tsx (just created in Task 1),
    apps/workbench/src/features/fleet/use-fleet-connection.ts
  </read_first>
  <action>
    Enhance fleet-dashboard.tsx with the following additions. Preserve ALL existing functionality (summary cards, filter bar, sortable table, expandable rows, disconnected state, error banners).

    1. **SSE Connection Indicator** (FLEET-04 enhancement):
       - Read `sseState` from `useFleetConnectionStore.use.sseState()` (added in Plan 01)
       - In the subtitle area of PageHeader, add an SSE status indicator:
         - "connected": green pulsing dot + "Live" text
         - "connecting": amber dot + "Connecting..."
         - "disconnected" | "error": gray dot + "Polling" (fall back to existing behavior description)
         - "idle": no indicator
       - When SSE is connected, update the subtitle from "auto-refresh every 60s" to "Live updates via SSE"

    2. **View Toggle -- Table / Topology** (FLEET-05):
       - Add a view toggle at top-right of the dashboard (two icon buttons: table icon + nodes icon)
       - State: `const [view, setView] = useState<"table" | "topology">("table")`
       - When "topology" is selected, render `<FleetTopologyView />` instead of the agent table
       - Import FleetTopologyView from `./fleet-topology-view`

    3. **Bulk Selection** (FLEET-08):
       - Add checkbox column as first column in the agent table
       - Header checkbox: select all / deselect all (indeterminate state when partial)
       - State: `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`
       - When any agents are selected, show a floating action bar at the bottom:
         - "{N} agents selected"
         - "Push Policy" button (primary action)
         - "Retire" button (danger, secondary)
         - "Clear Selection" button (ghost)

    4. **Quick Deploy / Push Policy** (FLEET-07):
       - "Push Policy" in the bulk action bar (or the drift card "Quick Deploy" button) opens a deploy confirmation dialog
       - Use the SAME Dialog/DialogContent pattern from deploy-panel.tsx with type-to-confirm safety
       - Dialog shows: which agents will receive the policy (list selected agents or the specific drift agent), current policy version, confirmation input
       - On confirm: call `validateRemotely(conn, remotePolicyInfo.yaml)` first, then `deployPolicy(conn, remotePolicyInfo.yaml)`
       - Show success/failure toast via `useToast()`
       - After successful deploy, call `refreshAgents()` to get updated status
       - IMPORTANT: Do NOT bypass the confirmation step. The existing deploy-panel has type-to-confirm for safety. This quick deploy should have the same.

    5. **Agent Row Click-to-Detail** (FLEET-06):
       - Make each agent row clickable (cursor-pointer, hover highlight)
       - On click (not on checkbox): `usePaneStore.getState().openApp("/fleet/" + agent.endpoint_agent_id, agent.endpoint_agent_id)`
       - The expandable detail row (existing) should still work via a dedicated expand chevron

    6. **Update existing tests** in fleet-dashboard.test.tsx:
       - Add test: SSE state "connected" shows "Live" indicator text
       - Add test: Selecting agents shows bulk action bar with correct count
       - Add test: Clicking agent row calls openApp with correct path
       - Keep all existing tests passing
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/components/workbench/fleet/__tests__/fleet-dashboard.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "sseState" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "Live" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "topology" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "FleetTopologyView" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "selectedIds" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "Push Policy" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "deployPolicy" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "openApp" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
    - grep -q "CONFIRM_TEXT\|type-to-confirm\|confirmText\|confirm ==" apps/workbench/src/components/workbench/fleet/fleet-dashboard.tsx
  </acceptance_criteria>
  <done>
    Dashboard shows live SSE indicator when streaming is active. View toggle switches between table and topology. Bulk select with checkboxes enables batch policy push via confirmation dialog. Agent rows are clickable to open detail page. All tests pass.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify fleet dashboard end-to-end</name>
  <files>none</files>
  <action>
    Human verifies the full fleet dashboard experience after all automated tasks complete.
  </action>
  <verify>Human confirms all items in how-to-verify checklist</verify>
  <done>User approves or provides issues for follow-up</done>
  <what-built>
    Full fleet dashboard with real-time SSE updates, topology view, agent detail page, bulk operations, and one-click policy push.
  </what-built>
  <how-to-verify>
    1. Start the workbench: `cd apps/workbench && npm run dev`
    2. Open the Fleet Dashboard via sidebar or navigate to /fleet
    3. If hushd is running and connected:
       a. Verify "Live" SSE indicator appears in the header
       b. Verify agents update in real-time when heartbeats arrive (sub-10s)
       c. Verify drift flags appear on agents with mismatched policy versions
       d. Click an agent row -- verify the agent detail page opens at /fleet/:id
       e. On the detail page, verify Agent Info, Drift Flags, and Recent Activity sections
       f. Go back to dashboard, toggle to Topology view -- verify agent nodes render with correct status colors
       g. Select 2+ agents via checkboxes -- verify bulk action bar appears at bottom
       h. Click "Push Policy" -- verify confirmation dialog with type-to-confirm appears
    4. If hushd is NOT running:
       a. Verify disconnected state shows "Connect in Settings" message
       b. Verify the view toggle and table layout still render correctly with no agents
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
1. Full test suite: `cd apps/workbench && npx vitest run src/features/fleet/ src/components/workbench/fleet/ --reporter=verbose`
2. TypeScript check: `cd apps/workbench && npx tsc --noEmit 2>&1 | head -20`
3. No dead imports: `cd apps/workbench && npx vitest run --reporter=verbose 2>&1 | tail -5` (ensures no broken imports across the whole suite)
</verification>

<success_criteria>
- Topology view renders agents as SVG nodes with status-colored circles and policy-version-based edges
- Agent detail page (/fleet/:id) shows full config, drift flags with expected vs actual, and recent audit events
- "Push Policy" button triggers deploy with type-to-confirm safety dialog (does NOT skip confirmation)
- Bulk selection allows batch policy push to multiple agents
- SSE connection state visible in dashboard header (Live/Polling indicator)
- View toggle switches between table and topology layouts
- All new and existing tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/track-a-fleet/track-a-fleet-02-SUMMARY.md`
</output>
