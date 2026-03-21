---
phase: 04-eql-adapter-plugin
plan: 01
subsystem: detection-workflow
tags: [eql, elastic, parser, adapter, ecs, detection]

requires:
  - phase: 01-core-detection-plugin-infrastructure
    provides: registerAdapter, registerFileType, translateField, DetectionWorkflowAdapter interface, shared-types, field-mappings registry
provides:
  - EQL parser (AST types, parseEql, generateEql) for single-event and sequence queries
  - eql_rule file type registration with .eql extension and content detection
  - EQL DetectionWorkflowAdapter (canDraftFrom, buildDraft, buildStarterEvidence, runLab, buildPublication)
  - Publication to "eql" and "json_export" targets with NDJSON detection rule format
affects: [04-02-PLAN.md, 04-03-PLAN.md, detection-workflow/index.ts]

tech-stack:
  added: []
  patterns:
    - "EQL parser with separate AST for single vs sequence queries"
    - "Client-side approximate matching with dotted ECS field resolution"
    - "ECS field translation via field-mappings translateField"

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/eql-parser.ts
    - apps/workbench/src/lib/workbench/detection-workflow/eql-adapter.ts
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts

key-decisions:
  - "EQL parser uses separate AST node types (EqlSingleQuery vs EqlSequenceQuery) rather than a unified node, matching Elastic's own grammar split"
  - "Client-side matching resolves ECS dotted paths from both flat keys and nested objects for compatibility with normalized payloads"
  - "Sequence query draft triggers when seed has multiple categories, defaulting to sequence by host.id with 5m maxspan"

patterns-established:
  - "EQL adapter follows sigma-adapter pattern exactly: module-level registerFileType + registerAdapter, sha256Hex helper, inferSeverity from confidence"

requirements-completed: [EQL-01, EQL-02, EQL-04]

duration: 4min
completed: 2026-03-21
---

# Phase 4 Plan 1: EQL Parser, Adapter, and File Type Registration Summary

**EQL parser handling single-event and sequence queries with all operators, plus full DetectionWorkflowAdapter with ECS field mapping and NDJSON publication**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T13:47:18Z
- **Completed:** 2026-03-21T13:51:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- EQL parser with complete AST for single-event queries (process/file/network/registry/dns/any where ...) and multi-event sequence queries (sequence by ... [...] [...])
- All EQL operators supported: ==, !=, :, ~, >=, <=, >, <, in -- plus not-prefix negation
- Full DetectionWorkflowAdapter with ECS field name translation via field-mappings registry
- Publication to "eql" (raw EQL with comment header) and "json_export" (NDJSON detection rule with risk_score, severity, MITRE threat mapping)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EQL parser and code generator** - `1cf5d4acf` (feat)
2. **Task 2: Create EQL adapter with file type registration and publication** - `81b243f79` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/eql-parser.ts` - EQL AST types, parseEql(), generateEql(), extractEqlFields(), getEventCategoryForHint()
- `apps/workbench/src/lib/workbench/detection-workflow/eql-adapter.ts` - File type registration (eql_rule, .eql, #f04e98), full adapter with draft, evidence, lab, publication
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Barrel export and side-effect import for eqlAdapter

## Decisions Made
- EQL parser uses separate AST node types (EqlSingleQuery vs EqlSequenceQuery) rather than a unified node, matching Elastic's own grammar distinction between event queries and sequence queries
- Client-side matching resolves ECS dotted paths from both flat keys ("process.name" as a string key) and nested objects ({ process: { name: "..." } }) for compatibility with different payload shapes
- Sequence query draft generation triggers when seed has multiple unique event categories, using `sequence by host.id` with 5m maxspan as sensible defaults

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EQL parser and adapter are ready for Plan 02 (visual panel with sequence builder)
- Plan 03 (bidirectional Sigma-EQL translation) can use parseEql/generateEql for round-tripping
- runLab stub provides approximate matching; Plan 03 will implement full sequence correlation

## Self-Check: PASSED

- FOUND: `apps/workbench/src/lib/workbench/detection-workflow/eql-parser.ts`
- FOUND: `apps/workbench/src/lib/workbench/detection-workflow/eql-adapter.ts`
- FOUND: `.planning/phases/04-eql-adapter-plugin/04-01-SUMMARY.md`
- FOUND: commit `1cf5d4acf` (Task 1)
- FOUND: commit `81b243f79` (Task 2)

---
*Phase: 04-eql-adapter-plugin*
*Completed: 2026-03-21*
