---
phase: 03-permission-system
plan: 01
subsystem: security
tags: [permissions, capability-based, bridge, middleware, fail-closed]

# Dependency graph
requires:
  - phase: 01-postmessage-rpc-bridge
    provides: BridgeMessage protocol, BRIDGE_METHODS, PluginBridgeHost, BridgeErrorCode
provides:
  - PluginPermission type (15 permissions across 4 categories)
  - NetworkPermission interface with domain allowlist
  - METHOD_TO_PERMISSION mapping (7 bridge methods to permission strings)
  - checkPermission() function with fail-closed semantics
  - Permission enforcement middleware in PluginBridgeHost
affects: [03-02-PLAN, 04-receipt-signing, 05-revocation]

# Tech tracking
tech-stack:
  added: []
  patterns: [capability-based permissions, fail-closed enforcement, permission middleware, colon-notation permissions]

key-files:
  created:
    - apps/workbench/src/lib/plugins/bridge/permissions.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/permissions.test.ts
  modified:
    - apps/workbench/src/lib/plugins/types.ts
    - apps/workbench/src/lib/plugins/bridge/bridge-host.ts
    - apps/workbench/src/lib/plugins/bridge/index.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/bridge-host.test.ts

key-decisions:
  - "Permission strings use colon notation (guards:register) while bridge methods use dot notation (guards.register) -- intentionally different namespaces"
  - "permissions field on BridgeHostOptions is optional; null permissionSet means no enforcement (backward compat for internal plugins)"
  - "Permission check runs BEFORE handler lookup/dispatch -- denied calls never touch handlers"
  - "sendError updated from 3-variant union to full BridgeErrorCode type for extensibility"

patterns-established:
  - "Capability-based permissions: plugins must declare needed permissions in manifest"
  - "Fail-closed enforcement: unknown methods denied, empty permissions denied, missing permissions denied"
  - "Permission middleware pattern: check in handleMessage before dispatch"

requirements-completed: [PERM-01, PERM-02, PERM-03]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 3 Plan 1: Permission Types & Enforcement Summary

**Capability-based permission system with 15 PluginPermission types, METHOD_TO_PERMISSION mapping, and fail-closed enforcement middleware in PluginBridgeHost**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T05:22:25Z
- **Completed:** 2026-03-19T05:26:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PluginPermission type with 15 permissions across 4 categories (registry, data, network, system)
- NetworkPermission interface with domain allowlist for fine-grained network access
- METHOD_TO_PERMISSION mapping covering all 7 bridge methods with fail-closed semantics
- Permission enforcement middleware in PluginBridgeHost that checks BEFORE handler dispatch
- Full backward compatibility: existing code without permissions option continues to work
- 34 new tests (16 permission + 18 bridge-host including 7 new permission enforcement), 74 total bridge tests passing, 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Define PluginPermission types and METHOD_TO_PERMISSION mapping**
   - `1cdc420ac` (test: failing tests for permission types -- TDD RED)
   - `d5a5d5f88` (feat: PluginPermission, NetworkPermission, METHOD_TO_PERMISSION, checkPermission)
2. **Task 2: Add permission enforcement middleware to PluginBridgeHost**
   - `29d045a3b` (test: failing tests for permission enforcement -- TDD RED)
   - `566be959c` (feat: permission middleware, BridgeErrorCode update, barrel re-exports)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/types.ts` - Added PluginPermission type (15 values), NetworkPermission interface, permissions field on PluginManifest
- `apps/workbench/src/lib/plugins/bridge/permissions.ts` - METHOD_TO_PERMISSION record (7 mappings) and checkPermission() function
- `apps/workbench/src/lib/plugins/bridge/bridge-host.ts` - Permission enforcement middleware, permissionSet field, BridgeErrorCode sendError
- `apps/workbench/src/lib/plugins/bridge/index.ts` - Re-exports checkPermission and METHOD_TO_PERMISSION
- `apps/workbench/src/lib/plugins/bridge/__tests__/permissions.test.ts` - 16 tests for types and mapping
- `apps/workbench/src/lib/plugins/bridge/__tests__/bridge-host.test.ts` - 7 new permission enforcement tests

## Decisions Made
- Permission strings use colon notation (`guards:register`) while bridge methods use dot notation (`guards.register`) -- per CONTEXT.md convention, intentionally different
- `permissions` on BridgeHostOptions is optional; when omitted, `permissionSet` is null and no enforcement happens (backward compat for internal plugins)
- Permission check runs BEFORE handler lookup/dispatch -- denied calls never reach handlers
- `sendError` type broadened from 3-variant union to `BridgeErrorCode` for extensibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Permission types and enforcement are in place, ready for Plan 03-02 (PluginLoader permission wiring)
- PluginLoader needs to pass `manifest.permissions` to BridgeHostOptions when creating bridge hosts for community plugins
- Receipt signing (Phase 04) can use permission check results as evidence

## Self-Check: PASSED

- 7/7 files found
- 4/4 commits found
- 13/13 acceptance criteria passed
- 74/74 bridge tests passing, 0 regressions

---
*Phase: 03-permission-system*
*Completed: 2026-03-19*
