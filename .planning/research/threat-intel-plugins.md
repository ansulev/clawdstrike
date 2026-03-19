# Threat Intel Source Plugins for ClawdStrike Workbench

**Researched:** 2026-03-18
**Domain:** Plugin-based threat intelligence enrichment for security findings
**Overall Confidence:** MEDIUM (codebase analysis: HIGH, API details: MEDIUM -- based on training data, not live verification)

---

## 1. Existing Enrichment Architecture

### 1.1 The Enrichment Data Model

The enrichment system is well-defined and extensible. Key types from `finding-engine.ts`:

```typescript
interface Enrichment {
  id: string;           // "enr_{ts}{seq}" format
  type:                 // Discriminated enrichment types
    | "mitre_attack"
    | "ioc_extraction"
    | "spider_sense"
    | "external_feed"
    | "swarm_corroboration"
    | "reputation"
    | "geolocation"
    | "whois"
    | "custom";
  label: string;        // Human-readable summary
  data: Record<string, unknown>;  // Flexible data payload
  addedAt: number;      // Unix ms timestamp
  source: string;       // Who/what added it
}
```

**Key design choice:** The `finding-engine.ts` Enrichment type uses `data: Record<string, unknown>` rather than the stricter discriminated union (`EnrichmentData = MitreEnrichment | IocEnrichment | GenericEnrichment`) from `sentinel-types.ts`. This was an intentional decision noted in the code comments: "the enrichment pipeline constructs payloads with shapes that don't match the strict canonical variants." This loose typing is actually advantageous for plugin extensibility -- plugins can put any structured data in the `data` field.

### 1.2 How Enrichments Are Added

The `addEnrichment()` function in `finding-engine.ts` (line 617) is the core entry point:

- **Idempotent by type+source:** If an enrichment with the same `type` and `source` already exists, it replaces it in-place. Otherwise, it appends.
- **Timeline tracking:** Every enrichment addition generates a timeline entry of type `"enrichment_added"`.
- **Actor attribution:** Every enrichment records who added it.
- **No async:** The `addEnrichment` function is pure/synchronous -- it takes state in, returns new state out. Async fetching must happen outside, then the result is dispatched.

Built-in enrichment helpers:
- `enrichWithMitre()` -- MITRE ATT&CK technique mappings
- `enrichWithIocs()` -- IOC extraction results
- `enrichWithSpiderSense()` -- Spider Sense detection results
- `enrichWithSwarmCorroboration()` -- Peer sentinel corroboration (also boosts confidence by 0.05)
- `runEnrichmentPipeline()` -- Batch orchestrator running all built-in enrichment types

### 1.3 Enrichment in the UI

The enrichment UI lives in `findings/enrichment-sidebar.tsx`:

- **Grouped by type:** Enrichments are grouped into collapsible sections by their `type` field
- **Type-specific renderers:** Each enrichment type has a dedicated React component:
  - `MitreAttackContent` -- shows kill-chain depth bar, technique cards, tactic tags
  - `IocExtractionContent` -- shows indicator list with type-colored badges
  - `SpiderSenseContent` -- shows verdict badge, score bar, top pattern matches
  - `ExternalFeedContent` -- shows feed name and match details
  - `SwarmCorroborationContent` -- shows peer fingerprint, finding ID, confidence
  - `GenericContent` -- key-value fallback for unknown types
- **Config map:** `ENRICHMENT_TYPE_CONFIG` maps each type to icon, color, and label
- **"Run Enrichment" button:** The sidebar has an `onRunEnrichment` callback, showing the system is designed for manual enrichment triggers

The `FindingDetail` component (line 471-481) renders the enrichment sidebar as a fixed-width 320px right panel within the finding detail view.

### 1.4 The FindingStore Dispatch Path

`finding-store.tsx` provides a React context with `useReducer`:
```
User clicks "Run Enrichment"
  -> Component calls addEnrichment(findingId, enrichment, actor)
  -> Dispatches { type: "ADD_ENRICHMENT", findingId, enrichment, actor }
  -> Reducer calls engineAddEnrichment(finding, enrichment, actor)
  -> Returns new Finding with enrichment appended/replaced
  -> State persisted to localStorage (debounced 500ms)
```

