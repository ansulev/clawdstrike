---
phase: 06-detection-engineering-inline
plan: 02
subsystem: ui
tags: [guard-card, execution-order, gutter, simulation, test-runner, codemirror]

requires:
  - phase: 06-detection-engineering-inline
    provides: CodeMirror gutter extensions with onRunGuardTest callback and showDetectionGutters prop
provides:
  - Numbered execution order badges on guard cards in custom reorder view
  - Gutter play button wired to scenario generation and test runner import
  - Detection gutters enabled by default for clawdstrike_policy files in YamlPreviewPanel
affects: [07-detection-editor-integration]

tech-stack:
  added: []
  patterns: [testScenarioToSuite conversion for gutter-to-runner pipeline, isPolicyFile conditional prop forwarding]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/editor/guard-card.tsx
    - apps/workbench/src/components/workbench/editor/editor-visual-panel.tsx
    - apps/workbench/src/components/workbench/editor/yaml-preview-panel.tsx

key-decisions:
  - "Execution order badge placed between drag handle and guard icon for visual hierarchy (drag > order > icon > name)"
  - "Gutter test callback uses toast feedback for both success (scenarios imported) and info (test runner not open) cases"
  - "testScenarioToSuite duplicated locally in yaml-preview-panel rather than extracting to shared module (matches guard-card pattern)"

patterns-established:
  - "Guard-specific scenario filtering via auto-{guardId}- prefix convention (consistent with guard-card.tsx context menu)"

requirements-completed: [DET-01, DET-03]

duration: 3min
completed: 2026-03-18
---

# Phase 6 Plan 2: Execution Order Badges & Gutter Test Wiring Summary

**Numbered execution order badges on guard cards in custom reorder mode, and gutter Run Test button wired to scenario generation with test runner import**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T20:33:10Z
- **Completed:** 2026-03-18T20:37:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Guard cards in custom reorder view now display numbered badges (1, 2, 3...) showing execution position, updating immediately on reorder
- Gutter play button in the YAML editor triggers scenario generation for the specific guard and imports results into the test runner
- Detection gutters (Run Test + coverage gaps) enabled by default for all clawdstrike_policy files in the YamlPreviewPanel
- Toast notifications provide feedback: success when scenarios are imported, info when test runner is not available

## Task Commits

Each task was committed atomically:

1. **Task 1: Add execution order badges to guard cards and wire gutter test callback** - `9cb4169cb` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/guard-card.tsx` - Added executionOrder prop with numbered badge rendering in CollapsibleTrigger header
- `apps/workbench/src/components/workbench/editor/editor-visual-panel.tsx` - Passes executionOrder={idx + 1} to GuardCard in custom reorder view
- `apps/workbench/src/components/workbench/editor/yaml-preview-panel.tsx` - Added handleRunGuardTest callback with scenario generation, test runner import, and toast feedback; passes showDetectionGutters and onRunGuardTest to both YamlEditor instances

## Decisions Made
- Placed execution order badge between drag handle and guard icon for clear visual hierarchy (drag > order number > icon > name)
- Used toast notifications for gutter test feedback rather than console.log, providing visible user feedback in both scenarios (test runner available and unavailable)
- Duplicated testScenarioToSuite helper locally in yaml-preview-panel.tsx rather than extracting to shared module, matching the existing pattern in guard-card.tsx

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 is now complete (both plans done)
- Detection engineering inline loop complete: edit guard -> see execution order -> click gutter to test -> get toast feedback with scenarios imported
- All DET-* requirements satisfied (DET-01, DET-02, DET-03)

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 06-detection-engineering-inline*
*Completed: 2026-03-18*
