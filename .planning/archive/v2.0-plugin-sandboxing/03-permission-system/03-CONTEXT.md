# Phase 3: Permission System - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge rejects any API call the plugin did not declare permission for in its manifest. Capability-based permissions (Chrome extension model) enforced as middleware at the bridge host level.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Permissions declared in manifest `permissions` array (e.g., `["guards.register", "findings.read", "network.egress:api.virustotal.com"]`)
- Bridge host checks permissions before dispatching to handlers
- Undeclared API calls return PERMISSION_DENIED error code
- Network permissions are domain-scoped
- Unknown permissions rejected at manifest validation
- Install flow should show permissions for operator review

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- PluginBridgeHost from Phase 1 (handleMessage dispatch)
- PluginSandbox from Phase 2 (iframe lifecycle)
- PluginManifest type (can add `permissions` field)
- manifest-validation.ts (can validate permissions)

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-sandboxing.md` (Permission system section)

</specifics>

<deferred>
## Deferred Ideas

- Audit trail per permission check (Phase 4)

</deferred>
