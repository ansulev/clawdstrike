/**
 * Enrichment Orchestrator
 *
 * Coordinates async enrichment across registered ThreatIntelSources with:
 * - Per-source token bucket rate limiting (maxPerMinute enforcement)
 * - Result caching by (sourceId, indicatorType, indicatorValue) with configurable TTL
 * - AbortSignal-based cancellation
 * - Streaming callbacks via onResult
 *
 * The orchestrator queries the ThreatIntelSourceRegistry to discover sources,
 * then fans out indicator lookups with rate limiting and caching.
 */

import type { Indicator, EnrichmentResult, ThreatIntelSource } from "@clawdstrike/plugin-sdk";
import {
  getThreatIntelSource,
  getThreatIntelSourcesForIndicator,
} from "./threat-intel-registry";

// ---- Token Bucket (internal) ----

class TokenBucket {
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefill: number;
  private readonly refillIntervalMs = 60_000; // 1 minute

  constructor(maxPerMinute: number) {
    this.maxTokens = maxPerMinute;
    this.tokens = maxPerMinute;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  msUntilToken(): number {
    this.refill();
    if (this.tokens > 0) return 0;
    return this.refillIntervalMs - (Date.now() - this.lastRefill);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}

// ---- Cache (internal) ----

interface CacheEntry {
  result: EnrichmentResult;
  expiresAt: number;
}

function cacheKey(sourceId: string, indicator: Indicator): string {
  return `${sourceId}:${indicator.type}:${indicator.value}`;
}

// ---- Enrichment Options ----

export interface EnrichOptions {
  /** Restrict enrichment to specific source IDs. */
  sourceIds?: string[];
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Callback invoked for each result as it arrives. */
  onResult?: (result: EnrichmentResult) => void;
}

// ---- Orchestrator ----

export class EnrichmentOrchestrator {
  private readonly rateLimiters = new Map<string, TokenBucket>();
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Enrich an indicator across matching or specified sources.
   *
   * - Checks cache before calling source.enrich()
   * - Applies per-source token bucket rate limiting
   * - Supports AbortSignal cancellation
   * - Calls onResult for each result as it arrives
   * - One source failing does not block other sources
   */
  async enrich(
    indicator: Indicator,
    options: EnrichOptions = {},
  ): Promise<EnrichmentResult[]> {
    const { sourceIds, signal, onResult } = options;

    // Resolve applicable sources
    const sources = this.resolveSources(indicator, sourceIds);

    // Dispatch concurrently with rate limiting
    const settled = await Promise.allSettled(
      sources.map((source) =>
        this.enrichFromSource(source, indicator, signal, onResult),
      ),
    );

    // Collect successful results
    const results: EnrichmentResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === "fulfilled" && outcome.value != null) {
        results.push(outcome.value);
      }
    }

    return results;
  }

  /** Clear the entire result cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Clear cached entries for a specific source. */
  clearCacheForSource(sourceId: string): void {
    const prefix = `${sourceId}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // ---- Private helpers ----

  private resolveSources(
    indicator: Indicator,
    sourceIds?: string[],
  ): ThreatIntelSource[] {
    if (sourceIds && sourceIds.length > 0) {
      const resolved: ThreatIntelSource[] = [];
      for (const id of sourceIds) {
        const source = getThreatIntelSource(id);
        if (source) {
          resolved.push(source);
        }
      }
      return resolved;
    }
    return getThreatIntelSourcesForIndicator(indicator.type);
  }

  private async enrichFromSource(
    source: ThreatIntelSource,
    indicator: Indicator,
    signal?: AbortSignal,
    onResult?: (result: EnrichmentResult) => void,
  ): Promise<EnrichmentResult | null> {
    // Check abort before starting
    if (signal?.aborted) {
      return null;
    }

    // Check cache
    const key = cacheKey(source.id, indicator);
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      onResult?.(cached.result);
      return cached.result;
    }

    // Get or create rate limiter
    let bucket = this.rateLimiters.get(source.id);
    if (!bucket) {
      bucket = new TokenBucket(source.rateLimit.maxPerMinute);
      this.rateLimiters.set(source.id, bucket);
    }

    // Wait for rate limit token
    if (!bucket.tryConsume()) {
      const waitMs = bucket.msUntilToken();
      if (waitMs > 0) {
        // Wait for token, checking abort periodically
        await this.waitWithAbort(waitMs, signal);
        if (signal?.aborted) {
          return null;
        }
        // After waiting, try to consume again (refill should have happened)
        if (!bucket.tryConsume()) {
          return null; // Still no token available
        }
      }
    }

    // Check abort before calling source
    if (signal?.aborted) {
      return null;
    }

    try {
      const result = await source.enrich(indicator);

      // Store in cache
      this.cache.set(key, {
        result,
        expiresAt: Date.now() + result.cacheTtlMs,
      });

      onResult?.(result);
      return result;
    } catch {
      // One source failing does not block others -- return null
      return null;
    }
  }

  private waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        resolve();
      }, ms);

      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }
}

/** Singleton orchestrator instance. */
export const enrichmentOrchestrator = new EnrichmentOrchestrator();
