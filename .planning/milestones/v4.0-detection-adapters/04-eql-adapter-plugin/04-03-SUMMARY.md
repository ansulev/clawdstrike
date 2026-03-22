---
phase: 04-eql-adapter-plugin
plan: 03
subsystem: detection-workflow
tags: [eql, elastic, sigma, translation, ecs, field-mapping, lab-execution, sequence-query]

# Dependency graph
requires:
  - phase: 04-eql-adapter-plugin/04-01
    provides: EQL parser (parseEql/generateEql/extractEqlFields) and EQL adapter stub
  - phase: 01-core-detection-plugin-infrastructure/01-01
    provides: Translation provider registry, field mapping registry, shared types
provides:
  - Bidirectional Sigma<->EQL translation provider (eqlTranslationProvider)
  - Full client-side EQL lab execution with per-step sequence matching
  - plugin_trace explainability traces for single and sequence queries
affects: [04-eql-adapter-plugin, detection-workflow, cross-format-translation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bidirectional translation provider pattern (same as kql-translation.ts)"
    - "Per-step sequence matching with matchSequenceQuery"
    - "Named evaluation functions (evaluateEqlCondition, matchSingleQuery, matchSequenceQuery)"

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/eql-translation.ts
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/eql-adapter.ts
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts

key-decisions:
  - "EQL translation uses same bidirectional pattern as kql-translation.ts for consistency"
  - "Sequence EQL->Sigma degrades to first step only, with untranslatableFeatures listing all lost semantics"
  - "Lab execution split: single queries use eql_match traces, sequence queries use eql_sequence_match traces"
  - "matchSequenceQuery evaluates steps independently (no temporal ordering) as client-side approximation"

patterns-established:
  - "Translation provider auto-registration at module load with side-effect import in barrel"
  - "Named matching functions (evaluateEqlCondition, matchSingleQuery, matchSequenceQuery) for testability"
  - "Per-step explainability traces for multi-event queries"

requirements-completed: [EQL-03, EQL-06]

# Metrics
duration: 12min
completed: 2026-03-21
---

# Phase 04 Plan 03: EQL Translation + Lab Execution Summary

**Bidirectional Sigma<->EQL translation with ECS field mapping, plus full client-side EQL lab execution with per-step sequence matching and plugin_trace explainability**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-21T14:00:00Z
- **Completed:** 2026-03-21T14:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Bidirectional Sigma<->EQL translation provider registered into translation registry
- Sigma->EQL maps logsource categories to event categories, fields to ECS via translateField, modifiers to EQL operators
- EQL->Sigma reverse-maps ECS fields, converts operators to modifiers, populates untranslatableFeatures for sequence queries
- Full client-side EQL lab execution with evaluateEqlCondition, matchSingleQuery, matchSequenceQuery
- Single-event queries emit eql_match plugin_trace traces with matched/unmatched fields
- Sequence queries emit eql_sequence_match plugin_trace traces with per-step stepIndex, totalSteps, sequenceComplete

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bidirectional Sigma-EQL translation provider** - `7b9aa26f2` (feat)
2. **Task 2: Implement full EQL lab execution with per-step sequence matching** - `28a656270` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/eql-translation.ts` - Bidirectional Sigma<->EQL translation provider with logsource/event category mapping, field translation, modifier/operator mapping
- `apps/workbench/src/lib/workbench/detection-workflow/eql-adapter.ts` - Refactored with evaluateEqlCondition, matchSingleQuery, matchSequenceQuery, getNestedValue, findEqlSourceLineHints; full runLab with per-step traces
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Added eqlTranslationProvider export and ./eql-translation side-effect import

## Decisions Made
- Used same bidirectional translation pattern as kql-translation.ts for consistency across the codebase
- Sequence EQL->Sigma translation degrades to first step only, with all lost semantics documented in untranslatableFeatures array (sequence correlation, byFields, maxspan, until)
- Lab execution uses separate trace types: eql_match for single queries, eql_sequence_match for sequence queries, enabling differentiated UI rendering
- matchSequenceQuery evaluates steps independently against all events (client-side approximation; real temporal ordering would require server-side Elastic execution)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EQL adapter is fully functional with translation, lab execution, draft building, evidence generation, and publication
- Cross-format Sigma<->EQL translation enables hub-and-spoke patterns (e.g. SPL->Sigma->EQL)
- Ready for Phase 05 (YARA-L adapter) which follows the same patterns

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/workbench/detection-workflow/eql-translation.ts
- FOUND: apps/workbench/src/lib/workbench/detection-workflow/eql-adapter.ts
- FOUND: .planning/phases/04-eql-adapter-plugin/04-03-SUMMARY.md
- FOUND: commit 7b9aa26f2 (Task 1)
- FOUND: commit 28a656270 (Task 2)

---
*Phase: 04-eql-adapter-plugin*
*Completed: 2026-03-21*
