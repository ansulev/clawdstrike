---
phase: 04-activity-bar-gutters-context-menus
plan: 02
subsystem: ui
tags: [codemirror, compartment, gutter, plugin-sdk, react, useSyncExternalStore]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation
    provides: Map + snapshot + listeners pattern for plugin registries
provides:
  - GutterExtensionRegistry with register/get/onChange/useGutterExtensions API
  - GutterDecorationContribution and GutterConfig SDK types
  - PluginLoader routing for gutterDecorations contributions
  - Compartment-based dynamic gutter extension injection in yaml-editor
affects: [04-03-context-menus, plugin-development-docs]

# Tech tracking
tech-stack:
  added: []
  patterns: [CodeMirror Compartment for dynamic extension reconfiguration, useSyncExternalStore gutter registry]

key-files:
  created:
    - apps/workbench/src/lib/plugins/gutter-extension-registry.ts
    - apps/workbench/src/lib/plugins/__tests__/gutter-extension-registry.test.ts
  modified:
    - apps/workbench/src/components/ui/yaml-editor.tsx
    - packages/sdk/plugin-sdk/src/types.ts
    - packages/sdk/plugin-sdk/src/index.ts
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/types.ts

key-decisions:
  - "Compartment.of([]) in useMemo (static) with useEffect reconfigure for dynamic updates -- avoids editor destroy/recreate"
  - "Frozen empty array sentinel for empty registry state ensures useSyncExternalStore reference stability"
  - "Async gutter entrypoint resolution with fire-and-forget pattern matching status bar item routing"

patterns-established:
  - "Compartment pattern: static Compartment.of([]) in initial extensions, useEffect dispatches reconfigure on changes"
  - "GutterExtensionRegistry follows same Map + snapshot + listeners pattern as ViewRegistry and StatusBarRegistry"

requirements-completed: [GUTR-01, GUTR-02, GUTR-03]

# Metrics
duration: 22min
completed: 2026-03-19
---

# Phase 4 Plan 2: Gutter Extension Registry Summary

**Plugin-contributed CodeMirror gutter decorations via GutterExtensionRegistry with dynamic Compartment-based injection in yaml-editor**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-19T15:09:35Z
- **Completed:** 2026-03-19T15:32:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- GutterExtensionRegistry with registerGutterExtension, getGutterExtensions, onGutterExtensionChange, useGutterExtensions API
- GutterDecorationContribution and GutterConfig types added to both SDK and workbench type systems
- PluginLoader.routeContributions routes gutterDecorations to the registry via async entrypoint resolution
- yaml-editor uses CodeMirror Compartment for zero-recreate dynamic gutter extension reconfiguration
- 8 unit tests covering registration, disposal, duplicates, ordering, listeners, reference stability

## Task Commits

Each task was committed atomically:

1. **Task 1: GutterExtensionRegistry + SDK types + PluginLoader routing** - `5ceba78a1` (feat)
2. **Task 2: Integrate gutter extensions into yaml-editor via Compartment** - `84b323c54` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/gutter-extension-registry.ts` - Central registry for plugin-contributed CodeMirror gutter extensions
- `apps/workbench/src/lib/plugins/__tests__/gutter-extension-registry.test.ts` - 8 unit tests for the gutter extension registry
- `apps/workbench/src/components/ui/yaml-editor.tsx` - Compartment-based dynamic gutter extension consumption
- `packages/sdk/plugin-sdk/src/types.ts` - GutterDecorationContribution, GutterConfig, gutterDecorations field
- `packages/sdk/plugin-sdk/src/index.ts` - Re-exports for GutterDecorationContribution, GutterConfig
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - gutterDecorations routing in routeContributions
- `apps/workbench/src/lib/plugins/types.ts` - GutterDecorationContribution, GutterConfig, gutterDecorations field, CONTRIBUTION_POINT_KEYS update

## Decisions Made
- Compartment.of([]) is static in useMemo (no dependency array churn); useEffect dispatches reconfigure when pluginGutterExtensions changes -- this avoids destroying/recreating the entire editor
- Frozen empty array sentinel for empty registry state ensures useSyncExternalStore reference stability (same pattern as ViewRegistry)
- Async gutter entrypoint resolution uses fire-and-forget void IIFE matching the existing status bar item routing pattern
- GutterConfig passes both pluginId and decorationId so factories can create properly namespaced gutters
- CONTRIBUTION_POINT_KEYS updated to include "gutterDecorations" for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added GutterDecorationContribution and GutterConfig to workbench-local types.ts**
- **Found during:** Task 1 (PluginLoader routing)
- **Issue:** Plan only specified SDK types.ts, but plugin-loader.ts imports types from workbench-local types.ts which also needs the types and PluginContributions field
- **Fix:** Added GutterDecorationContribution, GutterConfig, and gutterDecorations field to apps/workbench/src/lib/plugins/types.ts; also updated CONTRIBUTION_POINT_KEYS
- **Files modified:** apps/workbench/src/lib/plugins/types.ts
- **Verification:** TypeScript compilation succeeds, no import errors
- **Committed in:** 5ceba78a1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix necessary for correctness -- the workbench-local types mirror needed the same additions as the SDK types. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gutter extension infrastructure complete, ready for context menu contributions (Plan 3)
- Plugin authors can now contribute CodeMirror gutter decorations via manifest gutterDecorations field
- Editor dynamically reconfigures on plugin install/uninstall without recreating the CodeMirror view

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (5ceba78a1, 84b323c54) verified in git log.

---
*Phase: 04-activity-bar-gutters-context-menus*
*Completed: 2026-03-19*
