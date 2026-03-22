/**
 * Shodan Threat Intel Source Plugin
 *
 * Implements ThreatIntelSource for the Shodan REST API. Supports IP and
 * domain indicator types. For domains, resolves via Shodan DNS first,
 * then enriches the resolved IP.
 *
 * Normalizes Shodan host data (open ports, vulnerabilities, geolocation)
 * into ThreatVerdict (classification + confidence + summary).
 *
 * Rate limit: 60 requests/minute (1 req/sec).
 * Cache TTL: 1 hour (Shodan data changes slowly).
 *
 * Auth pattern: Shodan uses `key` as a query parameter (NOT a header).
 *
 * Never throws -- all error paths return EnrichmentResult with
 * classification "unknown" and confidence 0.
 */

import type {
  PluginManifest,
  ThreatIntelSource,
  Indicator,
  EnrichmentResult,
  ThreatVerdict,
} from "@clawdstrike/plugin-sdk";

// ---- Constants ----

const SHODAN_API_BASE = "https://api.shodan.io";
const CACHE_TTL_MS = 3_600_000; // 1 hour
const RATE_LIMIT_MAX_PER_MINUTE = 60; // 1 req/sec

// ---- Manifest ----

export const SHODAN_MANIFEST: PluginManifest = {
  id: "clawdstrike.shodan",
  name: "shodan-intel",
  displayName: "Shodan",
  description:
    "Shodan threat intelligence source. Enriches IP addresses and domains with open ports, services, vulnerabilities, and geolocation via the Shodan API.",
  version: "1.0.0",
  publisher: "clawdstrike",
  categories: ["intel"],
  trust: "internal",
  activationEvents: ["onStartup"],
  main: "./shodan-plugin.ts",
  contributions: {
    threatIntelSources: [
      {
        id: "shodan",
        name: "Shodan",
        description:
          "Internet-connected device search engine",
        entrypoint: "./shodan-plugin.ts",
      },
    ],
  },
  requiredSecrets: [
    {
      key: "api_key",
      label: "Shodan API Key",
      description: "API key from account.shodan.io",
    },
  ],
};

// ---- Types ----

/** Shodan host API response shape. */
interface ShodanHostResponse {
  ip_str: string;
  ports?: number[];
  vulns?: string[];
  org?: string;
  isp?: string;
  country_name?: string;
  city?: string;
  os?: string;
  [key: string]: unknown;
}

// ---- Helpers ----

/** Normalize Shodan host data into a ThreatVerdict. */
function normalizeVerdict(data: ShodanHostResponse): ThreatVerdict {
  const ports = data.ports ?? [];
  const vulns = data.vulns ?? [];
  const vulnCount = vulns.length;
  const portCount = ports.length;

  // Build summary
  const vulnWord = vulnCount === 1 ? "vulnerability" : "vulnerabilities";
  const summary = `${portCount} open ports, ${vulnCount} known ${vulnWord}`;

  // Classification based on vuln count
  if (vulnCount > 0) {
    // Confidence scales with vuln count: 1-5 = 0.5, 6+ = 0.7
    const confidence = vulnCount >= 6 ? 0.7 : 0.5;
    return {
      classification: "suspicious",
      confidence,
      summary,
    };
  }

  return {
    classification: "benign",
    confidence: 0.3,
    summary,
  };
}

/** Create an error EnrichmentResult with classification "unknown". */
function errorResult(summaryText: string): EnrichmentResult {
  return {
    sourceId: "shodan",
    sourceName: "Shodan",
    verdict: {
      classification: "unknown",
      confidence: 0,
      summary: summaryText,
    },
    rawData: {},
    fetchedAt: Date.now(),
    cacheTtlMs: CACHE_TTL_MS,
  };
}

// ---- Factory ----

/**
 * Create a Shodan ThreatIntelSource instance.
 *
 * @param apiKey - Shodan API key (passed as query parameter `key`)
 * @returns A ThreatIntelSource that enriches IP/domain indicators via Shodan REST API
 */
export function createShodanSource(apiKey: string): ThreatIntelSource {
  return {
    id: "shodan",
    name: "Shodan",
    supportedIndicatorTypes: ["ip", "domain"],
    rateLimit: { maxPerMinute: RATE_LIMIT_MAX_PER_MINUTE },

    async enrich(indicator: Indicator): Promise<EnrichmentResult> {
      try {
        // For domain indicators, first resolve to IP via Shodan DNS
        let targetIp: string;
        let relatedIndicators: Indicator[] | undefined;

        if (indicator.type === "domain") {
          const dnsUrl = `${SHODAN_API_BASE}/dns/resolve?hostnames=${indicator.value}&key=${apiKey}`;
          const dnsResponse = await fetch(dnsUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
          });

          if (!dnsResponse.ok) {
            return errorResult(
              `Shodan DNS resolution failed: HTTP ${dnsResponse.status}`,
            );
          }

          const dnsData = (await dnsResponse.json()) as Record<string, string | null>;
          const resolvedIp = dnsData[indicator.value];
          if (!resolvedIp) {
            return errorResult(
              `No DNS resolution for domain: ${indicator.value}`,
            );
          }

          targetIp = resolvedIp;
          relatedIndicators = [{ type: "ip", value: resolvedIp }];
        } else if (indicator.type === "ip") {
          targetIp = indicator.value;
        } else {
          return errorResult(
            `Unsupported indicator type: ${indicator.type}. Shodan supports IP and domain indicators.`,
          );
        }

        // Fetch host information
        const hostUrl = `${SHODAN_API_BASE}/shodan/host/${targetIp}?key=${apiKey}`;
        const response = await fetch(hostUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          if (response.status === 404) {
            return errorResult("No data found for this IP");
          }
          if (response.status === 401) {
            return errorResult("Shodan API key unauthorized or invalid");
          }
          if (response.status === 429) {
            return errorResult("Shodan rate limit exceeded");
          }
          return errorResult(
            `Shodan API error: HTTP ${response.status}`,
          );
        }

        const data = (await response.json()) as ShodanHostResponse;
        const verdict = normalizeVerdict(data);

        return {
          sourceId: "shodan",
          sourceName: "Shodan",
          verdict,
          rawData: {
            ports: data.ports ?? [],
            vulns: data.vulns ?? [],
            org: data.org ?? "",
            isp: data.isp ?? "",
            country_name: data.country_name ?? "",
            city: data.city ?? "",
            os: data.os ?? "",
          },
          relatedIndicators,
          permalink: `https://www.shodan.io/host/${targetIp}`,
          fetchedAt: Date.now(),
          cacheTtlMs: CACHE_TTL_MS,
        };
      } catch (err: unknown) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return errorResult("Shodan request timeout");
        }
        if (err instanceof TypeError && /fetch/i.test(err.message)) {
          return errorResult("Network error contacting Shodan");
        }
        return errorResult(
          `Shodan error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      try {
        const response = await fetch(
          `${SHODAN_API_BASE}/api-info?key=${apiKey}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          },
        );
        if (response.ok) {
          return { healthy: true };
        }
        return {
          healthy: false,
          message: `Shodan health check failed: HTTP ${response.status}`,
        };
      } catch (err: unknown) {
        return {
          healthy: false,
          message: `Shodan health check error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
