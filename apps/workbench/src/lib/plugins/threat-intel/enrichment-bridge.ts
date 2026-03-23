/**
 * Enrichment Bridge
 *
 * React hook that bridges the UI "Run Enrichment" button to the Phase 1
 * EnrichmentOrchestrator. Extracts indicators from a finding, fans out
 * enrichment requests across all registered threat intel sources, and
 * provides reactive state for streaming results, skeleton loaders, and
 * per-source error badges.
 */

import { useState, useCallback, useRef } from "react";
import type { EnrichmentResult, ThreatIntelSource } from "@clawdstrike/plugin-sdk";
import type { Finding } from "@/lib/workbench/finding-engine";
import { extractIndicators } from "@/lib/workbench/indicator-extractor";
import { getAllThreatIntelSources } from "@/lib/workbench/threat-intel-registry";

// ---- Types ----

export type EnrichmentSourceStatusState = "idle" | "loading" | "done" | "error";

export interface EnrichmentSourceStatus {
  sourceId: string;
  sourceName: string;
  status: EnrichmentSourceStatusState;
  result?: EnrichmentResult;
  error?: string;
}

// ---- Orchestrator interface (duck-typed to avoid hard coupling) ----

interface EnrichmentOrchestratorLike {
  enrich(
    indicator: unknown,
    options?: {
      sourceIds?: string[];
      signal?: AbortSignal;
      onResult?: (result: EnrichmentResult) => void;
    },
  ): Promise<EnrichmentResult[]>;
}

// ---- Hook ----

export interface UseEnrichmentBridgeReturn {
  runEnrichment: (finding: Finding) => void;
  sourceStatuses: EnrichmentSourceStatus[];
  isEnriching: boolean;
  results: EnrichmentResult[];
  cancel: () => void;
}

/**
 * Hook bridging the UI to the EnrichmentOrchestrator.
 *
 * @param orchestrator - The enrichment orchestrator instance (Phase 1).
 * @returns Reactive enrichment state and control functions.
 */
export function useEnrichmentBridge(
  orchestrator: EnrichmentOrchestratorLike,
): UseEnrichmentBridgeReturn {
  const [sourceStatuses, setSourceStatuses] = useState<EnrichmentSourceStatus[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsEnriching(false);
  }, []);

  const runEnrichment = useCallback(
    (finding: Finding) => {
      // Cancel any in-flight enrichment
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Set up new AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      // Extract indicators from the finding (signals not available at UI layer,
      // so we pass undefined -- the extractor falls back to finding-only extraction)
      const indicators = extractIndicators(finding, undefined as never);

      // Get all registered sources to initialize skeleton statuses
      const sources: ThreatIntelSource[] = getAllThreatIntelSources();

      // Initialize source statuses to "loading"
      const initialStatuses: EnrichmentSourceStatus[] = sources.map((source) => ({
        sourceId: source.id,
        sourceName: source.name,
        status: "loading" as const,
      }));

      setSourceStatuses(initialStatuses);
      setResults([]);
      setIsEnriching(true);

      if (indicators.length === 0) {
        setIsEnriching(false);
        setSourceStatuses(
          sources.map((source) => ({
            sourceId: source.id,
            sourceName: source.name,
            status: "done" as const,
          })),
        );
        return;
      }

      // Fan out enrichment requests (one per indicator) using Promise.allSettled
      // to avoid the race condition of manual counter tracking.
      const promises = indicators.map((indicator) =>
        orchestrator.enrich(indicator, {
          signal,
          onResult: (result: EnrichmentResult) => {
            setSourceStatuses((prev) =>
              prev.map((s) =>
                s.sourceId === result.sourceId
                  ? { ...s, status: "done" as const, result }
                  : s,
              ),
            );
            setResults((prev) => [...prev, result]);
          },
        }),
      );

      Promise.allSettled(promises).then((settled) => {
        // Collect error messages from rejected promises
        const errors = settled
          .filter(
            (r): r is PromiseRejectedResult => r.status === "rejected",
          )
          .map((r) =>
            r.reason instanceof Error
              ? r.reason.message
              : "Enrichment failed",
          );

        // Mark any remaining loading sources as done or errored
        setSourceStatuses((prev) =>
          prev.map((s) => {
            if (s.status === "loading") {
              if (errors.length > 0) {
                return { ...s, status: "error" as const, error: errors[0] };
              }
              return { ...s, status: "done" as const };
            }
            return s;
          }),
        );
        setIsEnriching(false);
      });
    },
    [orchestrator, cancel],
  );

  return {
    runEnrichment,
    sourceStatuses,
    isEnriching,
    results,
    cancel,
  };
}
