# Phase 02: SPL Adapter Plugin - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Splunk SPL detection adapter plugin: parser, generator, visual builder panel, Sigma translation provider, field mappings. Uses createPlugin() SDK and Phase 1 infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Use createPlugin() from @clawdstrike/plugin-sdk
- Register FileType, DetectionWorkflowAdapter, visual panel, translation provider, field mappings
- Bidirectional Sigma<->SPL translation (existing sigma-conversion.ts has SPL output — add parser for inverse)
- Visual builder panel using DetectionVisualPanelKit components
- Lab execution support for testing Splunk SPL rules against evidence

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 registries (visual panels, translations, field mappings)
- sigma-conversion.ts (already outputs some formats)
- DetectionVisualPanelKit (shared form components)
- createPlugin() SDK
- Existing Sigma adapter as reference implementation

</code_context>

<specifics>
## Specific Ideas
Reference: .planning/research/detection-adapter-plugins.md
</specifics>

<deferred>
## Deferred Ideas
- Connected SIEM execution mode (v2)
</deferred>
