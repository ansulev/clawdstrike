---
phase: 01-enrichment-infrastructure
plan: 01
subsystem: api
tags: [typescript, sdk, threat-intel, registry, secrets, plugin-sdk]

# Dependency graph
requires:
  - phase: v1.0-plugin-foundation
    provides: plugin-sdk package, PluginContext interface, guard-registry pattern
provides:
  - ThreatIntelSource, Indicator, EnrichmentResult, ThreatVerdict, IndicatorType types in @clawdstrike/plugin-sdk
  - ThreatIntelSourceRegistry singleton with register/unregister/get/getAll/getForIndicator
  - SecretsApi interface on PluginContext for plugin-scoped credential storage
  - createSecretsApi factory with plugin:{pluginId}: key prefixing
affects: [01-02-PLAN, 01-03-PLAN, phase-2-plugins, phase-3-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [Map-based singleton registry, plugin-scoped key prefixing, secureStore delegation]

key-files:
  created:
    - packages/sdk/plugin-sdk/src/threat-intel-types.ts
    - apps/workbench/src/lib/workbench/threat-intel-registry.ts
    - apps/workbench/src/lib/plugins/secrets-api.ts
    - packages/sdk/plugin-sdk/tests/threat-intel-types.test.ts
    - apps/workbench/src/lib/workbench/__tests__/threat-intel-registry.test.ts
    - apps/workbench/src/lib/plugins/__tests__/secrets-api.test.ts
  modified:
    - packages/sdk/plugin-sdk/src/context.ts
    - packages/sdk/plugin-sdk/src/index.ts

key-decisions:
  - "SecretsApi interface defined in both SDK context.ts (for type consumers) and secrets-api.ts (for factory implementation) to maintain SDK-is-types-only separation"
  - "ThreatIntelSourceRegistry includes _resetForTesting() for test isolation since module-level Map state persists across tests"
  - "Registry imports ThreatIntelSource from @clawdstrike/plugin-sdk via workspace resolution rather than relative path to SDK source"

patterns-established:
  - "ThreatIntelSourceRegistry: follows guard-registry Map-based singleton pattern with register-returns-dispose convention"
  - "SecretsApi key prefixing: plugin:{pluginId}: prefix pattern for plugin-scoped secure storage"

requirements-completed: [FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-06]

# Metrics
duration: 14min
completed: 2026-03-22
---

# Phase 1 Plan 1: Types, Registry, and SecretsApi Summary

**SDK types for threat intel enrichment pipeline (ThreatIntelSource, Indicator, EnrichmentResult, ThreatVerdict, IndicatorType), Map-based ThreatIntelSourceRegistry, and SecretsApi factory with plugin-scoped key prefixing**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-22T03:15:06Z
- **Completed:** 2026-03-22T03:29:51Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Defined 5 runtime types for the threat intel enrichment pipeline, exported from @clawdstrike/plugin-sdk
- Built ThreatIntelSourceRegistry with indicator-type filtering (getForIndicator) following guard-registry pattern
- Created SecretsApi factory that auto-prefixes keys with plugin:{pluginId}: and delegates to secureStore
- Added SecretsApi to PluginContext interface for plugin-scoped credential access
- 18 total tests across 3 test files (5 SDK type tests, 8 registry tests, 5 secrets API tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define threat intel types and wire into SDK exports** - `4eb63858b` (feat)
2. **Task 2: Create ThreatIntelSourceRegistry and SecretsApi factory with tests** - `4379e23ed` (feat)

_Both tasks followed TDD: tests written first (RED), implementation written (GREEN), no refactoring needed._

## Files Created/Modified
- `packages/sdk/plugin-sdk/src/threat-intel-types.ts` - IndicatorType, Indicator, ThreatVerdict, EnrichmentResult, ThreatIntelSource types
- `packages/sdk/plugin-sdk/src/context.ts` - SecretsApi interface added, secrets field on PluginContext
- `packages/sdk/plugin-sdk/src/index.ts` - Re-exports for all new types and SecretsApi
- `packages/sdk/plugin-sdk/tests/threat-intel-types.test.ts` - 5 tests validating type shapes
- `apps/workbench/src/lib/workbench/threat-intel-registry.ts` - Registry singleton with 5 exported functions
- `apps/workbench/src/lib/workbench/__tests__/threat-intel-registry.test.ts` - 8 tests for registry behavior
- `apps/workbench/src/lib/plugins/secrets-api.ts` - createSecretsApi factory
- `apps/workbench/src/lib/plugins/__tests__/secrets-api.test.ts` - 5 tests for key prefixing and delegation

## Decisions Made
- SecretsApi interface defined in both SDK context.ts and the factory module to keep SDK as types-only while the factory has the concrete implementation
- Added _resetForTesting() to the registry to prevent test pollution from module-level Map state
- Registry imports from @clawdstrike/plugin-sdk workspace package rather than relative paths to SDK source

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 runtime types ready for EnrichmentOrchestrator (plan 01-02) to consume
- ThreatIntelSourceRegistry ready for PluginLoader routing (plan 01-03)
- SecretsApi factory ready for PluginLoader to inject into PluginContext at activation time
- No blockers for plan 01-02 or 01-03

## Self-Check: PASSED

All 6 created files verified present. Both task commits (4eb63858b, 4379e23ed) verified in git log.

---
*Phase: 01-enrichment-infrastructure*
*Completed: 2026-03-22*
