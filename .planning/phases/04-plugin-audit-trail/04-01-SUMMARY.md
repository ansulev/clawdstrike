---
phase: 04-plugin-audit-trail
plan: 01
subsystem: security
tags: [ed25519, sha-256, receipts, audit-trail, localstorage, middleware]

# Dependency graph
requires:
  - phase: 03-permission-system
    provides: "Permission enforcement (checkPermission, METHOD_TO_PERMISSION), PluginBridgeHost with permission gating"
provides:
  - "PluginActionReceipt types (content, signature, signer_public_key)"
  - "createReceiptContent() factory with SHA-256 params_hash"
  - "PluginReceiptStore with add/getAll/query/clear (5000 cap, localStorage)"
  - "ReceiptQueryFilter (pluginId, actionType, result, since, until)"
  - "createReceiptMiddleware with recordAllowed/recordDenied/recordError"
  - "Bridge host receipt integration (fire-and-forget after each dispatch)"
  - "usePluginReceipts React hook"
affects: [04-02-hushd-forwarding, 05-revocation]

# Tech tracking
tech-stack:
  added: []
  patterns: [receipt-middleware-pattern, fire-and-forget-audit, tdd-red-green]

key-files:
  created:
    - apps/workbench/src/lib/plugins/bridge/receipt-types.ts
    - apps/workbench/src/lib/plugins/bridge/receipt-store.ts
    - apps/workbench/src/lib/plugins/bridge/receipt-middleware.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/receipt-types.test.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/receipt-store.test.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/receipt-middleware.test.ts
  modified:
    - apps/workbench/src/lib/plugins/bridge/bridge-host.ts
    - apps/workbench/src/lib/plugins/bridge/index.ts
    - apps/workbench/src/lib/plugins/bridge/__tests__/bridge-host.test.ts

key-decisions:
  - "Receipt generation is fire-and-forget (void the promise) so audit does not block bridge response time"
  - "Denials always recorded regardless of verbosity (AUDIT-02) -- fail-open for audit, fail-closed for security"
  - "Unsigned receipts (signature='') supported for dev mode when secretKeyHex is null"
  - "Handler-level PermissionDeniedError (e.g. domain denial in network.fetch) produces recordDenied, not recordError"
  - "Receipt store uses localStorage with 5000 cap following existing local-audit.ts pattern"

patterns-established:
  - "Receipt middleware pattern: inject via BridgeHostOptions.receiptMiddleware, store instance injected for testability"
  - "Fire-and-forget audit: void promise + catch to console.warn, never blocks response path"

requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 4 Plan 1: Receipt Types + Store + Middleware Summary

**Ed25519-signed PluginActionReceipt with SHA-256 params_hash, localStorage-backed receipt store with query API, and fire-and-forget middleware wired into every bridge dispatch**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T05:46:28Z
- **Completed:** 2026-03-19T05:52:33Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- PluginActionReceipt types with all AUDIT-01 fields: plugin identity, action type, SHA-256 params_hash, result, permission_checked, duration_ms, Ed25519 signature
- PluginReceiptStore with query by pluginId, actionType, result, and time range (AUDIT-03), 5000 cap with oldest-eviction
- Receipt middleware wired into bridge host -- every handleMessage dispatch (allowed, denied, error) produces a receipt
- Permission denials always recorded (AUDIT-02), no verbosity exemption
- 251 total plugin tests pass with zero regressions (22 new receipt tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define PluginActionReceipt types and local receipt store** - `e310c345d` (test: failing) + `175ccfc5f` (feat: implementation)
2. **Task 2: Receipt generation middleware and bridge host integration** - `60275991e` (test: failing) + `251cd3acd` (feat: implementation)

_TDD: Each task has a RED commit (failing tests) followed by a GREEN commit (implementation)._

## Files Created/Modified
- `apps/workbench/src/lib/plugins/bridge/receipt-types.ts` - PluginActionReceipt/Content interfaces, createReceiptContent factory with SHA-256 params_hash
- `apps/workbench/src/lib/plugins/bridge/receipt-store.ts` - PluginReceiptStore class (localStorage, 5000 cap, query API), getPluginReceiptStore singleton, usePluginReceipts hook
- `apps/workbench/src/lib/plugins/bridge/receipt-middleware.ts` - createReceiptMiddleware with recordAllowed/recordDenied/recordError, Ed25519 signing via signCanonical
- `apps/workbench/src/lib/plugins/bridge/bridge-host.ts` - Added receiptMiddleware option, fire-and-forget receipt generation after each dispatch, performance.now() timing
- `apps/workbench/src/lib/plugins/bridge/index.ts` - Barrel exports for receipt types, store, middleware
- `apps/workbench/src/lib/plugins/bridge/__tests__/receipt-types.test.ts` - 4 tests for createReceiptContent and receipt shape
- `apps/workbench/src/lib/plugins/bridge/__tests__/receipt-store.test.ts` - 8 tests for store CRUD, queries, cap, singleton
- `apps/workbench/src/lib/plugins/bridge/__tests__/receipt-middleware.test.ts` - 6 tests for middleware API, signing, unsigned dev mode
- `apps/workbench/src/lib/plugins/bridge/__tests__/bridge-host.test.ts` - 4 new tests for receipt middleware integration

## Decisions Made
- Receipt generation is fire-and-forget (void the promise) so audit does not block bridge response time
- Denials always recorded regardless of verbosity (AUDIT-02) -- fail-open for audit, fail-closed for security
- Unsigned receipts (signature='') supported for dev mode when secretKeyHex is null
- Handler-level PermissionDeniedError (e.g. domain denial in network.fetch) produces recordDenied, not recordError
- Receipt store uses localStorage with 5000 cap following existing local-audit.ts pattern
- Receipt middleware is injected via BridgeHostOptions for testability (store instance injected, not singleton)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MAX_RECEIPTS test causing worker OOM crash**
- **Found during:** Task 1 (receipt-store tests)
- **Issue:** Creating 5002 receipts one-by-one via store.add() caused memory exhaustion in vitest worker (each add serializes the full array to localStorage)
- **Fix:** Seeded localStorage directly with 4999 receipts, then added 3 via store.add() to verify cap enforcement
- **Files modified:** receipt-store.test.ts
- **Verification:** Test passes in <30ms, all 8 store tests green
- **Committed in:** 175ccfc5f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test-only optimization to avoid OOM. Behavior coverage identical. No scope creep.

## Issues Encountered
None beyond the test OOM fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Receipt types, store, and middleware are complete and tested
- Bridge host wired to generate receipts on every dispatch
- Ready for 04-02: hushd forwarding (receipts can now be forwarded to hushd SSE)
- Ready for 05-xx: audit viewer UI (usePluginReceipts hook + query API ready)

## Self-Check: PASSED

All 7 created files verified on disk. All 4 task commits verified in git log.

---
*Phase: 04-plugin-audit-trail*
*Completed: 2026-03-19*
