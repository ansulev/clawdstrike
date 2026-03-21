---
phase: 02-spl-adapter-plugin
plan: 01
subsystem: detection-workflow
tags: [splunk, spl, detection-adapter, cim-fields, parser, client-side-matching]

# Dependency graph
requires:
  - phase: 01-core-detection-plugin-infrastructure
    provides: DetectionWorkflowAdapter interface, registerAdapter, registerFileType, translateField, field-mappings registry
provides:
  - SPL parser utilities (parseSplPipeChain, parseSplFieldConditions, matchSplConditions, buildSplFromSeed, findSplSourceLineHints)
  - SPL detection workflow adapter with file type registration, draft generation, lab execution, and publication
  - splunk_spl file type registered with .spl extension, #65a637 icon, content-based detection
affects: [02-02-PLAN, spl-visual-panel, spl-translation-provider]

# Tech tracking
tech-stack:
  added: []
  patterns: [regex-based SPL parsing for client-side matching, CIM field mapping via translateField, plugin_trace explainability for SPL]

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/spl-parser.ts
    - apps/workbench/src/lib/workbench/detection-workflow/spl-adapter.ts
  modified: []

key-decisions:
  - "Regex-based parsing (not parser combinators) for SPL -- matches sigma-adapter complexity level, suitable for client-side approximate matching"
  - "AND logic for condition matching (all conditions must match) -- consistent with sigma adapter behavior"
  - "CIM field mapping through translateField(sigmaField, 'splunkCIM') -- reuses existing field mapping registry from Phase 1"
  - "plugin_trace explainability kind with traceType 'spl_match' -- uses the extensible trace type designed for plugin adapters"
  - "Case-insensitive field lookup in payload matching -- tolerates varying field name casing across evidence sources"

patterns-established:
  - "SPL adapter structure mirrors sigma-adapter.ts -- canDraftFrom/buildDraft/buildStarterEvidence/runLab/buildExplainability/buildPublication"
  - "Parser module separated from adapter module -- spl-parser.ts is reusable for visual panel and translation provider"
  - "Auto-registration pattern at module bottom: registerFileType() + registerAdapter(splAdapter) + export"

requirements-completed: [SPL-01, SPL-02, SPL-03, SPL-04]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 2 Plan 1: SPL Parser and Adapter Summary

**Regex-based SPL parser with pipe-chain splitting, field condition extraction, and client-side CIM-mapped matching, plus full DetectionWorkflowAdapter for splunk_spl file type**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T13:47:06Z
- **Completed:** 2026-03-21T13:52:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- SPL parser module with 5 exported functions and 2 interfaces for pipe-chain parsing, field condition extraction, client-side matching, draft generation, and source line hints
- Complete splunk_spl detection workflow adapter with file type registration (.spl, #65a637, content detection), draft from seeds using CIM field names, client-side lab execution with plugin_trace explainability, and publication to spl/json_export targets
- Consistent architecture with sigma-adapter.ts -- same method signatures, evidence pack structure, and summary computation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SPL parser utilities** - `55a471c5d` (feat)
2. **Task 2: Create SPL adapter with file type registration** - `b78e992e8` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/spl-parser.ts` - SPL parsing utilities: parseSplPipeChain (pipe splitting with quote awareness), parseSplFieldConditions (field=value extraction with modifier inference), matchSplConditions (AND-logic client-side matching with case-insensitive lookup), buildSplFromSeed (CIM-mapped draft generation), findSplSourceLineHints (editor highlighting)
- `apps/workbench/src/lib/workbench/detection-workflow/spl-adapter.ts` - Full DetectionWorkflowAdapter for splunk_spl: file type registration, canDraftFrom (process/file/network/registry/command), buildDraft via buildSplFromSeed, buildStarterEvidence with CIM-mapped payloads, runLab with client-side matching and plugin_trace traces, buildPublication for spl identity and json_export targets

## Decisions Made
- Used regex-based parsing (not parser combinators) to match the complexity level of sigma-adapter.ts -- the parser is for approximate client-side matching, not full SPL execution
- AND logic for condition matching: all conditions must match for overall match (consistent with sigma adapter)
- CIM field mapping via translateField(sigmaField, "splunkCIM") reuses the field mapping registry built in Phase 1
- plugin_trace explainability kind with traceType "spl_match" uses the extensible trace type from shared-types.ts
- Case-insensitive field lookup in payload matching tolerates varying field name casing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SPL parser and adapter are ready for Plan 02-02 (visual panel + translation provider)
- spl-parser.ts exports are designed for reuse by the visual pipe-chain builder
- The adapter's runLab uses parseSplFieldConditions which the translation provider will also use for SPL-to-Sigma conversion

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/workbench/detection-workflow/spl-parser.ts
- FOUND: apps/workbench/src/lib/workbench/detection-workflow/spl-adapter.ts
- FOUND: .planning/phases/02-spl-adapter-plugin/02-01-SUMMARY.md
- FOUND: 55a471c5d (Task 1 commit)
- FOUND: b78e992e8 (Task 2 commit)

---
*Phase: 02-spl-adapter-plugin*
*Completed: 2026-03-21*
