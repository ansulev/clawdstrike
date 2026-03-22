---
phase: 05-yara-l-adapter-plugin
plan: 03
subsystem: detection-workflow
tags: [yaral, sigma, translation, udm, chronicle, field-mapping, bidirectional]

requires:
  - phase: 01-core-detection-plugin-infrastructure
    provides: TranslationProvider interface, registerTranslationProvider, field-mappings registry
  - phase: 05-yara-l-adapter-plugin/plan-01
    provides: yaral-adapter.ts with parseYaralRule pattern, UDM field mappings, file type registration

provides:
  - Bidirectional Sigma<->YARA-L translation provider
  - Sigma->YARA-L with UDM field path mapping, logsource to event type, modifier to regex conversion
  - YARA-L->Sigma with reverse UDM field mapping, multi-event untranslatable feature detection
  - Barrel exports for yaralTranslationProvider

affects: [cross-format-translation, split-editor, detection-workflow]

tech-stack:
  added: []
  patterns:
    - "YARA-L translation mirrors KQL translation provider pattern"
    - "Reverse UDM mapping built dynamically from getAllFieldMappings()"
    - "Multi-event YARA-L rules degrade gracefully with untranslatableFeatures"

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/yaral-translation.ts
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts

key-decisions:
  - "Duplicated parseYaralRule from yaral-adapter.ts since it is not exported; extended with hasMatchSection/hasOutcomeSection tracking"
  - "Used manual YAML renderer instead of importing yaml library to avoid dependency for simple output"
  - "Regex-with-nocase maps to Sigma |contains modifier; anchored regexes map to |startswith/|endswith"

patterns-established:
  - "Translation provider self-registration at module bottom with side-effect import chain"
  - "Reverse field mapping built from getAllFieldMappings() for target->Sigma lookups"

requirements-completed: [YARAL-06]

duration: 8min
completed: 2026-03-21
---

# Phase 5 Plan 3: YARA-L Translation Provider Summary

**Bidirectional Sigma<->YARA-L translation with UDM field mapping, event type conversion, and multi-event untranslatable feature detection**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T14:00:00Z
- **Completed:** 2026-03-21T14:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created yaral-translation.ts with full Sigma->YARA-L and YARA-L->Sigma translation
- Sigma->YARA-L maps fields via translateField(udmPath), logsource categories to UDM event types, and Sigma modifiers to YARA-L regex patterns
- YARA-L->Sigma reverse-maps UDM paths to Sigma fields, converts event predicates to detection blocks, and handles multi-event rules by populating untranslatableFeatures with descriptions of lost correlation semantics
- Wired side-effect import chain: index.ts -> yaral-adapter -> yaral-translation ensuring automatic provider registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Sigma-to-YARA-L and YARA-L-to-Sigma translation provider** - `290a961f` (feat)
2. **Task 2: Wire translation side-effect import in yaral-adapter** - `7154cf6f` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/yaral-translation.ts` - Bidirectional Sigma<->YARA-L translation provider (430 lines)
- `apps/workbench/src/lib/workbench/detection-workflow/yaral-adapter.ts` - Added side-effect import for yaral-translation
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Added yaralTranslationProvider barrel export and side-effect import

## Decisions Made
- Duplicated parseYaralRule parsing logic from yaral-adapter.ts rather than refactoring to export, since the function is internal to that module and the translation module extends it with hasMatchSection/hasOutcomeSection tracking for multi-event feature detection
- Used a lightweight manual YAML renderer (renderSigmaYaml) instead of importing the yaml library for reverse translation output, keeping the module self-contained
- Regex predicates with nocase flag map to Sigma |contains modifier; anchored regexes (^pattern or pattern$) map to |startswith or |endswith respectively

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- YARA-L adapter is now feature-complete with draft generation, lab execution, publication, and cross-format translation
- Translation provider is registered and discoverable via getTranslationPath("sigma_rule", "yaral_rule") and reverse
- Ready for any remaining YARA-L adapter plans or integration testing

## Self-Check: PASSED

- FOUND: `apps/workbench/src/lib/workbench/detection-workflow/yaral-translation.ts`
- FOUND: `.planning/phases/05-yara-l-adapter-plugin/05-03-SUMMARY.md`
- FOUND: Commit `290a961f` (Task 1)
- FOUND: Commit `7154cf6f` (Task 2)
- FOUND: Side-effect import in yaral-adapter.ts (line 35)
- FOUND: Barrel export in index.ts (line 99)

---
*Phase: 05-yara-l-adapter-plugin*
*Completed: 2026-03-21*
