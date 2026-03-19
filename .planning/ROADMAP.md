# Roadmap: Plugin Sandboxing (v2.0)

## Overview

Harden the community plugin boundary from trust-based to sandbox-based isolation. The journey starts with a typed postMessage RPC bridge (the only gateway between plugin and host), wraps it in a null-origin iframe with strict CSP, layers capability-based permissions on top, adds cryptographic audit receipts for every plugin action, and finishes with fleet-wide emergency revocation via hushd. After this milestone, a malicious community plugin cannot access the host DOM, Tauri IPC, filesystem, network, or any API it did not declare in its manifest -- and every action it takes is Ed25519-signed and auditable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: postMessage RPC Bridge** - Build typed request/response and event subscription protocol over postMessage with host-side dispatch to registries
- [x] **Phase 2: iframe Sandbox** - Isolate community plugins in null-origin iframes with strict CSP, fork PluginLoader by trust tier
- [ ] **Phase 3: Permission System** - Capability-based permissions declared in manifest, enforced at bridge middleware, with domain-scoped network access
- [ ] **Phase 4: Plugin Audit Trail** - Ed25519-signed receipts for every plugin action, local SQLite storage, hushd forwarding, and audit viewer UI
- [ ] **Phase 5: Emergency Revocation** - Fleet-wide plugin kill via hushd SSE broadcast, offline sync on reconnect, revoked lifecycle state

## Phase Details

### Phase 1: postMessage RPC Bridge
**Goal**: Community plugins can make typed API calls and receive events through a message-passing bridge that produces identical results to the in-process PluginContext API
**Depends on**: Nothing (first phase -- builds on v1.0 plugin infrastructure)
**Requirements**: BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05, BRIDGE-06
**Success Criteria** (what must be TRUE):
  1. A test plugin running in a mock iframe can call `bridge.call("guards.register", guardContribution)` and the guard appears in the host-side guard registry
  2. A test plugin can call `bridge.subscribe("policy.changed")` and receives an event when policy changes in the host
  3. A bridge call with an invalid method returns a structured error with code and message, and a call that exceeds 30 seconds rejects with a timeout error
  4. Every PluginContext API method (commands.register, guards.register, fileTypes.register, statusBar.register, storage.get, storage.set) has a bridge equivalent that produces the same observable result
**Plans:** 2 plans
Plans:
- [x] 01-01-PLAN.md -- Bridge protocol types + PluginBridgeClient (call/subscribe/timeout)
- [x] 01-02-PLAN.md -- PluginBridgeHost dispatch + origin validation + integration tests

### Phase 2: iframe Sandbox
**Goal**: Community plugins run in isolated null-origin iframes with zero access to the host window, Tauri IPC, cookies, localStorage, or network
**Depends on**: Phase 1
**Requirements**: SANDBOX-01, SANDBOX-02, SANDBOX-03, SANDBOX-04, SANDBOX-05, SANDBOX-06
**Success Criteria** (what must be TRUE):
  1. A community plugin loaded via PluginLoader renders inside an `<iframe sandbox="allow-scripts">` element, and its JavaScript cannot access `window.parent.document`, `localStorage`, or `document.cookie`
  2. The same plugin manifest with `trust: "internal"` loads in-process (no iframe) and with `trust: "community"` loads via iframe sandbox -- both produce working contributions in the registries
  3. A community plugin that attempts `fetch("https://example.com")` or `new XMLHttpRequest()` fails due to CSP `connect-src 'none'`
  4. The plugin iframe cannot access `__TAURI_INTERNALS__` or invoke Tauri commands
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md -- PluginSandbox component + srcdoc builder with CSP and bridge bootstrap
- [x] 02-02-PLAN.md -- PluginLoader trust-tier fork + integration tests

### Phase 3: Permission System
**Goal**: Community plugins declare required capabilities in their manifest, and the bridge rejects any API call the plugin did not declare permission for
**Depends on**: Phase 2
**Requirements**: PERM-01, PERM-02, PERM-03, PERM-04, PERM-05, PERM-06
**Success Criteria** (what must be TRUE):
  1. A community plugin with `permissions: ["guards:register", "storage:read"]` can register guards and read storage, but calling `bridge.call("storage.set", ...)` returns a `PERMISSION_DENIED` error
  2. A plugin with `permissions: [{ type: "network:fetch", allowedDomains: ["api.virustotal.com"] }]` can fetch from VirusTotal via the bridge proxy, but a fetch to any other domain is denied
  3. Installing a plugin that declares `["policy:write", "network:fetch"]` shows a permission prompt listing both capabilities before the operator confirms
  4. A manifest declaring an unknown permission (e.g., `"filesystem:write"`) is rejected at install time with a validation error
**Plans**: TBD

### Phase 4: Plugin Audit Trail
**Goal**: Every action a community plugin takes through the bridge is recorded as an Ed25519-signed receipt, queryable locally and forwardable to hushd for fleet aggregation
**Depends on**: Phase 3
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Success Criteria** (what must be TRUE):
  1. After a community plugin registers a guard and reads storage, querying the local receipt store returns two signed receipts with correct plugin_id, action_type, and `result: "allowed"`
  2. After a permission-denied bridge call, a receipt with `result: "denied"` exists in the store regardless of audit verbosity settings
  3. When connected to hushd, plugin action receipts appear in the daemon's audit ledger and are available to SIEM exporters
  4. The workbench audit view shows plugin receipts filterable by plugin name, action type (e.g., "network.fetch"), result, and time range
**Plans**: TBD

### Phase 5: Emergency Revocation
**Goal**: An operator can revoke a community plugin fleet-wide via hushd, and all connected workbench instances immediately kill the plugin and persist the revocation for offline restarts
**Depends on**: Phase 4
**Requirements**: REVOKE-01, REVOKE-02, REVOKE-03, REVOKE-04, REVOKE-05, REVOKE-06
**Success Criteria** (what must be TRUE):
  1. Calling `POST /api/v1/plugins/{plugin_id}/revoke` on hushd causes all connected workbench instances to deactivate the plugin within seconds -- its guards are unregistered, its iframe is removed, and its lifecycle state is `"revoked"`
  2. A revoked plugin shows a warning badge in the marketplace UI and cannot be reactivated (Install/Activate buttons are disabled with an explanation)
  3. A workbench instance that was offline during revocation deactivates the plugin on reconnect after syncing the revocation list from hushd
  4. If a revoked plugin has a bridge call in-flight, the call returns `PLUGIN_REVOKED` error and the iframe is removed after draining (5-second timeout)
  5. A time-limited revocation (e.g., revoked for 24 hours) automatically allows reactivation after the expiration period
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. postMessage RPC Bridge | 2/2 | Complete | 2026-03-19 |
| 2. iframe Sandbox | 2/2 | Complete | 2026-03-19 |
| 3. Permission System | 0/TBD | Not started | - |
| 4. Plugin Audit Trail | 0/TBD | Not started | - |
| 5. Emergency Revocation | 0/TBD | Not started | - |
