# Plugin Sandboxing Research

**Domain:** Plugin isolation and security enforcement for desktop IDE
**Researched:** 2026-03-18
**Overall confidence:** MEDIUM-HIGH (training data knowledge verified against codebase patterns; no web search available)

---

## 1. iframe Sandbox Patterns in Desktop Apps

### State of the Art

Three dominant patterns exist for sandboxing plugins in desktop applications built on web technology:

#### VS Code Webview Extensions
**Confidence: HIGH (well-documented, stable pattern)**

VS Code runs extension webviews in `<iframe>` elements with `sandbox` attribute. The key design:

- Each webview runs in a **separate iframe** with `sandbox="allow-scripts allow-same-origin"` (the `allow-same-origin` is needed for the webview to use `postMessage` with the VS Code host, but scripts from the webview cannot access the parent window's DOM).
- Communication is exclusively via **`window.postMessage`** -- the iframe has zero access to the host's JavaScript context, DOM, or Node.js APIs.
- The host provides a **`acquireVsCodeApi()`** function injected into the iframe's script context that returns a proxy object. This proxy wraps `postMessage` calls into a typed API.
- Webview content is loaded from a **special `vscode-webview://` protocol** (Electron custom protocol), not `file://`. This gives full CSP control.
- Extensions that need to render UI run code in the **extension host process** (a separate Node.js process) and send data to the webview via messages. The webview is purely a rendering surface.

**Key takeaway for ClawdStrike:** VS Code's dual-process model (extension host + webview) is heavy. ClawdStrike community plugins are simpler -- they do not need a separate Node.js process. The iframe-only model (like Figma) is more appropriate.

#### Figma Plugin Sandbox
**Confidence: HIGH (well-documented)**

Figma's model is the closest match for ClawdStrike's needs:

- Plugin code runs in a **sandboxed `<iframe>` with `sandbox="allow-scripts"`** (no `allow-same-origin`). This is the strictest useful sandbox -- scripts can execute but cannot read cookies, localStorage, or access the parent frame.
- The iframe loads a **`null` origin** document (via `srcdoc` or `blob:` URL). The plugin's JavaScript is injected into this document.
- All communication happens via **`postMessage`**. The Figma host provides a structured message protocol, not raw messages.
- The plugin iframe has **no network access by default** -- CSP blocks all `connect-src`, `fetch`, and XHR. Plugins that need network access must declare it, and the host proxies the request.
- Figma provides a **`figma` global object** that is actually a message-passing proxy, not a direct reference. Calling `figma.createRectangle()` sends a message to the host, which performs the operation and returns the result.
- Plugin UI runs in a **second iframe** (the first is the code sandbox, the second is the UI sandbox). The code sandbox has API access but no DOM; the UI sandbox has DOM but no API access. They communicate via `postMessage` through the host.

**Key takeaway for ClawdStrike:** Figma's "null-origin iframe + CSP lockdown + message proxy" is the right model. ClawdStrike can simplify by using a single iframe (code + UI together) since community plugins in a security workbench do not need the same rendering flexibility as a design tool.

#### Obsidian Community Plugins
**Confidence: MEDIUM (less formally documented)**

Obsidian takes a **different, weaker approach**:

- Community plugins run **in-process** in the main Electron renderer. They share the same JavaScript context as the app.
- Isolation is achieved via **code review + signing** rather than technical sandboxing. The community plugin review process is the primary security gate.
- Plugins can access the full Obsidian API, the DOM, and Node.js (via Electron). This is a **trust-based, not sandbox-based** model.
- This approach has led to security incidents where malicious plugins accessed the filesystem and network.

**Key takeaway for ClawdStrike:** Obsidian's model is explicitly what ClawdStrike should NOT do for community plugins. The PROJECT.md already correctly identifies that community plugins must be iframe-sandboxed.

### Recommendation for ClawdStrike

Use the **Figma model**: null-origin iframe + strict CSP + postMessage bridge. Specifically:

1. Community plugins load into `<iframe sandbox="allow-scripts">` -- no `allow-same-origin`, no `allow-top-navigation`, no `allow-popups`.
2. Plugin code is loaded via `srcdoc` or `blob:` URL to get a `null` origin, preventing any cookie/storage access to the host.
3. All API access goes through a postMessage proxy (see section 2).
4. Internal plugins continue to run in-process (no iframe overhead) since they are first-party code.

---

## 2. postMessage Bridge Architecture

### The Core Problem

Plugins in an iframe cannot:
- Call functions in the host window
- Access React state/context
- Import host modules
- Render React components in the host DOM
- Use host-side Tauri commands

Everything must be serialized as JSON messages. The bridge must handle:
- **Request/response pairing** (async RPC over messages)
- **Event subscriptions** (host pushes updates to plugin)
- **Error propagation** (host-side errors must reach the plugin)
- **Type safety** (both sides should know the message schema)

### Architecture: Typed RPC over postMessage

**Confidence: HIGH (widely used pattern)**

```
Plugin iframe                              Host window
  |                                           |
  |  PluginBridgeClient                       |  PluginBridgeHost
  |    .call("guards.register", payload) -->  |    dispatches to real registry
  |    <-- { id, result }                     |    returns serialized result
  |                                           |
  |    .subscribe("policy.changed") -------> |    adds listener
  |    <-- { type: "event", ... }             |    pushes updates
  |                                           |
  |    .call("storage.get", "key") ---------> |    reads plugin-scoped store
  |    <-- { id, result: value }              |    returns value
```

#### Message Protocol

```typescript
// All messages conform to this envelope
interface BridgeMessage {
  /** Unique message ID for request/response correlation */
  id: string;
  /** Message direction */
  type: "request" | "response" | "event" | "error";
  /** Namespaced method (e.g., "guards.register", "commands.execute") */
  method?: string;
  /** Serialized arguments */
  params?: unknown;
  /** Response payload */
  result?: unknown;
  /** Error details */
  error?: { code: string; message: string };
}
```

#### Request/Response Correlation

The standard pattern uses monotonically increasing IDs or UUIDs:

```typescript
class PluginBridgeClient {
  private pending = new Map<string, { resolve: Function; reject: Function }>();
  private nextId = 0;

  async call<T>(method: string, params?: unknown): Promise<T> {
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      parent.postMessage({ id, type: "request", method, params }, "*");
      // Timeout after 30s to prevent leaked promises
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Bridge call "${method}" timed out`));
        }
      }, 30_000);
    });
  }

  handleMessage(event: MessageEvent) {
    const msg = event.data as BridgeMessage;
    if (msg.type === "response" || msg.type === "error") {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.type === "error") {
          pending.reject(new Error(msg.error?.message ?? "Unknown error"));
        } else {
          pending.resolve(msg.result);
        }
      }
    }
    if (msg.type === "event") {
      // Dispatch to subscription handlers
      this.eventHandlers.get(msg.method!)?.forEach(fn => fn(msg.params));
    }
  }
}
```

#### Serialization Challenges

**Functions cannot be serialized.** This is the biggest constraint:

- Plugin cannot pass a callback function to the host. Instead, use **command IDs**: the plugin registers a named command, and the host invokes it by name when needed.
- Plugin cannot return React components. Instead, plugin UI renders **inside the iframe**. The host reserves a DOM slot (e.g., a panel area) and sizes the iframe to fill it.
- Event handlers must be **subscription-based**: plugin calls `subscribe("event.name")`, host maintains a subscription list and pushes events.

**React components cannot cross the iframe boundary.** Two options:

1. **Plugin renders its own React tree inside the iframe.** The SDK bundles a thin React runtime (or the plugin bundles its own). The host provides a design system CSS file that the plugin iframe can load. This is Figma's approach.
2. **Plugin sends declarative UI descriptions (JSON) that the host renders.** Like VS Code's TreeView API where the extension describes nodes and the host renders them. Better for simple UIs (config panels, lists) but limits expressiveness.

**Recommendation:** Use option 1 (plugin renders its own React) for editor tabs, sidebar panels, and bottom panel tabs. Use option 2 (declarative JSON) for simple contribution points like status bar items, guard config fields, and activity bar items (which already use a declarative `ConfigFieldDef` schema).

#### Event Subscriptions

```typescript
// Plugin side (inside iframe)
const unsubscribe = await bridge.subscribe("policy.changed", (policy) => {
  // Update plugin UI with new policy
});