### 1.5 Intel Forge Integration

`intel-forge.ts` uses enrichments when promoting findings to intel:
- `detectIntelType()` inspects enrichment types to determine intel classification
- `extractMitreMappings()` pulls MITRE techniques from enrichments
- IOC enrichments drive IOC-type intel content extraction

### 1.6 Gaps in Current Architecture

1. **No async enrichment orchestration:** The finding store is synchronous. There is no built-in mechanism to kick off async API calls and route results back.
2. **No enrichment registry:** Enrichment types are hardcoded in the `type` union. Adding new types requires source changes.
3. **No rate limiting or caching:** Each enrichment is fire-and-forget.
4. **No indicator extraction:** The system assumes IOCs are already extracted. There is no automatic indicator extraction from finding signals that would feed into external lookups.
5. **"Run Enrichment" button exists but is not wired:** The `onRunEnrichment` callback is optional and passed through but the FindingsIntelPage does not provide it.

---

## 2. Threat Intel API Landscape

### 2.1 VirusTotal (v3 API)

**Confidence:** MEDIUM (training data)

| Aspect | Details |
|--------|---------|
| API Version | v3 REST API (base: `https://www.virustotal.com/api/v3/`) |
| Auth | `x-apikey` header with API key |
| Lookups | `/files/{hash}`, `/domains/{domain}`, `/ip_addresses/{ip}`, `/urls/{url_id}` |
| Rate Limits | Free: 4 req/min, 500 req/day. Premium: 1000+ req/min |
| Key Data | Detection ratio, AV engine results, community score, first/last submission dates, MITRE ATT&CK tags |
| Indicator Types | hash (MD5/SHA1/SHA256), domain, IP, URL |
| Response Size | Large (up to 70+ AV engine results per file hash) |
| Enrichment Value | HIGH -- detection ratios are the industry standard for file reputation |

**Plugin design notes:**
- URL lookups require base64-encoding the URL (no padding) as the identifier
- The free tier is severely rate-limited; queuing/batching is essential
- File hash lookups are the most common use case for agent security findings

### 2.2 Shodan

**Confidence:** MEDIUM (training data)

| Aspect | Details |
|--------|---------|
| API Version | REST API (base: `https://api.shodan.io/`) |
| Auth | `key` query parameter |
| Lookups | `/shodan/host/{ip}` (host info), `/dns/resolve` (domain to IP), `/dns/reverse` (IP to domains) |
| Rate Limits | Free: 1 req/sec. Academic/paid: higher |
| Key Data | Open ports, services, banners, OS, vulnerabilities (CVEs), geolocation, ISP/org |
| Indicator Types | IP address, domain (via DNS resolution) |
| Response Size | Medium (ports array, vulns array, location object) |
| Enrichment Value | HIGH for network security -- shows exposed services and known vulns on IPs |

**Plugin design notes:**
- Host lookup is the primary operation for enriching IP indicators from egress findings
- The `/shodan/host/{ip}` endpoint returns all open ports and their banners
- Vulns field requires a paid membership tier
- Results include geolocation (country, city, lat/long) -- can dual-purpose as geolocation enrichment

### 2.3 GreyNoise

**Confidence:** MEDIUM (training data)

| Aspect | Details |
|--------|---------|
| API Version | v3 REST API (base: `https://api.greynoise.io/v3/`) |
| Auth | `key` header |
| Lookups | `/community/{ip}` (free), `/v3/noise/context/{ip}` (enterprise) |
| RIOT | `/v3/riot/{ip}` -- checks if IP belongs to known benign services (CDNs, cloud providers) |
| Rate Limits | Community: 50 req/day. Enterprise: 5000+ req/day |
| Classifications | `benign`, `malicious`, `unknown` (community); adds `noise`/`riot` booleans (enterprise) |
| Indicator Types | IP address only |
| Enrichment Value | HIGH for reducing false positives -- RIOT dataset identifies known-good IPs |

