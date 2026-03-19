---
phase: track-c-intel
plan: C1-01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/workbench/signal-correlator.ts
  - src/lib/workbench/__tests__/signal-correlator.test.ts
  - src/features/findings/hooks/use-signal-correlator.ts
autonomous: true
requirements: [INTEL-01, INTEL-02, INTEL-03, INTEL-04]

must_haves:
  truths:
    - "When signals are ingested into the signal store, correlation runs automatically after a debounce"
    - "Correlated signal clusters produce findings in the finding store"
    - "Findings that meet auto-confirm thresholds are confirmed automatically"
    - "Findings that meet auto-promote thresholds are annotated as promotion-ready"
    - "Enrichment pipeline runs on newly created findings"
  artifacts:
    - path: "src/lib/workbench/signal-correlator.ts"
      provides: "Pure-function orchestrator wiring correlateSignals -> createFromCluster -> enrichment -> auto-promotion"
      exports: ["runCorrelationPipeline", "CorrelationPipelineResult"]
    - path: "src/features/findings/hooks/use-signal-correlator.ts"
      provides: "React hook subscribing to signal store and triggering correlation pipeline"
      exports: ["useSignalCorrelator"]
    - path: "src/lib/workbench/__tests__/signal-correlator.test.ts"
      provides: "Unit tests for the correlation pipeline orchestrator"
      contains: "runCorrelationPipeline"
  key_links:
    - from: "src/features/findings/hooks/use-signal-correlator.ts"
      to: "src/features/findings/stores/signal-store.tsx"
      via: "useSignalStore.use.signals() subscription"
      pattern: "useSignalStore"
    - from: "src/features/findings/hooks/use-signal-correlator.ts"
      to: "src/features/findings/stores/finding-store.tsx"
      via: "useFindingStore.getState().actions.createFromCluster()"
      pattern: "useFindingStore"
    - from: "src/lib/workbench/signal-correlator.ts"
      to: "src/lib/workbench/signal-pipeline.ts"
      via: "correlateSignals() import"
      pattern: "correlateSignals"
    - from: "src/lib/workbench/signal-correlator.ts"
      to: "src/lib/workbench/finding-engine.ts"
      via: "createFromCluster, runEnrichmentPipeline, checkAutoPromotion imports"
      pattern: "createFromCluster|runEnrichmentPipeline|checkAutoPromotion"
---

<objective>
Wire the automated signal -> cluster -> finding -> auto-promotion pipeline.

Purpose: The signal pipeline has all the building blocks (4 correlation strategies, union-find merge, finding creation, enrichment, auto-promotion) but nothing triggers correlation after signal ingestion. This plan creates the orchestration layer that connects them, plus a React hook that drives the pipeline from signal store changes.

Output: A pure-function correlator module and a hook that automatically creates findings from signal clusters as signals arrive.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/track-c-intel/RESEARCH.md

@src/lib/workbench/signal-pipeline.ts
@src/lib/workbench/finding-engine.ts
@src/features/findings/stores/signal-store.tsx
@src/features/findings/stores/finding-store.tsx

<interfaces>
<!-- Signal pipeline exports used by the correlator -->
From src/lib/workbench/signal-pipeline.ts:
```typescript
export interface Signal { id: string; type: SignalType; source: SignalSource; timestamp: number; severity: Severity; confidence: number; data: SignalData; context: SignalContext; relatedSignals: string[]; ttl: number | null; findingId: string | null; }
export interface SignalCluster { id: string; signalIds: string[]; maxConfidence: number; strategies: CorrelationStrategyName[]; createdAt: number; }
export interface CorrelationOptions { windowMs?: number; patterns?: HuntPattern[]; sessionEventsMap?: Map<string, AgentEvent[]>; signalMitreMap?: Map<string, string[]>; }
export function correlateSignals(signals: Signal[], options?: CorrelationOptions): SignalCluster[];
```

From src/lib/workbench/finding-engine.ts:
```typescript
export function createFromCluster(cluster: SignalCluster, signals: Signal[], createdBy: string): Finding | null;
export function runEnrichmentPipeline(finding: Finding, options: { mitreTechniques?: MitreTechnique[]; extractedIocs?: ExtractedIoc[]; spiderSenseResult?: SpiderSenseResult; }, actor?: string): Finding;
export function checkAutoPromotion(finding: Finding, signals: Signal[], rules?: AutoPromotionRules, actor?: string): Finding;
export const DEFAULT_AUTO_PROMOTION_RULES: AutoPromotionRules;
```

From src/features/findings/stores/signal-store.tsx:
```typescript
export const useSignalStore = createSelectors(useSignalStoreBase);
// State: { signals: Signal[]; pipelineState: SignalPipelineState; stats: StreamStats; isStreaming: boolean; actions: {...} }
```

