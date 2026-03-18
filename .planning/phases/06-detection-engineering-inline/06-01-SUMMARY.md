---
phase: 06-detection-engineering-inline
plan: 01
subsystem: ui
tags: [codemirror, gutter, mitre, detection, yaml-editor]

requires:
  - phase: 01-in-file-search
    provides: CodeMirror editor with search extension in YamlEditor
provides:
  - CodeMirror gutter extension for Run Test play buttons on guard config sections
  - CodeMirror gutter extension for MITRE coverage gap colored indicators
  - Guard range parser for YAML policy documents
  - Coverage gap computation from guard-to-technique mapping
affects: [06-02, 07-detection-editor-integration]

tech-stack:
  added: []
  patterns: [StateEffect/StateField gutter marker pattern, RangeSet-based gutter rendering, debounced useEffect for document change reactions]

key-files:
  created:
    - apps/workbench/src/lib/workbench/codemirror/gutter-types.ts
    - apps/workbench/src/lib/workbench/codemirror/guard-gutter.ts
    - apps/workbench/src/lib/workbench/codemirror/coverage-gutter.ts
  modified:
    - apps/workbench/src/components/ui/yaml-editor.tsx

key-decisions:
  - "RangeSet-based gutter markers via derived StateField (guardMarkerSet) instead of lineMarker callback for simpler state management"
  - "useCallback + ref pattern for onRunGuardTest to avoid extension rebuilds on callback identity changes"
  - "500ms debounce on guard range parsing to avoid excessive computation during rapid typing"
  - "Coverage threshold: red for >= 3 uncovered techniques, amber for 1-2"

patterns-established:
  - "CodeMirror gutter extension pattern: StateEffect -> StateField -> derived RangeSet StateField -> gutter(markers: view => field)"
  - "Detection gutter opt-in via showDetectionGutters prop (defaults false, only for clawdstrike_policy fileType)"

requirements-completed: [DET-01, DET-02]

duration: 7min
completed: 2026-03-18
---

# Phase 6 Plan 1: Detection Gutter Extensions Summary

**CodeMirror 6 gutter extensions for inline Run Test play buttons and MITRE ATT&CK coverage gap indicators in the YAML policy editor**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T20:21:12Z
- **Completed:** 2026-03-18T20:27:54Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Guard range parser scans YAML documents for guard config sections under `guards:` key, identifying line ranges per guard ID
- Play-button gutter markers appear on hover over guard config first lines with gold-to-green color transition and click-to-test dispatch
- Coverage gap gutter shows persistent colored circle indicators (red/amber) for guards with uncovered MITRE techniques
- Both gutter extensions conditionally activate only for `clawdstrike_policy` files when `showDetectionGutters` is enabled

## Task Commits

Each task was committed atomically:

1. **Task 1: Create gutter type definitions and guard test gutter extension** - `8137eab74` (feat)
2. **Task 2: Create coverage gap gutter extension and integrate both gutters into YamlEditor** - `4d0b6becc` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/codemirror/gutter-types.ts` - Shared types (GuardLineRange, CoverageGap) and utilities (parseGuardRanges, computeCoverageGaps)
- `apps/workbench/src/lib/workbench/codemirror/guard-gutter.ts` - Run Test play button gutter extension with StateField, RangeSet markers, theme, and click handler
- `apps/workbench/src/lib/workbench/codemirror/coverage-gutter.ts` - MITRE coverage gap indicator gutter with colored circle markers
- `apps/workbench/src/components/ui/yaml-editor.tsx` - Added onRunGuardTest and showDetectionGutters props, conditional gutter extensions, debounced guard range parsing

## Decisions Made
- Used RangeSet-based gutter markers via a derived StateField rather than the lineMarker callback, providing cleaner state management with the existing StateEffect pattern
- Applied the useCallback + ref pattern for the onRunGuardTest callback to keep extension identity stable across renders
- Set 500ms debounce on guard range parsing useEffect to balance responsiveness with performance during rapid editing
- Coverage indicator colors follow brand palette: red (#c45c5c) for >= 3 uncovered techniques, amber (#d4a84b) for 1-2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gutter extensions ready for 06-02 to wire the play button to the simulation engine and add execution order badges
- onRunGuardTest callback prop is the integration point for test execution
- Guard range parsing and coverage gap computation are reusable by future detection features

---
*Phase: 06-detection-engineering-inline*
*Completed: 2026-03-18*
