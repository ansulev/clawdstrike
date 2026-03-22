/**
 * GreyNoise Threat Intel Source Plugin
 *
 * Implements ThreatIntelSource for the GreyNoise Community v3 API.
 * Supports IP indicator type only. Normalizes GreyNoise classification
 * and RIOT status into ThreatVerdict (classification + confidence + summary).
 *
 * Rate limit: 10 requests/minute (community tier).
 * Cache TTL: 10 minutes (GreyNoise data changes less frequently).
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

const GN_API_BASE = "https://api.greynoise.io";
const GN_VIZ_BASE = "https://viz.greynoise.io";
const CACHE_TTL_MS = 600_000; // 10 minutes
const RATE_LIMIT_MAX_PER_MINUTE = 10; // Community tier

// ---- Manifest ----

export const GREYNOISE_MANIFEST: PluginManifest = {
  id: "clawdstrike.greynoise",
  name: "greynoise",
  displayName: "GreyNoise",
  description:
    "GreyNoise threat intelligence source. Enriches IP addresses via the GreyNoise Community v3 API with noise and RIOT classification.",
  version: "1.0.0",
  publisher: "clawdstrike",
  categories: ["intel"],
  trust: "internal",
  activationEvents: ["onStartup"],
  main: "./greynoise-plugin.ts",
  contributions: {
    threatIntelSources: [
      {
        id: "greynoise",
        name: "GreyNoise",
        description:
          "IP noise classification and RIOT status via GreyNoise Community v3 API",
        entrypoint: "./greynoise-plugin.ts",
      },
    ],
  },
};

// ---- Types ----

/** GreyNoise community API response shape. */
interface GnCommunityResponse {
  ip: string;
  noise: boolean;
  riot: boolean;
  classification: string;
  name: string;
  link?: string;
  last_seen: string;
  message: string;
}

// ---- Helpers ----

/** Normalize GreyNoise classification + RIOT status into a ThreatVerdict. */
function normalizeVerdict(data: GnCommunityResponse): ThreatVerdict {
  const classification = data.classification;
  const riot = data.riot;
  const name = data.name;

  // Build summary
  let summary = `GreyNoise: ${classification}`;
  if (riot) {
    summary += " (RIOT - Rule It Out)";
  }
  if (name && name !== "Unknown") {
    summary += ` - ${name}`;
  }

  switch (classification) {
    case "malicious":
      return {
        classification: "malicious",
        confidence: 0.85,
        summary,
      };

    case "benign":
      return {
        classification: "benign",
        confidence: riot ? 0.95 : 0.9,
        summary,
      };

    case "unknown":
    default:
      return {
        classification: "unknown",
        confidence: 0.5,
        summary,
      };
  }
}

/** Create an error EnrichmentResult with classification "unknown". */
function errorResult(summaryText: string): EnrichmentResult {
  return {
    sourceId: "greynoise",
    sourceName: "GreyNoise",
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
 * Create a GreyNoise ThreatIntelSource instance.
 *
 * @param apiKey - GreyNoise API key (passed in key header)
 * @returns A ThreatIntelSource that enriches IP indicators via GreyNoise Community v3 API
 */
export function createGreyNoiseSource(apiKey: string): ThreatIntelSource {
  return {
    id: "greynoise",
    name: "GreyNoise",
    supportedIndicatorTypes: ["ip"],
    rateLimit: { maxPerMinute: RATE_LIMIT_MAX_PER_MINUTE },

    async enrich(indicator: Indicator): Promise<EnrichmentResult> {
      // Only supports IP indicators
      if (indicator.type !== "ip") {
        return errorResult(
          `Unsupported indicator type: ${indicator.type}. GreyNoise only supports IP indicators.`,
        );
      }

      try {
        const url = `${GN_API_BASE}/v3/community/${indicator.value}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            key: apiKey,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            return errorResult("GreyNoise API key unauthorized or invalid");
          }
          if (response.status === 429) {
            return errorResult("GreyNoise rate limit exceeded");
          }
          return errorResult(
            `GreyNoise API error: HTTP ${response.status}`,
          );
        }

        const data = (await response.json()) as GnCommunityResponse;
        const verdict = normalizeVerdict(data);

        // Construct permalink: prefer response link field, fallback to constructed URL
        const permalink =
          data.link || `${GN_VIZ_BASE}/ip/${indicator.value}`;

        return {
          sourceId: "greynoise",
          sourceName: "GreyNoise",
          verdict,
          rawData: {
            noise: data.noise,
            riot: data.riot,
            classification: data.classification,
            name: data.name,
            last_seen: data.last_seen,
          },
          permalink,
          fetchedAt: Date.now(),
          cacheTtlMs: CACHE_TTL_MS,
        };
      } catch (err: unknown) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return errorResult("GreyNoise request timeout");
        }
        if (err instanceof TypeError && /fetch/i.test(err.message)) {
          return errorResult("Network error contacting GreyNoise");
        }
        return errorResult(
          `GreyNoise error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      try {
        // Use Google DNS (8.8.8.8) as a known benign IP for health checks
        const response = await fetch(
          `${GN_API_BASE}/v3/community/8.8.8.8`,
          {
            method: "GET",
            headers: {
              key: apiKey,
              Accept: "application/json",
            },
          },
        );
        if (response.ok) {
          return { healthy: true };
        }
        return {
          healthy: false,
          message: `GreyNoise health check failed: HTTP ${response.status}`,
        };
      } catch (err: unknown) {
        return {
          healthy: false,
          message: `GreyNoise health check error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