// Host side
class PluginBridgeHost {
  private subscriptions = new Map<string, Set<string>>(); // event -> Set<pluginId>

  handleSubscribe(pluginId: string, event: string) {
    if (!this.isEventAllowed(pluginId, event)) {
      throw new PermissionError(`Plugin ${pluginId} lacks permission for event ${event}`);
    }
    // Add to subscription list; when event fires, post to plugin iframe
  }
}
```

### Mapping Existing PluginContext API to Bridge Messages

The existing `PluginContext` interface maps cleanly to bridge methods:

| PluginContext API | Bridge Method | Serializable? |
|---|---|---|
| `commands.register(cmd, handler)` | `"commands.register"` + command ID callback pattern | Yes (handler stored host-side by ID) |
| `guards.register(guard)` | `"guards.register"` | Yes (GuardContribution is pure data) |
| `fileTypes.register(ft)` | `"fileTypes.register"` | Yes (FileTypeContribution is pure data) |
| `statusBar.register(item)` | `"statusBar.register"` | Partial (render function must be declarative) |
| `storage.get(key)` | `"storage.get"` | Yes |
| `storage.set(key, value)` | `"storage.set"` | Yes (value must be JSON-serializable) |

The key insight: **most of the existing contribution points are already purely declarative data** (GuardContribution, FileTypeContribution, etc.). The only contribution points that involve functions are command handlers and render functions, both of which can use the callback pattern.

---

## 3. Permission System Design

### Capability-Based vs Role-Based

**Confidence: HIGH (well-established patterns)**

| Approach | Fit for Plugins | Why |
|---|---|---|
| **Capability-based** (declare what you need) | Best fit | Plugins declare permissions in manifest. Host enforces at bridge level. Matches VS Code + Chrome extension model. |
| **Role-based** (admin/user/readonly) | Poor fit | Plugins are not users. A guard plugin needs different permissions than a UI plugin. Roles are too coarse. |
| **Hybrid** | Overkill | Add role-based on top of capabilities only if operator override is needed (e.g., "admin can grant extra permissions"). |

**Recommendation:** Capability-based, declared in the plugin manifest.

### Permission Declaration (Manifest Extension)

Add a `permissions` field to `PluginManifest`:

```typescript
interface PluginManifest {
  // ... existing fields ...

