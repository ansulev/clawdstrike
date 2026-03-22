# Requirements: v5.0 Threat Intel Source Plugins

## Overview

Enable threat intelligence enrichment of security findings through a plugin-based architecture. Operators configure API keys for external threat intel services (VirusTotal, GreyNoise, Shodan, etc.), and the workbench enriches findings with reputation scores, classifications, and related indicators -- turning isolated guard violations into actionable threat context.

## Scope

**v1 (this milestone):** ThreatIntelSource registry and runtime interfaces, EnrichmentOrchestrator with rate limiting and caching, SecretsApi for plugin-scoped credentials, first-party plugins (VirusTotal, GreyNoise, Shodan, AbuseIPDB, OTX, MISP), API key settings UI, enrichment badges, auto-enrichment, pivot enrichment, bidirectional reporting, custom renderers, aggregation dashboard.

**v2 (deferred):** Community-authored threat intel plugins (requires v2.0 sandbox), threat intel source composition (chaining sources), confidence auto-adjustment from enrichment verdicts, enrichment result persistence separate from findings (for localStorage size), broker subsystem integration for API key storage in fleet deployments.

## Requirements

### FOUND: Foundation Infrastructure

- **FOUND-01**: `ThreatIntelSourceRegistry` singleton with `register()`, `unregister()`, `get()`, `getAll()`, and `getForIndicator(type)` methods, following the same Map-based pattern as guard-registry and file-type-registry
- **FOUND-02**: `ThreatIntelSource` runtime interface defines `id`, `name`, `supportedIndicatorTypes`, `rateLimit`, `enrich(indicator)`, and optional `healthCheck()` -- exported from `@clawdstrike/plugin-sdk`
- **FOUND-03**: `Indicator` type with `type` (hash, ip, domain, url, email), `value`, optional `hashAlgorithm`, and optional `context` linking back to the originating finding and signals
- **FOUND-04**: `EnrichmentResult` type with `sourceId`, `sourceName`, `verdict` (classification + confidence + summary), `rawData`, optional `mitreTechniques`, optional `relatedIndicators`, `permalink`, `fetchedAt`, and `cacheTtlMs`
- **FOUND-05**: `EnrichmentOrchestrator` coordinates async enrichment across registered sources with per-source token bucket rate limiting, result caching by `(sourceId, indicatorType, indicatorValue)` tuple with configurable TTL, and cancellation support
- **FOUND-06**: `SecretsApi` added to `PluginContext` with `get(key)`, `set(key, value)`, `delete(key)`, and `has(key)` methods that auto-prefix keys with `plugin:{pluginId}:` and delegate to the existing `secureStore`
- **FOUND-07**: `PluginLoader.routeContributions()` routes `threatIntelSources` contributions by resolving the source module from the manifest `entrypoint` field and registering it with `ThreatIntelSourceRegistry`
- **FOUND-08**: `extractIndicators(finding, signals)` function parses IOCs from finding enrichments, IPs from egress guard violations, domains from DNS signals, and hashes from file access signals, returning deduplicated `Indicator[]`

### PLUG: First-Party Plugins

- **PLUG-01**: VirusTotal plugin implements `ThreatIntelSource` for hash (MD5/SHA1/SHA256), domain, IP, and URL indicator types using the v3 REST API with `x-apikey` header authentication
- **PLUG-02**: GreyNoise plugin implements `ThreatIntelSource` for IP indicator type using the v3 REST API with `key` header authentication, returning classification (benign/malicious/unknown) and RIOT status
- **PLUG-03**: The "Run Enrichment" button in FindingsIntelPage is wired to the `EnrichmentOrchestrator`, triggering indicator extraction and enrichment across all configured sources for the selected finding
- **PLUG-04**: Enrichment results stream into the `EnrichmentSidebar` as they arrive from each source, with skeleton loaders for in-flight requests and per-source error handling (one source failing does not block others)

### OPS: Operational Features

- **OPS-01**: Plugin settings UI renders a generic API key entry form for each threat intel plugin based on the manifest `requiredSecrets` declaration, storing keys via `SecretsApi`
- **OPS-02**: Shodan plugin implements `ThreatIntelSource` for IP and domain indicator types using the REST API with `key` query parameter authentication
- **OPS-03**: AbuseIPDB plugin implements `ThreatIntelSource` for IP indicator type using the v2 REST API with `Key` header authentication
- **OPS-04**: AlienVault OTX plugin implements `ThreatIntelSource` for IP, domain, URL, and hash indicator types using the DirectConnect API v2 with `X-OTX-API-KEY` header authentication
- **OPS-05**: MISP plugin implements `ThreatIntelSource` for all indicator types using the REST API with `Authorization` header authentication and configurable base URL
- **OPS-06**: Finding list rows display small source badges (abbreviation + brand color) for each threat intel source that has enriched the finding
- **OPS-07**: Auto-enrichment can be enabled per-sentinel and per-source, automatically enriching new findings above a configurable confidence threshold while respecting rate limits via queue

### ADV: Differentiation Features

- **ADV-01**: Pivot enrichment discovers `relatedIndicators` from source results and offers one-click enrichment of those indicators, enabling recursive threat graph exploration
- **ADV-02**: Bidirectional reporting allows the workbench to report IOCs back to AbuseIPDB (`/report` endpoint) and MISP (event creation) for findings confirmed as malicious
- **ADV-03**: Plugins can register custom enrichment type renderers via an `EnrichmentTypeRegistry` contribution point, replacing the generic key-value fallback with source-specific UI components
- **ADV-04**: An enrichment aggregation dashboard view shows cross-finding intelligence: which indicators appear across multiple findings, aggregate verdicts by source, and source health/quota status

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete |
| FOUND-08 | Phase 1 | Complete |
| PLUG-01 | Phase 2 | Complete |
| PLUG-02 | Phase 2 | Complete |
| PLUG-03 | Phase 2 | Complete |
| PLUG-04 | Phase 2 | Complete |
| OPS-01 | Phase 3 | Complete |
| OPS-02 | Phase 3 | Complete |
| OPS-03 | Phase 3 | Complete |
| OPS-04 | Phase 3 | Complete |
| OPS-05 | Phase 3 | Complete |
| OPS-06 | Phase 3 | Complete |
| OPS-07 | Phase 3 | Complete |
| ADV-01 | Phase 4 | Pending |
| ADV-02 | Phase 4 | Pending |
| ADV-03 | Phase 4 | Pending |
| ADV-04 | Phase 4 | Pending |
