---
phase: 01-enrichment-infrastructure
plan: 03
subsystem: plugins
tags: [plugin-loader, threat-intel, secrets-api, contribution-routing, tdd]

# Dependency graph
requires:
  - phase: 01-enrichment-infrastructure
    provides: ThreatIntelSourceRegistry (registerThreatIntelSource), SecretsApi (createSecretsApi), ThreatIntelSource types
provides:
  - threatIntelSources contribution routing in PluginLoader.routeContributions()
  - SecretsApi injection in PluginActivationContext
  - EntrypointResolver option for testable contribution module loading
affects: [02-first-plugins, 03-operational-readiness, 04-intelligence-participation]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-entrypoint-resolution, plugin-namespaced-source-ids, entrypoint-resolver-injection]

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts

key-decisions:
  - "Added EntrypointResolver option to PluginLoader for testable contribution module loading (parallels resolveModule pattern)"
  - "Source IDs namespaced as {pluginId}.{sourceId} for inter-plugin isolation"

patterns-established:
  - "EntrypointResolver: injectable async module resolver for contribution entrypoints, enabling test mocking without global import stubs"
  - "Threat intel source routing: async IIFE inside routeContributions with try/catch for error isolation per source"

requirements-completed: [FOUND-07]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 1 Plan 3: Plugin Loader Integration Summary

**threatIntelSources contribution routing wired into PluginLoader.routeContributions() with SecretsApi injected into PluginActivationContext for plugin credential access**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T03:41:15Z
- **Completed:** 2026-03-22T03:47:59Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- PluginLoader.routeContributions() now routes threatIntelSources entries to ThreatIntelSourceRegistry by resolving entrypoints and registering valid source modules
- SecretsApi injected into PluginActivationContext so plugins can access plugin-scoped credential storage
- EntrypointResolver option added to PluginLoader for testable contribution module loading
- Dispose functions tracked for automatic cleanup on plugin deactivation
- 7 new tests: entrypoint resolution, source registration, dispose cleanup, error handling (failed load, missing enrich), SecretsApi context injection

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for threatIntelSources routing and SecretsApi** - `33609439d` (test)
2. **Task 1 (GREEN): Wire threatIntelSources routing and SecretsApi** - `20b2fc76e` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Added imports for registerThreatIntelSource and createSecretsApi; added EntrypointResolver type and option; added secrets field to PluginActivationContext; added threatIntelSources routing block in routeContributions()
- `apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts` - Added 7 new tests in "threat intel source routing" and "SecretsApi injection" describe blocks

## Decisions Made
- Added `EntrypointResolver` type and `resolveEntrypoint` option to PluginLoader to enable test mocking of dynamic imports for contribution entrypoints (parallels existing `resolveModule` pattern for plugin main modules)
- Source IDs namespaced as `{pluginId}.{sourceId}` to prevent cross-plugin collisions in ThreatIntelSourceRegistry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added EntrypointResolver for testable dynamic imports**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Tests could not mock `import()` for contribution entrypoints because modules don't exist on disk. The plan's implementation used raw `import()` directly in routeContributions().
- **Fix:** Added `EntrypointResolver` type and `resolveEntrypoint` option to PluginLoaderOptions, defaulting to `import()`. Tests inject mock resolvers.
- **Files modified:** apps/workbench/src/lib/plugins/plugin-loader.ts
- **Verification:** All 35 tests pass including 7 new tests
- **Committed in:** 20b2fc76e

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** EntrypointResolver is a clean extension of the existing resolveModule pattern. No scope creep -- it's the minimal change needed to make the contribution routing testable.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 enrichment infrastructure is now complete (plans 01, 02, 03 all done)
- Plugin manifest threatIntelSources contributions are routed to ThreatIntelSourceRegistry
- SecretsApi available in plugin activation context for credential access
- Ready for Phase 2 (first plugins) to build VirusTotal and GreyNoise plugins on this infrastructure

---
*Phase: 01-enrichment-infrastructure*
*Completed: 2026-03-22*