  /** Declared permissions (capabilities the plugin requires). */
  permissions?: PluginPermission[];
}

/**
 * Permission categories with granular scopes.
 * Use "scope:action" format similar to OAuth scopes.
 */
type PluginPermission =
  // Registry access
  | "guards:register"        // Register custom guards
  | "guards:read"            // Read guard configurations
  | "fileTypes:register"     // Register file types
  | "commands:register"      // Register commands
  | "commands:execute"       // Execute other commands
  | "statusBar:register"     // Register status bar items
  | "sidebar:register"       // Register sidebar panels
  // Data access
  | "storage:read"           // Read plugin-scoped storage
  | "storage:write"          // Write plugin-scoped storage
  | "policy:read"            // Read current policy
  | "policy:write"           // Modify policy (high privilege)
  | "detections:read"        // Read detection rules
  | "detections:write"       // Create/modify detection rules
  | "findings:read"          // Read findings/alerts
  // Network
  | "network:fetch"          // Make outbound HTTP requests (scoped to declared domains)
  // System
  | "clipboard:read"         // Read clipboard
  | "clipboard:write"        // Write clipboard
  | "notifications:show"     // Show desktop notifications
  ;
```

### How VS Code Does It

VS Code extensions declare permissions in `package.json` via `contributes` and implicit API access. However, VS Code's model is permissive -- extensions get broad API access by default. The only gated permissions are:
- Workspace trust (restricted in untrusted workspaces)
- Proposed API access (feature flags for unstable APIs)

ClawdStrike should be **stricter than VS Code** because it is a security product. Principle of least privilege.

### How Chrome Extensions Do It

Chrome uses `manifest.json` `permissions` array with granular capabilities:
```json
{
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://api.example.com/*"]
}
```

Ungranted permissions cause API calls to throw. The browser prompts the user at install time.

**Key design from Chrome to adopt:**
- Permissions are declared at install time, not requested at runtime.
- The host refuses API calls for undeclared permissions (fail-closed).
- Network permissions are scoped to specific domain patterns.

### Bridge-Level Enforcement

The `PluginBridgeHost` enforces permissions as a middleware layer:

```typescript
class PluginBridgeHost {
  private permissions: Set<PluginPermission>;

  handleRequest(pluginId: string, method: string, params: unknown) {
    const requiredPermission = METHOD_TO_PERMISSION[method];
    if (requiredPermission && !this.permissions.has(requiredPermission)) {
      return {
        type: "error",
        error: {
          code: "PERMISSION_DENIED",
          message: `Plugin "${pluginId}" requires "${requiredPermission}" permission for "${method}"`
        }
      };
    }
    // Proceed with actual handler
  }
}

