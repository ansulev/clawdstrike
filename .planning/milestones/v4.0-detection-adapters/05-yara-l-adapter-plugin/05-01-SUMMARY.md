---
phase: 05-yara-l-adapter-plugin
plan: 01
subsystem: detection-workflow
tags: [yaral, chronicle, udm, detection-adapter, google-siem]

requires:
  - phase: 01-core-detection-plugin-infrastructure
    provides: "DetectionWorkflowAdapter interface, registerAdapter, registerFileType, registerPublishTarget, field-mappings registry"
provides:
  - "yaral_rule file type with .yaral extension, content detection, and starter template"
  - "YARA-L DetectionWorkflowAdapter (canDraftFrom, buildDraft, buildStarterEvidence, runLab, buildExplainability, buildPublication)"
  - "UDM field mapping helpers (sigmaToUdm, inferEventType, inferSeverity)"
  - "YARA-L parser (parseYaralRule) for client-side rule analysis"
  - "Publication targets: yaral (raw text) and json_export (Chronicle metadata envelope)"
affects: [05-yara-l-adapter-plugin, detection-workflow, split-editor]

tech-stack:
  added: []
  patterns:
    - "plugin_trace ExplainabilityTrace variant for YARA-L predicate matching"
    - "Dot-notation field path traversal for UDM-structured evidence payloads"
    - "Inverse UDM-to-Sigma mapping for flat field fallback lookups"

key-files:
  created:
    - "apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts"
  modified:
    - "apps/workbench/src/lib/workbench/detection-workflow/index.ts"

key-decisions:
  - "Full implementation in single file pass rather than stub+replace, since both tasks target same file"
  - "Regex-based YARA-L parser is best-effort for client-side simulation, not a full grammar"
  - "Multi-variable condition uses OR semantics (at least one variable group must fully match)"
  - "UDM field resolution tries dot-path traversal first, then inverse Sigma mapping fallback"

patterns-established:
  - "plugin_trace with traceType yaral_match for YARA-L explainability"
  - "Self-registering adapter pattern: registerFileType + registerAdapter + registerPublishTarget at module load"

requirements-completed: [YARAL-01, YARAL-02, YARAL-03, YARAL-04]

duration: 5min
completed: 2026-03-21
---

# Phase 5 Plan 1: YARA-L Adapter Summary

**YARA-L detection workflow adapter with file type registration, UDM-aware drafting, client-side predicate matching lab, and Chronicle JSON export publication**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T13:47:05Z
- **Completed:** 2026-03-21T13:51:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Registered yaral_rule file type with .yaral extension, #4285f4 icon color, content-based detection, and YARA-L starter template
- Built complete DetectionWorkflowAdapter with canDraftFrom (process/file/network/dns/auth), buildDraft (UDM field paths), and buildStarterEvidence (event_type normalization)
- Implemented client-side YARA-L lab execution with parseYaralRule parser, per-variable predicate matching, and plugin_trace explainability traces
- Added publication support for "yaral" (raw text identity) and "json_export" (Chronicle metadata with riskScore) targets

## Task Commits

Each task was committed atomically:

1. **Task 1: Create YARA-L adapter with file type, drafting, and starter evidence** - `b957d39ff` (feat)
2. **Task 2: Wire YARA-L adapter into barrel export + lab execution and publication** - `fa9092013` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts` - Complete YARA-L DetectionWorkflowAdapter with file type registration, UDM field mapping, draft generation, lab execution, and publication
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Added yaralAdapter export and side-effect import for module-load registration

## Decisions Made
- Full implementation in single file creation rather than stub+replace pattern, since both tasks target the same file and the implementation is cohesive
- YARA-L parser uses regex-based best-effort parsing (not a full grammar) -- sufficient for client-side simulation
- Multi-variable YARA-L conditions use OR semantics between variable groups (at least one must fully match), with AND within each group
- UDM field resolution first tries dot-notation traversal, then falls back to inverse Sigma-to-UDM mapping for flat field names

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added yaral-adapter to barrel export**
- **Found during:** Task 2
- **Issue:** Without barrel import in index.ts, the yaral-adapter module would not be loaded at runtime and registerAdapter() would not fire
- **Fix:** Added `export { yaralAdapter } from "./yaral-adapter"` and `import "./yaral-adapter"` to detection-workflow/index.ts
- **Files modified:** apps/workbench/src/lib/workbench/detection-workflow/index.ts
- **Verification:** Follows existing pattern for sigma, yara, ocsf, eql adapters
- **Committed in:** fa9092013

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for runtime registration. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- yaral_rule is now a first-class detection format in the workbench
- Ready for Plan 02 (SPL adapter) and Plan 03 (cross-format translation providers)
- The adapter self-registers at module load via the plugin infrastructure from Phase 1

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts
- FOUND: .planning/phases/05-yara-l-adapter-plugin/05-01-SUMMARY.md
- FOUND: commit b957d39ff (Task 1)
- FOUND: commit fa9092013 (Task 2)

---
*Phase: 05-yara-l-adapter-plugin*
*Completed: 2026-03-21*
