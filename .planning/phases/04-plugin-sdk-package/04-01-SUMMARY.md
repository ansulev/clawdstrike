---
phase: 04-plugin-sdk-package
plan: 01
subsystem: sdk
tags: [typescript, plugin-sdk, types, createPlugin, PluginContext, tsup, vitest]

# Dependency graph
requires:
  - phase: 03-plugin-loader-trust
    provides: "PluginLoader, PluginModule, PluginActivationContext contracts"
  - phase: 02-plugin-manifest-registry
    provides: "PluginManifest, PluginContributions, contribution point interfaces"
provides:
  - "@clawdstrike/plugin-sdk package with typed APIs for plugin authoring"
  - "createPlugin() factory enforcing activate(PluginContext)/deactivate() contract"
  - "PluginContext interface with namespaced register APIs (commands, guards, fileTypes, statusBar, sidebar, storage)"
  - "All 12 contribution point interfaces re-exported for plugin author consumption"
  - "PluginManifest, Disposable, InstallationMetadata types re-exported"
affects: [05-guard-as-plugin-poc, 06-marketplace-ui]

# Tech tracking
tech-stack:
  added: ["@clawdstrike/plugin-sdk"]
  patterns: ["identity factory for type-safe plugin definition", "standalone SDK package with zero runtime deps", "namespaced API interfaces for contribution point registration"]

key-files:
  created:
    - packages/sdk/plugin-sdk/package.json
    - packages/sdk/plugin-sdk/tsconfig.json
    - packages/sdk/plugin-sdk/tsup.config.ts
    - packages/sdk/plugin-sdk/vitest.config.ts
    - packages/sdk/plugin-sdk/src/types.ts
    - packages/sdk/plugin-sdk/src/context.ts
    - packages/sdk/plugin-sdk/src/create-plugin.ts
    - packages/sdk/plugin-sdk/src/index.ts
    - packages/sdk/plugin-sdk/tests/create-plugin.test.ts
  modified:
    - package.json

key-decisions:
  - "Zero runtime dependencies -- SDK is types + identity function only; runtime injection happens in PluginLoader"
  - "Types are copied from workbench, not imported -- SDK is a standalone publishable package"
  - "createPlugin() is an identity function providing type checking at the call site, not runtime behavior"
  - "PluginContext uses namespaced API interfaces (CommandsApi, GuardsApi, etc.) matching workbench registry patterns"

patterns-established:
  - "Identity factory pattern: createPlugin() returns input unchanged but enforces type constraints"
  - "Namespaced API surface: PluginContext.commands.register(), PluginContext.guards.register(), etc."
  - "Standalone type copying: SDK types mirror workbench types without importing from internal paths"

requirements-completed: [SDK-01, SDK-02, SDK-03, SDK-04, SDK-05]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 4 Plan 1: Plugin SDK Package Summary

**@clawdstrike/plugin-sdk with createPlugin() factory, PluginContext namespaced APIs, and all 12 contribution point interfaces**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T23:54:33Z
- **Completed:** 2026-03-18T23:59:05Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments
- Created `@clawdstrike/plugin-sdk` package at `packages/sdk/plugin-sdk/` with zero runtime dependencies
- Exported all 12 contribution point interfaces (GuardContribution, CommandContribution, FileTypeContribution, etc.) with JSDoc documentation
- Implemented `createPlugin()` identity factory that enforces the `activate(PluginContext)` / `deactivate()` contract at the type level
- Defined `PluginContext` interface with 6 namespaced API surfaces: commands, guards, fileTypes, statusBar, sidebar, storage
- Build produces ESM + CJS + declaration files; all 12 tests pass; typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for createPlugin and PluginContext** - `ff35dd914` (test)
2. **Task 1 (GREEN): Implement types, context, create-plugin, and barrel** - `998c97a68` (feat)

## Files Created/Modified
- `packages/sdk/plugin-sdk/package.json` - Package identity as @clawdstrike/plugin-sdk, zero runtime deps
- `packages/sdk/plugin-sdk/tsconfig.json` - TypeScript config (ES2022, strict, declaration)
- `packages/sdk/plugin-sdk/tsup.config.ts` - Build config (ESM + CJS, dts, sourcemap)
- `packages/sdk/plugin-sdk/vitest.config.ts` - Test config (globals, node environment)
- `packages/sdk/plugin-sdk/src/types.ts` - All contribution point interfaces, PluginManifest, lifecycle types (370 lines)
- `packages/sdk/plugin-sdk/src/context.ts` - PluginContext with namespaced API interfaces (97 lines)
- `packages/sdk/plugin-sdk/src/create-plugin.ts` - createPlugin() factory and PluginDefinition (56 lines)
- `packages/sdk/plugin-sdk/src/index.ts` - Barrel re-exports for full public API (65 lines)
- `packages/sdk/plugin-sdk/tests/create-plugin.test.ts` - 12 tests covering factory, context APIs, type re-exports (313 lines)
- `package.json` - Added "packages/sdk/plugin-sdk" to workspaces array

## Decisions Made
- Zero runtime dependencies: the SDK is purely types + a thin identity function. Runtime injection of concrete API implementations happens in the workbench PluginLoader.
- Types are copied from workbench, not imported: the SDK is a standalone publishable package that doesn't depend on workbench internals.
- createPlugin() is an identity function that exists solely for TypeScript inference and validation at the plugin author's call site.
- PluginContext uses namespaced API interfaces (CommandsApi, GuardsApi, FileTypesApi, StatusBarApi, SidebarApi, StorageApi) consistent with workbench registry patterns from Phase 1.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SDK package ready for Phase 5 (Guard-as-Plugin PoC) to use `createPlugin()` and contribution types
- Plugin authors can `import { createPlugin, PluginContext, PluginManifest, GuardContribution } from '@clawdstrike/plugin-sdk'`
- Phase 6 marketplace UI can reference SDK types for plugin card display

## Self-Check: PASSED

All files exist, all commits found, build artifacts present.

---
*Phase: 04-plugin-sdk-package*
*Completed: 2026-03-18*