const METHOD_TO_PERMISSION: Record<string, PluginPermission> = {
  "guards.register": "guards:register",
  "guards.read": "guards:read",
  "policy.read": "policy:read",
  "storage.get": "storage:read",
  "storage.set": "storage:write",
  "network.fetch": "network:fetch",
  // ...
};
```

### Network Permission Scoping

For plugins that need outbound network (e.g., a VirusTotal threat intel plugin):

```typescript
interface NetworkPermission {
  type: "network:fetch";
  /** Allowed domain patterns. Supports wildcards. */
  allowedDomains: string[];
  /** Allowed HTTP methods. Default: ["GET"]. */
  methods?: string[];
}

// Example in manifest:
{
  "permissions": [
    { "type": "network:fetch", "allowedDomains": ["api.virustotal.com"], "methods": ["GET", "POST"] }
  ]
}
```

The bridge host validates the URL against `allowedDomains` before proxying the fetch. The iframe itself has CSP `connect-src 'none'` so it cannot make direct network calls.

---

## 4. CSP for Plugin iframes

### Baseline CSP for Community Plugin iframes

**Confidence: HIGH (CSP is a well-understood standard)**

```
Content-Security-Policy:
  default-src 'none';
  script-src 'unsafe-inline' blob:;
  style-src 'unsafe-inline';
  img-src data: blob:;
  connect-src 'none';
  frame-src 'none';
  worker-src 'none';
  child-src 'none';
  object-src 'none';
  base-uri 'none';
  form-action 'none';
```

Explanation:
- `default-src 'none'` -- deny everything by default.
- `script-src 'unsafe-inline' blob:` -- the plugin code is injected via `srcdoc` so inline scripts must be allowed. `blob:` supports dynamic module creation. **No `'unsafe-eval'`** -- plugins cannot use `eval()`, `new Function()`, or `setTimeout(string)`.
- `style-src 'unsafe-inline'` -- plugins can use inline styles for their UI.
- `img-src data: blob:` -- plugins can render images from data URIs and blob URLs but cannot load external images.
- `connect-src 'none'` -- **no direct network access**. All network goes through the bridge host.
- `frame-src 'none'` -- no nested iframes.
- `worker-src 'none'` -- no Web Workers (prevents background computation abuse).
- `object-src 'none'` -- no Flash, Java, etc.
- `form-action 'none'` -- no form submissions.

### Tauri 2 Security Model Interaction

**Confidence: MEDIUM (based on Tauri 2 architecture knowledge + the existing tauri.conf.json)**

The existing `tauri.conf.json` has:
```json
"security": {
  "csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"
}
```

Key interactions:

1. **Tauri's CSP applies to the main webview**, not to iframes. The iframe's CSP is controlled by the `<iframe>` element's `csp` attribute (via the `Content-Security-Policy` header of the iframe's document) or by the `srcdoc` approach.

2. **Tauri's IPC (`ipc:`, `http://ipc.localhost`)** is only available in the main webview context. An iframe with `sandbox="allow-scripts"` (no `allow-same-origin`) **cannot access Tauri IPC**. This is a security feature -- community plugins cannot call Tauri commands directly.

3. **`__TAURI_INTERNALS__`** is injected into the main webview's `window` object. Sandboxed iframes do not inherit this, so plugins cannot call `invoke()` to reach Rust commands.

