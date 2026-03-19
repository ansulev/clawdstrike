---
phase: track-c-intel
plan: C2-01
subsystem: detection-workflow
tags: [finding, draft-seed, detection-rule, mitre, ioc, sigma, ocsf]

requires:
  - phase: track-c-intel/C1-01
    provides: detection-workflow pipeline (shared-types, draft-mappers, use-draft-detection, draft-generator)
provides:
  - "mapFindingToDraftSeed mapper for Finding -> DraftSeed conversion"
  - "draftFromFinding method in useDraftDetection hook"
  - "Draft Detection button in FindingDetail for confirmed findings"
  - "finding variant in DraftSeedKind union type"
affects: [track-c-intel, detection-workflow, sentinel-swarm]

tech-stack:
  added: []
  patterns:
    - "Finding enrichment extraction: MITRE techniques from mitre_attack enrichments, IOCs from ioc_extraction enrichments"
    - "Signal data source mapping: signal.data.actionType -> ACTION_TO_DATA_SOURCE for finding signals"
    - "Callback prop pattern for cross-domain actions: onDraftDetection callback bridges findings UI to detection workflow"

key-files:
  created:
    - "src/lib/workbench/__tests__/draft-mappers-finding.test.ts"
  modified:
    - "src/lib/workbench/detection-workflow/shared-types.ts"
    - "src/lib/workbench/detection-workflow/draft-mappers.ts"
    - "src/lib/workbench/detection-workflow/use-draft-detection.ts"
    - "src/components/workbench/findings/finding-detail.tsx"
    - "src/components/workbench/sentinel-swarm-pages.tsx"

key-decisions:
  - "Used callback prop pattern (onDraftDetection) rather than direct store coupling in FindingDetail, matching existing component architecture"
  - "Wired draft detection in FindingDetailPage (sentinel-swarm-pages.tsx) using useDraftDetection hook with multiDispatch and pane store navigation"
  - "Extracted technique hints from signal.data.summary and signal.data.target text using inferTechniqueHintsFromText, since signal context flags lack label field"

patterns-established:
  - "Finding-to-DraftSeed mapping: enrichment type filtering + signal data source projection + IOC extraction"
  - "Hook method extension: add new draft method following draftFromEvents/draftFromInvestigation/draftFromPattern pattern"

requirements-completed: [INTEL-06, INTEL-07, INTEL-08]

duration: 9min
completed: 2026-03-19
---

# Plan C2-01: Finding-to-Detection Pipeline Summary

**Finding mapper extracts MITRE techniques, data sources, and IOCs from enrichments; useDraftDetection exposes draftFromFinding; FindingDetail shows one-click Draft Detection for confirmed findings**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-19T14:00:55Z
- **Completed:** 2026-03-19T14:10:22Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Complete finding-to-detection pipeline: Finding -> DraftSeed -> Draft -> Editor tab
- mapFindingToDraftSeed extracts MITRE techniques from mitre_attack enrichments, data source hints from signal action types, IOC indicators from ioc_extraction enrichments
- useDraftDetection hook extended with draftFromFinding (alongside existing draftFromEvents, draftFromInvestigation, draftFromPattern)
- "Draft Detection" button added to FindingDetail for confirmed findings with full wiring through sentinel-swarm-pages.tsx
- 7 unit tests validate mapper behavior (kind, MITRE extraction, data sources, IOCs, confidence, format recommendation, gap merging)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DraftSeedKind and create mapFindingToDraftSeed with tests** - `719388538` (feat)
2. **Task 2: Extend useDraftDetection hook with draftFromFinding method** - `c1afa007c` (feat)
3. **Task 3: Add "Draft Detection" button to FindingDetail for confirmed findings** - `dae24985c` (feat)

## Files Created/Modified
- `src/lib/workbench/detection-workflow/shared-types.ts` - Extended DraftSeedKind with "finding", added findingId to DraftSeed
- `src/lib/workbench/detection-workflow/draft-mappers.ts` - Added mapFindingToDraftSeed, "finding" case in recommendFormats, Finding/Signal imports
- `src/lib/workbench/detection-workflow/use-draft-detection.ts` - Added buildSeedFromFinding, draftFromFinding in hook interface and implementation
- `src/lib/workbench/__tests__/draft-mappers-finding.test.ts` - 7 unit tests for finding mapper
- `src/components/workbench/findings/finding-detail.tsx` - Added onDraftDetection prop and Draft Detection button for confirmed findings
- `src/components/workbench/sentinel-swarm-pages.tsx` - Wired draftFromFinding handler in FindingDetailPage using useDraftDetection hook

## Decisions Made
- Used callback prop pattern (onDraftDetection) rather than direct store coupling in FindingDetail, consistent with existing component architecture (onConfirm, onPromote, etc.)
- Wired draft detection in FindingDetailPage using useDraftDetection hook with multiDispatch from useMultiPolicy, matching the hunt-layout pattern
- Extracted technique hints from signal summaries/targets via inferTechniqueHintsFromText rather than signal context flags (which lack the label property)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted signal technique hint extraction to actual type shape**
- **Found during:** Task 1 (mapFindingToDraftSeed implementation)
- **Issue:** Plan suggested scanning signal.context.flags for `{ type: "tag", label: /T\d{4}/ }` patterns, but SignalContext.flags is typed as `Array<{ type: string; reason?: string; score?: number }>` which lacks the `label` field (unlike EventFlag in hunt-types)
- **Fix:** Used inferTechniqueHintsFromText on signal.data.summary and signal.data.target strings instead
- **Files modified:** src/lib/workbench/detection-workflow/draft-mappers.ts
- **Verification:** Tests pass, technique extraction works from signal text content
- **Committed in:** 719388538 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added parent component wiring for onDraftDetection**
- **Found during:** Task 3 (FindingDetail button implementation)
- **Issue:** FindingDetail uses callback props (not direct store access). Plan focused on finding-detail.tsx but the handler needed wiring in the parent FindingDetailPage
- **Fix:** Added useDraftDetection hook + handleDraftDetection callback in FindingDetailPage (sentinel-swarm-pages.tsx), imported useMultiPolicy, useSignalStore, usePaneStore
- **Files modified:** src/components/workbench/sentinel-swarm-pages.tsx
- **Verification:** Type check passes, button wiring complete
- **Committed in:** dae24985c (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Finding-to-detection pipeline complete; findings now flow into detection rule authoring
- All existing draft-from-events/investigation/pattern functionality unchanged
- Ready for C2-02 (if planned) or further detection workflow enhancements

---
*Phase: track-c-intel*
*Completed: 2026-03-19*
