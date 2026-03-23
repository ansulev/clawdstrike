# Phase 2: First Plugins - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

VirusTotal and GreyNoise plugins proving the enrichment pipeline end-to-end. "Run Enrichment" button wired to EnrichmentOrchestrator. Streaming enrichment results in sidebar UI.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance:
- VirusTotal plugin uses v3 REST API with `x-apikey` header
- GreyNoise plugin uses v3 REST API with `key` header
- Enrichment results stream into sidebar as each source responds (not batch)
- Skeleton loaders for in-flight requests
- Per-source error handling — one source failing does not block others
- "Run Enrichment" button in FindingsIntelPage triggers the full pipeline

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 output: ThreatIntelSourceRegistry, EnrichmentOrchestrator, SecretsApi, extractIndicators()
- Existing findings UI in apps/workbench/src/components/workbench/findings/

### Integration Points
- FindingsIntelPage — needs "Run Enrichment" button
- EnrichmentSidebar — new component for streaming results display
- ThreatIntelSourceRegistry — plugins register here

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/REQUIREMENTS.md` PLUG-01 through PLUG-04
</specifics>

<deferred>
## Deferred Ideas
- Additional source plugins (Phase 3)
- Custom renderers (Phase 4)
</deferred>
