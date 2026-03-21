---
phase: 03-kql-adapter-plugin
plan: 01
subsystem: detection-workflow
tags: [kql, microsoft-sentinel, translation, adapter, detection-engineering]

# Dependency graph
requires:
  - phase: 01-core-detection-plugin-infrastructure
    provides: DetectionWorkflowAdapter interface, registerAdapter, registerFileType, registerTranslationProvider, translateField, field-mappings registry
provides:
  - KQL DetectionWorkflowAdapter with all 6 methods (canDraftFrom, buildDraft, buildStarterEvidence, runLab, buildExplainability, buildPublication)
  - kql_rule file type registration (.kql extension, #0078d4 icon color, content detection)
  - KQL parser utilities (parseKqlQuery, extractKqlWhereFields, clientSideKqlMatch)
  - Bidirectional Sigma<->KQL translation provider (sigma_rule<->kql_rule)
  - KQL-to-Sentinel Analytics Rule JSON export (json_export target)
affects: [03-02-kql-visual-panel, detection-workflow-barrel]

# Tech tracking
tech-stack:
  added: []
  patterns: [KQL pipe-operator parsing, Sentinel table-to-logsource mapping, reverse field mapping for KQL->Sigma]

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/kql-adapter.ts
    - apps/workbench/src/lib/workbench/detection-workflow/kql-translation.ts
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts

key-decisions:
  - "Client-side KQL execution via where-clause parsing and clientSideKqlMatch (no native backend needed)"
  - "KQL parser handles 14 operators including negated forms, regex, and in-list"
  - "KQL->Sigma reverse mapping built dynamically from getAllFieldMappings() sentinel entries"
  - "Untranslatable KQL features (summarize, join, union, extend, ago, render, sort, top, count) detected and reported"
  - "Sentinel Analytics Rule JSON uses standard queryFrequency/queryPeriod PT5H defaults"

patterns-established:
  - "KQL adapter pattern: Sentinel table inference from data source hints + translateField for field mapping"
  - "plugin_trace explainability with kql_where_match traceType for per-clause match/unmatch tracking"

requirements-completed: [KQL-01, KQL-02, KQL-03, KQL-04, KQL-06]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 3 Plan 1: KQL Adapter Plugin Summary

**KQL (Microsoft Sentinel) adapter with file type registration, client-side lab execution via where-clause parsing, and bidirectional Sigma<->KQL translation provider**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T13:46:58Z
- **Completed:** 2026-03-21T13:52:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Full KQL DetectionWorkflowAdapter with all 6 methods: draft generation using Sentinel table names and field mappings, starter evidence packs, client-side lab execution, explainability traces, and publication to raw KQL or Analytics Rule JSON
- Exported KQL parser utilities (parseKqlQuery, extractKqlWhereFields, clientSideKqlMatch) for reuse by visual panel and other consumers
- Bidirectional translation provider: sigma_rule->kql_rule reuses convertSigmaToQuery; kql_rule->sigma_rule parses KQL where-clauses and reverse-maps Sentinel fields to Sigma canonical names
- File type registration: kql_rule with .kql extension, Microsoft blue (#0078d4) icon color, content-based detection that avoids Sigma/SPL false positives

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KQL adapter with file type registration and parser utilities** - `d6b8486f2` (feat)
2. **Task 2: Create KQL translation provider and wire barrel exports** - `20e30f2b1` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/kql-adapter.ts` - KQL adapter (915 lines): file type registration, parser utilities, full DetectionWorkflowAdapter implementation
- `apps/workbench/src/lib/workbench/detection-workflow/kql-translation.ts` - KQL translation provider (335 lines): bidirectional Sigma<->KQL with reverse field mapping and untranslatable feature detection
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Barrel exports updated with kqlAdapter, kqlTranslationProvider, KQL parser types and functions, side-effect imports

## Decisions Made
- Client-side KQL execution via where-clause parsing and clientSideKqlMatch (matching sigma-adapter pattern of client-side fallback execution)
- KQL parser supports 14 operators (==, !=, contains, !contains, startswith, !startswith, endswith, !endswith, has, !has, matches regex, in, !in, =~) covering common KQL query patterns
- KQL->Sigma reverse mapping uses dynamic getAllFieldMappings() lookup rather than hardcoded reverse map, so plugin-registered field mappings are automatically included
- Untranslatable KQL features (summarize, join, union, extend, ago, render, sort, top, count) are detected and reported in translation results
- Sentinel Analytics Rule JSON export uses standard defaults (PT5H frequency/period, GreaterThan 0 trigger) that match Azure Sentinel template norms

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- KQL adapter fully operational -- ready for visual panel (03-02-PLAN.md)
- KQL parser utilities exported and available for the visual panel's drag-and-drop where-clause builder
- Translation provider registered -- KQL now participates in the hub-and-spoke translation system

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/workbench/detection-workflow/kql-adapter.ts (915 lines)
- FOUND: apps/workbench/src/lib/workbench/detection-workflow/kql-translation.ts (335 lines)
- FOUND: .planning/phases/03-kql-adapter-plugin/03-01-SUMMARY.md
- FOUND: d6b8486f2 (Task 1 commit)
- FOUND: 20e30f2b1 (Task 2 commit)

---
*Phase: 03-kql-adapter-plugin*
*Completed: 2026-03-21*
