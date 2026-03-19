---
phase: track-a-fleet
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/workbench/src/features/fleet/fleet-event-stream.ts
  - apps/workbench/src/features/fleet/fleet-event-reducer.ts
  - apps/workbench/src/features/fleet/fleet-client.ts
  - apps/workbench/src/features/fleet/use-fleet-connection.ts
  - apps/workbench/src/features/fleet/__tests__/fleet-event-stream.test.ts
  - apps/workbench/src/features/fleet/__tests__/fleet-event-reducer.test.ts
  - apps/workbench/src/features/fleet/__tests__/drift-detection.test.ts
autonomous: true
requirements: [FLEET-01, FLEET-02, FLEET-03, FLEET-04]

must_haves:
  truths:
    - "Fleet dashboard shows agents with live heartbeat status that updates in sub-10s (online/stale/degraded)"
    - "Each agent shows posture score, active policy version, last heartbeat timestamp, guard count"
    - "Agents that drift from the fleet-wide policy are flagged with a drift indicator"
    - "Dashboard auto-refreshes via SSE when connected to hushd, falling back to polling when SSE disconnects"
  artifacts:
    - path: "apps/workbench/src/features/fleet/fleet-event-stream.ts"
      provides: "SSE connection lifecycle manager for hushd /api/v1/events"
      exports: ["FleetEventStream", "FleetSSEState"]
    - path: "apps/workbench/src/features/fleet/fleet-event-reducer.ts"
      provides: "Pure functions to merge SSE events into AgentInfo[] state"
      exports: ["reduceFleetEvent", "mergeHeartbeat", "FleetEvent"]
    - path: "apps/workbench/src/features/fleet/fleet-client.ts"
      provides: "Fixed fetchAgentList with expected_policy_version query param"
      contains: "expected_policy_version"
    - path: "apps/workbench/src/features/fleet/use-fleet-connection.ts"
      provides: "SSE integration into existing fleet store"
      contains: "FleetEventStream"
  key_links:
    - from: "fleet-event-stream.ts"
      to: "/api/v1/events"
      via: "fetch-based SSE with Bearer auth"
      pattern: "fetch.*api/v1/events.*text/event-stream"
    - from: "fleet-event-reducer.ts"
      to: "use-fleet-connection.ts"
      via: "reducer called from SSE event handler to update agents array"
      pattern: "reduceFleetEvent|mergeHeartbeat"
    - from: "fleet-client.ts"
      to: "/api/v1/agents/status"
      via: "expected_policy_version query param for server-side drift"
      pattern: "expected_policy_version"
    - from: "use-fleet-connection.ts"
      to: "fleet-event-stream.ts"
      via: "SSE stream started on connect, stopped on disconnect"
      pattern: "FleetEventStream"
---

<objective>
Wire real-time SSE streaming from hushd into the fleet connection store and fix drift detection.

Purpose: The existing fleet dashboard polls every 60s. This plan adds SSE-driven real-time agent heartbeat updates and fixes the drift detection query parameter so the server actually computes policy drift. After this plan, the data layer is live.

Output: Three new modules (event stream, event reducer, drift fix) plus store integration. All existing polling behavior preserved as fallback.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/track-a-fleet/RESEARCH.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From apps/workbench/src/features/fleet/fleet-client.ts:
```typescript
export interface FleetConnection {
  hushdUrl: string;
  controlApiUrl: string;
  apiKey: string;
  controlApiToken: string;
  connected: boolean;
  hushdHealth: HealthResponse | null;
  agentCount: number;
}

export type FleetConnectionInfo = Omit<FleetConnection, "apiKey" | "controlApiToken">;

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

export interface AgentDriftFlags {
  policy_drift: boolean;
  daemon_drift: boolean;
  stale: boolean;
}

export interface AgentStatusResponse {
  generated_at: string;
  stale_after_secs: number;
  endpoints: AgentInfo[];
  runtimes: unknown[];
}
```

