---
phase: 01-core-detection-plugin-infrastructure
plan: 03
subsystem: ui
tags: [react, detection-workflow, visual-panels, plugin-loader, registry]

# Dependency graph
requires:
  - phase: 01-core-detection-plugin-infrastructure (01-01)
    provides: DetectionVisualPanelProps, visual-panels registry, shared-types, translations registry
  - phase: 01-core-detection-plugin-infrastructure (01-02)
    provides: field-mappings registry, FieldMappingTable component
provides:
  - Migrated Sigma/YARA/OCSF panels accepting DetectionVisualPanelProps
  - Dynamic visual panel resolution in split-editor via getVisualPanel()
  - Extensible publish targets for plugin file types via translation registry
  - Plugin loader routing for detectionAdapters contributions
  - Field-mappings module exported from detection-workflow barrel
affects: [02-adapter-implementations, plugin-sdk, editor]

# Tech tracking
tech-stack:
  added: []
  patterns: [self-registering visual panels at module load, dynamic component resolution via registry, side-effect imports for registration]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/editor/sigma-visual-panel.tsx
    - apps/workbench/src/components/workbench/editor/yara-visual-panel.tsx
    - apps/workbench/src/components/workbench/editor/ocsf-visual-panel.tsx
    - apps/workbench/src/components/workbench/editor/split-editor.tsx
    - apps/workbench/src/lib/workbench/detection-workflow/use-publication.ts
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/workbench/detection-workflow/index.ts

key-decisions:
  - "Subcomponents in panels use DEFAULT_ACCENT constant; main panel function uses accentColor prop with fallback"
  - "Side-effect imports in split-editor guarantee panel registration before getVisualPanel() calls"
  - "Plugin file types get json_export baseline + translatable targets from translation registry"
  - "detectionAdapters routing is declarative only; actual adapter registration happens in plugin activate()"

patterns-established:
  - "Self-registering panels: registerVisualPanel() called at module bottom, imported as side effect"
  - "Dynamic panel resolution: getVisualPanel(fileType) replaces hardcoded switch statements"
  - "Extensible publish targets: builtinTargetMap for known types, translation-derived targets for plugins"

requirements-completed: [CORE-07, CORE-02, CORE-09, CORE-03, CORE-06]

# Metrics
duration: 21min
completed: 2026-03-21
---

# Phase 1 Plan 3: Panel Migration and Editor Wiring Summary

**Migrated Sigma/YARA/OCSF panels to DetectionVisualPanelProps with self-registration, replaced hardcoded editor switch with dynamic registry lookup, and wired extensible publish targets and plugin loader routing**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-21T13:02:30Z
- **Completed:** 2026-03-21T13:23:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All three visual panels (Sigma, YARA, OCSF) accept DetectionVisualPanelProps and self-register via registerVisualPanel() at module load
- Editor dynamically resolves visual panels via getVisualPanel() with accentColor from file type descriptor -- no hardcoded switch remains
- getAvailableTargets supports plugin file types via translation registry, with json_export as baseline
- Plugin loader routes detectionAdapters manifest contributions with debug logging
- Field-mappings module (50+ entries) exported from detection-workflow barrel

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate panels to DetectionVisualPanelProps and self-register** - `c9bc04afb` (feat)
2. **Task 2: Wire editor dynamic panel resolution, extensible publish targets, and plugin loader routing** - `ab84407d0` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/sigma-visual-panel.tsx` - Now accepts DetectionVisualPanelProps, self-registers for sigma_rule
- `apps/workbench/src/components/workbench/editor/yara-visual-panel.tsx` - Now accepts DetectionVisualPanelProps, self-registers for yara_rule
- `apps/workbench/src/components/workbench/editor/ocsf-visual-panel.tsx` - Now accepts DetectionVisualPanelProps, self-registers for ocsf_event
- `apps/workbench/src/components/workbench/editor/split-editor.tsx` - Dynamic panel resolution via getVisualPanel(), side-effect imports
- `apps/workbench/src/lib/workbench/detection-workflow/use-publication.ts` - Extensible publish targets with translation registry fallback
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - detectionAdapters contribution routing block
- `apps/workbench/src/lib/workbench/detection-workflow/index.ts` - Field-mappings barrel exports

## Decisions Made
- Subcomponents (ConditionBar, SelectionNode, TagBadge, etc.) continue using a module-level DEFAULT_ACCENT constant since they don't receive props; only the main panel function uses the dynamic accentColor prop with a fallback to the original hardcoded value
- Panel modules are imported as side-effects in split-editor.tsx to guarantee registration before getVisualPanel() is called during render
- Plugin file types without built-in targets get json_export as baseline plus any translatable targets derived from the translation registry
- detectionAdapters routing in plugin-loader is intentionally declarative (console.debug logging only); the actual registerAdapter() call happens when the plugin's activate() function runs through the SDK bridge

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 infrastructure loop is complete: panels register themselves, the editor discovers them dynamically, and plugin loader knows how to route detection adapter contributions
- Any plugin can now register a detection adapter and have it fully integrated without touching core workbench code
- Ready for Phase 2: adapter implementations (SPL, KQL, EQL, YARA-L plugins)

---
*Phase: 01-core-detection-plugin-infrastructure*
*Completed: 2026-03-21*
