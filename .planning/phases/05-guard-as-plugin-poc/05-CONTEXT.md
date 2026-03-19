# Phase 5: Guard-as-Plugin Proof of Concept - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the EgressAllowlistGuard into a plugin that works identically to the built-in version, proving the end-to-end pipeline from manifest to guard evaluation to config UI.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Use `createPlugin()` from `@clawdstrike/plugin-sdk`
- Plugin manifest declares guard contribution with config schema
- Plugin activates and registers guard via the Phase 1 dynamic guard registry
- Guard config UI should render identically to built-in (reuses GuardConfigFields)
- Same allow/deny verdicts as built-in for same policy/actions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Guard registry from Phase 1 (registerGuard/unregisterGuard)
- PluginManifest type from Phase 2 (GuardContribution interface)
- PluginLoader from Phase 3 (contribution routing)
- Plugin SDK from Phase 4 (createPlugin factory)
- EgressAllowlistGuard implementation in workbench

### Integration Points
- Plugin SDK → createPlugin() → manifest with guards contribution
- PluginLoader → loads plugin → routes guard to registry
- Guard registry → guard available in policy engine + config UI

</code_context>

<specifics>
## Specific Ideas

No specific requirements — proof of concept.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