From apps/workbench/src/features/fleet/use-fleet-connection.ts:
```typescript
export interface FleetStoreState extends FleetConnectionState {
  actions: FleetConnectionActions;
}

export interface FleetConnectionState {
  connection: FleetConnectionInfo;
  isConnecting: boolean;
  error: string | null;
  pollError: string | null;
  secureStorageWarning: boolean;
  agents: AgentInfo[];
  remotePolicyInfo: RemotePolicyInfo | null;
}

export interface RemotePolicyInfo {
  name?: string;
  version?: string;
  policyHash?: string;
  yaml: string;
}

// Store pattern: createSelectors(create(immer(...)))
export const useFleetConnectionStore = createSelectors(useFleetConnectionStoreBase);
```

From apps/workbench/src/components/workbench/editor/live-agent-tab.tsx (SSE parsing):
```typescript
export interface ParsedSseMessage {
  eventType: string;
  data: string;
}

export function consumeSseMessages(buffer: string): {
  messages: ParsedSseMessage[];
  remainder: string;
}

export function resolveProxyBase(raw: string, isDev?: boolean): string;
export function buildHushdAuthHeaders(endpoint: string, hushdUrl: string, apiKey: string): Record<string, string>;
```

SSE events from hushd (from RESEARCH.md):
- `agent_heartbeat`: { endpoint_agent_id, runtime_agent_id, runtime_agent_kind, session_id, posture, policy_version, daemon_version, timestamp }
- `policy_updated`: { policy_hash, yaml }
- `policy_reloaded`: { before_hash, after_hash }
- `check`: { action_type, target, verdict, guard, session_id, agent_id, evidence }
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fleet event reducer + SSE stream module with tests</name>
  <files>
    apps/workbench/src/features/fleet/fleet-event-stream.ts,
    apps/workbench/src/features/fleet/fleet-event-reducer.ts,
    apps/workbench/src/features/fleet/__tests__/fleet-event-stream.test.ts,
    apps/workbench/src/features/fleet/__tests__/fleet-event-reducer.test.ts
  </files>
  <read_first>
    apps/workbench/src/components/workbench/editor/live-agent-tab.tsx,
    apps/workbench/src/features/fleet/fleet-client.ts (lines 121-200 for types),
    apps/workbench/src/features/fleet/use-fleet-connection.ts
  </read_first>
  <behavior>
    fleet-event-reducer.test.ts:
    - mergeHeartbeat updates an existing agent's fields (posture, policy_version, daemon_version, last_heartbeat_at, seconds_since_heartbeat=0, online=true) when a matching heartbeat arrives
    - mergeHeartbeat appends a new agent when endpoint_agent_id is unknown
    - reduceFleetEvent("agent_heartbeat", data) returns updated agents array with merged heartbeat
    - reduceFleetEvent("policy_updated", data) returns { refreshPolicy: true }
    - reduceFleetEvent("policy_reloaded", data) returns { refreshPolicy: true }
    - reduceFleetEvent("unknown_type", data) returns no-op (agents unchanged)

    fleet-event-stream.test.ts:
    - FleetEventStream.connect() calls fetch with correct URL including event_types filter
    - FleetEventStream.connect() includes Bearer auth header from credential getter
    - FleetEventStream.disconnect() aborts the fetch controller
    - On SSE reconnect (after disconnect), a full refresh callback is invoked
    - State transitions: idle -> connecting -> connected -> disconnected
    - Exponential backoff on connection failure (1s, 2s, 4s, 8s, 16s max)
  </behavior>
  <action>
    Create fleet-event-reducer.ts:
    - Define FleetEvent discriminated union: { type: "agent_heartbeat", data: HeartbeatEventData } | { type: "policy_updated" | "policy_reloaded" | "policy_bundle_update", data: unknown } | { type: "check", data: CheckEventData }
    - HeartbeatEventData: { endpoint_agent_id: string, runtime_agent_id?: string, runtime_agent_kind?: string, session_id?: string, posture?: string, policy_version?: string, daemon_version?: string, timestamp: string }
    - mergeHeartbeat(agents: AgentInfo[], heartbeat: HeartbeatEventData): AgentInfo[] -- find by endpoint_agent_id, update matched agent's fields (set seconds_since_heartbeat to 0, online to true, update posture/policy_version/daemon_version/last_heartbeat_at from event data), or append new agent with defaults
    - reduceFleetEvent(agents: AgentInfo[], event: FleetEvent): { agents: AgentInfo[], refreshPolicy: boolean } -- dispatch on event.type

    Create fleet-event-stream.ts:
    - Import consumeSseMessages and resolveProxyBase from live-agent-tab.tsx (or copy the consumeSseMessages function locally if import creates a circular dep -- it is a pure function with no component dependency)
    - FleetSSEState = "idle" | "connecting" | "connected" | "disconnected" | "error"
    - FleetEventStream class:
      - constructor(opts: { hushdUrl: string, getApiKey: () => string, onEvent: (event: FleetEvent) => void, onStateChange: (state: FleetSSEState) => void, onReconnect: () => void })
      - connect(): void -- builds URL as `${resolveProxyBase(hushdUrl)}/api/v1/events?event_types=agent_heartbeat,check,policy_updated,policy_reloaded,policy_bundle_update,session_posture_transition`, fetches with Bearer auth and Accept: text/event-stream, reads streaming body via ReadableStream, parses with consumeSseMessages, dispatches parsed events via onEvent callback
      - disconnect(): void -- abort controller, clear reconnect timer
      - Private reconnect with exponential backoff: delays [1000, 2000, 4000, 8000, 16000] ms, calls onReconnect() on successful reconnect to trigger full agent refresh
    - IMPORTANT: Use fetch-based SSE (NOT EventSource) because hushd requires Bearer token auth. Follow the exact pattern from live-agent-tab.tsx lines 565-640.
    - IMPORTANT: SSE URL must go through proxyUrl() in dev mode. Use resolveProxyBase for the base, then append path.
    - IMPORTANT: On reconnect success, call onReconnect() so the store can do a full refreshAgents() to re-sync any missed events.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/features/fleet/__tests__/fleet-event-reducer.test.ts src/features/fleet/__tests__/fleet-event-stream.test.ts --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "mergeHeartbeat" apps/workbench/src/features/fleet/fleet-event-reducer.ts
    - grep -q "reduceFleetEvent" apps/workbench/src/features/fleet/fleet-event-reducer.ts
    - grep -q "FleetEventStream" apps/workbench/src/features/fleet/fleet-event-stream.ts
    - grep -q "event_types=agent_heartbeat" apps/workbench/src/features/fleet/fleet-event-stream.ts
    - grep -q "text/event-stream" apps/workbench/src/features/fleet/fleet-event-stream.ts
    - grep -q "Authorization.*Bearer" apps/workbench/src/features/fleet/fleet-event-stream.ts
    - grep -q "mergeHeartbeat" apps/workbench/src/features/fleet/__tests__/fleet-event-reducer.test.ts
    - grep -q "FleetEventStream" apps/workbench/src/features/fleet/__tests__/fleet-event-stream.test.ts
  </acceptance_criteria>
  <done>
    Fleet event reducer correctly merges heartbeat events into agents array (update existing, append new). Fleet event stream connects via fetch-based SSE with auth headers, parses named events, and reconnects with exponential backoff. All tests pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix drift detection + integrate SSE into fleet store</name>
  <files>
    apps/workbench/src/features/fleet/fleet-client.ts,
    apps/workbench/src/features/fleet/use-fleet-connection.ts,
    apps/workbench/src/features/fleet/__tests__/drift-detection.test.ts
  </files>
  <read_first>
    apps/workbench/src/features/fleet/fleet-client.ts (lines 849-870 for fetchAgentList),
    apps/workbench/src/features/fleet/use-fleet-connection.ts (full file),
    apps/workbench/src/features/fleet/fleet-event-stream.ts (just created in Task 1),
    apps/workbench/src/features/fleet/fleet-event-reducer.ts (just created in Task 1)
  </read_first>
  <behavior>
    drift-detection.test.ts:
    - fetchAgentList with remotePolicyVersion="sha256:abc" appends ?expected_policy_version=sha256:abc to the URL
    - fetchAgentList without remotePolicyVersion does NOT add expected_policy_version param (backward compat)
    - The URL includes both include_stale=true AND expected_policy_version when both are present
  </behavior>
  <action>
    1. Fix drift detection in fleet-client.ts:
       - Modify fetchAgentList signature: add optional second param `opts?: { expectedPolicyVersion?: string }`
       - When opts.expectedPolicyVersion is provided, append `&expected_policy_version=${encodeURIComponent(opts.expectedPolicyVersion)}` to the agents/status URL
       - The URL should be: `/api/v1/agents/status?include_stale=true&expected_policy_version=...`
       - Keep the control-api fallback path unchanged (it does not support expected_policy_version)

    2. Integrate SSE into use-fleet-connection.ts:
       - Import FleetEventStream from fleet-event-stream.ts
       - Import reduceFleetEvent from fleet-event-reducer.ts
       - Add to FleetConnectionState: `sseState: "idle" | "connecting" | "connected" | "disconnected" | "error"` (default "idle")
       - Add module-level variable: `let fleetEventStream: FleetEventStream | null = null;`
       - In startPolling() -- after starting interval timers, also start SSE:
         ```
         fleetEventStream = new FleetEventStream({
           hushdUrl: conn.hushdUrl,
           getApiKey: () => _credentials.apiKey,
           onEvent: (event) => {
             const currentAgents = get().agents;
             const result = reduceFleetEvent(currentAgents, event);
             set((state) => { state.agents = result.agents; state.connection.agentCount = result.agents.length; });
             if (result.refreshPolicy) {
               fetchRemoteInfo();
             }
           },
           onStateChange: (sseState) => set((state) => { state.sseState = sseState; }),
           onReconnect: () => pollAgents(),  // full re-sync on reconnect
         });
         fleetEventStream.connect();
         ```
       - In stopPolling() -- also disconnect SSE: `fleetEventStream?.disconnect(); fleetEventStream = null;`
       - In disconnect action -- set sseState back to "idle"
       - In pollAgents() -- pass expectedPolicyVersion from remotePolicyInfo:
         `const remotePolicyVersion = get().remotePolicyInfo?.policyHash ?? get().remotePolicyInfo?.version;`
         `apiFetchAgentList(conn, remotePolicyVersion ? { expectedPolicyVersion: remotePolicyVersion } : undefined)`

    3. CRITICAL: Do NOT put credentials in the Zustand state tree. The SSE stream gets credentials via the getApiKey callback (reads from _credentials closure).

    4. CRITICAL: Preserve all existing polling behavior. SSE is additive -- polling continues as before.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/features/fleet/__tests__/drift-detection.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "expected_policy_version" apps/workbench/src/features/fleet/fleet-client.ts
    - grep -q "expectedPolicyVersion" apps/workbench/src/features/fleet/fleet-client.ts
    - grep -q "FleetEventStream" apps/workbench/src/features/fleet/use-fleet-connection.ts
    - grep -q "reduceFleetEvent" apps/workbench/src/features/fleet/use-fleet-connection.ts
    - grep -q "sseState" apps/workbench/src/features/fleet/use-fleet-connection.ts
    - grep -qv "apiKey.*state\." apps/workbench/src/features/fleet/use-fleet-connection.ts || true
    - grep -q "expected_policy_version" apps/workbench/src/features/fleet/__tests__/drift-detection.test.ts
  </acceptance_criteria>
  <done>
    fetchAgentList passes expected_policy_version to hushd so drift is computed server-side. SSE stream is started alongside polling on connect and stopped on disconnect. Heartbeat events update agents array in real-time via the reducer. Policy change events trigger remote policy refresh. SSE state is tracked in the store (but credentials are NOT in state). All existing fleet dashboard tests still pass, plus new drift detection tests.
  </done>
</task>

</tasks>

<verification>
1. Run all fleet-related tests:
   `cd apps/workbench && npx vitest run src/features/fleet/ src/components/workbench/fleet/ --reporter=verbose`
2. Verify no TypeScript errors: `cd apps/workbench && npx tsc --noEmit 2>&1 | head -20`
3. Verify credential isolation: `grep -r "apiKey" apps/workbench/src/features/fleet/use-fleet-connection.ts` should NOT show apiKey in any set() state mutation
</verification>

<success_criteria>
- SSE stream module connects to /api/v1/events with Bearer auth and parses named events
- Event reducer merges heartbeats into agents array (update existing, append new)
- Drift detection passes expected_policy_version query param from remote policy hash
- SSE integration in fleet store: starts on connect, stops on disconnect, updates agents in real-time
- Polling preserved as fallback (SSE is additive, not replacement)
- Credentials never enter Zustand state tree
- All new tests pass, all existing fleet tests still pass
</success_criteria>

<output>
After completion, create `.planning/phases/track-a-fleet/track-a-fleet-01-SUMMARY.md`
</output>