**Plugin design notes:**
- GreyNoise is specifically valuable for ClawdStrike's egress monitoring (EgressAllowlistGuard)
- The RIOT dataset is excellent for auto-dismissing findings involving known cloud provider IPs
- Community tier is heavily rate-limited but sufficient for triage
- Classification maps directly to confidence adjustments (benign -> lower confidence, malicious -> higher)

### 2.4 MISP (Malware Information Sharing Platform)

**Confidence:** MEDIUM (training data)

| Aspect | Details |
|--------|---------|
| API Version | REST API (base: `https://{instance}/`) |
| Auth | `Authorization` header with API key |
| Lookups | `/attributes/restSearch` (search by indicator value), `/events/restSearch` (search events) |
| Rate Limits | Instance-dependent (self-hosted or community instances) |
| Key Data | Events containing attributes with types, categories, tags, threat levels, sharing groups |
| Indicator Types | All (hash, domain, IP, URL, email, filename, registry key, YARA, etc.) |
| Data Model | Event -> Attribute -> Tag/Galaxy/Cluster; Sharing Groups control distribution |
| Enrichment Value | HIGH for enterprise -- connects to global threat sharing community |

**Plugin design notes:**
- MISP is self-hosted, so the base URL is configurable per deployment
- The attribute search endpoint is the most useful for enrichment: POST to `/attributes/restSearch` with `{"value": "indicator_value"}`
- MISP events contain MITRE ATT&CK galaxy clusters that map directly to ClawdStrike's MITRE enrichment
- Sharing groups are relevant for the ClawdStrike swarm model -- MISP communities map conceptually to sentinel swarms
- TLP (Traffic Light Protocol) markings in MISP should map to ClawdStrike's `shareability` field

### 2.5 AlienVault OTX (Open Threat Exchange)

**Confidence:** MEDIUM (training data)

| Aspect | Details |
|--------|---------|
| API Version | DirectConnect API v2 (base: `https://otx.alienvault.com/api/v1/`) |
| Auth | `X-OTX-API-KEY` header |
| Lookups | `/indicators/{type}/{indicator}/{section}` |
| Sections | `general`, `reputation`, `geo`, `malware`, `url_list`, `passive_dns` |
| Rate Limits | 10,000 req/day (generous free tier) |
| Key Data | Pulses (threat reports referencing indicator), reputation score, geo data, passive DNS |
| Indicator Types | IPv4, IPv6, domain, hostname, URL, file hash (MD5/SHA1/SHA256), email, CIDR |
| Enrichment Value | MEDIUM -- good free tier, broad indicator coverage, pulse context |

**Plugin design notes:**
- OTX has the most generous free tier of all the sources
- Pulses are community-contributed threat reports that reference indicators -- good for context
- The `/indicators/IPv4/{ip}/general` endpoint returns pulse count, reputation, country, ASN
- Can also do reverse lookups: "what pulses mention this indicator?"

### 2.6 AbuseIPDB

**Confidence:** MEDIUM (training data)

| Aspect | Details |
|--------|---------|
| API Version | v2 REST API (base: `https://api.abuseipdb.com/api/v2/`) |
| Auth | `Key` header |
| Lookups | `/check` (check IP reputation), `/report` (report abuse) |
| Rate Limits | Free: 1000 checks/day. Premium: 5000+/day |
| Key Data | Abuse confidence score (0-100), total reports, last reported date, ISP, usage type, country |
| Indicator Types | IP address only |
| Enrichment Value | MEDIUM -- specialized for IP abuse reporting/checking |

**Plugin design notes:**
- The confidence score (0-100) maps directly to ClawdStrike's confidence model (divide by 100)
- Report categories indicate attack types (SSH brute force, web attack, DDoS, etc.)
- The `/report` endpoint could enable bidirectional intelligence -- ClawdStrike could report IPs that trigger guard violations
- Best combined with GreyNoise for comprehensive IP reputation

### 2.7 Cross-Cutting Patterns

