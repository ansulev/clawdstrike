# Phase 4: Intelligence Participation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Pivot enrichment for related indicators, bidirectional reporting to AbuseIPDB and MISP, custom enrichment type renderers via EnrichmentTypeRegistry, and aggregation dashboard view.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance:
- Pivot enrichment discovers `relatedIndicators` from source results and offers one-click enrichment
- Bidirectional reporting: AbuseIPDB `/report` endpoint, MISP event creation
- EnrichmentTypeRegistry contribution point for custom React renderers
- Aggregation dashboard: cross-finding indicators, aggregate verdicts, source health/quota

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1-3 output: Full enrichment pipeline with all 6 sources
- EnrichmentResult.relatedIndicators field for pivot support
- ViewRegistry pattern for custom renderers

### Integration Points
- EnrichmentSidebar — needs pivot enrichment UI
- Finding detail view — needs "Report to..." button
- New route/tab for aggregation dashboard
- EnrichmentTypeRegistry — new registry following ViewRegistry pattern

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/REQUIREMENTS.md` ADV-01 through ADV-04
</specifics>

<deferred>
## Deferred Ideas
- Confidence auto-adjustment from enrichment verdicts (v2)
- Enrichment result persistence separate from localStorage (v2)
</deferred>
