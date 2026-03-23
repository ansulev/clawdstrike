---
phase: 14-intel-pipeline-wiring
plan: 02
subsystem: ui
tags: [react, zustand, tabler-icons, detection-workflow, policy-adapter, findings]

# Dependency graph
requires:
  - phase: C2-promote-to-detection
    provides: draftFromFinding hook, finding mapper, detection workflow adapter registry
provides:
  - Draft Guard button on confirmed findings generating guard config YAML via policy adapter
  - Bidirectional finding-detection links via post-draft annotation
affects: [intel-pipeline, detection-workflow, findings-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft Guard uses CoverageGapCandidate.suggestedFormats to force clawdstrike_policy adapter"
    - "Post-draft annotation via useFindingStore.getState().actions.addAnnotation for Zustand out-of-React access"

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/findings/finding-detail.tsx
    - apps/workbench/src/components/workbench/sentinel-swarm-pages.tsx
    - apps/workbench/src/lib/workbench/detection-workflow/use-draft-detection.ts

key-decisions:
  - "Gold (#d4a84b) color for Draft Guard button to differentiate from blue (#6ea8d9) Draft Detection"
  - "Force clawdstrike_policy format via suggestedFormats hint with as-any cast on partial CoverageGapCandidate"
  - "Annotation actor set to detection_workflow for traceability in finding timeline"

patterns-established:
  - "Draft Guard: callback prop pattern (onDraftGuard) matching existing onDraftDetection convention"
  - "Post-draft annotation: Zustand getState().actions pattern for side-effects in async callbacks"

requirements-completed: [INTEL-06, INTEL-08]

# Metrics
duration: 1min
completed: 2026-03-22
---

# Phase 14 Plan 02: Draft Guard Button and Bidirectional Finding-Detection Links Summary

**Gold "Draft Guard" button on confirmed findings generates guard config YAML via policy adapter; post-draft annotation creates bidirectional finding-detection links in the timeline**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-22T23:14:23Z
- **Completed:** 2026-03-22T23:15:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Draft Guard button renders on confirmed findings with gold (#d4a84b) color and IconShield, alongside the existing blue Draft Detection button
- Clicking Draft Guard forces the policy adapter (clawdstrike_policy format) to generate a guard config YAML block opened in a new editor tab
- After any detection draft from a finding, the source finding is automatically annotated with "Linked to detection draft: {name} ({fileType})" in the timeline
- INTEL-06 and INTEL-08 requirements are now satisfied

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Draft Guard button and onDraftGuard prop to finding-detail** - `b8140da6` (feat)
2. **Task 2: Add bidirectional finding-detection link via post-draft annotation** - `939639a0` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/findings/finding-detail.tsx` - Added onDraftGuard prop, IconShield import, gold Draft Guard button in confirmed status section
- `apps/workbench/src/components/workbench/sentinel-swarm-pages.tsx` - Added handleDraftGuard callback forcing clawdstrike_policy format, wired to FindingDetail
- `apps/workbench/src/lib/workbench/detection-workflow/use-draft-detection.ts` - Imported useFindingStore, added post-draft annotation in draftFromFinding callback

## Decisions Made
- Gold (#d4a84b) color for Draft Guard button to differentiate from blue (#6ea8d9) Draft Detection -- matches the policy/guard theme color used throughout the workbench
- Force clawdstrike_policy format via CoverageGapCandidate.suggestedFormats hint with `as any` cast since only the format hint matters (other fields irrelevant)
- Annotation actor set to "detection_workflow" for traceability in finding timeline, with `ann_draft_` ID prefix

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 is now complete (both plans done)
- All INTEL requirements from v1.3 re-audit are closed
- Full intel pipeline is wired: Fleet SSE -> signal-store -> correlator -> findings -> Draft Detection / Draft Guard -> bidirectional links

## Self-Check: PASSED

- All 3 modified files verified present on disk
- Commit b8140da6 (Task 1) verified in git log
- Commit 939639a0 (Task 2) verified in git log
- All 11 acceptance criteria grepped and confirmed

---
*Phase: 14-intel-pipeline-wiring*
*Completed: 2026-03-22*
