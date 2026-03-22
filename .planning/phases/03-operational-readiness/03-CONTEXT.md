# Phase 3: Operational Readiness - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

API key settings UI, four remaining plugins (Shodan, AbuseIPDB, OTX, MISP), enrichment badges on finding list rows, and auto-enrichment capability.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance:
- Plugin settings UI renders generic API key form based on manifest `requiredSecrets`
- MISP plugin needs configurable base URL (self-hosted)
- Finding list badges show source abbreviation + brand color
- Auto-enrichment configurable per-sentinel and per-source with confidence threshold
- All six plugins return normalized `ThreatVerdict` with classification + confidence

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1-2 output: Full enrichment pipeline, VirusTotal + GreyNoise as reference plugins
- Plugin manifest `requiredSecrets` field for settings UI generation

### Integration Points
- Settings/preferences UI — needs plugin API key management
- Finding list rows — need enrichment badges
- EnrichmentOrchestrator — needs auto-enrichment queue mode

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/REQUIREMENTS.md` OPS-01 through OPS-07
</specifics>

<deferred>
## Deferred Ideas
- Pivot enrichment (Phase 4)
- Bidirectional reporting (Phase 4)
</deferred>
