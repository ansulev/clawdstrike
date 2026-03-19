---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-03-19T06:21:04Z"
last_activity: 2026-03-19 -- Completed client-side revocation infrastructure (05-01)
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 10
  completed_plans: 9
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Community plugins run in sandboxed iframes with capability-based permissions, Ed25519 audit trail, and fleet-wide emergency revocation
**Current focus:** Phase 5 in progress -- Emergency Revocation (1 of 2 plans done).

## Current Position

Phase: 5 of 5 (Emergency Revocation)
Plan: 1 of 2 complete
Status: Executing
Last activity: 2026-03-19 -- Completed client-side revocation infrastructure (05-01)

Progress: [#########-] 90%

## Previous Milestones

### v1.0 — Plugin Foundation (Complete 2026-03-18)
6 phases, 13 plans: Open seams, manifest/registry, loader/trust, SDK, guard PoC, marketplace UI

## Accumulated Context

### Decisions
- v1.0 established: dynamic registries, PluginManifest type, PluginRegistry singleton, PluginLoader with trust gating, createPlugin() SDK, guard-as-plugin PoC
- Figma sandbox model recommended (null-origin iframe, strict CSP)
- Capability-based permissions (Chrome extension model)
- Receipt system for audit trail (existing hush-core primitives)
- Revocation via hushd SSE (existing infrastructure)
- BridgeError extends Error as a class for instanceof checks and stack traces (01-01)
- Events have no id field -- fire-and-forget, not correlated with requests (01-01)
- BRIDGE_METHODS uses nested object structure mirroring PluginContext namespace hierarchy (01-01)
- BridgeMethodName type uses recursive conditional type extraction from BRIDGE_METHODS values (01-01)
- statusBar.register injects render: () => null placeholder since render functions cannot cross iframe boundary (01-02)
- commands.register stores metadata host-side; actual handler stays in iframe for future callback invocation pattern (01-02)
- Host uses try/catch + Promise chain for both sync and async handler error propagation (01-02)
- [Phase 01]: statusBar.register injects render: () => null placeholder since render functions cannot cross iframe boundary (01-02)
- Inlined PluginBridgeClient in srcdoc as self-contained ES5-style class -- no module imports possible in srcdoc iframe (02-01)
- React srcDoc prop (camelCase) maps to HTML srcdoc attribute -- used JSX convention (02-01)
- Bridge host created in useEffect with [pluginId, pluginCode] as dependencies for proper lifecycle management (02-01)
- Use setAttribute('sandbox', 'allow-scripts') instead of DOMTokenList for jsdom compat (02-02)
- No iframe.onload wait -- contentWindow available immediately after appendChild (02-02)
- Community plugins store module: null in LoadedPlugin; code runs in iframe not host (02-02)
- resolvePluginCode defaults to empty string for declarative-only community plugins (02-02)
- Permission strings use colon notation (guards:register) while bridge methods use dot notation (guards.register) -- intentionally different namespaces (03-01)
- permissions field on BridgeHostOptions is optional; null permissionSet means no enforcement for backward compat (03-01)
- Permission check runs BEFORE handler lookup/dispatch -- denied calls never touch handlers (03-01)
- sendError updated from 3-variant union to full BridgeErrorCode type for extensibility (03-01)
- PermissionDeniedError subclass thrown by network.fetch handler to distinguish domain denial (PERMISSION_DENIED) from other errors (INTERNAL_ERROR) (03-02)
- Wildcard domain *.example.com matches sub.example.com but NOT example.com itself (strict subdomain only) (03-02)
- network:fetch auto-added to simple permissions when NetworkPermission objects present, ensuring permission-level check passes before domain-level check (03-02)
- Permission prompt runs BEFORE registry.register() so rejected installs never touch the registry (03-02)
- Empty permissions array on manifest activates enforcement (deny-all); undefined permissions means no enforcement (backward compat) (03-02)
- Receipt generation is fire-and-forget (void the promise) so audit does not block bridge response time (04-01)
- Denials always recorded regardless of verbosity -- fail-open for audit, fail-closed for security (04-01)
- Unsigned receipts (signature='') supported for dev mode when secretKeyHex is null (04-01)
- Handler-level PermissionDeniedError produces recordDenied, not recordError (04-01)
- Receipt store uses localStorage with 5000 cap following existing local-audit.ts pattern (04-01)
- Receipt middleware is injected via BridgeHostOptions for testability (store instance injected, not singleton) (04-01)
- Forwarding is best-effort (fail-open): network errors queue for retry, never throw or block bridge (04-02)
- Local-only mode (hushdUrl=null) silently skips forwarding -- receipts stay in local store only (04-02)
- Audit viewer uses native select element for result filter for simplicity and testing compat (04-02)
- Revocation check runs BEFORE permission check in bridge host -- revoked plugins blocked at earliest point (05-01)
- revocationStore on BridgeHostOptions uses duck-typed interface { isRevoked(pluginId: string): boolean } for testability (05-01)
- revokePlugin sets state to "revoked" immediately, waits 5s drain, then deactivates -- bridge rejects new calls during drain (05-01)
- PluginRevocationStore follows receipt-store.ts localStorage + in-memory cache pattern (05-01)

### Pending Todos
None yet.

### Blockers/Concerns
None yet.

## Session Continuity

Last session: 2026-03-19T06:21:04Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None
