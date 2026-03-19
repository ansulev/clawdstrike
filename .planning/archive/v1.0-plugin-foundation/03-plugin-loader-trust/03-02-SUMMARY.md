---
phase: 03-plugin-loader-trust
plan: 02
subsystem: plugins
tags: [plugin-loader, activation-events, contribution-routing, trust-gating, promise-allsettled, guard-registry, file-type-registry, status-bar-registry]

# Dependency graph
requires:
  - phase: 03-plugin-loader-trust
    provides: verifyPluginTrust() for Ed25519 manifest signature verification
  - phase: 02-plugin-manifest-registry
    provides: PluginManifest type, PluginRegistry class, createTestManifest helper
  - phase: 01-open-closed-seams
    provides: registerGuard, registerFileType, statusBarRegistry dynamic registries
provides:
  - PluginLoader class with loadAll, loadPlugin, deactivatePlugin, triggerActivationEvent
  - PluginModule and PluginActivationContext types for plugin module contract
  - Activation event parsing and matching (parseActivationEvent, matchActivationEvent, shouldActivateOnStartup)
  - pluginLoader singleton for workbench integration
affects: [04-01-PLAN (SDK wraps PluginLoader), 05-01-PLAN (guard-as-plugin uses PluginLoader), 06-01-PLAN (marketplace install triggers loadPlugin)]

# Tech tracking
tech-stack:
  added: []
  patterns: [dependency-injection-via-resolveModule, promise-allsettled-error-isolation, contribution-routing-with-disposables]

key-files:
  created:
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/activation-events.ts
    - apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts
  modified: []

key-decisions:
  - "Dependency injection via resolveModule option for testability instead of mocking dynamic import()"
  - "Contributions routed BEFORE activate() called -- registrations happen first, then plugin code runs"
  - "StatusBarItemContribution renders null placeholder -- real render resolved at activation time via entrypoint"
  - "Activation event matching is pure functions in separate module (no side effects, easy to test independently)"

patterns-established:
  - "Plugin module contract: activate(ctx) returns Disposable[] | void; deactivate() is optional"
  - "Contribution routing pattern: each contribution type has a private route*() method returning Disposable"
  - "Error isolation pattern: Promise.allSettled in loadAll + try/catch in loadPlugin with cleanup"
  - "Lazy activation pattern: pendingActivation map holds deferred plugins until triggerActivationEvent"

requirements-completed: [LOAD-01, LOAD-02, LOAD-03, LOAD-04]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 3 Plan 2: Plugin Loader Summary

**PluginLoader with contribution routing to guard/fileType/statusBar registries, Promise.allSettled error isolation, activation event lazy loading, and Ed25519 trust gating**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T23:42:34Z
- **Completed:** 2026-03-18T23:46:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PluginLoader loads plugins by resolving modules and routing guard/fileType/statusBar contributions to Phase 1 registries
- Promise.allSettled ensures one failing plugin does not block others during loadAll()
- Activation events control lazy loading: onStartup plugins load immediately, others wait for triggerActivationEvent()
- Trust verification gates non-internal plugins before activate() runs
- Clean deactivation disposes all contribution registrations and calls module.deactivate()
- Pure activation-events.ts module with parseActivationEvent, matchActivationEvent, shouldActivateOnStartup
- All 9 loader tests pass plus 25 total tests with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Activation event matching module** - `a9102fc` (feat)
2. **Task 2 (TDD RED): PluginLoader tests** - `a69b29c` (test)
3. **Task 2 (TDD GREEN): PluginLoader implementation** - `2fd20f3` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/activation-events.ts` - Pure module with parseActivationEvent, matchActivationEvent, shouldActivateOnStartup
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - PluginLoader class with contribution routing, trust gating, activation events, disposable tracking
- `apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts` - 9 test cases covering all loader behaviors

## Decisions Made
- Dependency injection via resolveModule option -- avoids mocking dynamic import() in tests, clean DI seam
- Contributions routed BEFORE activate() called -- guards/fileTypes/statusBar items exist in registries before plugin code runs
- StatusBarItemContribution renders null placeholder -- full render component resolved via entrypoint at activation time
- Activation event matching is a separate pure module -- no side effects, independently testable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PluginLoader is ready for SDK consumption (Phase 4)
- All Phase 1 registries (guard, file type, status bar) receive plugin contributions correctly
- Trust verification integrates cleanly with plugin loading lifecycle
- Phase 3 complete -- all loader + trust requirements satisfied

## Self-Check: PASSED

- [x] `apps/workbench/src/lib/plugins/activation-events.ts` exists
- [x] `apps/workbench/src/lib/plugins/plugin-loader.ts` exists
- [x] `apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts` exists
- [x] Commit `a9102fc` exists (Task 1: activation events)
- [x] Commit `a69b29c` exists (Task 2 TDD RED)
- [x] Commit `2fd20f3` exists (Task 2 TDD GREEN)

---
*Phase: 03-plugin-loader-trust*
*Completed: 2026-03-18*
