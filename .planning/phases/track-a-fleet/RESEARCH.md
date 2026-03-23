# Track A: Live Fleet Dashboard - Research

**Researched:** 2026-03-19
**Domain:** Real-time agent monitoring, fleet visualization, policy deployment, SSE streaming
**Confidence:** HIGH

## Summary

The ClawdStrike workbench already has substantial fleet infrastructure: a Zustand store (`useFleetConnectionStore`) managing hushd connectivity with credential isolation, a full HTTP client (`fleet-client.ts`) wrapping 30+ API endpoints, an existing polling-based fleet dashboard, a sidebar fleet panel, and a deploy panel with validation and confirmation dialogs. The hushd daemon exposes a rich SSE endpoint (`GET /api/v1/events`) that supports event-type filtering and agent-scoped subscriptions -- but the workbench only uses SSE in the live-agent-tab, not in the fleet dashboard. The existing fleet dashboard uses interval polling (60s agents, 30s health) which creates the main opportunity for Track A: replace polling with SSE-driven real-time updates.

The hushd API surface is comprehensive. Agent heartbeats (`POST /api/v1/agent/heartbeat`) store endpoint and runtime liveness with posture, policy version, daemon version, and drift detection. The status endpoint (`GET /api/v1/agents/status`) returns full endpoint and runtime status with drift flags computed server-side. Policy management includes `GET/PUT /api/v1/policy`, `POST /api/v1/policy/validate`, `POST /api/v1/policy/reload`, and signed policy bundle endpoints. All state-mutating operations broadcast `DaemonEvent` messages over the SSE channel, enabling the dashboard to receive live updates for heartbeats, check evaluations, policy changes, broker capabilities, and more.

**Primary recommendation:** Build an SSE-connected fleet dashboard that subscribes to `/api/v1/events` for real-time agent heartbeat and policy change events, augmenting the existing Zustand store with a streaming connection layer. Reuse the existing `fleet-client.ts` API functions, `FleetConnection` credential model, and deploy panel components rather than building new infrastructure.

## Existing Infrastructure Inventory

### 1. Fleet Connection Store (Zustand)

**File:** `src/features/fleet/use-fleet-connection.ts`
**Confidence:** HIGH (read directly)

| Property | Type | Description |
|----------|------|-------------|
| `connection` | `FleetConnectionInfo` | Credential-free connection metadata (hushdUrl, controlApiUrl, connected, hushdHealth, agentCount) |
| `isConnecting` | `boolean` | True during connection attempt |
| `error` | `string | null` | Connection error |
| `pollError` | `string | null` | Surfaced after 3+ consecutive poll failures |
| `secureStorageWarning` | `boolean` | True when credentials only in browser session |
| `agents` | `AgentInfo[]` | Current agent list |
| `remotePolicyInfo` | `RemotePolicyInfo | null` | Name, version, hash, YAML of remote policy |

**Actions:**
- `connect(hushdUrl, controlApiUrl, apiKey, controlApiToken?)` -- connect and start polling
- `disconnect()` -- stop polling, clear credentials
- `testConnection(hushdUrl, apiKey)` -- test without saving
- `refreshAgents()` -- force re-poll
- `refreshRemotePolicy()` -- force re-fetch policy
- `getCredentials()` -- get apiKey/controlApiToken from closure
- `getAuthenticatedConnection()` -- merge connection + credentials

**Polling intervals:**
- Health: every 30s (`HEALTH_POLL_MS`)
- Agents: every 60s (`AGENT_POLL_MS`)

**Credential model:** Credentials stored in a module-level closure (`_credentials`), never in Zustand state tree. Secure storage via `secureStore` (Stronghold on desktop, sessionStorage fallback on web). URL-only fields in localStorage for synchronous bootstrap.

**Pattern:** `createSelectors(create(immer(...)))` -- this is the standard store pattern in this codebase.

### 2. Fleet Client (HTTP API Layer)

**File:** `src/features/fleet/fleet-client.ts` (~2300 lines)
**Confidence:** HIGH (read directly)

