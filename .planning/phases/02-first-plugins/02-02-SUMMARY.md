---
phase: 02-first-plugins
plan: 02
subsystem: intel
tags: [enrichment-bridge, streaming-ui, skeleton-loaders, react-hooks, threat-intel]

# Dependency graph
requires:
  - phase: 02-first-plugins
    provides: VirusTotal and GreyNoise ThreatIntelSource plugin implementations
  - phase: 01-enrichment-infrastructure
    provides: EnrichmentOrchestrator, extractIndicators, ThreatIntelSourceRegistry, SecretsApi
provides:
  - useEnrichmentBridge React hook connecting Run Enrichment button to EnrichmentOrchestrator
  - Enhanced EnrichmentSidebar with streaming source statuses, skeleton loaders, and per-source error badges
  - ThreatIntelContent renderer with verdict badge, confidence bar, summary, and permalink
  - FindingDetail wired to enrichment bridge for end-to-end pipeline
affects: [03-operational-readiness, enrichment-sidebar, finding-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [enrichment-bridge-hook, streaming-source-status, skeleton-loader-per-source, per-source-error-isolation]

key-files:
  created:
    - apps/workbench/src/lib/plugins/threat-intel/enrichment-bridge.ts
    - apps/workbench/src/lib/plugins/threat-intel/__tests__/enrichment-bridge.test.ts
    - apps/workbench/src/components/workbench/findings/__tests__/enrichment-sidebar.test.tsx
  modified:
    - apps/workbench/src/components/workbench/findings/enrichment-sidebar.tsx
    - apps/workbench/src/components/workbench/findings/finding-detail.tsx

key-decisions:
  - "EnrichmentOrchestratorLike duck-typed interface to avoid hard coupling to concrete orchestrator"
  - "Source statuses initialized from getAllThreatIntelSources() so skeleton loaders appear for all sources"
  - "Enrichment fans out per-indicator (not per-source) since orchestrator handles source routing internally"
  - "FindingDetail imports enrichmentOrchestrator singleton from module-level for direct wiring"
  - "ThreatIntelContent verdict badge colors: malicious=red, suspicious=amber, benign=green, unknown=gray"

patterns-established:
  - "Enrichment bridge hook pattern: useEnrichmentBridge(orchestrator) returns reactive state + controls"
  - "Per-source streaming: skeleton loaders per source, results stream in as each source responds"
  - "Error isolation: one source failing shows error badge without blocking other source results"

requirements-completed: [PLUG-03, PLUG-04]

# Metrics
duration: 1min
completed: 2026-03-22
---

# Phase 2 Plan 2: Enrichment Bridge and Streaming Sidebar Summary

**useEnrichmentBridge hook wiring Run Enrichment to EnrichmentOrchestrator with per-source skeleton loaders, streaming results, error badges, and ThreatIntelContent verdict renderer**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-22T23:20:58Z
- **Completed:** 2026-03-22T23:21:52Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 2

## Accomplishments
- useEnrichmentBridge hook extracts indicators from finding, fans out enrichment via orchestrator, and streams per-source results back with reactive state
- EnrichmentSidebar enhanced with skeleton loaders (animate-pulse) for in-flight sources, error badges for failed sources, and Cancel button during active enrichment
- ThreatIntelContent renderer displays verdict badge (color-coded by classification), confidence bar, summary text, and permalink
- FindingDetail wired directly to enrichment bridge -- clicking "Run Enrichment" triggers the full extraction-to-rendering pipeline
- 16 tests (9 bridge + 7 sidebar) covering streaming, cancellation, error isolation, and UI state transitions

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrichment bridge hook** - `d7101e30a` (feat) -- TDD: 9 tests covering streaming results, cancellation, error handling
2. **Task 2: Enhanced enrichment sidebar** - `f305a214d` (feat) -- Sidebar streaming UI + FindingDetail wiring, 7 tests

## Files Created/Modified
- `apps/workbench/src/lib/plugins/threat-intel/enrichment-bridge.ts` - useEnrichmentBridge hook: extracts indicators, calls orchestrator.enrich, tracks per-source status, AbortController cancellation
- `apps/workbench/src/lib/plugins/threat-intel/__tests__/enrichment-bridge.test.ts` - 9 tests: streaming results, cancellation, error paths, re-run cancels previous
- `apps/workbench/src/components/workbench/findings/enrichment-sidebar.tsx` - Enhanced with sourceStatuses prop, skeleton loaders, error badges, ThreatIntelContent renderer, Cancel button
- `apps/workbench/src/components/workbench/findings/__tests__/enrichment-sidebar.test.tsx` - 7 tests: skeleton loaders, error badges, done states, Cancel button, error isolation
- `apps/workbench/src/components/workbench/findings/finding-detail.tsx` - Imports useEnrichmentBridge and enrichmentOrchestrator, wires Run Enrichment to bridge

## Decisions Made
- Used duck-typed `EnrichmentOrchestratorLike` interface to avoid hard coupling the hook to the concrete orchestrator implementation
- Source statuses initialized from `getAllThreatIntelSources()` so skeleton loaders appear for all registered sources immediately
- Enrichment fans out per-indicator (not per-source) since the orchestrator handles source routing internally
- FindingDetail imports `enrichmentOrchestrator` singleton at module level for direct wiring (no prop threading needed)
- ThreatIntelContent verdict badge colors follow standard severity convention: malicious=red, suspicious=amber, benign=green, unknown=gray

## Deviations from Plan

None - plan executed exactly as written. Both task commits existed from a prior execution and were verified with passing tests and acceptance criteria.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- End-to-end enrichment pipeline is fully wired: button click -> indicator extraction -> orchestrator fan-out -> streaming sidebar results
- Phase 2 is complete -- both VT/GN plugins and the UI pipeline are ready for Phase 3 operational features
- Phase 3 can build on this foundation to add API key settings UI, four more plugins, enrichment badges, and auto-enrichment

## Self-Check: PASSED

- All 5 key files verified on disk (3 created, 2 modified)
- Both task commits verified in git log (d7101e30a, f305a214d)
- All 16 tests pass (9 bridge + 7 sidebar)
- All acceptance criteria verified via grep checks

---
*Phase: 02-first-plugins*
*Completed: 2026-03-22*
