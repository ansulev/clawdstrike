---
phase: 04-eql-adapter-plugin
plan: 02
subsystem: ui
tags: [eql, visual-panel, sequence-builder, elastic, react]

# Dependency graph
requires:
  - phase: 04-eql-adapter-plugin/01
    provides: eql-parser.ts with parseEql/generateEql and EQL AST types
  - phase: 01-core-detection-plugin-infrastructure/02
    provides: detection-panel-kit.tsx shared components and visual-panels.ts registry
provides:
  - EQL visual panel with single-event condition editor and multi-event sequence builder
  - eql_rule file type visual panel registration
affects: [04-eql-adapter-plugin/03]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequence-builder-step-cards, multi-mode-visual-panel]

key-files:
  created:
    - apps/workbench/src/components/workbench/editor/eql-visual-panel.tsx
  modified:
    - apps/workbench/src/components/workbench/editor/split-editor.tsx

key-decisions:
  - "Two-mode panel: SingleQueryEditor for simple queries, SequenceBuilder for sequences -- branching on ast.type"
  - "ConditionRow handles operator type switching including in(...) with comma-separated value parsing"
  - "Until clause rendered as collapsible section with muted styling to differentiate from main steps"

patterns-established:
  - "Sequence builder pattern: step cards with number badges, connecting lines, move up/down reordering"
  - "Multi-mode visual panel: parse AST, branch on type discriminant to render different editors"

requirements-completed: [EQL-05]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 4 Plan 2: EQL Visual Panel Summary

**EQL visual panel with dual-mode editing: single-event condition editor and multi-step sequence builder with reorderable cards, maxspan, and until clause**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- EQL visual panel with SingleQueryEditor for simple queries (event category, conditions, logic toggle)
- SequenceBuilder with reorderable step cards, by-fields, maxspan, and collapsible until clause
- Round-trip editing: all visual edits flow through generateEql() back to source text
- Self-registration via registerVisualPanel("eql_rule") and side-effect import in split-editor.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EQL visual panel with condition editor and sequence builder** - `1542bd238` (feat)
2. **Task 2: Wire EQL visual panel side-effect import in split-editor** - `52bde802b` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/eql-visual-panel.tsx` - 822-line visual panel with SingleQueryEditor, SequenceBuilder, ConditionRow, and StepConditions subcomponents
- `apps/workbench/src/components/workbench/editor/split-editor.tsx` - Added side-effect import for eql-visual-panel

## Decisions Made
- Two-mode panel branching on ast.type ("single" vs "sequence") rather than separate panels
- ConditionRow is shared between SingleQueryEditor and SequenceBuilder via StepConditions wrapper
- Until clause uses collapsible UI with muted border color (#6f7f9a) to visually differentiate from sequence steps
- Elastic pink (#f04e98) as DEFAULT_ACCENT, consistent with EQL branding

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EQL visual panel is fully functional and registered
- Ready for Plan 04-03 (EQL adapter activation, translation provider, and draft seeder)

## Self-Check: PASSED

- FOUND: apps/workbench/src/components/workbench/editor/eql-visual-panel.tsx (822 lines)
- FOUND: apps/workbench/src/components/workbench/editor/split-editor.tsx (eql-visual-panel import present)
- FOUND: .planning/phases/04-eql-adapter-plugin/04-02-SUMMARY.md
- FOUND: commit 1542bd238 (Task 1)
- FOUND: commit 52bde802b (Task 2)

---
*Phase: 04-eql-adapter-plugin*
*Completed: 2026-03-21*
