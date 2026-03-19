# Requirements: Plugin Sandboxing (v2.0)

## Overview

Isolate community plugins in sandboxed iframes with a typed postMessage bridge, capability-based permissions, cryptographic audit trail, and fleet-wide emergency revocation. Community plugins get zero direct access to the host window, Tauri IPC, or React state -- every interaction is mediated, permission-checked, and receipted.

## Scope

**v2.0 (this milestone):** postMessage RPC bridge, iframe sandbox with strict CSP, capability-based permission system, Ed25519-signed plugin action receipts, emergency revocation via hushd SSE.

**Deferred:** WASM sandbox alternative for guard-only plugins, plugin hot reload dev mode, cross-plugin communication scoping, plugin resource limits (CPU/memory monitoring).

## Requirements

### BRIDGE: postMessage RPC Bridge

- **BRIDGE-01**: `PluginBridgeClient` class runs inside the plugin iframe and provides `call(method, params): Promise<T>` for request/response RPC and `subscribe(event, handler): Unsubscribe` for host-pushed events, communicating exclusively via `window.postMessage`
- **BRIDGE-02**: `PluginBridgeHost` class runs in the host window and dispatches incoming bridge requests to the appropriate registries (command registry, guard registry, file type registry, status bar registry, storage), returning serialized results
- **BRIDGE-03**: Message protocol uses a typed `BridgeMessage` envelope with `id` (correlation), `type` (request | response | event | error), `method` (namespaced, e.g. `"guards.register"`), `params`, `result`, and `error` fields
- **BRIDGE-04**: Request/response correlation uses monotonically increasing IDs with a 30-second timeout that rejects leaked promises with a descriptive error
- **BRIDGE-05**: All existing `PluginContext` API surfaces (`commands.register`, `guards.register`, `fileTypes.register`, `statusBar.register`, `storage.get`, `storage.set`) have bridge method equivalents that produce identical results to the in-process API
- **BRIDGE-06**: Bridge host validates that `event.origin` matches the expected null origin and rejects messages from unexpected sources

### SANDBOX: iframe Sandbox

- **SANDBOX-01**: `PluginSandbox` React component creates an `<iframe sandbox="allow-scripts">` (no `allow-same-origin`, no `allow-top-navigation`, no `allow-popups`) with the plugin's bundled JavaScript injected via `srcdoc`
- **SANDBOX-02**: Plugin iframes load with a null origin (via `srcdoc` or `blob:` URL), preventing access to the host's cookies, localStorage, and sessionStorage
- **SANDBOX-03**: Each plugin iframe has a strict CSP: `default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'`
- **SANDBOX-04**: `PluginLoader` forks loading path by trust tier: `internal` plugins load in-process (existing path, no iframe), `community` plugins load via `PluginSandbox` with bridge
- **SANDBOX-05**: The `PluginBridgeClient` SDK and a design system CSS file are injected into the iframe's `srcdoc` alongside the plugin's bundled code
- **SANDBOX-06**: Plugin iframes cannot access Tauri IPC (`__TAURI_INTERNALS__`, `ipc:` protocol, `http://ipc.localhost`) -- the sandbox attribute blocks this without additional configuration

### PERM: Permission System

- **PERM-01**: `PluginManifest` gains a `permissions` field declaring the capabilities the plugin requires, using `"scope:action"` format (e.g., `"guards:register"`, `"storage:write"`, `"network:fetch"`, `"policy:read"`)
- **PERM-02**: `PluginBridgeHost` enforces permissions as middleware: every incoming bridge request is checked against the plugin's declared permissions before dispatch, and undeclared permissions return a `PERMISSION_DENIED` error (fail-closed)
- **PERM-03**: A `METHOD_TO_PERMISSION` mapping connects each bridge method to its required permission, so new bridge methods cannot bypass enforcement
- **PERM-04**: Network permissions (`network:fetch`) include domain scoping via `allowedDomains` patterns, and the bridge host validates request URLs against declared domains before proxying
- **PERM-05**: Manifest validation rejects plugins that declare unknown or malformed permissions at install time
- **PERM-06**: The plugin install flow shows a permission prompt UI listing the plugin's declared permissions before the operator confirms installation

