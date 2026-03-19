---
phase: 03-permission-system
plan: 02
subsystem: security
tags: [permissions, network-fetch, domain-scoping, manifest-validation, install-prompt]

# Dependency graph
requires:
  - phase: 03-permission-system/01
    provides: "Permission types, METHOD_TO_PERMISSION mapping, checkPermission enforcement, BridgeHostOptions.permissions"
provides:
  - "KNOWN_PERMISSIONS set for manifest validation"
  - "checkNetworkPermission with exact and wildcard domain matching"
  - "extractNetworkPermissions helper"
  - "network.fetch bridge handler with domain-scoped proxy"
  - "PermissionDeniedError for domain-level denials"
  - "validatePermissions in manifest validator"
  - "Permission wiring from manifest to bridge host in plugin loader"
  - "PermissionPromptCallback and onPermissionPrompt in installer"
affects: [04-audit-receipts, 05-revocation]

# Tech tracking
tech-stack:
  added: []
  patterns: [domain-scoped-network-permissions, permission-prompt-callback, fail-closed-url-parsing]

key-files:
  created: []
  modified:
    - "apps/workbench/src/lib/plugins/bridge/permissions.ts"
    - "apps/workbench/src/lib/plugins/bridge/bridge-host.ts"
    - "apps/workbench/src/lib/plugins/manifest-validation.ts"
    - "apps/workbench/src/lib/plugins/plugin-loader.ts"
    - "apps/workbench/src/lib/plugins/plugin-installer.ts"
    - "apps/workbench/src/lib/plugins/bridge/index.ts"

key-decisions:
  - "PermissionDeniedError subclass thrown by network.fetch handler to distinguish domain denial (PERMISSION_DENIED) from other errors (INTERNAL_ERROR)"
  - "Wildcard domain *.example.com matches sub.example.com but NOT example.com itself (strict subdomain only)"
  - "network:fetch auto-added to simple permissions when NetworkPermission objects present, ensuring permission-level check passes before domain-level check"
  - "Permission prompt runs BEFORE registry.register() so rejected installs never touch the registry"
  - "Empty permissions array on manifest activates enforcement (deny-all); undefined permissions means no enforcement (backward compat)"

patterns-established:
  - "Domain scoping: URL parsing with fail-closed try/catch, wildcard matching via endsWith"
  - "Permission prompt callback: async (manifest, permissions) => boolean pattern for operator approval gates"

requirements-completed: [PERM-04, PERM-05, PERM-06]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 3 Plan 2: Network Domain Scoping, Manifest Permission Validation, and Install Prompt Summary

**Domain-scoped network fetch proxy with wildcard matching, manifest validation for unknown permissions, and operator approval prompt before community plugin installation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T05:29:47Z
- **Completed:** 2026-03-19T05:36:57Z
- **Tasks:** 2 (both TDD: RED -> GREEN)
- **Files modified:** 7 source + 4 test files

## Accomplishments
- Network permission enforcement: plugins can only proxy-fetch to domains in their declared allowedDomains list
- Manifest validation rejects unknown permissions (e.g., "filesystem:write") and malformed NetworkPermission objects at install time
- Plugin loader wires manifest.permissions into PluginBridgeHost, activating enforcement for community plugins
- Plugin installer shows permission prompt for community plugins before installation; operator can reject
- 229 total tests pass across 16 plugin test files, 0 regressions

## Task Commits

Each task was committed atomically (TDD: test commit + implementation commit):

1. **Task 1: Network domain-scoped permissions and manifest permission validation**
   - `6c4cf49` (test: add failing tests)
   - `aef0cca` (feat: implement network domain scoping, fetch handler, manifest validation)
2. **Task 2: Wire permissions from manifest into bridge host and add install prompt**
   - `d76f9f9` (test: add failing tests)
   - `41a780c` (feat: wire permissions from manifest, add install prompt)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/bridge/permissions.ts` - Added KNOWN_PERMISSIONS, checkNetworkPermission, extractNetworkPermissions
- `apps/workbench/src/lib/plugins/bridge/bridge-host.ts` - Added network.fetch handler, networkPermissions option, PermissionDeniedError
- `apps/workbench/src/lib/plugins/manifest-validation.ts` - Added validatePermissions function
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Wires manifest.permissions into PluginBridgeHost
- `apps/workbench/src/lib/plugins/plugin-installer.ts` - Added PermissionPromptCallback, onPermissionPrompt option
- `apps/workbench/src/lib/plugins/bridge/index.ts` - Updated barrel exports
- `apps/workbench/src/lib/plugins/bridge/__tests__/permissions.test.ts` - 11 new tests
- `apps/workbench/src/lib/plugins/bridge/__tests__/bridge-host.test.ts` - 3 new tests
- `apps/workbench/src/lib/plugins/__tests__/manifest-validation.test.ts` - 7 new tests
- `apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts` - 4 new tests
- `apps/workbench/src/lib/plugins/__tests__/plugin-installer.test.ts` - 5 new tests

## Decisions Made
- **PermissionDeniedError class**: Handler throws PermissionDeniedError (not plain Error) so dispatch loop can return PERMISSION_DENIED instead of INTERNAL_ERROR for domain-level denials
- **Wildcard strictness**: `*.virustotal.com` matches `sub.virustotal.com` but NOT `virustotal.com` itself -- stricter than some wildcard implementations
- **Auto-inject network:fetch**: When manifest has NetworkPermission objects, `network:fetch` is auto-added to the simple permissions list so the top-level permission check passes before the handler's domain check
- **Prompt before register**: Permission prompt runs before registry.register() so rejected installs don't pollute the registry
- **Backward compat**: undefined permissions = no enforcement; empty array = deny-all enforcement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async handler test expectations**
- **Found during:** Task 1 (bridge-host network.fetch tests)
- **Issue:** Tests expected synchronous postMessage calls but network.fetch handler is async; domain denial test used Map instead of Headers for mock response
- **Fix:** Made domain denial test async with vi.waitFor(); used proper Headers constructor for mock response
- **Files modified:** bridge-host.test.ts
- **Verification:** All 21 bridge-host tests pass
- **Committed in:** aef0cca (Task 1 feat commit)

**2. [Rule 1 - Bug] Fixed ESM require() calls in permission tests**
- **Found during:** Task 1 (RED phase)
- **Issue:** Initial test code used CommonJS require() which doesn't work with vitest ESM module mocking
- **Fix:** Changed to static ESM imports at top of file
- **Files modified:** permissions.test.ts
- **Verification:** All 34 permission tests pass
- **Committed in:** aef0cca (Task 1 feat commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test code)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed test issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Permission system complete (Plan 01 + Plan 02)
- Network domain scoping, manifest validation, permission enforcement, and install prompt all functional
- Ready for Phase 04 (audit receipts) which will sign permission grant decisions
- Ready for Phase 05 (revocation) which will revoke permissions fleet-wide

---
*Phase: 03-permission-system*
*Completed: 2026-03-19*