**Core fleet functions already available:**

| Function | Endpoint | Auth | Description |
|----------|----------|------|-------------|
| `testConnection(url, apiKey)` | `GET /health` | hushd Bearer | Liveness check |
| `fetchAgentList(conn)` | `GET /api/v1/agents/status?include_stale=true` | hushd Bearer | Full agent list with drift |
| `fetchRemotePolicy(conn)` | `GET /api/v1/policy` | hushd Bearer | Current policy YAML, name, hash |
| `deployPolicy(conn, yaml)` | `POST /api/v2/policy` | hushd Bearer | Push policy to fleet |
| `validateRemotely(conn, yaml)` | `POST /api/v2/policy/validate` | hushd Bearer | Server-side validation |
| `fetchAuditEvents(conn, filters?)` | `GET /api/v1/audit` | hushd Bearer | Audit log with filters |
| `distributePolicy(conn, yaml)` | `POST control/api/v1/policies/deploy` | control token | Deploy via control-api |
| `fetchApprovals(conn)` | `GET control/api/v1/approvals` | control token | Pending approvals |
| `resolveApproval(conn, id, decision)` | `POST control/api/v1/approvals/:id/resolve` | control token | Approve/deny |
| `fetchDelegationGraphSnapshot(conn, id)` | `GET control/api/v1/principals/:id/delegation-graph` | control token | Delegation graph |
| `fetchPrincipals(conn)` | `GET control/api/v1/principals` | control token | Principal list |
| `fetchScopedPolicies(conn)` | `GET /api/v1/scoped-policies` | control/hushd | Scoped policies |
| `fetchPolicyAssignments(conn)` | `GET /api/v1/policy-assignments` | control/hushd | Policy assignments |
| `fetchReceipts(conn, opts?)` | `GET /api/v1/receipts` | control/hushd | Receipt list |
| `fetchHierarchyNodes(conn)` | `GET /api/v1/hierarchy/nodes` | control/hushd | Hierarchy tree |

**Dev proxy:** In development mode, URLs are rewritten to `/_proxy/hushd{path}` or `/_proxy/control{path}` to avoid CORS issues.

**Security patterns:**
- `redirect: "error"` on all fetches (prevents credential forwarding on redirects)
- Response body size limits (10MB max, 2KB for errors)
- Secret redaction in error messages
- URL validation before every request

### 3. hushd API Surface (Rust Backend)

**File:** `crates/services/hushd/src/api/mod.rs` + submodules
**Confidence:** HIGH (read directly)

#### Route Map

**Public (no auth):**
- `GET /health` -- liveness probe (status, version, uptime_secs, session_id, audit_count)
- `GET /ready` -- readiness probe (policy_loaded, signing_key, audit_db, control_db checks)

**Check scope (service principal auth):**
- `POST /api/v1/check` -- evaluate action against policy
- `POST /api/v1/eval` -- evaluate policy event
- `POST /api/v1/agent/heartbeat` -- ingest agent heartbeat
- `POST /api/v1/session` -- create session
- `GET /api/v1/me` -- current identity

**Read scope:**
- `GET /api/v1/policy` -- get active policy (name, version, hash, yaml, source, schema)
- `GET /api/v1/policy/bundle` -- get signed policy bundle
- `GET /api/v1/agents/status` -- list agent status (endpoints + runtimes with drift)
- `GET /api/v1/events` -- **SSE event stream** (filterable by event_types, session_id, agent_id)
- `GET /api/v1/audit` -- query audit log
- `GET /api/v1/audit/stats` -- audit statistics
- `GET /metrics` -- Prometheus metrics
- `GET /api/v1/session/:id` -- get session
- `GET /api/v1/session/:id/posture` -- get session posture
- `GET /api/v1/broker/capabilities` -- list capabilities
- `GET /api/v1/broker/previews` -- list previews
- `GET /api/v1/scoped-policies` -- list scoped policies
- `GET /api/v1/policy-assignments` -- list assignments
- `GET /api/v1/policy/resolve` -- resolve policy for scope
- `GET /api/v1/rbac/roles` -- list RBAC roles
- `GET /api/v1/swarm/hub/config` -- swarm hub configuration
- `GET /api/v1/siem/exporters` -- SIEM exporter list

