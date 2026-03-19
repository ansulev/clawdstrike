---
phase: 01-open-closed-seams
plan: 02
subsystem: ui
tags: [typescript, file-type-registry, detection, plugin-extensibility, proxy-pattern]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - Open FileType type (string-based, plugin-extensible)
  - Dynamic file type registry with register/unregister APIs
  - Custom detector function support in detectFileType pipeline
  - FILE_TYPE_REGISTRY backward-compatible Proxy over Map
  - plugin_trace variant in ExplainabilityTrace union
  - BUILTIN_FILE_TYPES const and BuiltinFileType narrow type
affects: [01-03, 02-01, 03-01, 04-01, 05-01]

# Tech tracking
tech-stack:
  added: []
  patterns: [Map-backed-Proxy-for-backward-compat, dispose-pattern-for-registration, open-string-type-with-narrowing-const]

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/workbench/file-type-registry.ts
    - apps/workbench/src/lib/workbench/detection-workflow/shared-types.ts
    - apps/workbench/src/lib/workbench/__tests__/file-type-registry.test.ts

key-decisions:
  - "Used Map + Proxy pattern for FILE_TYPE_REGISTRY backward compatibility instead of breaking the Record<> API"
  - "Plugin detectors run after built-in content heuristics but before default fallback in detectFileType()"
  - "getFileTypeByExtension() checks plugin-registered extensions for unambiguous matches, skipping built-in ambiguous extensions"

patterns-established:
  - "Map-backed Proxy: dynamic registries expose a Proxy object that delegates to a Map for backward compat with Record<> consumers"
  - "Dispose pattern: registerFileType() returns () => void for cleanup, matching VS Code extension disposable convention"
  - "Open string type with const narrowing: FileType = string with BUILTIN_FILE_TYPES as const for narrowing when needed"

requirements-completed: [SEAM-03, SEAM-04, SEAM-07]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 1 Plan 2: Open File Type and Detection Seams Summary

**Open FileType from closed 4-value union to extensible string type with Map-backed dynamic registry, Proxy-based backward compat, custom detector support, and plugin_trace ExplainabilityTrace variant**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T20:54:25Z
- **Completed:** 2026-03-18T20:58:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Converted FileType from closed union to open string type, enabling plugins to register arbitrary file type IDs at runtime
- Built dynamic file type registry backed by Map with Proxy wrapper for full backward compatibility with existing FILE_TYPE_REGISTRY consumers (keyed access, Object.keys/values/entries)
- Added registerFileType()/unregisterFileType() with dispose pattern and custom detector function support
- Added generic plugin_trace variant to ExplainabilityTrace allowing plugin detection adapters to produce traces without modifying the union
- Wrote 17 comprehensive tests covering detection, dynamic registration, disposal, custom detectors, proxy compat, and plugin_trace type

## Task Commits

Each task was committed atomically:

1. **Task 1: Open FileType and convert FILE_TYPE_REGISTRY to dynamic registry** - `0ea9dd084` (feat)
2. **Task 2: Add plugin_trace variant to ExplainabilityTrace and update tests** - `ea882ee7e` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/file-type-registry.ts` - Opened FileType type, dynamic Map-backed registry with register/unregister APIs, Proxy for backward compat, custom detector pipeline
- `apps/workbench/src/lib/workbench/detection-workflow/shared-types.ts` - Added plugin_trace variant to ExplainabilityTrace discriminated union
- `apps/workbench/src/lib/workbench/__tests__/file-type-registry.test.ts` - Comprehensive tests for dynamic registration, disposal, detectors, proxy compat, and plugin_trace

## Decisions Made
- Used Map + Proxy pattern for FILE_TYPE_REGISTRY backward compatibility instead of breaking the Record<> API -- this ensures all 19+ files that use `FILE_TYPE_REGISTRY[id]` and `Object.entries(FILE_TYPE_REGISTRY)` patterns continue working without modification
- Plugin custom detectors run after built-in content heuristics (steps 1-3) but before the default fallback (step 4), giving built-in types priority while still allowing plugin detection
- getFileTypeByExtension() checks plugin-registered extensions for unambiguous matches, but skips built-in ambiguous extensions (.yaml, .yml, .json) -- preserving existing disambiguation logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- File type and detection seams are open; plugin file types can be registered at runtime
- ExplainabilityTrace is extensible via plugin_trace variant
- Ready for Plan 01-03 (Open UI seams: StatusBarRegistry, AppId, etc.)
- All 35+ FileType consumers and 19+ FILE_TYPE_REGISTRY consumers continue working unchanged via backward-compatible Proxy

## Self-Check: PASSED

All files and commits verified:
- FOUND: file-type-registry.ts
- FOUND: shared-types.ts
- FOUND: file-type-registry.test.ts
- FOUND: 01-02-SUMMARY.md
- FOUND: commit 0ea9dd084
- FOUND: commit ea882ee7e

---
*Phase: 01-open-closed-seams*
*Completed: 2026-03-18*
