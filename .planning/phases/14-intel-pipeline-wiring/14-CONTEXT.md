# Phase 14: Intel Pipeline Wiring & Completion - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the last-mile connections in the INTEL track: Fleet SSE check events → signal-store, mount useSignalCorrelator in workbench root, add "Draft Policy Guard" button, and implement bidirectional finding↔detection links.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — concrete wiring phase with solutions defined by the audit integration checker:

1. **Fleet SSE → signal-store bridge:** In `fleet-event-reducer.ts`, the `case "check"` handler (line 118) currently returns a no-op. Add a side-effect that calls `useSignalStore.getState().ingestSignal()` with the check event data converted to a Signal. The `FleetEvent` `check` type carries policy verdict data (action type, guard results, etc.) that maps to Signal fields. Since `reduceFleetEvent` is a pure function, the signal ingestion should happen at the call site in `use-fleet-connection.ts` (line 327) after `reduceFleetEvent` returns, not inside the reducer.

2. **Mount useSignalCorrelator:** Add `useSignalCorrelator()` call in a top-level component. The hook's JSDoc says "Mount in a top-level component (e.g. Workbench root)". The best mount point is `WorkbenchBootstraps` in `App.tsx` or `desktop-layout.tsx` — wherever other global hooks are mounted. The hook subscribes to signal-store changes and auto-triggers correlation.

3. **"Draft Policy Guard" button:** Add a "Draft Guard" button next to the existing "Draft Detection" button in finding-detail.tsx. Use the existing `policy-adapter.ts` from `detection-workflow/` to generate a guard config block from the finding's pattern. The policy adapter already implements `DraftAdapter` interface with `generateDraft(seed)`.

4. **Bidirectional finding↔detection link:** After `draftFromFinding` completes and opens the new file tab, call `findingStore.annotate(findingId, { text: "Linked to detection: {filePath}" })` or add a `linkedDetections: string[]` field to the Finding type. The link should be visible in finding-detail.tsx timeline.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSignalStore.getState().ingestSignal(signal)` — ingests a Signal into the store
- `Signal` type from `signal-pipeline.ts` — canonical signal format with source, severity, confidence, context
- `useSignalCorrelator` hook from `features/findings/hooks/use-signal-correlator.ts` — complete implementation, just needs mounting
- `policy-adapter.ts` from `detection-workflow/` — implements `DraftAdapter` for guard config generation
- `useDraftDetection` hook — existing draft workflow that opens result in editor tab
- `findingStore.annotate(findingId, annotation)` — existing annotation system in finding-store
- `finding-detail.tsx` — existing finding detail page with action buttons and timeline

### Established Patterns
- `reduceFleetEvent` is pure; side-effects happen at call site in `use-fleet-connection.ts`
- Signal ingestion: `ingestSignal(signal: Signal)` accepts a canonical Signal object
- Draft workflow: `draftFromFinding(finding, signals)` → generates draft → opens in editor tab
- Finding annotations: `{ text: string, timestamp: number }` entries in finding timeline

### Integration Points
- `use-fleet-connection.ts` line 327 — after `reduceFleetEvent`, add signal ingestion for check events
- `App.tsx` or `desktop-layout.tsx` — mount `useSignalCorrelator()` alongside other global hooks
- `finding-detail.tsx` — add "Draft Guard" button next to "Draft Detection"
- `use-draft-detection.ts` — add callback after draft completion to annotate source finding

</code_context>

<specifics>
## Specific Ideas

- The `check` FleetEvent data contains action_type, guard results, verdict — map these directly to Signal fields
- `policy-adapter.ts` `generateDraft(seed)` returns guard config YAML — same workflow as sigma adapter but outputs guards block
- Finding annotation is the simplest approach for bidirectional links (no schema changes needed)

</specifics>

<deferred>
## Deferred Ideas

- Full receipt-based signal ingestion (receipts → signals, not just check events)
- Signal deduplication tuning (overlap threshold currently 50%)
- External feed integration (STIX/TAXII → signal-store)

</deferred>
