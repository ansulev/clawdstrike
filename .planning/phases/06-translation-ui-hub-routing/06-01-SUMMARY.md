---
phase: 06-translation-ui-hub-routing
plan: 01
subsystem: ui
tags: [react, translation, hub-and-spoke, sigma, command-palette, detection-workflow]

# Dependency graph
requires:
  - phase: 01-foundation-seams
    provides: TranslationProvider interface, translation registry, file type registry
  - phase: 02-spl-adapter
    provides: SPL translation provider (sigma_rule <-> splunk_spl)
  - phase: 03-kql-adapter
    provides: KQL translation provider (sigma_rule <-> kql_rule)
  - phase: 04-eql-adapter
    provides: EQL translation provider (sigma_rule <-> eql_rule)
  - phase: 05-yaral-adapter
    provides: YARA-L translation provider (sigma_rule <-> yaral_rule)
provides:
  - chainTranslation() multi-hop orchestrator routing through Sigma
  - useTranslation() React hook for translation state management
  - TranslationResultsPanel UI component for displaying translation output
  - "Translate to..." command palette entries under "Translate" category
  - parseYaralRule exported from yaral-adapter (duplication eliminated)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [hub-and-spoke routing via Sigma, multi-hop translation chaining, dynamic command palette generation]

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/use-translation.ts
    - apps/workbench/src/components/workbench/editor/translation-results-panel.tsx
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/translations.ts
    - apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts
    - apps/workbench/src/lib/workbench/detection-workflow/yaral-translation.ts
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts
    - apps/workbench/src/components/workbench/editor/eql-visual-panel.tsx
    - apps/workbench/src/components/workbench/editor/command-palette.tsx
    - apps/workbench/src/components/workbench/editor/policy-editor.tsx

key-decisions:
  - "Translation wired in policy-editor.tsx (not split-editor.tsx) because CommandPalette lives there"
  - "TranslationResultsPanel renders below SplitEditor in both test-runner and default layouts"
  - "Translate category added to CATEGORY_ORDER after Format for natural command palette grouping"
  - "parseYaralRule canonical location is yaral-adapter.ts; yaral-translation.ts imports from it"

patterns-established:
  - "Hub-and-spoke routing: chainTranslation tries direct provider first, then two-hop through sigma_rule"
  - "Dynamic command generation: getTranslatableTargets() populates palette entries based on active file type"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 6 Plan 1: Translation UI + Hub-and-Spoke Routing Summary

**Multi-hop translation orchestrator (chainTranslation) with command palette integration and results panel, closing all v4.0 translation integration gaps**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T02:33:54Z
- **Completed:** 2026-03-22T02:42:03Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- chainTranslation() enables any-to-any translation between {Sigma, SPL, KQL, EQL, YARA-L} via hub-and-spoke routing through Sigma
- "Translate to..." commands dynamically populate in the command palette based on the active file type's available translation paths
- TranslationResultsPanel displays output text with copy button, field mappings with confidence indicators, severity-colored diagnostics, and untranslatable features
- parseYaralRule duplication eliminated -- canonical export from yaral-adapter.ts, yaral-translation.ts imports it
- EQL visual panel import tech debt resolved (shared-form-fields -> detection-panel-kit)

## Task Commits

Each task was committed atomically:

1. **Task 1: chainTranslation orchestrator, parseYaralRule export fix, and useTranslation hook** - `237a3f4a3` (feat)
2. **Task 2: Translation results panel and "Translate to..." command palette integration** - `c461ecec1` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/translations.ts` - Added chainTranslation() multi-hop orchestrator
- `apps/workbench/src/lib/workbench/detection-workflow/use-translation.ts` - New React hook wrapping chainTranslation with loading/result/error state
- `apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts` - Exported parseYaralRule, added hasMatchSection/hasOutcomeSection to ParsedYaralRule
- `apps/workbench/src/lib/workbench/detection-workflow/yaral-translation.ts` - Removed ~100 lines of duplicated parser code, imports from yaral-adapter
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Added barrel exports for chainTranslation, useTranslation, parseYaralRule
- `apps/workbench/src/components/workbench/editor/eql-visual-panel.tsx` - Fixed import to detection-panel-kit, added missing Section icon prop
- `apps/workbench/src/components/workbench/editor/translation-results-panel.tsx` - New panel with output, field mappings, diagnostics, untranslatable features
- `apps/workbench/src/components/workbench/editor/command-palette.tsx` - Added Translate category with dynamic translate-to-{format} commands
- `apps/workbench/src/components/workbench/editor/policy-editor.tsx` - Wired useTranslation hook and TranslationResultsPanel rendering

## Decisions Made
- Translation state wired in policy-editor.tsx (not split-editor.tsx as plan suggested) because CommandPalette is rendered in policy-editor.tsx, not split-editor.tsx. This is where both the command palette and editor content area are co-located.
- TranslationResultsPanel renders in both the test-runner-open and default layout branches to ensure visibility regardless of bottom panel state.
- "Translate" added as 5th category in CATEGORY_ORDER after Format, keeping it visually distinct from file/navigation commands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Translation wired in policy-editor.tsx instead of split-editor.tsx**
- **Found during:** Task 2 (Command palette integration)
- **Issue:** Plan specified wiring useTranslation in split-editor.tsx and passing onTranslate to CommandPalette, but CommandPalette is actually rendered in policy-editor.tsx, not split-editor.tsx. split-editor.tsx has no access to CommandPalette.
- **Fix:** Wired useTranslation, handleTranslate, and TranslationResultsPanel in policy-editor.tsx where both components are accessible.
- **Files modified:** apps/workbench/src/components/workbench/editor/policy-editor.tsx
- **Verification:** TypeScript compiles, acceptance criteria pass
- **Committed in:** c461ecec1 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed pre-existing Section icon prop missing in EQL visual panel**
- **Found during:** Task 1 (EQL panel-kit import fix)
- **Issue:** Section component requires an `icon` prop, but EQL visual panel's usage at line 791 omitted it. This was a pre-existing error (confirmed by stashing changes and re-compiling).
- **Fix:** Added `icon={IconFilter}` to the Section usage and imported IconFilter from @tabler/icons-react.
- **Files modified:** apps/workbench/src/components/workbench/editor/eql-visual-panel.tsx
- **Verification:** TypeScript compiles without errors for this file
- **Committed in:** 237a3f4a3 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct wiring and compilation. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v4.0 integration gaps are closed: TRANSLATION_UI, HUB_AND_SPOKE_ROUTING, Flow C, Flow E
- Detection adapter plugin ecosystem is complete with full translation capability between all 5 formats
- Users can translate between any pair of {Sigma, SPL, KQL, EQL, YARA-L} via the command palette

## Self-Check: PASSED

All 9 files verified present. Both task commits (237a3f4a3, c461ecec1) verified in git log.

---
*Phase: 06-translation-ui-hub-routing*
*Completed: 2026-03-22*
