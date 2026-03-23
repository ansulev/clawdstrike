---
phase: 04-intelligence-participation
plan: 01
subsystem: ui
tags: [react, enrichment, plugin-sdk, registry, pivot-enrichment, useSyncExternalStore]

# Dependency graph
requires:
  - phase: 01-enrichment-infrastructure
    provides: ThreatIntelSourceRegistry and enrichment pipeline
  - phase: 03-operational-readiness
    provides: enrichment sidebar, enrichment bridge, finding store
provides:
  - EnrichmentTypeRegistry for plugin-contributed custom enrichment renderers
  - Pivot enrichment logic (extractRelatedIndicators, triggerPivotEnrichment)
  - RelatedIndicatorsSection component with one-click enrich buttons
  - SDK types for enrichmentRenderers contribution point
affects: [04-intelligence-participation, plugin-loader, enrichment-sidebar]

# Tech tracking
tech-stack:
  added: []
  patterns: [Map + snapshot + listeners registry, useSyncExternalStore hook, pivot enrichment extraction]

key-files:
  created:
    - apps/workbench/src/lib/plugins/enrichment-type-registry.ts
    - apps/workbench/src/lib/plugins/__tests__/enrichment-type-registry.test.ts
    - apps/workbench/src/lib/workbench/pivot-enrichment.ts
    - apps/workbench/src/lib/workbench/__tests__/pivot-enrichment.test.ts
    - apps/workbench/src/components/workbench/findings/related-indicators-section.tsx
  modified:
    - apps/workbench/src/components/workbench/findings/enrichment-sidebar.tsx
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/types.ts
    - packages/sdk/plugin-sdk/src/types.ts
    - packages/sdk/plugin-sdk/src/context.ts

key-decisions:
  - "EnrichmentTypeRegistry follows identical Map + snapshot + listeners pattern as ViewRegistry for consistency"
  - "Custom renderers override built-in switch-case in EnrichmentContent (plugin renderer checked first)"
  - "Related indicators deduplicated by type:value tuple, first occurrence wins"
  - "EnrichmentRendererContribution added to both SDK types and workbench-internal types for type safety"

patterns-established:
  - "EnrichmentTypeRegistry: register/get/useRenderer/onChange pattern for enrichment type renderers"
  - "Pivot enrichment extraction: scan data.relatedIndicators across enrichments with deduplication"

requirements-completed: [ADV-01, ADV-03]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 04 Plan 01: Pivot Enrichment and Custom Enrichment Type Renderers Summary

**EnrichmentTypeRegistry with useSyncExternalStore for plugin-contributed renderers, plus pivot enrichment with related indicators extraction and one-click follow-on enrichment**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T23:43:59Z
- **Completed:** 2026-03-22T23:50:57Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- EnrichmentTypeRegistry enables plugins to register custom React renderers for specific enrichment types, overriding the built-in GenericContent fallback
- Pivot enrichment extracts related indicators from enrichment data and deduplicates by type:value, enabling recursive threat graph exploration
- RelatedIndicatorsSection component renders related indicators with IOC type badges and gold-accent Enrich buttons
- Plugin loader routes enrichmentRenderers contributions through lazy() to the registry
- SDK types include EnrichmentRendererContribution and EnrichmentRenderersApi for plugin authors

## Task Commits

Each task was committed atomically:

1. **Task 1: EnrichmentTypeRegistry and pivot enrichment logic** - `520bf3e6f` (feat)
2. **Task 2: Wire EnrichmentSidebar to use custom renderers and show related indicators** - `8a18581e4` (feat)

_Note: Task 1 was TDD with RED+GREEN in single commit (tests and implementation)_

## Files Created/Modified
- `apps/workbench/src/lib/plugins/enrichment-type-registry.ts` - Map + snapshot + listeners registry for enrichment renderers
- `apps/workbench/src/lib/plugins/__tests__/enrichment-type-registry.test.ts` - 7 tests for registry operations
- `apps/workbench/src/lib/workbench/pivot-enrichment.ts` - extractRelatedIndicators and triggerPivotEnrichment
- `apps/workbench/src/lib/workbench/__tests__/pivot-enrichment.test.ts` - 6 tests for pivot extraction and dedup
- `apps/workbench/src/components/workbench/findings/related-indicators-section.tsx` - Collapsible section with one-click enrich
- `apps/workbench/src/components/workbench/findings/enrichment-sidebar.tsx` - Custom renderer hook + related indicators section
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - enrichmentRenderers routing block
- `apps/workbench/src/lib/plugins/types.ts` - EnrichmentRendererContribution type + CONTRIBUTION_POINT_KEYS entry
- `packages/sdk/plugin-sdk/src/types.ts` - EnrichmentRendererContribution + enrichmentRenderers field
- `packages/sdk/plugin-sdk/src/context.ts` - EnrichmentRenderersApi interface

## Decisions Made
- EnrichmentTypeRegistry follows identical Map + snapshot + listeners pattern as ViewRegistry for consistency across registries
- Custom renderers override built-in switch-case in EnrichmentContent -- plugin renderer is checked first, then falls through to mitre_attack/ioc_extraction/etc. built-in renderers, then GenericContent default
- Related indicators deduplicated by type:value tuple with first-occurrence-wins semantics
- EnrichmentRendererContribution added to both SDK types.ts and workbench-internal types.ts to ensure plugin-loader TypeScript compilation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added EnrichmentRendererContribution to workbench-internal types.ts**
- **Found during:** Task 2 (plugin-loader wiring)
- **Issue:** plugin-loader.ts imports PluginContributions from workbench-internal types.ts (not SDK types.ts), so accessing contributions.enrichmentRenderers caused TS2339 errors
- **Fix:** Added EnrichmentRendererContribution interface and enrichmentRenderers field to workbench-internal types.ts, plus entry in CONTRIBUTION_POINT_KEYS
- **Files modified:** apps/workbench/src/lib/plugins/types.ts
- **Verification:** tsc --noEmit shows no errors in our files (only pre-existing errors in unrelated files)
- **Committed in:** 8a18581e4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for type safety. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EnrichmentTypeRegistry is ready for plugins to register custom renderers
- Pivot enrichment enables recursive threat graph exploration from any enrichment source
- SDK types ready for plugin authors to declare enrichmentRenderers contributions
- RelatedIndicatorsSection wired into enrichment sidebar for all findings

---
*Phase: 04-intelligence-participation*
*Completed: 2026-03-22*
