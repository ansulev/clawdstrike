---
phase: 03-kql-adapter-plugin
plan: 02
subsystem: detection
tags: [kql, sentinel, visual-panel, plugin-sdk, react]

# Dependency graph
requires:
  - phase: 03-kql-adapter-plugin/03-01
    provides: kql-adapter.ts with parseKqlQuery, KqlParsedQuery, KqlWhereClause types
  - phase: 01-core-infrastructure
    provides: visual-panels.ts registerVisualPanel, detection-panel-kit.tsx shared components, shared-types.ts DetectionVisualPanelProps
provides:
  - KQL tabular expression visual panel (kql-visual-panel.tsx) with Sentinel table selector, editable where-clause filter cards, projection columns
  - KQL adapter plugin manifest example (kql-adapter-plugin.ts) with DetectionAdapterContribution
  - Side-effect import wiring in split-editor.tsx for visual panel registration
affects: [04-eql-adapter-plugin, 05-yara-l-adapter-plugin]

# Tech tracking
tech-stack:
  added: []
  patterns: [round-trip reconstruction for KQL queries, where-clause card editing pattern]

key-files:
  created:
    - apps/workbench/src/components/workbench/editor/kql-visual-panel.tsx
    - apps/workbench/src/lib/plugins/examples/kql-adapter-plugin.ts
  modified:
    - apps/workbench/src/components/workbench/editor/split-editor.tsx

key-decisions:
  - "Round-trip reconstruction reconstructs KQL from parsed components rather than patching source text, ensuring consistency"
  - "Custom table names shown at top of selector dropdown with '(custom)' suffix for tables not in predefined Sentinel list"
  - "Extend expressions rendered read-only since they are complex computed columns; visual editing deferred"

patterns-established:
  - "KQL visual panel pattern: parse source -> structured editing -> reconstruct -> onSourceChange round-trip"
  - "Where-clause card pattern: grid layout with field/operator/value inputs and remove button"

requirements-completed: [KQL-05]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 03 Plan 02: KQL Visual Panel & Plugin Manifest Summary

**KQL tabular expression visual panel with Sentinel table selector, editable where-clause filter cards, projection column list, and plugin manifest example**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T14:00:00Z
- **Completed:** 2026-03-21T14:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- KQL visual panel (557 lines) renders structured tabular expression editor with source table selector (11 Sentinel tables), where-clause filter cards (13 KQL operators), projection column editor, and extend expression display
- Round-trip editing: modifying any field in the visual panel reconstructs valid KQL and calls onSourceChange for live source text updates
- KQL adapter plugin manifest example demonstrates DetectionAdapterContribution with file type, visual panel, and bidirectional Sigma translation declarations
- Side-effect import in split-editor.tsx ensures registerVisualPanel("kql_rule") runs before render

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KQL tabular expression visual panel** - `abe6438f3` (feat)
2. **Task 2: Create KQL plugin manifest example and wire visual panel import** - `8a9f3cfd6` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/kql-visual-panel.tsx` - KQL visual panel with table selector, where-clause cards, projection columns, extend expressions, raw preview
- `apps/workbench/src/lib/plugins/examples/kql-adapter-plugin.ts` - Plugin manifest example using createPlugin SDK with DetectionAdapterContribution
- `apps/workbench/src/components/workbench/editor/split-editor.tsx` - Added side-effect import for kql-visual-panel

## Decisions Made
- Round-trip reconstruction reconstructs KQL from parsed components rather than patching source text, ensuring consistency
- Custom table names shown at top of selector dropdown with "(custom)" suffix for tables not in predefined Sentinel list
- Extend expressions rendered read-only since they are complex computed columns; visual editing deferred

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- KQL adapter plugin is complete (Plan 01 adapter + Plan 02 visual panel + plugin manifest)
- Pattern established for visual panel development that EQL (Phase 04) and YARA-L (Phase 05) panels follow
- All three artifacts (kql-visual-panel.tsx, kql-adapter-plugin.ts, split-editor import) verified and committed

## Self-Check: PASSED

- FOUND: apps/workbench/src/components/workbench/editor/kql-visual-panel.tsx
- FOUND: apps/workbench/src/lib/plugins/examples/kql-adapter-plugin.ts
- FOUND: .planning/phases/03-kql-adapter-plugin/03-02-SUMMARY.md
- FOUND: abe6438f3 (Task 1 commit)
- FOUND: 8a9f3cfd6 (Task 2 commit)

---
*Phase: 03-kql-adapter-plugin*
*Completed: 2026-03-21*
