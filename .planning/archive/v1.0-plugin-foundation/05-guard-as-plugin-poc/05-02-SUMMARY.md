---
phase: 05-guard-as-plugin-poc
plan: 02
subsystem: plugins
tags: [plugin-parity, egress-guard, custom-guard-registry, verdict-testing]

# Dependency graph
requires:
  - phase: 05-guard-as-plugin-poc
    plan: 01
    provides: EgressAllowlistGuard plugin with configFields matching built-in guard
  - phase: 01-open-closed-seams
    provides: guard-registry with registerGuard/unregisterGuard API
provides:
  - TS verdict parity tests proving hush-ts EgressAllowlistGuard produces correct verdicts for plugin config schema
  - Rust CustomGuardRegistry parity test proving EgressAllowlistGuard works as a custom guard factory
  - Cross-runtime verdict parity validation (TS + Rust both allow/deny same domains)
affects: [06-marketplace-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [custom-guard-factory-pattern, verdict-parity-testing]

key-files:
  created:
    - apps/workbench/src/lib/plugins/__tests__/egress-guard-parity.test.ts
    - crates/libs/clawdstrike/src/guards/egress_allowlist_plugin_parity.rs
  modified:
    - crates/libs/clawdstrike/src/guards/mod.rs

key-decisions:
  - "Parity tests verify config schema mapping (plugin configFields -> EgressAllowlistConfig) rather than runtime delegation since plugin declares metadata only"
  - "Rust factory wraps built-in guard via CustomGuardFactory trait, proving custom_guards path works without WASM"

patterns-established:
  - "Verdict parity testing: instantiate both built-in guard and plugin-declared config, verify same allow/deny/warn outcomes"
  - "CustomGuardFactory wrapper pattern: wrap any built-in guard as a custom factory for registry-based loading"

requirements-completed: [GAP-03]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 5 Plan 2: Egress Guard Verdict Parity Summary

**Cross-runtime verdict parity tests proving EgressAllowlistGuard produces identical allow/deny/warn verdicts via plugin path (TS configFields + Rust CustomGuardFactory) and built-in path**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T00:13:31Z
- **Completed:** 2026-03-19T00:20:04Z
- **Tasks:** 2 (both TDD)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments
- 8 TS parity tests: 7 verdict behavior tests (allow, deny, block-precedence, log/warn, disabled bypass) + 1 config schema parity test (plugin configFields match built-in guard metadata field-by-field)
- 4 Rust parity tests: factory registration+build, verdict parity (allow for openai.com, deny for evil.com), handles() filtering (NetworkEgress yes, FileAccess no), name() matches built-in
- Zero regressions: all 61 TS plugin tests pass, all existing clawdstrike Rust tests pass
- Both TS and Rust paths produce matching verdicts for the same domains, completing GAP-03

## Task Commits

Each task was committed atomically:

1. **Task 1: TS verdict parity tests** - `377b1ebd4` (test)
2. **Task 2: Rust CustomGuardRegistry parity test** - `4f109f315` (test)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/__tests__/egress-guard-parity.test.ts` - 8 parity tests: 7 verdict behavior (allow/deny/warn for various configs) + 1 config schema comparison
- `crates/libs/clawdstrike/src/guards/egress_allowlist_plugin_parity.rs` - 4 Rust tests: EgressAllowlistGuardFactory wrapping built-in guard for CustomGuardRegistry
- `crates/libs/clawdstrike/src/guards/mod.rs` - Added `#[cfg(test)] mod egress_allowlist_plugin_parity;` module declaration

## Decisions Made
- **Config schema parity over runtime delegation:** Plugin declares metadata only (configFields), so parity tests verify the config schema maps correctly to EgressAllowlistConfig rather than testing runtime guard delegation
- **CustomGuardFactory wrapper without WASM:** The Rust test wraps the built-in EgressAllowlistGuard in a CustomGuardFactory, proving the custom_guards policy path works for this guard type without requiring WASM compilation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Guard-as-Plugin PoC) fully complete: plugin creation (05-01) + verdict parity (05-02)
- All GAP requirements satisfied: GAP-01 (guard contribution), GAP-02 (plugin SDK), GAP-03 (verdict parity)
- Ready for Phase 6 (Marketplace UI) -- plugin ecosystem infrastructure proven end-to-end

## Self-Check: PASSED

- [x] egress-guard-parity.test.ts exists
- [x] egress_allowlist_plugin_parity.rs exists
- [x] Commit 377b1ebd4 found
- [x] Commit 4f109f315 found

---
*Phase: 05-guard-as-plugin-poc*
*Completed: 2026-03-19*