4. **The `asset:` protocol** (Tauri's custom protocol for loading bundled assets) is available in the main webview. Plugin iframes loaded via `srcdoc` or `blob:` cannot use `asset:` protocol, which is correct -- plugins should not read the app's bundled files.

**Implication:** The iframe sandbox naturally isolates community plugins from Tauri's Rust backend. The bridge host (running in the main webview) is the only gateway to Tauri commands.

### What Can and Cannot Be Locked Down

**Can lock down:**
- Direct network access (CSP `connect-src 'none'`)
- Filesystem access (no `file:` protocol, no Tauri FS commands)
- eval/Function constructor (omit `'unsafe-eval'`)
- Clipboard access (CSP + no `clipboard-read`/`clipboard-write` permissions API)
- Navigation/popups (`sandbox` without `allow-popups`, `allow-top-navigation`)
- External script loading (`script-src` without `https:`)
- Cookie/localStorage (`sandbox` without `allow-same-origin`)

**Cannot fully lock down with CSP alone:**
- CPU usage (a plugin can spin a tight loop). Mitigation: monitor iframe with `performance.measureUserAgentSpecificMemory()` or terminate iframes that become unresponsive.
- Memory usage (same mitigation as CPU).
- Timing side channels (Spectre-class). Mitigation: `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers, though these are less relevant in a desktop app context.
- `postMessage` flooding (a plugin can spam messages). Mitigation: rate-limit incoming messages from each plugin iframe.

---

## 5. Plugin Audit Trail Using ClawdStrike Receipts

### Existing Receipt Infrastructure

The codebase has a mature receipt system in `crates/hush-core/src/receipt.rs`:

- `Receipt` struct with version, timestamp, content_hash (SHA-256), verdict, provenance, metadata.
- `SignedReceipt` with Ed25519 signature (primary signer + optional co-signer).
- Canonical JSON serialization (RFC 8785) for deterministic signing.
- `VerificationResult` with error codes (VFY_* taxonomy).
- Kernel enforcement metadata fields (`sandbox.enforced`, `sandbox.enforcement_level`).

### Proposed Plugin Action Receipt Schema

Extend the receipt metadata to capture plugin actions:

```typescript
interface PluginActionReceipt {
  version: "1.0.0";
  timestamp: string; // ISO-8601
  receipt_id: string; // UUID v7 for time-sortable IDs

  // What happened
  content_hash: string; // SHA-256 of canonical action payload
  verdict: {
    passed: boolean;
    gate_id: "plugin_sandbox"; // Identifies this as a plugin action receipt
  };

  // Plugin context
  provenance: {
    clawdstrike_version: string;
    provider: "plugin_sandbox";
    policy_hash: string;
    violations: ViolationRef[]; // If any permission was denied
  };

  // Plugin-specific metadata
  metadata: {
    plugin: {
      id: string;              // Plugin ID
      version: string;         // Plugin version
      publisher: string;       // Publisher
      trust_tier: "community" | "internal" | "mcp";
    };
    action: {
      type: string;            // "guards.register" | "network.fetch" | "storage.write" | etc.
      params_hash: string;     // SHA-256 of the action parameters (not the full params, for privacy)
      result: "allowed" | "denied" | "error";
      permission_checked: string; // Which permission was checked
      duration_ms: number;     // How long the action took
    };
    sandbox: {
      enforced: true;
      enforcement_level: "iframe_csp"; // Or "in_process" for internal plugins
    };
  };
}
```

### Receipt Generation Points

Every bridge call generates a receipt:

| Action | Receipt Generated? | Why |
|---|---|---|
| `guards.register` | Yes | Tracks what guards a plugin registered |
| `network.fetch` | Yes | Audit trail for outbound network requests |
| `storage.write` | Yes | Tracks data mutation |
| `storage.read` | Optional (configurable) | Read auditing can be noisy |
| `policy.read` | Yes | Tracks who reads policy (data exfiltration signal) |
| `commands.execute` | Yes | Tracks cross-plugin command execution |
| Permission denied | Always | Security event, must be logged |

### Receipt Storage

Two tiers:

1. **Local SQLite** (existing pattern in `SqliteCertificationStore`, `SqliteRevocationStore`): All plugin action receipts are written to a local SQLite database on the workbench instance. This provides immediate queryability and offline operation.

2. **hushd forwarding** (existing pattern via `AuditForwarder`): Receipts are forwarded to the hushd daemon when connected. This enables fleet-wide aggregation and the SIEM exporters (Splunk, Elastic, Datadog) to pick up plugin action events.

### Querying the Audit Trail

Provide a plugin audit view in the workbench:

```sql
-- All actions by a specific plugin in the last 24 hours
SELECT * FROM plugin_receipts
WHERE plugin_id = 'community.virustotal-lookup'
  AND timestamp > datetime('now', '-24 hours')
ORDER BY timestamp DESC;

-- All denied actions across all plugins
SELECT * FROM plugin_receipts
WHERE result = 'denied'
ORDER BY timestamp DESC;

-- Network calls by plugin (potential data exfiltration)
SELECT plugin_id, action_type, COUNT(*) as call_count
FROM plugin_receipts
WHERE action_type = 'network.fetch'
GROUP BY plugin_id
ORDER BY call_count DESC;
```

### Integration with Existing Infrastructure

The existing `operator-crypto.ts` module provides `signCanonical()` and `verifyCanonical()` -- the same functions used for plugin trust verification. Plugin action receipts should use the same signing key (the operator's Ed25519 keypair) for consistency. The receipt can be signed locally and verified on hushd.

---

## 6. Emergency Revocation

### Existing Revocation Store

The codebase has a well-designed revocation system in `crates/hush-multi-agent/src/revocation.rs`:

- **`RevocationStore` trait** with `is_revoked(token_id, now_unix)` and `revoke(token_id, until_unix)`.
- **`InMemoryRevocationStore`** for ephemeral use (tests, single-instance).
- **`SqliteRevocationStore`** (behind `sqlite` feature flag) for durable, persistent revocation with:
  - WAL mode for concurrent reads.
  - Capacity limits with LRU eviction.
  - Automatic expiration of time-limited revocations.
  - Nonce replay protection (`check_and_mark_nonce`).
  - **Fail-closed on DB errors** -- if the DB query fails, the token is treated as revoked.

### Plugin Revocation Model

Extend the revocation system to support plugin IDs:

```rust
// New revocation scope: "plugin:{plugin_id}"
// Example: revoke("plugin:community.virustotal-lookup", None) -- permanent
// Example: revoke("plugin:community.virustotal-lookup", Some(1711000000)) -- until timestamp
```

### Fleet-Wide Kill via hushd

The hushd daemon already has:
- **SSE event stream** (`/api/v1/events`) that all connected workbench instances subscribe to.
- **`broadcast::Sender<DaemonEvent>`** for pushing events to all listeners.
- **`BrokerStateStore`** with revocation capabilities for broker tokens.
- **RBAC system** with `Action` and `ResourceType` for access control.

The revocation flow:

```
1. Operator calls hushd API:
   POST /api/v1/plugins/{plugin_id}/revoke
   Body: { "reason": "Malicious behavior detected", "until": null }

2. hushd stores revocation in SqliteRevocationStore

3. hushd broadcasts DaemonEvent:
   { "event_type": "plugin_revoked", "data": { "plugin_id": "...", "reason": "..." } }

4. All connected workbench instances receive the SSE event

5. Each workbench instance:
   a. Calls pluginLoader.deactivatePlugin(pluginId) -- disposes all contributions
   b. Sets plugin state to "revoked" (new lifecycle state)
   c. Stores revocation locally (survives offline restart)
   d. Generates a signed receipt for the revocation action
```

### Handling Mid-Execution Revocation

When a plugin is revoked while it is processing a request:

1. **Bridge calls in-flight**: The `PluginBridgeHost` checks the revocation store before processing each message. If the plugin is revoked mid-call, the response is `{ type: "error", error: { code: "PLUGIN_REVOKED" } }`.

2. **iframe termination**: After draining in-flight responses (with a 5-second timeout), remove the iframe from the DOM. This immediately terminates all plugin code.

3. **Contribution cleanup**: The existing `deactivatePlugin()` method already calls all disposables, which unregister guards, commands, file types, etc. This is synchronous and complete.

4. **State consistency**: If a plugin registered a guard that is mid-evaluation when revoked, the guard evaluation should complete (the guard metadata is already copied into the guard registry). The next evaluation will not find the guard (it has been unregistered). No data corruption risk.

### Offline Revocation Sync

When a workbench instance is offline and reconnects:

1. On reconnect, fetch the current revocation list from hushd: `GET /api/v1/plugins/revocations`.
2. Diff against local revocation state.
3. Deactivate any newly-revoked plugins.
4. Reactivate any plugins whose revocation has expired (time-limited revocations).

### New Lifecycle State

Add `"revoked"` to the `PluginLifecycleState` union:

```typescript
export type PluginLifecycleState =
  | "not-installed"
  | "installing"
  | "installed"
  | "activating"
  | "activated"
  | "deactivated"
  | "revoked"     // New: plugin killed by operator/fleet
  | "error";
```

Revoked plugins display a warning badge in the marketplace UI and cannot be reactivated until the revocation is lifted.

---

## 7. Existing Infrastructure to Reuse

### Already Built (Phase 1-6 of Plugin Ecosystem)

| Component | File | Reusable For |
|---|---|---|
| Plugin manifest types | `plugins/types.ts` | Permission declarations go here. Trust tier already distinguishes internal/community/mcp. |
| Plugin registry | `plugins/plugin-registry.ts` | Add `"revoked"` state. Add permission tracking. Lifecycle events already support subscribers. |
| Plugin loader | `plugins/plugin-loader.ts` | Fork loading path by trust tier: internal = in-process, community = iframe + bridge. |
| Trust verification | `plugins/plugin-trust.ts` | Already verifies Ed25519 signatures. No changes needed. |
| Plugin installer | `plugins/plugin-installer.ts` | Orchestration layer. Add permission prompt before install. |
| Activation events | `plugins/activation-events.ts` | Works unchanged for iframe plugins. |
| Manifest validation | `plugins/manifest-validation.ts` | Add permission validation rules. |
| Plugin SDK | `packages/sdk/plugin-sdk/` | SDK types need a `SandboxedPluginContext` variant that uses bridge instead of direct APIs. |
| Operator crypto | `workbench/operator-crypto.ts` | Sign plugin action receipts. Already has `signCanonical()` and `verifyCanonical()`. |

### Already Built (Core Crates)

| Component | Location | Reusable For |
|---|---|---|
| Receipt system | `hush-core/src/receipt.rs` | Plugin action receipts. Receipt + SignedReceipt + Verdict + Provenance all work. |
| Revocation store | `hush-multi-agent/src/revocation.rs` | Plugin revocation. Both InMemory and SQLite stores available. |
| SSE event stream | `hushd/src/api/events.rs` | Fleet-wide revocation broadcast. Already supports filtered event subscriptions. |
| Audit ledger | `hushd/src/audit/` | Forward plugin receipts to SIEM exporters. |
| RBAC | `hushd/src/rbac/` | Authorize who can revoke plugins (`plugins:revoke` action). |
| Canonical JSON | `hush-core/src/canonical.rs` | Deterministic serialization for receipt content hashing. |

### Gaps to Fill

| Gap | What to Build | Effort |
|---|---|---|
| **PluginBridgeHost** | Message dispatcher in host window that routes bridge calls to registries | Medium |
| **PluginBridgeClient** | SDK-side message proxy injected into iframe | Medium |
| **PluginSandbox component** | React component that manages iframe lifecycle, injects code, handles bridge | Medium |
| **Permission enforcement layer** | Middleware in bridge host that checks permissions before dispatch | Low |
| **Plugin CSP builder** | Generates CSP string based on declared permissions | Low |
| **Plugin receipt store** | SQLite table for local plugin action receipts | Low (copy SqliteRevocationStore pattern) |
| **hushd plugin routes** | `/api/v1/plugins/revoke`, `/api/v1/plugins/revocations` | Medium |
| **Revocation sync** | Workbench-side SSE listener for `plugin_revoked` events | Low |

---

## 8. Architecture Recommendation

### Component Diagram

```
+------------------------------------------------------------------+
|  Host Window (Main Webview)                                       |
|                                                                   |
|  +------------------+     +------------------+                    |
|  | PluginLoader     |     | PluginRegistry   |                    |
|  |  (existing)      |     |  (existing)      |                    |
|  +--------+---------+     +--------+---------+                    |
|           |                        |                              |
|  +--------v-------------------------v---------+                   |
|  | PluginSandboxManager                       |                   |
|  |  - Creates iframes for community plugins   |                   |
|  |  - Manages PluginBridgeHost per iframe      |                   |
|  |  - Enforces permissions at bridge level     |                   |
|  |  - Generates receipts for all actions       |                   |
|  |  - Handles revocation events                |                   |
|  +---+-----+-----+---+---+---+---+---+-------+                   |
|      |     |     |   |   |   |   |   |                            |
|      v     v     v   v   v   v   v   v                            |
|  [GuardReg][CmdReg][FileTypeReg][StatusBarReg]  (existing regs)   |
|                                                                   |
+---+---+---+---+---+---+---+---+---+---+---+---+------------------+
    |   |   |   |   |   |   |   |   |   |   |   |
    v   v   v   v   v   v   v   v   v   v   v   v
  +-------+ +-------+ +-------+
  |iframe | |iframe | |iframe |   Community Plugin Sandboxes
  | P1    | | P2    | | P3    |   (null origin, strict CSP)
  |       | |       | |       |
  |Bridge | |Bridge | |Bridge |   PluginBridgeClient
  |Client | |Client | |Client |   (SDK injected)
  +-------+ +-------+ +-------+
```

### Loading Path by Trust Tier

```
Plugin manifest.trust === "internal"
  --> PluginLoader.loadPlugin() (existing path, in-process)
  --> Direct registry access
  --> No iframe, no bridge, no CSP

Plugin manifest.trust === "community"
  --> PluginLoader.loadPlugin() detects trust tier
  --> Creates PluginSandbox (iframe + CSP)
  --> Injects plugin code + PluginBridgeClient
  --> All API calls go through PluginBridgeHost
  --> Permission enforcement + receipt generation

Plugin manifest.trust === "mcp"
  --> MCP transport (already supported, out of scope for this research)
```

### Phased Implementation Recommendation

**Phase A: Bridge Infrastructure** (foundation)
- Build `PluginBridgeHost` and `PluginBridgeClient`
- Message protocol with request/response correlation
- Map existing PluginContext API to bridge methods
- Unit tests with mock iframes

**Phase B: iframe Sandbox** (isolation)
- Build `PluginSandbox` React component
- CSP generation based on permissions
- Plugin code injection via `srcdoc`
- Integration with PluginLoader (fork by trust tier)

**Phase C: Permission System** (enforcement)
- Add `permissions` to PluginManifest
- Permission enforcement middleware in bridge host
- Manifest validation for permissions
- Permission prompt UI at install time

**Phase D: Audit Trail** (observability)
- Plugin action receipt generation
- Local SQLite receipt store
- Receipt viewer in workbench UI
- hushd forwarding of plugin receipts

**Phase E: Emergency Revocation** (fleet safety)
- hushd plugin revocation API routes
- SSE event propagation
- Workbench-side revocation handler
- Offline sync on reconnect
- `"revoked"` lifecycle state

### Phase Ordering Rationale

A before B: The bridge must exist before the iframe can use it.
B before C: The sandbox must exist before permissions matter.
C before D: Permission checks are what generate receipt-worthy events.
D before E: The audit trail should capture revocation events.

However, D and E could be developed in parallel since they are relatively independent.

---

## 9. Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| iframe sandbox model | HIGH | Well-established pattern (Figma, VS Code). No ambiguity. |
| postMessage bridge | HIGH | Standard RPC-over-postMessage. Widely used in production. |
| Permission system | HIGH | Chrome extension model is proven at scale. |
| CSP configuration | HIGH | CSP is a W3C standard. Behavior well-defined. |
| Tauri 2 + iframe interaction | MEDIUM | Based on Tauri 2 architecture knowledge. Should verify that `sandbox="allow-scripts"` without `allow-same-origin` correctly blocks Tauri IPC in the iframe. |
| Receipt integration | HIGH | Based on direct reading of `receipt.rs` -- the schema supports plugin metadata cleanly. |
| Revocation via hushd | HIGH | Based on direct reading of `revocation.rs` + `events.rs` -- the infrastructure exists. |
| Performance impact | LOW | No benchmarks for iframe + postMessage overhead. Need to measure in Phase B. |

---

## 10. Open Questions

1. **Plugin UI rendering strategy**: Should community plugins that contribute editor tabs render their React tree inside the iframe (Figma model) or send declarative UI to the host (VS Code TreeView model)? The iframe approach is more flexible but requires shipping a UI kit CSS to each plugin. The declarative approach limits what plugins can render.

2. **WASM as alternative sandbox**: Instead of iframes, plugins could run as WASM modules. The codebase already has `hush-wasm` with WASM bindings. WASM provides stronger isolation than iframes (no DOM access at all) but is harder for plugin authors to develop with. Consider WASM for guard-only plugins (no UI), iframes for UI plugins.

3. **Hot reload during development**: Plugin authors need a fast dev loop. How does the bridge handle iframe reload? Should there be a `--plugin-dev` mode that relaxes CSP for development?

4. **Plugin bundle format**: What format do community plugins ship in? A tarball with manifest.json + bundled JS? A single JS file? This affects how `srcdoc` is constructed.

5. **Cross-plugin communication**: Can plugin A call plugin B's commands? If so, this needs permission scoping (`commands:execute` with a scope of which commands are accessible).

---

## Sources

All findings are based on:
- Direct codebase analysis of the files listed in section 7
- Training data knowledge of VS Code extension host architecture, Figma plugin sandbox, Chrome extension permissions model, CSP specification, and postMessage RPC patterns
- No web search was available; findings marked accordingly in confidence levels

**Files analyzed:**
- `apps/workbench/src/lib/plugins/types.ts` (manifest types, trust tiers)
- `apps/workbench/src/lib/plugins/plugin-trust.ts` (Ed25519 verification)
- `apps/workbench/src/lib/plugins/plugin-loader.ts` (lifecycle management)
- `apps/workbench/src/lib/plugins/plugin-registry.ts` (state machine)
- `apps/workbench/src/lib/plugins/plugin-installer.ts` (install/uninstall orchestration)
- `apps/workbench/src/lib/workbench/operator-crypto.ts` (signing primitives)
- `apps/workbench/src-tauri/tauri.conf.json` (security CSP)
- `crates/hush-core/src/receipt.rs` (receipt schema + signing)
- `crates/hush-multi-agent/src/revocation.rs` (revocation store trait + impls)
- `crates/services/hushd/src/state.rs` (daemon state with broadcast + revocation)
- `crates/services/hushd/src/api/events.rs` (SSE event streaming)
- `packages/sdk/plugin-sdk/src/context.ts` (PluginContext API surface)
- `.planning/PROJECT.md` (trust tier architecture vision)
- `.planning/ROADMAP.md` (existing plugin ecosystem phases)
