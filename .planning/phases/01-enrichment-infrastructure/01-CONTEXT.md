# Phase 1: Enrichment Infrastructure - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

ThreatIntelSource registry, EnrichmentOrchestrator with rate limiting/caching, SecretsApi for plugin-scoped credentials, indicator extraction from findings, and plugin loader routing for threatIntelSources contributions.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance from requirements:
- `ThreatIntelSourceRegistry` follows same Map-based pattern as guard-registry and file-type-registry
- `EnrichmentOrchestrator` uses token bucket rate limiting per source
- Result caching by `(sourceId, indicatorType, indicatorValue)` tuple with configurable TTL
- `SecretsApi` auto-prefixes keys with `plugin:{pluginId}:` and delegates to existing secureStore
- `extractIndicators()` parses IOCs from finding enrichments (IPs from egress, domains from DNS, hashes from file access)
- Plugin loader routing adds `threatIntelSources` as new contribution type

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `guard-registry.ts` — Map-based singleton with register/unregister/get/getAll pattern
- `file-type-registry.ts` — Dynamic registration with content-based detection pipeline
- `plugin-loader.ts` — routeContributions() with existing contribution routing
- `@clawdstrike/plugin-sdk` — PluginContext, createPlugin(), contribution types
- `secureStore` — existing secure storage mechanism for API keys

### Integration Points
- PluginLoader.routeContributions() — needs threatIntelSources routing
- PluginContext — needs SecretsApi injection
- Plugin SDK types.ts — needs ThreatIntelSource, Indicator, EnrichmentResult types
- Detection workflow — findings have structured data with IPs, domains, hashes

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/REQUIREMENTS.md` FOUND-01 through FOUND-08
</specifics>

<deferred>
## Deferred Ideas
- Community-authored threat intel plugins (requires v2.0 sandbox)
- Threat intel source composition (chaining sources)
- Broker subsystem integration for fleet API key storage
</deferred>
