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
  const pendingCountRef = useRef(0);

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

      // Track how many enrich calls are in flight
      const totalCalls = indicators.length;
      pendingCountRef.current = totalCalls;
      let completedCalls = 0;

      // Accumulate all received results from onResult callbacks
      const receivedSourceIds = new Set<string>();

      // Fan out enrichment requests (one per indicator)
      for (const indicator of indicators) {
        orchestrator
          .enrich(indicator, {
            signal,
            onResult: (result: EnrichmentResult) => {
              receivedSourceIds.add(result.sourceId);

              // Update the specific source status to "done"
              setSourceStatuses((prev) =>
                prev.map((s) =>
                  s.sourceId === result.sourceId
                    ? { ...s, status: "done" as const, result }
                    : s,
                ),
              );

              // Append to results
              setResults((prev) => [...prev, result]);
            },
          })
          .then(() => {
            completedCalls++;
            if (completedCalls >= totalCalls) {
              // All enrich calls have resolved -- mark any sources still "loading" as "done"
              setSourceStatuses((prev) =>
                prev.map((s) =>
                  s.status === "loading" ? { ...s, status: "done" as const } : s,
                ),
              );
              setIsEnriching(false);
            }
          })
          .catch((err: unknown) => {
            completedCalls++;
            // onError path: mark sources that haven't responded as "error"
            const errorMessage =
              err instanceof Error ? err.message : "Enrichment failed";

            setSourceStatuses((prev) =>
              prev.map((s) => {
                if (s.status === "loading" && !receivedSourceIds.has(s.sourceId)) {
                  return { ...s, status: "error" as const, error: errorMessage };
                }
                return s;
              }),
            );

            if (completedCalls >= totalCalls) {
              setIsEnriching(false);
            }
          });
      }
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
