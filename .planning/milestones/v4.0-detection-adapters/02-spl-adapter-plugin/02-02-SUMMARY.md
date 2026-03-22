---
phase: 02-spl-adapter-plugin
plan: 02
subsystem: detection-workflow
tags: [splunk, spl, visual-panel, translation-provider, pipe-chain, cim-fields, sigma-conversion]

# Dependency graph
requires:
  - phase: 01-core-detection-plugin-infrastructure
    provides: DetectionVisualPanelProps, registerVisualPanel, registerTranslationProvider, translateField, field-mappings registry, Section/FieldLabel/TextInput/TextArea from detection-panel-kit
  - phase: 02-spl-adapter-plugin-plan-01
    provides: parseSplPipeChain, parseSplFieldConditions, SplCommand, SplFieldCondition, splAdapter
provides:
  - SPL visual panel with pipe-chain command card builder and editable field-value pairs (SplVisualPanel)
  - Bidirectional Sigma<->SPL translation provider (splTranslationProvider)
  - SPL adapter and parser barrel exports from detection-workflow index.ts
  - Side-effect imports ensuring SPL adapter, translation provider, and visual panel register at module load
affects: [split-editor, detection-workflow-barrel]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipe-chain command card visual builder, reverse CIM field mapping for SPL->Sigma translation, comment metadata extraction for SPL headers]

key-files:
  created:
    - apps/workbench/src/components/workbench/editor/spl-visual-panel.tsx
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/spl-translation-provider.ts
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts
    - apps/workbench/src/components/workbench/editor/split-editor.tsx

key-decisions:
  - "Pipe-chain cards show command name as uppercase bold monospace header with args below -- consistent with SPL syntax highlighting conventions"
  - "Only search/where commands get editable field-value pairs -- other commands (stats, table, etc.) shown as read-only monospace since their args are not simple field=value"
  - "Comment metadata (title/author/description) extracted from // prefix lines -- mirrors SPL adapter's buildSplFromSeed comment block format"
  - "Reverse CIM mapping uses case-insensitive fallback for field names -- CIM fields like 'process' vs 'Process' vary across deployments"
  - "Untranslatable SPL features (stats, eval, lookup, subsearch, etc.) detected and reported in translation diagnostics rather than silently dropped"

patterns-established:
  - "SPL visual panel follows sigma-visual-panel pattern: ScrollArea, Section components, DEFAULT_ACCENT (#65a637), self-registration at module bottom"
  - "Translation provider follows kql-translation pattern: canTranslate for two directions, translateSigmaToSpl reuses convertSigmaToQuery, translateSplToSigma builds Sigma YAML"
  - "Round-trip reconstruction: reconstructSplFromCommands preserves original command structure for non-edited commands"

requirements-completed: [SPL-05, SPL-06]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 2 Plan 2: SPL Visual Panel and Translation Provider Summary

**SPL pipe-chain visual panel with editable command cards and bidirectional Sigma<->SPL translation provider using CIM field mappings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T13:54:51Z
- **Completed:** 2026-03-21T13:59:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SPL visual panel renders pipe chain as vertical command cards with uppercase command headers and pipe connectors
- Search and where command cards expose editable field-value pairs that round-trip to SPL source text
- Bidirectional Sigma<->SPL translation: Sigma->SPL reuses existing convertSigmaToQuery, SPL->Sigma reverse-maps CIM fields
- Translation provider detects and reports untranslatable SPL features (stats, eval, lookup, subsearch)
- All SPL modules wired into detection-workflow barrel with side-effect imports for automatic registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SPL visual panel with pipe-chain builder** - `5852ca6bf` (feat)
2. **Task 2: Create SPL translation provider and wire barrel exports** - no commit needed (artifacts already existed from prior plan execution)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/spl-visual-panel.tsx` - SPL pipe-chain visual panel with command cards, editable field-value pairs, comment metadata section
- `apps/workbench/src/lib/workbench/detection-workflow/spl-translation-provider.ts` - Bidirectional Sigma<->SPL translation with reverse CIM mapping (already existed)
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Barrel exports for splAdapter, splTranslationProvider, SPL parser types (already had exports)
- `apps/workbench/src/components/workbench/editor/split-editor.tsx` - Side-effect import for spl-visual-panel registration (already had import)

## Decisions Made
- Used #65a637 (Splunk green) as DEFAULT_ACCENT for the visual panel, consistent with the splunk_spl file type icon color
- Only search and where commands have editable field-value pairs -- other commands show args as read-only monospace
- Comment metadata extraction supports both `//` and `#` prefix comment styles
- Translation provider handles reverse CIM field lookup with case-insensitive fallback for deployment variance

## Deviations from Plan

None - plan executed exactly as written. Task 2 artifacts (spl-translation-provider.ts, barrel exports, split-editor import) were discovered to already exist in the codebase from a prior plan execution (04-03), so no new commit was needed for Task 2.

## Issues Encountered
- Task 2 files already existed from a prior plan execution (commit 28a656270, feat(04-03)). Verified the existing implementations match the plan requirements exactly -- no changes needed.
- TypeScript compilation via raw `npx tsc --noEmit <file>` produces false errors due to missing tsconfig context (path aliases, JSX flag). Used project-level `npx tsc --noEmit --project tsconfig.json` for accurate type checking.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SPL adapter plugin is complete (Plan 01: parser + adapter, Plan 02: visual panel + translation)
- Ready for Phase 03 (KQL adapter) or cross-format translation testing
- All SPL modules are properly barrel-exported and side-effect registered

## Self-Check: PASSED

- FOUND: `apps/workbench/src/components/workbench/editor/spl-visual-panel.tsx`
- FOUND: `apps/workbench/src/lib/workbench/detection-workflow/spl-translation-provider.ts`
- FOUND: commit `5852ca6bf` in branch history

---
*Phase: 02-spl-adapter-plugin*
*Completed: 2026-03-21*
