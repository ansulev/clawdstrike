---
phase: 01-core-detection-plugin-infrastructure
plan: 01
subsystem: detection
tags: [registry, visual-panels, translation, publish-target, plugin-types]

# Dependency graph
requires: []
provides:
  - Visual panel registry (register/get/unregister with dispose pattern)
  - Translation provider registry (array-based multi-pair lookup)
  - Extensible PublishTarget type with BUILTIN_PUBLISH_TARGETS constant
  - Publish target registry with register/get/getAll
  - DetectionVisualPanelProps standard interface for visual panels
  - TranslationProvider/TranslationRequest/TranslationResult contracts
  - DetectionAdapterContribution bundle with fileTypeDescriptor, hasVisualPanel, translations
  - unregisterAdapter() for adapter lifecycle management
affects: [01-02, 01-03, phase-02, phase-03, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dispose-on-register pattern: register functions return () => void for cleanup"
    - "Extensible string type with BUILTIN_* const array for built-in values"
    - "Module-level Map/Array backing stores for registries"

key-files:
  created:
    - apps/workbench/src/lib/workbench/detection-workflow/visual-panels.ts
    - apps/workbench/src/lib/workbench/detection-workflow/translations.ts
  modified:
    - apps/workbench/src/lib/workbench/detection-workflow/adapters.ts
    - apps/workbench/src/lib/workbench/detection-workflow/shared-types.ts
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts
    - apps/workbench/src/lib/plugins/types.ts

key-decisions:
  - "PublishTarget changed from union to string with BUILTIN_PUBLISH_TARGETS const for extensibility"
  - "Translation providers stored in array (not map) since one provider may handle multiple from/to pairs"
  - "Visual panel registry throws on duplicate registration to match registerFileType behavior"
  - "registerAdapter returns dispose function for lifecycle management"

patterns-established:
  - "Dispose pattern: all register functions return () => void cleanup callback"
  - "Extensible type pattern: type alias = string + BUILTIN_* const array + Descriptor registry"
  - "First-match provider lookup for translation (ordered array, not keyed map)"

requirements-completed: [CORE-01, CORE-02, CORE-03, CORE-04, CORE-06, CORE-09]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 1 Plan 1: Core Detection Plugin Infrastructure Summary

**Three core registries (visual panels, translation providers, publish targets) with extensible type contracts and DetectionAdapterContribution bundle interface**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T12:55:30Z
- **Completed:** 2026-03-21T12:58:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created visual panel registry with register/get/dispose pattern for format-specific builder components
- Created translation provider registry with array-based multi-pair lookup and getTranslatableTargets convenience
- Changed PublishTarget from fixed union to extensible string with publish target descriptor registry
- Added DetectionVisualPanelProps, TranslationProvider, TranslationRequest, TranslationResult type contracts
- Expanded DetectionAdapterContribution to full bundle (fileTypeDescriptor, hasVisualPanel, translations)
- Added unregisterAdapter() and dispose-return from registerAdapter()
- Updated barrel index.ts with all new exports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create type contracts and update adapters.ts with unregisterAdapter** - `280e2143a` (feat)
2. **Task 2: Create visual panel registry and translation provider registry** - `db20a495f` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/detection-workflow/visual-panels.ts` - Visual panel component registry (new)
- `apps/workbench/src/lib/workbench/detection-workflow/translations.ts` - Translation provider registry (new)
- `apps/workbench/src/lib/workbench/detection-workflow/adapters.ts` - Added unregisterAdapter and dispose pattern
- `apps/workbench/src/lib/workbench/detection-workflow/shared-types.ts` - Added extensible PublishTarget, publish target registry, DetectionVisualPanelProps, translation types
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Barrel re-exports for all new registries and types
- `apps/workbench/src/lib/plugins/types.ts` - Expanded DetectionAdapterContribution with full bundle fields

## Decisions Made
- Changed PublishTarget from fixed union to extensible `string` type with `BUILTIN_PUBLISH_TARGETS` const array -- enables plugins to register custom publish targets without modifying core types
- Translation providers use array storage (not Map) because a single provider may handle multiple (from, to) pairs
- Visual panel registry throws on duplicate registration to match existing registerFileType behavior (fail-fast)
- registerAdapter() now returns a dispose function; callers that ignore the return still work (backward compatible)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three core registries ready for adapter plugins to register into
- Plan 01-02 can build on these registries for adapter plugin loader wiring
- Plan 01-03 can implement the contribution point activation for detection adapters
- Phase 2+ adapter plugins can declare full DetectionAdapterContribution bundles

## Self-Check: PASSED

All 6 files verified on disk. Both task commits (280e2143a, db20a495f) found in git log.

---
*Phase: 01-core-detection-plugin-infrastructure*
*Completed: 2026-03-21*