### AUDIT: Plugin Audit Trail

- **AUDIT-01**: Every bridge call from a community plugin generates an Ed25519-signed `PluginActionReceipt` containing plugin identity (id, version, publisher, trust tier), action type, params hash (SHA-256, not full params), result (allowed | denied | error), permission checked, and duration
- **AUDIT-02**: Permission denial events always generate a receipt regardless of audit configuration
- **AUDIT-03**: Plugin action receipts are stored in a local SQLite database (following the existing `SqliteRevocationStore` pattern) with indexes on plugin_id, action_type, result, and timestamp
- **AUDIT-04**: Plugin action receipts are forwarded to hushd via the existing `AuditForwarder` pattern when a daemon connection is available, enabling fleet-wide aggregation and SIEM export
- **AUDIT-05**: A plugin audit view in the workbench displays receipts filterable by plugin, action type, result, and time range

### REVOKE: Emergency Revocation

- **REVOKE-01**: hushd exposes `POST /api/v1/plugins/{plugin_id}/revoke` and `GET /api/v1/plugins/revocations` API routes, with revocation stored in `SqliteRevocationStore` using the `plugin:{plugin_id}` scope
- **REVOKE-02**: hushd broadcasts a `plugin_revoked` event via SSE (`/api/v1/events`) to all connected workbench instances when a plugin is revoked
- **REVOKE-03**: Workbench instances receiving a `plugin_revoked` SSE event deactivate the plugin (dispose contributions, remove iframe), set its lifecycle state to `"revoked"`, store the revocation locally, and generate a signed receipt
- **REVOKE-04**: `PluginLifecycleState` gains a `"revoked"` state; revoked plugins display a warning badge in the marketplace UI and cannot be reactivated until the revocation is lifted
- **REVOKE-05**: When a workbench instance reconnects after being offline, it fetches the current revocation list from hushd, diffs against local state, deactivates newly-revoked plugins, and reactivates plugins whose time-limited revocations have expired
- **REVOKE-06**: The `PluginBridgeHost` checks the revocation store before processing each message; if a plugin is revoked mid-call, it returns `PLUGIN_REVOKED` error and the iframe is removed after a 5-second drain timeout

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRIDGE-01 | Phase 1 | Complete |
| BRIDGE-02 | Phase 1 | Complete |
| BRIDGE-03 | Phase 1 | Complete |
| BRIDGE-04 | Phase 1 | Complete |
| BRIDGE-05 | Phase 1 | Complete |
| BRIDGE-06 | Phase 1 | Complete |
| SANDBOX-01 | Phase 2 | Complete |
| SANDBOX-02 | Phase 2 | Complete |
| SANDBOX-03 | Phase 2 | Complete |
| SANDBOX-04 | Phase 2 | Complete |
| SANDBOX-05 | Phase 2 | Complete |
| SANDBOX-06 | Phase 2 | Complete |
| PERM-01 | Phase 3 | Complete |
| PERM-02 | Phase 3 | Complete |
| PERM-03 | Phase 3 | Complete |
| PERM-04 | Phase 3 | Complete |
| PERM-05 | Phase 3 | Complete |
| PERM-06 | Phase 3 | Complete |
| AUDIT-01 | Phase 4 | Pending |
| AUDIT-02 | Phase 4 | Pending |
| AUDIT-03 | Phase 4 | Pending |
| AUDIT-04 | Phase 4 | Pending |
| AUDIT-05 | Phase 4 | Pending |
| REVOKE-01 | Phase 5 | Pending |
| REVOKE-02 | Phase 5 | Pending |
| REVOKE-03 | Phase 5 | Pending |
| REVOKE-04 | Phase 5 | Pending |
| REVOKE-05 | Phase 5 | Pending |
| REVOKE-06 | Phase 5 | Pending |
