---
phase: 02-shared-components-and-content-infrastructure
plan: 01
subsystem: guards
tags: [vitest, picomatch, guard-simulation, typescript, tdd, happy-dom]

requires:
  - phase: 01-foundation-and-wasm-integration
    provides: wasm-api.ts WASM guard wrappers and verdict-display.tsx VerdictData type

provides:
  - GuardResult, GuardAction, GuardName unified types for all 14 guards
  - evaluateGuard dispatcher routing WASM (5) and TS (9) guard evaluation
  - guardResultToVerdict converter bridging guard results to VerdictData
  - 9 TS guard simulation modules with real default.yaml patterns
  - vitest test framework with happy-dom environment

affects: [02-02, 02-03, 03-01, 03-02, 03-03, playground-shell, bypass-challenge]

tech-stack:
  added: [picomatch, vitest, happy-dom, "@types/picomatch"]
  patterns: [guard-simulation-module, evaluateGuard-dispatcher, tdd-red-green]

key-files:
  created:
    - apps/academy/src/lib/guards/types.ts
    - apps/academy/src/lib/guards/forbidden-path.ts
    - apps/academy/src/lib/guards/path-allowlist.ts
    - apps/academy/src/lib/guards/egress-allowlist.ts
    - apps/academy/src/lib/guards/secret-leak.ts
    - apps/academy/src/lib/guards/shell-command.ts
    - apps/academy/src/lib/guards/mcp-tool.ts
    - apps/academy/src/lib/guards/patch-integrity.ts
    - apps/academy/src/lib/guards/computer-use.ts
    - apps/academy/src/lib/guards/remote-desktop.ts
    - apps/academy/src/lib/guards/__tests__/forbidden-path.test.ts
    - apps/academy/src/lib/guards/__tests__/egress-allowlist.test.ts
    - apps/academy/src/lib/guards/__tests__/secret-leak.test.ts
    - apps/academy/src/lib/guards/__tests__/shell-command.test.ts
    - apps/academy/src/lib/guards/__tests__/mcp-tool.test.ts
    - apps/academy/src/lib/guards/__tests__/patch-integrity.test.ts
  modified:
    - apps/academy/vitest.config.ts
    - apps/academy/package.json

key-decisions:
  - "picomatch with dot:true for glob matching to match Rust globset behavior"
  - "Lazy dynamic imports for TS guard modules to avoid bundling unused guards"
  - "WASM bridge in evaluateGuard converts WASM-specific result types to unified GuardResult"
  - "CUA guards (computer_use, remote_desktop) implemented as stubs with custom action type dispatch"

patterns-established:
  - "Guard module pattern: each guard exports evaluateXxx(config, action) -> GuardResult"
  - "evaluateGuard dispatcher: WASM_GUARDS set routes to wasm-api, TS_GUARDS set routes to lazy imports"
  - "(?i) flag conversion: TS compilePattern strips (?i) prefix and uses RegExp 'i' flag"
  - "Passthrough pattern: non-applicable action types return {allowed: true, severity: info}"

requirements-completed: [FOUN-07]

duration: 6min
completed: 2026-03-20
---

# Phase 2 Plan 1: Guard Types and TS Simulations Summary

**9 TS guard simulations with picomatch glob matching, evaluateGuard dispatcher for all 14 guards (WASM+TS), and 50 tests via vitest/happy-dom**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T20:22:46Z
- **Completed:** 2026-03-20T20:29:31Z
- **Tasks:** 2
- **Files modified:** 18 (10 guard files, 6 test files, vitest config, package.json)

## Accomplishments
- Unified guard evaluation layer: evaluateGuard dispatches to WASM (5 guards) or TS simulation (9 guards) transparently
- All 9 TS guard simulations use real patterns/thresholds from rulesets/default.yaml (not hardcoded toy values)
- guardResultToVerdict converter bridges GuardResult to VerdictData for verdict-display.tsx compatibility
- 50 new tests covering all 6 core guards with TDD (RED then GREEN), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install test framework, picomatch, and create guard types** - `6ded8f65c` (feat)
2. **Task 2 RED: Add failing tests for 6 guard simulations** - `77297adf2` (test)
3. **Task 2 GREEN: Implement all 9 TS guard simulations** - `3b467599b` (feat)

## Files Created/Modified
- `apps/academy/src/lib/guards/types.ts` - GuardResult, VerdictData, GuardAction, GuardName types + evaluateGuard dispatcher
- `apps/academy/src/lib/guards/forbidden-path.ts` - Forbidden path guard with picomatch glob matching
- `apps/academy/src/lib/guards/path-allowlist.ts` - Path allowlist guard (inverse of forbidden-path)
- `apps/academy/src/lib/guards/egress-allowlist.ts` - Egress allowlist with domain wildcard matching
- `apps/academy/src/lib/guards/secret-leak.ts` - Secret leak detection with regex pattern matching
- `apps/academy/src/lib/guards/shell-command.ts` - Shell command guard with dangerous pattern regex
- `apps/academy/src/lib/guards/mcp-tool.ts` - MCP tool guard with block/allow lists and args size limit
- `apps/academy/src/lib/guards/patch-integrity.ts` - Patch integrity with diff parsing and forbidden patterns
- `apps/academy/src/lib/guards/computer-use.ts` - CUA guard stub for blocked action types
- `apps/academy/src/lib/guards/remote-desktop.ts` - Remote desktop channel guard stub
- `apps/academy/vitest.config.ts` - Updated to happy-dom environment and .tsx includes
- `apps/academy/package.json` - Added picomatch, vitest, happy-dom, @types/picomatch

## Decisions Made
- Used picomatch with `{ dot: true }` for glob matching to match Rust globset behavior with dotfiles
- Lazy dynamic imports for TS guard modules to avoid bundling all guards when only one is needed
- WASM bridge in evaluateGuard converts WASM-specific result types (PromptInjectionResult, JailbreakResult, etc.) to unified GuardResult format
- CUA guards (computer_use, remote_desktop) implemented as stubs dispatching on `custom` action type since they are niche CUA-only guards

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Guard simulation layer complete: playground-shell.tsx can call evaluateGuard() for any of the 14 guards
- guardResultToVerdict() ready for verdict-display.tsx integration
- Ready for 02-02 (source extraction) and 02-03 (progress store and bypass challenges)

## Self-Check: PASSED

All 17 created files verified present. All 3 commits verified in git log.

---
*Phase: 02-shared-components-and-content-infrastructure*
*Completed: 2026-03-20*
