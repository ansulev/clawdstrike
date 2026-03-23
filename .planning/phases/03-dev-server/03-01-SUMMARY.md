---
phase: 03-dev-server
plan: 01
subsystem: dev-tooling
tags: [vite, hmr, websocket, plugin-dev, chokidar, file-watching]

requires:
  - phase: 01-testing-harness
    provides: SDK types and testing patterns for plugin packages
provides:
  - "@clawdstrike/vite-plugin-clawdstrike package with file watching and HMR events"
  - "FilePluginMap with longest-prefix directory resolution"
  - "PLUGIN_UPDATE_EVENT constant shared between server and client"
affects: [03-02, 03-03, 04-documentation]

tech-stack:
  added: [vite-plugin-api, chokidar]
  patterns: [directory-prefix-matching, custom-hmr-events, vite-configureServer]

key-files:
  created:
    - packages/dev/vite-plugin-clawdstrike/src/index.ts
    - packages/dev/vite-plugin-clawdstrike/src/types.ts
    - packages/dev/vite-plugin-clawdstrike/src/watcher.ts
    - packages/dev/vite-plugin-clawdstrike/src/file-plugin-map.ts
    - packages/dev/vite-plugin-clawdstrike/tests/file-plugin-map.test.ts
    - packages/dev/vite-plugin-clawdstrike/tests/watcher.test.ts
  modified: []

key-decisions:
  - "Used Vite's built-in chokidar watcher via server.watcher.add() rather than standalone chokidar dependency"
  - "FilePluginMap uses directory-prefix matching with trailing slash normalization to prevent partial directory name matches"

patterns-established:
  - "Custom HMR event pattern: server.ws.send(PLUGIN_UPDATE_EVENT, payload) with typed PluginUpdateEvent"
  - "Longest-prefix directory resolution for nested plugin directories"

requirements-completed: [DEVS-01, DEVS-02, DEVS-06]

duration: 3min
completed: 2026-03-23
---

# Phase 3 Plan 01: Vite Plugin Package Summary

**Vite plugin with chokidar file watching, per-directory plugin ID mapping, and custom HMR WebSocket events for targeted plugin reloads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T00:32:57Z
- **Completed:** 2026-03-23T00:36:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created @clawdstrike/vite-plugin-clawdstrike package with ESM/CJS dual build via tsup
- Implemented FilePluginMap with longest-prefix directory resolution for accurate per-file plugin ownership
- Built Vite plugin factory with configureServer hook wiring chokidar change/add events to custom HMR WebSocket events
- 19 tests passing across file-plugin-map and watcher modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Package scaffold, types, FilePluginMap** - `b86d96f6a` (feat)
2. **Task 2: Plugin factory, watcher, HMR emission** - `d74df8395` (feat)

**Package lock:** `75a813ab9` (chore: package-lock.json)

## Files Created/Modified
- `packages/dev/vite-plugin-clawdstrike/package.json` - Package manifest with vite peer dependency
- `packages/dev/vite-plugin-clawdstrike/tsconfig.json` - Strict TS config, ES2022 target
- `packages/dev/vite-plugin-clawdstrike/tsup.config.ts` - ESM + CJS dual build with DTS
- `packages/dev/vite-plugin-clawdstrike/src/types.ts` - ClawdstrikePluginOptions, PluginDevEntry, PluginUpdateEvent types
- `packages/dev/vite-plugin-clawdstrike/src/file-plugin-map.ts` - Directory-to-pluginId bidirectional map
- `packages/dev/vite-plugin-clawdstrike/src/watcher.ts` - File watcher setup with HMR event emission
- `packages/dev/vite-plugin-clawdstrike/src/index.ts` - Plugin factory and barrel exports
- `packages/dev/vite-plugin-clawdstrike/tests/file-plugin-map.test.ts` - 12 tests for FilePluginMap
- `packages/dev/vite-plugin-clawdstrike/tests/watcher.test.ts` - 7 tests for watcher integration

## Decisions Made
- Used Vite's built-in chokidar watcher (server.watcher) rather than adding a standalone chokidar dependency -- reduces bundle size and leverages Vite's existing watch configuration
- FilePluginMap normalizes directories with trailing slash to prevent false matches on partial directory names (e.g., /guard does not match /guard-extra)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- vite-plugin-clawdstrike package ready for integration into workbench vite.config.ts
- PLUGIN_UPDATE_EVENT constant shared between server and client for type-safe HMR events
- Plan 03-02 (client-side HMR handler) can consume these events immediately

## Self-Check: PASSED

All 6 created files verified on disk. All 3 commits (b86d96f6a, d74df8395, 75a813ab9) verified in git log.

---
*Phase: 03-dev-server*
*Completed: 2026-03-23*