**Admin scope:**
- `PUT /api/v1/policy` -- update policy (YAML)
- `PUT /api/v1/policy/bundle` -- update signed policy bundle
- `POST /api/v1/policy/validate` -- validate policy YAML
- `POST /api/v1/policy/reload` -- reload policy from file
- `POST /api/v1/shutdown` -- graceful shutdown
- `DELETE /api/v1/session/:id` -- terminate session
- `POST /api/v1/session/:id/transition` -- transition posture
- RBAC management routes
- Broker revocation/freeze routes
- Scoped policy CRUD

#### SSE Event Stream Details

**File:** `crates/services/hushd/src/api/events.rs`

**Endpoint:** `GET /api/v1/events`
**Auth:** Read scope required
**Keep-alive:** 30s interval

**Query parameters:**
- `event_types` -- comma-separated filter (e.g., `agent_heartbeat,check,policy_reload`)
- `session_id` -- filter by session
- `endpoint_agent_id` -- filter by endpoint agent
- `runtime_agent_id` -- filter by runtime agent
- `runtime_agent_kind` -- filter by runtime kind

**Events broadcast by hushd:**

| Event Type | Source | Data Fields |
|------------|--------|-------------|
| `agent_heartbeat` | `agent_status.rs` | endpoint_agent_id, runtime_agent_id, runtime_agent_kind, session_id, posture, policy_version, daemon_version, timestamp |
| `check` | `check.rs` | action_type, target, verdict, guard, session_id, agent_id, evidence |
| `eval` | `eval.rs` | (policy evaluation results) |
| `broker_capability_issued` | `broker.rs` | capability details |
| `policy_updated` | `policy.rs` via audit | policy hash, YAML |
| `policy_reloaded` | `policy.rs` via audit | before/after hashes |
| `policy_bundle_update` | `policy.rs` via audit | bundle_id, policy_hash |
| `scoped_policy_created/updated/deleted` | `policy_scoping.rs` | scope details |
| `policy_assignment_created/deleted` | `policy_scoping.rs` | assignment details |
| `webhook_okta/auth0` | `webhooks.rs` | webhook event data |
| `saml_session_created` | `saml.rs` | session details |
| `session_posture_transition` | `session.rs` | posture change |
| `rbac_role_created/updated/deleted` | `rbac.rs` | role details |

**Implementation note:** Events use `tokio::sync::broadcast` channel (capacity 1024). Each SSE client gets a `BroadcastStream` subscriber with server-side filtering.

#### Agent Status Schema

**File:** `crates/services/hushd/src/api/agent_status.rs`

```typescript
// TypeScript equivalent of the Rust response
interface AgentStatusResponse {
  generated_at: string;         // RFC 3339
  stale_after_secs: number;     // default 90
  endpoints: EndpointStatus[];
  runtimes: RuntimeStatus[];
}

interface EndpointStatus {
  endpoint_agent_id: string;
  last_heartbeat_at: string;    // RFC 3339
  last_seen_ip: string | null;
  last_session_id: string | null;
  posture: string | null;       // "strict" | "default" | "permissive"
  policy_version: string | null;
  daemon_version: string | null;
  runtime_count: number;
  seconds_since_heartbeat: number;
  online: boolean;              // seconds_since_heartbeat <= stale_after_secs
  drift: DriftFlags;
}

interface RuntimeStatus {
  runtime_agent_id: string;
  endpoint_agent_id: string;
  runtime_agent_kind: string;   // e.g., "claude", "openai"
  last_heartbeat_at: string;
  last_session_id: string | null;
  posture: string | null;
  policy_version: string | null;
  daemon_version: string | null;
  seconds_since_heartbeat: number;
  online: boolean;
  drift: DriftFlags;
}

interface DriftFlags {
  policy_drift: boolean;        // computed server-side against expected_policy_version query param
  daemon_drift: boolean;        // computed against expected_daemon_version query param
  stale: boolean;               // seconds_since_heartbeat > stale_after_secs
}
```

