---
phase: 01-open-closed-seams
plan: 03
subsystem: ui
tags: [react, registry, zustand, useSyncExternalStore, proxy]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - Open AppId, PluginIcon, CapsuleKind, ShelfMode types (string instead of closed union)
  - BUILTIN_APP_IDS, BUILTIN_PLUGIN_ICONS, BUILTIN_CAPSULE_KINDS, BUILTIN_SHELF_MODES const arrays
  - pluginIconMap with registerPluginIcon/getPluginIconPath APIs and backward-compatible PLUGIN_ICONS Proxy
  - CapsuleRendererRegistry with register/unregister/get/kinds for capsule content renderers
  - StatusBarRegistry with register/unregister/getItems/onChange for status bar segments
affects: [02-plugin-manifest-and-registry, 03-plugin-loader-and-trust, 04-plugin-sdk-package, 05-guard-as-plugin-poc]

# Tech tracking
tech-stack:
  added: []
  patterns: [Map-based registry with dispose-function pattern, useSyncExternalStore for registry subscription, Proxy for backward-compatible Record type]

key-files:
  created:
    - apps/desktop/src/shell/dock/capsule-renderer-registry.ts
    - apps/desktop/src/shell/dock/__tests__/capsule-renderer-registry.test.ts
    - apps/workbench/src/lib/workbench/status-bar-registry.ts
    - apps/workbench/src/lib/workbench/__tests__/status-bar-registry.test.ts
  modified:
    - apps/desktop/src/shell/plugins/types.ts
    - apps/desktop/src/shell/dock/types.ts
    - apps/desktop/src/shell/dock/DockSystem.tsx
    - apps/desktop/src/shell/dock/index.ts
    - apps/desktop/src/shell/ShellLayout.tsx
    - apps/workbench/src/components/desktop/status-bar.tsx

key-decisions:
  - "Used Map-based registry pattern (same as guard-registry and file-type-registry from plans 01 and 02)"
  - "Used useSyncExternalStore for StatusBar subscription to registry changes (referential stability via snapshot cache)"
  - "Used Proxy wrapper to maintain backward-compatible PLUGIN_ICONS Record type"
  - "Registered built-in status bar segments as React components (not functions) to support hooks"
  - "Combined guard-count and file-type segments into a single conditional component to match original behavior"

patterns-established:
  - "Map-based registry with register() returning dispose function: used across all registries in the system"
  - "Module-scope registration: built-in items registered at import time, ensuring they exist before first render"
  - "Proxy backward compat: when opening a Record type to a Map, use Proxy to maintain old import shape"

requirements-completed: [SEAM-05, SEAM-06, SEAM-10]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 1 Plan 3: Open UI Seams Summary

**Open AppId/PluginIcon/CapsuleKind/ShelfMode to string types, create CapsuleRendererRegistry and StatusBarRegistry with register/dispose APIs**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T20:54:27Z
- **Completed:** 2026-03-18T21:01:56Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Converted AppId, PluginIcon, CapsuleKind, and ShelfMode from closed unions to open `string` types with BUILTIN_* const arrays preserving type-safe access to known values
- Created CapsuleRendererRegistry replacing the 10-case switch statement in getCapsuleContent() with registry-based dispatch
- Created StatusBarRegistry with useSyncExternalStore integration, extracting 9 hardcoded status bar segments into individually registered React components
- Added pluginIconMap with registerPluginIcon/getPluginIconPath APIs and a backward-compatible PLUGIN_ICONS Proxy

## Task Commits

Each task was committed atomically:

1. **Task 1: Open AppId, PluginIcon, CapsuleKind, and ShelfMode types** - `1087a8750` (feat)
2. **Task 2: Create StatusBarRegistry and refactor StatusBar to render from it** - `959d0bc2c` (feat)
3. **Task 3: Create CapsuleRendererRegistry and refactor getCapsuleContent to dispatch from it** - `4e7ee71f1` (feat)

## Files Created/Modified
- `apps/desktop/src/shell/plugins/types.ts` - Open AppId/PluginIcon types, pluginIconMap, registerPluginIcon, backward-compat PLUGIN_ICONS Proxy
- `apps/desktop/src/shell/dock/types.ts` - Open CapsuleKind/ShelfMode types with BUILTIN_* arrays
- `apps/desktop/src/shell/dock/capsule-renderer-registry.ts` - CapsuleRendererRegistry with register/unregister/get/kinds
- `apps/desktop/src/shell/dock/DockSystem.tsx` - Register 9 built-in renderers, getCapsuleContent dispatches from registry
- `apps/desktop/src/shell/dock/index.ts` - Export capsuleRendererRegistry
- `apps/desktop/src/shell/ShellLayout.tsx` - Fix renderShelfContent parameter type for widened ShelfMode
- `apps/workbench/src/lib/workbench/status-bar-registry.ts` - StatusBarRegistry with register/unregister/getItems/onChange
- `apps/workbench/src/components/desktop/status-bar.tsx` - Refactored to render from registry with useSyncExternalStore
- `apps/desktop/src/shell/dock/__tests__/capsule-renderer-registry.test.ts` - 6 registry CRUD tests
- `apps/workbench/src/lib/workbench/__tests__/status-bar-registry.test.ts` - 8 registry CRUD tests

## Decisions Made
- Used Map-based registry pattern consistent with guard-registry and file-type-registry from plans 01 and 02
- Used useSyncExternalStore (not useEffect + useState) for StatusBar registry subscription for referential stability
- Used Proxy wrapper to maintain backward-compatible PLUGIN_ICONS Record type (avoids breaking existing consumers)
- Combined guard-count and file-type segments into single conditional components to match original status bar behavior
- kernel_agent retains inline fallback rather than getting its own registered renderer (no dedicated component)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ShellLayout.tsx renderShelfContent parameter type**
- **Found during:** Task 1 (Open types)
- **Issue:** `renderShelfContent` callback in ShellLayout.tsx used explicit union type `"events" | "output" | "artifacts"` for the mode parameter, which no longer matches `ShelfMode = string`
- **Fix:** Changed parameter type to `string` to match the widened ShelfMode
- **Files modified:** apps/desktop/src/shell/ShellLayout.tsx
- **Verification:** Desktop TypeScript compilation succeeds with no errors
- **Committed in:** 1087a8750 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary fix for type compatibility after widening ShelfMode. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 1 seams are now open: guard pipeline (plan 01), file types (plan 02), and UI contribution points (plan 03)
- Phase 2 (Plugin Manifest and Registry) can proceed -- it needs the open registration APIs from Phase 1 to define contribution point mappings
- No blockers or concerns
- 14 total registry tests passing (8 status bar + 6 capsule renderer)

---
*Phase: 01-open-closed-seams*
*Completed: 2026-03-18*
