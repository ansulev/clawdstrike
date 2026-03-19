---
phase: 01-postmessage-rpc-bridge
plan: 01
subsystem: plugins
tags: [postmessage, rpc, bridge, iframe, typescript, vitest]

# Dependency graph
requires:
  - phase: none
    provides: "First plan of v2.0 milestone, builds on v1.0 plugin infrastructure"
provides:
  - "BridgeMessage discriminated union (4 variants: request, response, event, error)"
  - "BRIDGE_METHODS const mapping all 7 PluginContext API methods"
  - "isBridgeMessage() runtime type guard"
  - "PluginBridgeClient class (call/subscribe/destroy)"
  - "BridgeError class with typed error codes"
  - "BRIDGE_TIMEOUT_MS = 30000"
affects: [01-02-bridge-host, 02-iframe-sandbox, 03-permission-system]

# Tech tracking
tech-stack:
  added: []
  patterns: [postMessage RPC, request/response correlation, discriminated union protocol, TDD]

key-files:
  created:
    - apps/workbench/src/lib/plugins/bridge/types.ts
    - apps/workbench/src/lib/plugins/bridge/bridge-client.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/types.test.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/bridge-client.test.ts
  modified: []

key-decisions:
  - "BridgeError extends Error as a class (not a plain interface) for instanceof checks and stack traces"
  - "Events have no id field (fire-and-forget, not correlated with requests)"
  - "BRIDGE_METHODS uses nested object structure mirroring PluginContext namespace hierarchy"
  - "BridgeMethodName type uses recursive conditional type extraction from BRIDGE_METHODS values"

patterns-established:
  - "postMessage RPC pattern: monotonic ID correlation, 30s timeout, structured error codes"
  - "Bridge type guard pattern: isBridgeMessage validates type discriminant and id presence"
  - "TDD with vitest fake timers: catch promise before advancing to prevent unhandled rejections"

requirements-completed: [BRIDGE-01, BRIDGE-03, BRIDGE-04]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 1 Plan 01: Bridge Protocol Types + PluginBridgeClient Summary

**postMessage RPC bridge types (BridgeMessage 4-variant union, 6 error codes, 7 method mappings) and iframe-side PluginBridgeClient with call/subscribe/destroy and 30s timeout -- 36 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T04:36:08Z
- **Completed:** 2026-03-19T04:41:56Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- BridgeMessage discriminated union with 4 variants (request, response, event, error) and isBridgeMessage type guard
- BRIDGE_METHODS const mapping all 7 PluginContext API methods to namespaced strings with literal types
- PluginBridgeClient class with call() (monotonic ID correlation), subscribe() (event handlers with unsubscribe), and destroy() (cleanup + reject pending)
- 36 tests total: 27 for types (type guard, methods map, error codes, type shapes) + 9 for client (call, error, timeout, subscribe, unsubscribe, multiple handlers, destroy, message filtering)

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: Define bridge protocol types and method map**
   - `73dc65186` test(01-01): add failing tests for bridge protocol types
   - `dd0f31203` feat(01-01): implement bridge protocol types and method map
2. **Task 2: Implement PluginBridgeClient with call/subscribe/timeout**
   - `9a9b34e45` test(01-01): add failing tests for PluginBridgeClient
   - `fbeb25b83` feat(01-01): implement PluginBridgeClient with call/subscribe/timeout

## Files Created/Modified
- `apps/workbench/src/lib/plugins/bridge/types.ts` - BridgeMessage discriminated union, BridgeErrorCode, BridgeError, BRIDGE_METHODS, isBridgeMessage type guard, BRIDGE_TIMEOUT_MS
- `apps/workbench/src/lib/plugins/bridge/bridge-client.ts` - PluginBridgeClient class (call/subscribe/destroy), BridgeError class
- `apps/workbench/src/lib/plugins/bridge/__tests__/types.test.ts` - 27 unit tests for bridge protocol types
- `apps/workbench/src/lib/plugins/bridge/__tests__/bridge-client.test.ts` - 9 unit tests for bridge client behavior

## Decisions Made
- BridgeError extends Error as a class (not plain interface) for instanceof checks and stack traces
- Events have no id field -- they are fire-and-forget, not correlated with requests
- BRIDGE_METHODS uses nested object structure mirroring PluginContext namespace hierarchy (commands.register, guards.register, etc.)
- BridgeMethodName type uses recursive conditional type to extract string literal union from nested BRIDGE_METHODS values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- vitest fake timers require `.catch()` handler attached to promise BEFORE `vi.advanceTimersByTimeAsync()` to prevent unhandled rejection errors in Node.js -- restructured timeout test accordingly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Bridge protocol types and client are complete and ready for Plan 02 (PluginBridgeHost)
- The host will import BridgeMessage, isBridgeMessage, and the type variants to dispatch incoming requests to registries
- No blockers

---
*Phase: 01-postmessage-rpc-bridge*
*Completed: 2026-03-19*
