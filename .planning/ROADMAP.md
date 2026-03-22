# Roadmap: v5.0 Threat Intel Source Plugins

## Overview

Transform ClawdStrike findings from isolated guard violations into threat-contextualized intelligence by building a plugin-based enrichment pipeline. The journey starts with the registry and orchestrator infrastructure all plugins need, proves the pipeline end-to-end with VirusTotal and GreyNoise (covering hash and IP indicator types), scales to operational readiness with API key management and four more source plugins, and finishes with differentiation features like pivot enrichment and bidirectional reporting that turn ClawdStrike from a consumer of threat intel into a participant in the ecosystem.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Enrichment Infrastructure** - ThreatIntelSource registry, EnrichmentOrchestrator with rate limiting/caching, SecretsApi, loader routing, indicator extraction
- [ ] **Phase 2: First Plugins** - VirusTotal and GreyNoise plugins proving the pipeline end-to-end with streaming enrichment UI
- [ ] **Phase 3: Operational Readiness** - API key settings UI, four remaining plugins (Shodan, AbuseIPDB, OTX, MISP), enrichment badges, auto-enrichment
- [ ] **Phase 4: Intelligence Participation** - Pivot enrichment, bidirectional reporting, custom renderers, aggregation dashboard

## Phase Details

### Phase 1: Enrichment Infrastructure
**Goal**: The workbench has a complete enrichment pipeline -- from indicator extraction through source registration to orchestrated async enrichment with rate limiting and caching -- ready for plugins to plug into
**Depends on**: Nothing (first phase; assumes plugin SDK and loader from v1.0 are available)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08
**Success Criteria** (what must be TRUE):
  1. A test plugin implementing `ThreatIntelSource` can register with `ThreatIntelSourceRegistry`, and `getForIndicator("ip")` returns it when it declares IP support
  2. The `EnrichmentOrchestrator` queues enrichment requests and respects per-source rate limits -- a source declaring 4 req/min does not receive a 5th request within 60 seconds
  3. A plugin can call `context.secrets.get("api_key")` to retrieve a stored API key, and the key is stored via the existing secure store with proper `plugin:{id}:` namespacing
  4. `extractIndicators()` given a finding with egress guard violations returns `Indicator` objects with type "ip" and the violating IP addresses as values
  5. `PluginLoader.routeContributions()` routes a manifest with `threatIntelSources` entries to the `ThreatIntelSourceRegistry`
**Plans:** 3 plans
Plans:
- [ ] 01-01-PLAN.md -- Types, ThreatIntelSourceRegistry, and SecretsApi
- [ ] 01-02-PLAN.md -- EnrichmentOrchestrator and indicator extraction
- [ ] 01-03-PLAN.md -- Plugin loader routing for threatIntelSources

### Phase 2: First Plugins
**Goal**: Operators can enrich findings with VirusTotal file hash reputation and GreyNoise IP classification, proving the enrichment pipeline works end-to-end from button click to rendered results
**Depends on**: Phase 1
**Requirements**: PLUG-01, PLUG-02, PLUG-03, PLUG-04
**Success Criteria** (what must be TRUE):
  1. With a VirusTotal API key configured, clicking "Run Enrichment" on a finding with a SHA-256 hash indicator returns detection ratio, AV engine results, and a malicious/benign/unknown verdict displayed in the enrichment sidebar
  2. With a GreyNoise API key configured, clicking "Run Enrichment" on a finding with an IP indicator returns the GreyNoise classification and RIOT status displayed in the enrichment sidebar
  3. Enrichment results stream into the sidebar as each source responds -- the GreyNoise result appears immediately even if VirusTotal is still loading
  4. A failed API call to one source shows an error badge for that source without blocking results from the other source
**Plans:** 2 plans
Plans:
- [ ] 02-01-PLAN.md -- VirusTotal and GreyNoise ThreatIntelSource plugin implementations
- [ ] 02-02-PLAN.md -- Enrichment bridge hook and streaming sidebar UI wiring

### Phase 3: Operational Readiness
**Goal**: Operators can configure API keys through the settings UI, all six planned threat intel sources are available, and the workbench surfaces enrichment status at the finding list level with optional auto-enrichment
**Depends on**: Phase 2
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07
**Success Criteria** (what must be TRUE):
  1. Each threat intel plugin's settings page shows an API key input field derived from its manifest `requiredSecrets`, and entering a key persists it to the secure store
  2. The MISP plugin accepts a configurable base URL (since MISP is self-hosted) and enriches indicators by searching the instance's attribute database
  3. Finding list rows display source badges (e.g., [VT] [GN] [SH]) indicating which sources have enriched each finding, using source brand colors
  4. Auto-enrichment can be enabled so that new findings above a confidence threshold are automatically queued for enrichment without manual button clicks
  5. All six plugins (VirusTotal, GreyNoise, Shodan, AbuseIPDB, OTX, MISP) return normalized `ThreatVerdict` with classification and confidence, despite their different API response formats
**Plans**: TBD

### Phase 4: Intelligence Participation
**Goal**: ClawdStrike moves from passive consumption to active participation in the threat intel ecosystem -- discovering related threats via pivot enrichment, reporting confirmed threats back to community databases, and providing operators with an aggregate intelligence view
**Depends on**: Phase 3
**Requirements**: ADV-01, ADV-02, ADV-03, ADV-04
**Success Criteria** (what must be TRUE):
  1. When a source returns related indicators (e.g., VirusTotal returns domains associated with a malicious hash), those indicators appear in a "Related Indicators" section with one-click enrichment
  2. An operator can report a confirmed-malicious IP to AbuseIPDB directly from the finding detail view, and the report is submitted via the AbuseIPDB `/report` endpoint
  3. A threat intel plugin can register a custom React renderer for its enrichment data, and the enrichment sidebar uses that renderer instead of the generic key-value fallback
  4. The enrichment aggregation dashboard shows which indicators appear across multiple findings and the current health/quota status of each configured source
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Enrichment Infrastructure | 0/3 | Planning complete | - |
| 2. First Plugins | 0/2 | Planning complete | - |
| 3. Operational Readiness | 0/? | Not started | - |
| 4. Intelligence Participation | 0/? | Not started | - |