**Query parameters for drift detection:**
- `expected_policy_version` -- if set, agents not matching this version have `policy_drift: true`
- `expected_daemon_version` -- if set, agents not matching this version have `daemon_drift: true`
- `include_stale` -- default `true`, set to `false` to exclude stale agents
- `stale_after_secs` -- default `90`, minimum `10`
- `limit` -- default `200`, max `1000`

### 4. Existing Fleet Dashboard

**File:** `src/components/workbench/fleet/fleet-dashboard.tsx` (680 lines)
**Confidence:** HIGH (read directly)

**What exists:**
- Summary cards: Total Agents, Online, Stale, Policy Drift, Active Policy Version
- Filter bar: all / online / stale / drift
- Sortable table with columns: Status dot, Agent ID, Posture, Policy Version, Daemon Version, Last Heartbeat, Runtimes, Drift badges
- Expandable agent detail rows showing: Agent Info, Drift Flags, Runtime count
- Disconnected state with CTA to Settings
- Poll error and secure storage warning banners
- Manual refresh button

**What is missing for Track A:**
- No SSE streaming -- relies entirely on 60s interval polling
- No real-time heartbeat updates
- No posture visualization (topology/graph view)
- No one-click policy push from within the dashboard
- No drift remediation actions
- No agent detail page (clicking just expands inline)
- No historical trend data or sparklines
- No per-agent audit trail integration

### 5. Fleet Sidebar Panel

**File:** `src/features/activity-bar/panels/fleet-panel.tsx` (224 lines)
**Confidence:** HIGH (read directly)

Shows:
- Connection status with hushd version
- Agent list with health dots and relative timestamps
- Clicking an agent opens a pane at `/fleet/{agent_id}`
- Link to topology map
- Footer with online count

### 6. Deploy Panel

**File:** `src/components/workbench/editor/deploy-panel.tsx` (507 lines)
**Confidence:** HIGH (read directly)

Full deploy flow exists:
1. Shows diff status (local vs remote policy)
2. "Validate Remotely" button calls `validateRemotely()`
3. Deploy confirmation dialog with type-to-confirm safety
4. Shows receiving agents list
5. Calls `deployPolicy()` on confirm
6. Import from production (reverse flow)
7. Toast notifications and audit event emission

### 7. Topology / Visualization Infrastructure

**Files:**
- `src/components/workbench/topology/topology-layout.tsx` -- tab switcher (Delegation / Hierarchy)
- `src/components/workbench/delegation/delegation-page.tsx` -- full SVG canvas graph with hierarchical layout, zoom/pan, path tracing, filters, SVG export
- `src/components/workbench/swarms/trust-graph.tsx` -- force-directed graph for swarm trust relationships

**Dependencies:**
- `@xyflow/react@^12.10.1` -- in package.json but NOT used in delegation/trust-graph (they use custom SVG canvas)
- Custom force simulation in `src/lib/workbench/force-graph-engine.ts`
- Custom hierarchical layout algorithm

### 8. SSE Usage Pattern (Live Agent Tab)

**File:** `src/components/workbench/editor/live-agent-tab.tsx`
**Confidence:** HIGH (read directly)

Existing SSE pattern:
```typescript
// Uses native EventSource with named events
const es = new EventSource(url);
eventSourceRef.current = es;

// hushd emits NAMED SSE events ("check", "violation", "policy_reload")
// Must use addEventListener, NOT onmessage
const makeHandler = (eventType: string) => (e: Event) => {
  const me = e as MessageEvent;
  // parse me.data as JSON
};

// Register listeners for each event type
es.addEventListener("check", makeHandler("check"));
es.addEventListener("violation", makeHandler("violation"));
// ...

// Reconnection with exponential backoff
es.onerror = () => {
  if (es.readyState === EventSource.CLOSED) {
    scheduleReconnect(proxyBase, startSse);
  }
};
```