All six APIs share these patterns:
1. **API key authentication** -- single string, no OAuth complexity
2. **REST/JSON** -- standard request/response patterns
3. **Rate limiting** -- varies from 4 req/min (VT free) to 10,000 req/day (OTX)
4. **Indicator-centric** -- lookup by indicator value, get structured threat data back
5. **Cacheable** -- threat intel data is relatively stable; 15-60 min TTL is appropriate
6. **Latency** -- 200ms-2s typical response times; must be async

---

## 3. ThreatIntelSource Contribution Interface Design

### 3.1 Core Interface

The SDK already declares `ThreatIntelSourceContribution` in `types.ts` (line 257-266), but it only covers manifest-level metadata. The runtime interface needs to be defined.

**Recommended design:**

```typescript
// ---- Indicator Types ----

type IndicatorType = "hash" | "ip" | "domain" | "url" | "email";

interface Indicator {
  type: IndicatorType;
  value: string;
  /** Optional sub-type for hashes (md5, sha1, sha256). */
  hashAlgorithm?: "md5" | "sha1" | "sha256";
  /** Context from the finding that produced this indicator. */
  context?: {
    findingId: string;
    signalIds: string[];
    guardId?: string;
  };
}

// ---- Enrichment Results ----

interface ThreatVerdict {
  /** Normalized classification. */
  classification: "malicious" | "suspicious" | "benign" | "unknown";
  /** Confidence 0.0-1.0 in the classification. */
  confidence: number;
  /** Human-readable summary. */
  summary: string;
}

interface EnrichmentResult {
  /** Source plugin ID. */
  sourceId: string;
  /** Source display name. */
  sourceName: string;
  /** Threat verdict from this source. */
  verdict: ThreatVerdict;
  /** Raw structured data from the API. */
  rawData: Record<string, unknown>;
  /** Extracted MITRE technique IDs, if available. */
  mitreTechniques?: string[];
  /** Related indicators discovered during enrichment. */
  relatedIndicators?: Indicator[];
  /** Link to the source's web UI for this indicator. */
  permalink?: string;
  /** When this result was fetched (Unix ms). */
  fetchedAt: number;
  /** TTL for caching (ms). Default: 900000 (15 min). */
  cacheTtlMs?: number;
}

// ---- ThreatIntelSource Runtime Interface ----

interface ThreatIntelSource {
  /** Unique source ID (matches manifest contribution id). */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Which indicator types this source can enrich. */
  readonly supportedIndicatorTypes: IndicatorType[];
  /** Rate limit configuration. */
  readonly rateLimit: {
    requests: number;
    windowMs: number;
  };
  /**
   * Enrich an indicator with threat intelligence.
   * Returns null if the source has no data for this indicator.
   * Throws on API errors (the orchestrator handles retries).
   */
  enrich(indicator: Indicator): Promise<EnrichmentResult | null>;
  /**
   * Optional health check. Called periodically to verify API key validity
   * and service availability.
   */
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}
```

### 3.2 Why This Design

**Normalized verdict:** Every source returns a `ThreatVerdict` with `classification` and `confidence`. This enables the enrichment orchestrator to aggregate verdicts across sources without source-specific logic.

**Raw data preserved:** The `rawData` field keeps the full API response for the type-specific UI renderers. The enrichment sidebar can have per-source rendering components.

**Related indicators:** Sources like MISP and OTX return related indicators. This enables "pivot" enrichment -- enriching one indicator discovers others that should also be checked.

**Rate limit declaration:** Each source declares its own rate limits. The orchestrator can queue and throttle per-source.

### 3.3 Indicator Extraction

Before enrichment can happen, IOCs must be extracted from findings. The current system relies on pre-extracted IOCs via `enrichWithIocs()`. A new `IndicatorExtractor` module should parse finding signals and enrichments to produce `Indicator[]`:

```typescript
function extractIndicators(finding: Finding, signals: Signal[]): Indicator[] {
  // Extract from IOC enrichments
  // Extract IPs from egress guard violations
  // Extract domains from DNS-related signals
  // Extract hashes from file access signals
  // Deduplicate by type+value
}
```