From src/features/findings/stores/finding-store.tsx:
```typescript
export const useFindingStore = createSelectors(useFindingStoreBase);
// actions.createFromCluster(cluster, signals, createdBy): Finding | null;
// actions.confirm(findingId, actor): void;
// actions.addEnrichment(findingId, enrichment, actor): void;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create signal-correlator.ts pure-function orchestrator with tests</name>
  <files>src/lib/workbench/signal-correlator.ts, src/lib/workbench/__tests__/signal-correlator.test.ts</files>
  <read_first>
    - src/lib/workbench/signal-pipeline.ts (correlateSignals, SignalCluster, Signal types)
    - src/lib/workbench/finding-engine.ts (createFromCluster, runEnrichmentPipeline, checkAutoPromotion, checkAutoConfirm)
  </read_first>
  <behavior>
    - Test 1: runCorrelationPipeline with 3 signals from same agent within 5min window produces 1 cluster and 1 finding
    - Test 2: runCorrelationPipeline with signals below MIN_CLUSTER_CONFIDENCE (0.3) produces no findings
    - Test 3: runCorrelationPipeline with 1 signal (below MIN_CLUSTER_SIGNALS=2) produces no findings
    - Test 4: runCorrelationPipeline skips signals already assigned to existing findings (signal.findingId !== null)
    - Test 5: runCorrelationPipeline runs enrichment pipeline on new findings (returns findings with enrichments array populated when MITRE data available)
    - Test 6: runCorrelationPipeline calls checkAutoPromotion and returns findings with updated status when thresholds met
    - Test 7: runCorrelationPipeline deduplicates -- signals already in existing findings are excluded from correlation input
  </behavior>
  <action>
    Create `src/lib/workbench/signal-correlator.ts` as a pure-function module (no React, no store imports). This follows the same pattern as signal-pipeline.ts and finding-engine.ts: pure functions that take state in and return new state out.

    The module exports:

    ```typescript
    export interface CorrelationPipelineInput {
      signals: Signal[];
      existingFindings: Finding[];
      options?: CorrelationOptions;
      enrichmentData?: {
        mitreTechniques?: MitreTechnique[];
        extractedIocs?: ExtractedIoc[];
        spiderSenseResult?: SpiderSenseResult;
      };
      autoPromotionRules?: AutoPromotionRules;
      actor?: string; // defaults to "signal_correlator"
    }

    export interface CorrelationPipelineResult {
      newFindings: Finding[];
      updatedFindings: Finding[]; // existing findings with new signals added
      clusters: SignalCluster[];
      skippedSignalIds: string[]; // signals already assigned to findings
    }

    export function runCorrelationPipeline(input: CorrelationPipelineInput): CorrelationPipelineResult;
    ```

    Implementation logic:
    1. Filter out signals where `findingId !== null` OR signal.id is already in any existingFinding.signalIds -- collect as skippedSignalIds
    2. Call `correlateSignals(unassignedSignals, options)` to get clusters
    3. For each cluster, call `createFromCluster(cluster, unassignedSignals, actor)` -- skip if returns null
    4. For each new finding, call `runEnrichmentPipeline(finding, enrichmentData)` if enrichmentData provided
    5. For each new finding, call `checkAutoPromotion(finding, unassignedSignals, autoPromotionRules)` to potentially auto-confirm or annotate as promotion-ready
    6. Return { newFindings, updatedFindings: [], clusters, skippedSignalIds }

    Import types and functions from signal-pipeline.ts and finding-engine.ts only. Do NOT import from stores.

    Create test file at `src/lib/workbench/__tests__/signal-correlator.test.ts` with the behaviors listed above. Use test helpers to create mock signals (generate with `generateSignalId()` and populate required fields). Use `vi.mock` sparingly -- prefer real function calls since the engine functions are pure.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/lib/workbench/__tests__/signal-correlator.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "export function runCorrelationPipeline" src/lib/workbench/signal-correlator.ts
    - grep -q "export interface CorrelationPipelineResult" src/lib/workbench/signal-correlator.ts
    - grep -q "correlateSignals" src/lib/workbench/signal-correlator.ts
    - grep -q "createFromCluster" src/lib/workbench/signal-correlator.ts
    - grep -q "runEnrichmentPipeline" src/lib/workbench/signal-correlator.ts
    - grep -q "checkAutoPromotion" src/lib/workbench/signal-correlator.ts
    - grep -q "skippedSignalIds" src/lib/workbench/signal-correlator.ts
    - grep -c "test\|it(" src/lib/workbench/__tests__/signal-correlator.test.ts returns >= 5
  </acceptance_criteria>
  <done>runCorrelationPipeline correctly orchestrates correlation -> finding creation -> enrichment -> auto-promotion as a pure function. All 7 test behaviors pass.</done>
</task>

<task type="auto">
  <name>Task 2: Create useSignalCorrelator hook wiring store subscription to pipeline</name>
  <files>src/features/findings/hooks/use-signal-correlator.ts</files>
  <read_first>
    - src/lib/workbench/signal-correlator.ts (just created in Task 1)
    - src/features/findings/stores/signal-store.tsx (useSignalStore, signals subscription)
    - src/features/findings/stores/finding-store.tsx (useFindingStore, createFromCluster action)
  </read_first>
  <action>
    Create `src/features/findings/hooks/use-signal-correlator.ts` that:

    1. Subscribes to `useSignalStore.use.signals()` for the signal array
    2. Reads `useFindingStore.use.findings()` for existing findings
    3. Debounces correlation: when signals change, waits 2000ms (configurable) before running `runCorrelationPipeline`
    4. For each new finding in the result, calls `useFindingStore.getState().actions.createFromCluster()` -- BUT since runCorrelationPipeline already created the finding via the pure engine function, instead use the finding-store's `load()` or directly set the findings. Actually, the correct approach: the hook should call `useFindingStore.getState().actions.createFromCluster(cluster, signals, "signal_correlator")` for each cluster, because the store action handles persistence. So the hook calls the pipeline to get clusters, then calls the store action for each cluster.

    Revised approach (simpler, correct):
    - The hook calls `correlateSignals()` directly (from signal-pipeline.ts) to get clusters
    - For each cluster, checks if a finding already exists for those signal IDs (dedup check against existing findings)
    - Calls `useFindingStore.getState().actions.createFromCluster(cluster, signals, "signal_correlator")` for new clusters only
    - After creation, runs enrichment and auto-promotion through the store actions
    - This keeps the store as the single source of truth for persistence

    Export:
    ```typescript
    export interface UseSignalCorrelatorOptions {
      enabled?: boolean;        // default true
      debounceMs?: number;      // default 2000
      minSignalsForRun?: number; // default 2, skip if fewer unassigned signals
    }

    export function useSignalCorrelator(options?: UseSignalCorrelatorOptions): {
      lastRunAt: number | null;
      clustersFound: number;
      findingsCreated: number;
      isRunning: boolean;
    };
    ```

    Implementation details:
    - Use `useEffect` with signals as dependency, start a debounce timer via `setTimeout`
    - On trigger: filter signals with `findingId === null` and not in any existing finding's signalIds
    - If unassigned count < minSignalsForRun, skip
    - Call `correlateSignals(unassignedSignals)` to get clusters
    - For each cluster, check if any existing finding already contains the majority of those signal IDs (prevent duplicate findings)
    - Call `createFromCluster` store action for genuinely new clusters
    - For each newly created finding, optionally run enrichment (extract MITRE technique hints from signal data/flags)
    - Track lastRunAt, clustersFound, findingsCreated in local state
    - Use `useRef` for the debounce timer to properly clean up on unmount
    - Use `useFindingStore.getState()` (imperative) inside the callback to avoid stale closures (per Pitfall 4 from research)
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit src/features/findings/hooks/use-signal-correlator.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "export function useSignalCorrelator" src/features/findings/hooks/use-signal-correlator.ts
    - grep -q "useSignalStore" src/features/findings/hooks/use-signal-correlator.ts
    - grep -q "useFindingStore" src/features/findings/hooks/use-signal-correlator.ts
    - grep -q "correlateSignals" src/features/findings/hooks/use-signal-correlator.ts
    - grep -q "debounce\|setTimeout" src/features/findings/hooks/use-signal-correlator.ts
    - grep -q "createFromCluster" src/features/findings/hooks/use-signal-correlator.ts
  </acceptance_criteria>
  <done>useSignalCorrelator hook subscribes to signal store changes and automatically creates findings from correlated signal clusters after a 2s debounce. No manual trigger needed -- just mount the hook in a top-level component.</done>
</task>

</tasks>

<verification>
1. `npx vitest run src/lib/workbench/__tests__/signal-correlator.test.ts` -- all correlation pipeline tests pass
2. `npx tsc --noEmit` on the hook file -- no type errors
3. signal-correlator.ts imports only from signal-pipeline.ts and finding-engine.ts (no store imports)
4. useSignalCorrelator hook uses `getState()` for imperative store access in callbacks (no stale closures)
</verification>

<success_criteria>
- Automated signal-to-finding pipeline exists as a pure function with 7+ test cases
- React hook subscribes to signal store and triggers correlation on signal changes
- No manual intervention needed to go from signal ingestion to finding creation
- Auto-confirmation and enrichment run automatically on new findings
</success_criteria>

<output>
After completion, create `.planning/phases/track-c-intel/C1-01-SUMMARY.md`
</output>