**Key pattern:** The live-agent-tab also supports a fetch-based SSE fallback for when auth headers are needed (EventSource doesn't support custom headers). This uses `fetch()` with streaming response body parsing.

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | `^5.0.12` | State management | Project standard; all stores use `create(immer(...))` + `createSelectors` |
| `react-router-dom` | `^7.0.0` | Routing | Project standard; pane-based routing via `workbench-routes.tsx` |
| `@tabler/icons-react` | `^3.28.1` | Icons | Project standard; used everywhere |
| `@xyflow/react` | `^12.10.1` | Graph visualization | Already a dependency (optional for fleet topology) |

### Supporting (no new deps needed)

| Library | Purpose | Already Used In |
|---------|---------|-----------------|
| `immer` (via zustand/middleware) | Immutable state updates | All Zustand stores |
| Native `EventSource` | SSE streaming | `live-agent-tab.tsx` |
| Native `fetch` streaming | SSE with auth headers | `live-agent-tab.tsx` |

### No New Dependencies Required

The entire Track A can be built using existing project dependencies. The SSE streaming, state management, HTTP client, visualization, and UI patterns are all already present in the codebase.

## Architecture Patterns

### Recommended Structure

```
src/features/fleet/
  fleet-client.ts           # EXISTING -- HTTP API layer (30+ functions)
  fleet-url-policy.ts       # EXISTING -- URL validation
  use-fleet-connection.ts   # EXISTING -- Zustand store (polling-based)
  use-fleet-events.ts       # NEW -- SSE event stream hook/store
  fleet-event-reducer.ts    # NEW -- Process SSE events into store updates

src/components/workbench/fleet/
  fleet-dashboard.tsx        # EXISTING -- Enhance with SSE + new panels
  fleet-agent-detail.tsx     # NEW -- Full agent detail page
  fleet-posture-map.tsx      # NEW -- Posture visualization
  fleet-drift-panel.tsx      # NEW -- Drift detection + remediation
  fleet-deploy-quick.tsx     # NEW -- One-click deploy from dashboard context
```

### Pattern 1: SSE Event Store (extends existing fleet store)

**What:** A companion Zustand store or store extension that manages the SSE connection lifecycle and merges live events into the agent state.

**When to use:** For all real-time dashboard updates.

**Approach:** Rather than replacing the existing polling store, layer SSE on top:
1. Polling remains as fallback and initial data load
2. SSE stream provides incremental updates between polls
3. On `agent_heartbeat` SSE event, update the matching agent in the `agents[]` array
4. On `policy_updated` / `policy_reloaded`, trigger a `refreshRemotePolicy()`
5. On SSE disconnect, fall back to polling until reconnected

```typescript
// Pseudocode for the SSE event handler
function handleFleetSSEEvent(event: DaemonEvent) {
  switch (event.event_type) {
    case "agent_heartbeat":
      // Merge heartbeat into agents array
      useFleetConnectionStore.setState((state) => {
        const idx = state.agents.findIndex(
          (a) => a.endpoint_agent_id === event.data.endpoint_agent_id
        );
        if (idx >= 0) {
          state.agents[idx] = mergeHeartbeat(state.agents[idx], event.data);
        }
        // New agent -- append and bump count
      });
      break;
    case "policy_updated":
    case "policy_reloaded":
    case "policy_bundle_update":
      // Re-fetch remote policy info
      useFleetConnectionStore.getState().actions.refreshRemotePolicy();
      break;
  }
}
```

### Pattern 2: SSE with Auth Headers (fetch-based streaming)

**What:** The existing `EventSource` API does not support custom headers. The live-agent-tab already implements a fetch-based SSE reader as a fallback.

**When to use:** When the hushd instance requires Bearer token auth (which it does when `auth_enabled: true`).

**Example from codebase (live-agent-tab):**
```typescript
// Fetch-based SSE for when auth headers are needed
const response = await fetch(sseUrl, {
  headers: { Authorization: `Bearer ${apiKey}` },
  signal: controller.signal,
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
// Parse SSE line-by-line from the stream
```

### Pattern 3: Pane-Based Navigation

**What:** The workbench uses a binary tree pane system where routes are opened via `usePaneStore.getState().openApp(path, label)`.

**When to use:** For all fleet dashboard navigation (agent detail, topology, etc.)

**Existing patterns:**
- Fleet sidebar: `openApp("/fleet/" + agent.endpoint_agent_id, agent.endpoint_agent_id)`
- Settings link: `openApp("/settings", "Settings")`
- Topology link: `openApp("/topology", "Topology")`

**Route registration:** All routes go in `workbench-routes.tsx` as `RouteObject` entries. The fleet route is currently `{ path: "fleet", element: <FleetDashboard /> }`.

### Anti-Patterns to Avoid

- **Duplicating fleet-client functions:** All hushd API calls already exist in `fleet-client.ts`. Do not create parallel API wrappers.
- **Exposing credentials in state:** The existing credential closure pattern MUST be preserved. Never add apiKey/controlApiToken to Zustand state.
- **Replacing polling entirely with SSE:** Keep polling as a fallback. SSE connections can drop; the dashboard must remain functional.
- **Using @xyflow/react for fleet topology:** The existing visualization code uses custom SVG canvas, not @xyflow. Use @xyflow only if building a new graph view from scratch; otherwise follow the established custom canvas pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent list fetching | Custom HTTP calls to hushd | `fetchAgentList()` from fleet-client | Handles hushd and control-api fallback, runtime validation |
| Policy deployment | Raw PUT to /api/v1/policy | `deployPolicy()` from fleet-client | Handles error mapping, proxy rewriting |
| Policy validation | Custom validation logic | `validateRemotely()` from fleet-client | Uses server-side validation |
| Credential management | Store credentials in state | `getCredentials()` / `getAuthenticatedConnection()` from fleet store | Keeps credentials in closure, not serializable state |
| SSE auth headers | Custom EventSource wrapper | Fetch-based streaming (pattern from live-agent-tab) | EventSource doesn't support custom headers |
| URL validation | Manual regex | `validateFleetUrl()` from fleet-url-policy | Handles IPv4/IPv6, private ranges, TLS warnings |
| Deploy confirmation | Simple confirm dialog | Existing `DeployConfirmDialog` component in deploy-panel.tsx | Has type-to-confirm, remote validation, agent list, audit logging |

## Common Pitfalls

### Pitfall 1: SSE Named Events vs Default onmessage
**What goes wrong:** Using `EventSource.onmessage` which only fires for unnamed events. hushd sends NAMED events (e.g., `event: agent_heartbeat`).
**Why it happens:** The SSE spec distinguishes between unnamed data events and named typed events.
**How to avoid:** Use `es.addEventListener("agent_heartbeat", handler)` for each event type.
**Warning signs:** SSE connection opens successfully but no events are received.

### Pitfall 2: SSE Authentication
**What goes wrong:** `EventSource` constructor does not support custom headers, so Bearer tokens cannot be sent.
**Why it happens:** Browser EventSource API limitation.
**How to avoid:** Use the fetch-based streaming approach already proven in `live-agent-tab.tsx`. Alternatively, in dev mode, the Vite proxy at `/_proxy/hushd/` may forward cookies/auth.
**Warning signs:** 401/403 errors on SSE connection.

### Pitfall 3: Credential Exposure in Zustand Devtools
**What goes wrong:** If credentials are added to the Zustand state tree, they become visible in Redux DevTools and serialized snapshots.
**Why it happens:** Zustand serializes the entire state tree for devtools.
**How to avoid:** The existing credential closure pattern (`_credentials` module variable) MUST be preserved. New SSE stores should reference `getCredentials()` at call time, never store credentials.
**Warning signs:** apiKey visible in React DevTools state inspector.

### Pitfall 4: Stale Agent State After SSE Reconnect
**What goes wrong:** After an SSE disconnect/reconnect, the dashboard shows stale data from before the gap.
**Why it happens:** SSE events during the disconnect are lost (no replay mechanism in hushd events endpoint).
**How to avoid:** On SSE reconnect, trigger a full `refreshAgents()` poll to re-sync state, then resume SSE for incremental updates.
**Warning signs:** Agent counts or statuses diverge from what `GET /api/v1/agents/status` returns.

### Pitfall 5: Policy Drift Requires Expected Versions
**What goes wrong:** Drift detection returns `false` for all agents even when they have mismatched policy versions.
**Why it happens:** The server computes drift by comparing against `expected_policy_version` and `expected_daemon_version` query parameters. If these are not provided, drift is not computed.
**How to avoid:** Always pass `expected_policy_version` (from the current remote policy hash) when fetching agent status. The existing fleet-client does NOT pass this; it will need to be added.
**Warning signs:** `drift.policy_drift` is always `false` even when agents clearly have different versions.

### Pitfall 6: Fleet URL Proxy Rewrite in Dev
**What goes wrong:** API calls fail with CORS errors or reach the wrong backend.
**Why it happens:** In development, URLs are rewritten to `/_proxy/hushd{path}` by `proxyUrl()`. SSE URLs need the same rewriting.
**How to avoid:** Use the same `proxyUrl()` function from fleet-client for SSE URLs.
**Warning signs:** Network tab shows requests going to the raw hushd URL instead of the dev proxy.

## Code Examples

### Existing: Connecting to Fleet

```typescript
// Source: src/features/fleet/use-fleet-connection.ts
const { connection, agents, refreshAgents, pollError } = useFleetConnection();

// Or via selectors (preferred for new code):
const connection = useFleetConnectionStore.use.connection();
const agents = useFleetConnectionStore.use.agents();
const actions = useFleetConnectionStore.use.actions();
```

### Existing: Deploying Policy

```typescript
// Source: src/features/fleet/fleet-client.ts
import { deployPolicy, validateRemotely } from "@/features/fleet/fleet-client";

const conn = useFleetConnectionStore.getState().actions.getAuthenticatedConnection();
const validation = await validateRemotely(conn, yamlContent);
if (validation.valid) {
  const result = await deployPolicy(conn, yamlContent);
  // result: { success: boolean; hash?: string; error?: string }
}
```

### Existing: SSE with Auth (fetch-based)

```typescript
// Adapted from: src/components/workbench/editor/live-agent-tab.tsx
async function connectSSE(url: string, apiKey: string, onEvent: (type: string, data: unknown) => void) {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
    signal: controller.signal,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE format: "event: type\ndata: json\n\n"
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const block of lines) {
      let eventType = "";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        if (line.startsWith("data: ")) data = line.slice(6);
      }
      if (eventType && data) {
        onEvent(eventType, JSON.parse(data));
      }
    }
  }

  return controller;
}
```

### Existing: Agent Info Type

```typescript
// Source: src/features/fleet/fleet-client.ts
interface AgentInfo {
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
  drift: {
    policy_drift: boolean;
    daemon_drift: boolean;
    stale: boolean;
  };
}
```

### Existing: Opening Agent Detail in Pane

```typescript
// Source: src/features/activity-bar/panels/fleet-panel.tsx
import { usePaneStore } from "@/features/panes/pane-store";

usePaneStore.getState().openApp(
  `/fleet/${agent.endpoint_agent_id}`,
  agent.endpoint_agent_id,
);
```

## State of the Art

| Current Approach | Needed Enhancement | Impact |
|-----------------|-------------------|--------|
| 60s polling for agents | SSE streaming for real-time updates | Sub-second agent status visibility |
| Table-only dashboard | Add posture visualization / topology view | At-a-glance fleet health |
| Deploy only from editor panel | One-click deploy from fleet dashboard context | Faster drift remediation |
| No drift root-cause display | Per-agent drift detail with expected vs actual | Faster troubleshooting |
| No per-agent SSE filtering | Use `endpoint_agent_id` SSE filter for agent detail view | Efficient per-agent streaming |
| Drift flags not computed | Pass `expected_policy_version` to agent status API | Accurate drift detection |

## Open Questions

1. **Agent detail route handling**
   - What we know: The fleet panel opens `/fleet/{agent_id}` but no route handler exists for this pattern -- it currently falls through to the main FleetDashboard which has no routing logic for sub-paths.
   - What's unclear: Should agent detail be a separate route (`fleet/:id`) or inline expansion (current behavior)?
   - Recommendation: Add `{ path: "fleet/:id", element: <FleetAgentDetail /> }` route to `workbench-routes.tsx`.

2. **Expected policy version for drift detection**
   - What we know: The server needs `expected_policy_version` query param to compute drift. The current fleet-client `fetchAgentList()` does not pass this.
   - What's unclear: Should the expected version come from the remote policy hash or a user-configured "golden" version?
   - Recommendation: Use `remotePolicyInfo.version` (already in store) as the expected version. Add it as a query param to the agent status fetch.

3. **SSE event types for fleet dashboard**
   - What we know: hushd broadcasts many event types. The fleet dashboard only needs a subset.
   - Recommendation: Subscribe with `event_types=agent_heartbeat,check,policy_updated,policy_reloaded,policy_bundle_update,session_posture_transition` to minimize noise.

4. **One-click policy push scope**
   - What we know: The deploy panel has a full confirmation flow with type-to-confirm. "One-click" may conflict with the existing safety mechanism.
   - Recommendation: Provide a "Quick Deploy" action that pre-fills the deploy dialog with the drift context (which agents are out of date, what version they should be on). Do NOT remove the confirmation step.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (configured in project) |
| Config file | `apps/workbench/vitest.config.ts` (inferred) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Existing Tests
- `src/components/workbench/fleet/__tests__/` -- fleet dashboard tests exist
- `src/components/workbench/editor/__tests__/live-agent-tab.test.ts` -- SSE streaming tests exist

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLEET-01 | SSE connection lifecycle | unit | `npx vitest run src/features/fleet/use-fleet-events.test.ts -x` | Wave 0 |
| FLEET-02 | Agent heartbeat merge | unit | `npx vitest run src/features/fleet/fleet-event-reducer.test.ts -x` | Wave 0 |
| FLEET-03 | Deploy from dashboard | integration | `npx vitest run src/components/workbench/fleet/__tests__/fleet-deploy.test.ts -x` | Wave 0 |
| FLEET-04 | Drift detection with expected version | unit | `npx vitest run src/features/fleet/__tests__/drift-detection.test.ts -x` | Wave 0 |
| FLEET-05 | SSE reconnect + re-sync | unit | `npx vitest run src/features/fleet/__tests__/sse-reconnect.test.ts -x` | Wave 0 |

### Wave 0 Gaps
- [ ] `src/features/fleet/__tests__/use-fleet-events.test.ts` -- SSE store tests
- [ ] `src/features/fleet/__tests__/fleet-event-reducer.test.ts` -- event processing tests
- [ ] `src/features/fleet/__tests__/drift-detection.test.ts` -- drift query param tests

## Sources

### Primary (HIGH confidence)
- Direct code reading of all listed files in the workbench app
- Direct code reading of `crates/services/hushd/src/api/` (mod.rs, health.rs, agent_status.rs, events.rs, policy.rs)
- Direct code reading of `crates/services/hushd/src/state.rs` for DaemonEvent broadcast mechanism

### Secondary (MEDIUM confidence)
- Inferred test framework from project structure and existing test files
- SSE event type list derived from `broadcast(DaemonEvent {...})` call sites across hushd source

## Metadata

**Confidence breakdown:**
- Existing infrastructure: HIGH -- all code read directly
- hushd API surface: HIGH -- all route handlers and types read
- SSE event types: HIGH -- traced all broadcast() call sites
- Architecture patterns: HIGH -- derived from existing codebase patterns
- Pitfalls: HIGH -- derived from direct code analysis of existing implementations

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable internal codebase, not external dependencies)