---

## 4. Enrichment Orchestration

### 4.1 The Enrichment Orchestrator

The missing piece in the current architecture is an async orchestrator that coordinates enrichment across multiple sources. This should be a standalone module, not embedded in the finding store.

**Recommended design:**

```typescript
interface EnrichmentOrchestrator {
  /** Register a threat intel source. */
  registerSource(source: ThreatIntelSource): Disposable;
  /** Get all registered sources. */
  getSources(): ThreatIntelSource[];
  /**
   * Enrich a finding by extracting indicators and querying all
   * compatible sources. Results are dispatched to the finding store
   * as they arrive (streaming UX).
   */
  enrichFinding(
    finding: Finding,
    signals: Signal[],
    options?: {
      /** Only query specific sources. */
      sourceIds?: string[];
      /** Skip cache and force fresh lookups. */
      skipCache?: boolean;
    }
  ): Promise<EnrichmentResult[]>;
  /** Cancel in-flight enrichment for a finding. */
  cancelEnrichment(findingId: string): void;
}
```

### 4.2 Per-Source Rate Limiter

Use a token bucket per source:

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per ms
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    // Wait for next token
    const waitMs = (1 / this.refillRate);
    await new Promise(r => setTimeout(r, waitMs));
    this.refill();
    this.tokens--;
  }
}
```

### 4.3 Caching Strategy

Results should be cached by `(sourceId, indicatorType, indicatorValue)` tuple with per-result TTL (from `EnrichmentResult.cacheTtlMs`):

- **Default TTL:** 15 minutes for real-time sources (VT, AbuseIPDB, GreyNoise)
- **Longer TTL:** 1 hour for slower-changing sources (Shodan, MISP)
- **Storage:** In-memory Map with LRU eviction (max 1000 entries per source)
- **Cache key:** `${sourceId}:${indicator.type}:${indicator.value}`

---

## 5. API Key Management

### 5.1 Current Secure Store

`secure-store.ts` provides a tiered storage backend:

1. **Tauri desktop:** Stronghold encrypted store (hardware-backed)
2. **Browser fallback for sensitive keys:** In-memory Map (ephemeral, lost on tab close)
3. **Browser fallback for non-sensitive keys:** sessionStorage (plaintext)

The store already has key sensitivity detection via `isSensitiveKey()` which pattern-matches on `api_key`, `token`, `secret`, etc.

### 5.2 Plugin-Scoped Secret Namespace

Plugin API keys should use a namespaced key pattern to avoid collisions:

```
plugin:{pluginId}:api_key
```

Examples:
- `plugin:clawdstrike.virustotal:api_key`
- `plugin:clawdstrike.shodan:api_key`
- `plugin:clawdstrike.greynoise:api_key`

**The existing `secureStore.set(key, value)` already handles these correctly** because `isSensitiveKey()` pattern-matches on `api_key` anywhere in the key string. So `plugin:clawdstrike.virustotal:api_key` will be correctly treated as sensitive and stored in Stronghold (desktop) or in-memory (browser).

### 5.3 Plugin SDK Secrets API

Add a `SecretsApi` to the `PluginContext`:

```typescript
interface SecretsApi {
  /** Get a plugin-scoped secret. Key is auto-prefixed with plugin:{pluginId}: */
  get(key: string): Promise<string | null>;
  /** Set a plugin-scoped secret. */
  set(key: string, value: string): Promise<void>;
  /** Delete a plugin-scoped secret. */
  delete(key: string): Promise<void>;
  /** Check if a secret exists. */
  has(key: string): Promise<boolean>;
}
```

The implementation wraps `secureStore` with automatic prefix injection:
```typescript
class PluginSecretsApi implements SecretsApi {
  constructor(private pluginId: string) {}
  async get(key: string) {
    return secureStore.get(`plugin:${this.pluginId}:${key}`);
  }
  // ... etc
}
```

### 5.4 API Key Configuration UI

Each threat intel plugin should contribute a settings panel where operators enter their API keys. Two options:

**Option A: Generic key entry in plugin settings** (recommended)
- The plugin manifest declares `requiredSecrets: [{ key: "api_key", label: "API Key", description: "..." }]`
- The workbench renders a standard secret entry form for each plugin
- No plugin-specific UI code needed for key management

**Option B: Custom settings panel per plugin**
- Each plugin contributes a right sidebar panel or settings tab
- More flexible but more code per plugin

Recommend Option A for simplicity. The manifest already has an `entrypoint` field on `ThreatIntelSourceContribution`, so the runtime module can handle the enrichment logic while the manifest handles secret declarations.

---

## 6. UI Integration Design

### 6.1 Enrichment Source Badges in FindingsList

Each finding row should show small source badges indicating which threat intel sources have enriched it:

```
[CRIT] Behavioral pattern on agent-alpha  [VT] [SH] [GN]  Confirmed  5 signals  92%
```

These badges use the source's brand color and abbreviation. Implementation: iterate `finding.enrichments` and collect unique sources, render as inline badges.

### 6.2 Enrichment Sidebar Enhancement

The existing `EnrichmentSidebar` already handles generic rendering via `GenericContent`. For threat intel plugins, add new entries to `ENRICHMENT_TYPE_CONFIG`:

```typescript
const ENRICHMENT_TYPE_CONFIG = {
  // ... existing entries ...
  // New plugin-contributed types use "external_feed" or "reputation" type
  // but with source-specific rendering via the source field
};
```

Better approach: Register custom enrichment renderers per source via the enrichment registry. The sidebar resolves renderers by `(type, source)` pair, falling back to `GenericContent`.

### 6.3 Enrichment Detail Panel

The right sidebar should gain a dedicated "Intel Sources" section showing:
- **Per-source status:** Connected (green), Not configured (gray), Error (red), Rate limited (amber)
- **Aggregate verdict:** Malicious (N sources), Benign (N sources), Unknown (N sources)
- **Per-source cards:** Expandable cards with source-specific data rendering
- **Pivot indicators:** "Related indicators" section with one-click enrichment

### 6.4 Loading and Error States

Enrichment is async and may take several seconds per source:

- **Skeleton loader:** Show placeholder cards with pulse animation while enrichment is in-flight
- **Streaming results:** Render results as they arrive (don't wait for all sources to complete)
- **Error per source:** A failed VirusTotal lookup should not prevent Shodan results from displaying
- **Rate limit indicator:** Show "Rate limited -- retry in Xs" badge when a source is throttled
- **Cancellation:** Allow canceling in-flight enrichment (e.g., when navigating away from finding)

### 6.5 Auto-Enrichment

Consider optional auto-enrichment for new findings above a confidence threshold:
- `autoEnrichOnConfirm: true` -- auto-enrich when a finding is confirmed
- This should be configurable per-sentinel and per-source
- Must respect rate limits -- queue rather than fire immediately

---

## 7. Plugin Architecture Recommendations

### 7.1 ThreatIntelSource Registry

Following the Phase 1 pattern (guard-registry, file-type-registry, status-bar-registry), create a `ThreatIntelSourceRegistry`:

```typescript
class ThreatIntelSourceRegistry {
  private sources = new Map<string, ThreatIntelSource>();

  register(source: ThreatIntelSource): Disposable {
    this.sources.set(source.id, source);
    return () => { this.sources.delete(source.id); };
  }

  get(id: string): ThreatIntelSource | undefined;
  getAll(): ThreatIntelSource[];
  getForIndicator(type: IndicatorType): ThreatIntelSource[];
}
```

### 7.2 Plugin Loader Integration

The `PluginLoader.routeContributions()` method (line 308-338) currently routes guards, file types, and status bar items. Add routing for `threatIntelSources`:

```typescript
// In routeContributions():
if (contributions.threatIntelSources) {
  for (const source of contributions.threatIntelSources) {
    const dispose = this.routeThreatIntelSourceContribution(source, manifest);
    disposables.push(dispose);
  }
}
```

The routing resolves the source module from the `entrypoint` field and calls `register()` on the `ThreatIntelSourceRegistry`.

### 7.3 Example Plugin: VirusTotal

```typescript
import { createPlugin, type PluginContext } from "@clawdstrike/plugin-sdk";

export default createPlugin({
  manifest: {
    id: "clawdstrike.virustotal",
    name: "virustotal",
    displayName: "VirusTotal",
    description: "VirusTotal threat intelligence enrichment",
    version: "1.0.0",
    publisher: "clawdstrike",
    categories: ["intel"],
    trust: "internal",
    activationEvents: ["onStartup"],
    contributions: {
      threatIntelSources: [{
        id: "virustotal",
        name: "VirusTotal",
        description: "File hash, domain, IP, and URL lookups via VirusTotal v3 API",
        entrypoint: "./sources/virustotal.ts",
      }],
    },
  },
  activate(ctx: PluginContext) {
    // Source registration happens via contribution routing
    // Plugin can use ctx.secrets.get("api_key") to retrieve the stored key
  },
});
```

### 7.4 Mapping Enrichment Results to Existing Types

Threat intel plugin results should map to existing enrichment types:

| Source | Enrichment Type | Rationale |
|--------|----------------|-----------|
| VirusTotal | `reputation` | Detection ratio is a reputation score |
| Shodan | `external_feed` | Port/service data is external intelligence |
| GreyNoise | `reputation` | Classification is a reputation verdict |
| MISP | `external_feed` | Event/attribute data from external sharing |
| OTX | `external_feed` | Pulse data from external community |
| AbuseIPDB | `reputation` | Abuse confidence score is reputation |

For all: the `source` field on the Enrichment identifies which plugin produced it (e.g., `"virustotal"`, `"shodan"`). The enrichment sidebar can then dispatch to source-specific renderers.

### 7.5 Enrichment Type Registry

To avoid the hardcoded `type` union on `Enrichment`, introduce an `EnrichmentTypeRegistry` following the same pattern as guard/file-type registries:

```typescript
interface EnrichmentTypeDescriptor {
  id: string;              // "virustotal_scan", "shodan_host", etc.
  label: string;           // "VirusTotal Scan"
  icon: ComponentType;     // Tabler icon component
  color: string;           // Hex color for UI
  renderContent?: ComponentType<{ data: Record<string, unknown> }>;
}
```

The current `ENRICHMENT_TYPE_CONFIG` hardcoded record becomes the seed data. Plugins register additional descriptors. The `EnrichmentSidebar` resolves renderers from the registry instead of the static map.

---

## 8. Implementation Phasing

### Phase A: Foundation (Threat Intel Registry + Orchestrator)

1. Create `ThreatIntelSourceRegistry` (Map-based singleton, register/unregister/getAll)
2. Define `ThreatIntelSource`, `Indicator`, `EnrichmentResult` interfaces in `@clawdstrike/plugin-sdk`
3. Create `EnrichmentOrchestrator` with rate limiting and caching
4. Add `SecretsApi` to `PluginContext`
5. Wire `PluginLoader.routeContributions()` for `threatIntelSources`
6. Add indicator extraction from finding signals

### Phase B: First-Party Plugins (VirusTotal + GreyNoise)

1. Implement VirusTotal source plugin (highest enrichment value, most recognizable)
2. Implement GreyNoise source plugin (most relevant for agent egress monitoring)
3. Wire "Run Enrichment" button in FindingsIntelPage to EnrichmentOrchestrator
4. Add streaming result rendering in EnrichmentSidebar

### Phase C: API Key Settings + Remaining Plugins

1. Add plugin secret settings UI (generic key entry form in settings panel)
2. Implement Shodan, AbuseIPDB, OTX, MISP plugins
3. Add enrichment source badges to FindingsList rows
4. Add auto-enrichment configuration

### Phase D: Advanced Features

1. Pivot enrichment (enrich related indicators discovered by sources)
2. Bidirectional reporting (report IOCs back to AbuseIPDB/MISP)
3. Custom enrichment type renderers via plugin contribution points
4. Enrichment aggregation dashboard

### Phase Ordering Rationale

- **Phase A first** because it creates the registry and orchestrator infrastructure all plugins need
- **Phase B second** because VirusTotal and GreyNoise cover the two most common indicator types (hash + IP) and prove the pipeline end-to-end
- **Phase C third** because API key management is needed before deploying to real operators, and the remaining plugins are incremental
- **Phase D last** because pivot enrichment and bidirectional reporting are differentiation features, not table stakes

---

## 9. Pitfalls and Risks

### Critical: API Key Leakage

**What goes wrong:** Plugin code or enrichment results containing API keys get persisted to localStorage or included in enrichment data.
**Prevention:** The `SecretsApi` never returns keys to rendering code. API calls happen in the orchestrator layer, not in UI components. The `secureStore` already treats `api_key` patterns as sensitive (in-memory only in browser mode).

### Critical: Rate Limit Exhaustion

**What goes wrong:** Auto-enrichment on a burst of findings exhausts API quotas in minutes.
**Prevention:** Per-source token bucket rate limiting. Queue overflow -> drop oldest. Global enrichment concurrency limit (max 3 concurrent sources). Never auto-enrich below a configurable confidence threshold.

### Moderate: Enrichment Data Staleness

**What goes wrong:** Cached enrichment results are stale, showing "benign" for an indicator that was reclassified as malicious.
**Prevention:** Conservative TTLs (15 min default). "Last checked" timestamp always shown in UI. Manual "Refresh" button per enrichment. Stale results shown with visual indicator.

### Moderate: Plugin Isolation Failure

**What goes wrong:** A malicious community plugin's threat intel source exfiltrates finding data to an unauthorized endpoint.
**Prevention:** Community (sandboxed) plugins should not have direct network access. Their enrichment requests should be proxied through the orchestrator, which validates the target URL against an allowlist. Internal plugins have full network access (trusted).

### Minor: Inconsistent Indicator Extraction

**What goes wrong:** Different signal types produce indicators in different formats (e.g., IPs with/without port, hashes in mixed case).
**Prevention:** Normalize all indicators before enrichment: lowercase hashes, strip ports from IPs, validate format with regex.

---

## 10. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Codebase analysis (enrichment architecture) | HIGH | Read all source files directly |
| Plugin SDK integration | HIGH | Read SDK types, loader, registry |
| VirusTotal API | MEDIUM | Training data; verify v3 rate limits and endpoint paths |
| Shodan API | MEDIUM | Training data; verify current pricing/limits |
| GreyNoise API | MEDIUM | Training data; verify v3 endpoint paths and RIOT availability |
| MISP API | MEDIUM | Training data; verify restSearch endpoint format |
| OTX API | MEDIUM | Training data; verify DirectConnect API v2 paths |
| AbuseIPDB API | MEDIUM | Training data; verify v2 endpoint and limits |
| UI integration patterns | HIGH | Based on existing enrichment sidebar code |
| Secret management | HIGH | Read secure-store.ts and operator-crypto.ts directly |

---

## 11. Open Questions

1. **Should threat intel plugins run in the Tauri sidecar (Rust) or the renderer (TypeScript)?** Running in the sidecar avoids CORS issues and gives access to native HTTP clients. Running in the renderer keeps the architecture simpler but requires CORS proxy or Tauri invoke bridge.

2. **Should enrichment results be persisted separately from findings?** Currently enrichments are embedded in the Finding object (persisted to localStorage). Large enrichment payloads (VirusTotal with 70+ AV results) could bloat localStorage. Consider a separate enrichment cache with TTL-based eviction.

3. **How should the broker subsystem interact with threat intel plugins?** The broker's secret backend (`file`, `env`, `http`) could serve as an alternative secret store for API keys, especially in fleet deployments where Stronghold per-workstation is impractical.

4. **Should there be a "threat intel dashboard" view?** Beyond per-finding enrichment, operators may want an aggregate view: "which IPs across all findings are flagged by VirusTotal?" This is a Phase D feature but affects data model decisions in Phase A.
