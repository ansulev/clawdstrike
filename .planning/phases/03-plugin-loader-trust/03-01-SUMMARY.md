---
phase: 03-plugin-loader-trust
plan: 01
subsystem: auth
tags: [ed25519, trust, signature, web-crypto, plugin-security]

# Dependency graph
requires:
  - phase: 02-plugin-manifest-registry
    provides: PluginManifest type, InstallationMetadata type, createTestManifest helper
  - phase: 01-open-closed-seams
    provides: operator-crypto module (verifyCanonical, signCanonical, generateOperatorKeypair)
provides:
  - verifyPluginTrust() function for Ed25519 manifest signature verification
  - TrustVerificationResult type for trust verdict with reason codes
  - TrustVerificationOptions type for publisher key and allowUnsigned config
affects: [03-02-PLAN (PluginLoader uses verifyPluginTrust as precondition gate)]

# Tech tracking
tech-stack:
  added: []
  patterns: [structuredClone-and-delete for signing envelope extraction, canonical JSON signature verification]

key-files:
  created:
    - apps/workbench/src/lib/plugins/plugin-trust.ts
    - apps/workbench/src/lib/plugins/__tests__/plugin-trust.test.ts
  modified: []

key-decisions:
  - "Reused operator-crypto verifyCanonical instead of implementing custom Ed25519 verification"
  - "Signature verification removes installation.signature from manifest clone via structuredClone + delete (signs content, not itself)"
  - "Empty string signature treated as missing (same as no installation field)"

patterns-established:
  - "Trust verification pattern: check trust tier first, then signature presence, then publisher key, then crypto verify"
  - "Signing envelope pattern: structuredClone manifest, delete signature field, canonicalize, verify"

requirements-completed: [LOAD-05]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 3 Plan 1: Plugin Trust Verification Summary

**Ed25519 manifest signature verification via operator-crypto with 7-path trust decision tree (internal bypass, valid/invalid/missing signature, missing key, allowUnsigned)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T23:38:21Z
- **Completed:** 2026-03-18T23:40:08Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- verifyPluginTrust() gates plugin activation on trust tier and Ed25519 signature
- Internal plugins (trust="internal") bypass signature checks entirely
- Real Web Crypto Ed25519 key pairs used in all 7 tests (no mocks)
- allowUnsigned option provides explicit operator opt-out for development mode

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Trust verification tests** - `c994c5a` (test)
2. **Task 1 (TDD GREEN): Trust verification implementation** - `d28faf1` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/plugin-trust.ts` - Trust verification module exporting verifyPluginTrust, TrustVerificationResult, TrustVerificationOptions
- `apps/workbench/src/lib/plugins/__tests__/plugin-trust.test.ts` - 7 test cases covering all trust verification paths

## Decisions Made
- Reused operator-crypto verifyCanonical instead of implementing custom Ed25519 verification -- consistent with existing crypto patterns, avoids duplication
- Signature verification removes installation.signature from manifest clone via structuredClone + delete -- the signature signs the content, not itself
- Empty string signature treated as missing (same as no installation field) -- prevents bypass via empty signature field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- verifyPluginTrust() is ready for consumption by PluginLoader (Plan 03-02)
- TrustVerificationResult type exported for downstream type safety
- All key links established: plugin-trust.ts imports from operator-crypto.ts and types.ts

## Self-Check: PASSED

- [x] `apps/workbench/src/lib/plugins/plugin-trust.ts` exists
- [x] `apps/workbench/src/lib/plugins/__tests__/plugin-trust.test.ts` exists
- [x] Commit `c994c5a` exists (TDD RED)
- [x] Commit `d28faf1` exists (TDD GREEN)

---
*Phase: 03-plugin-loader-trust*
*Completed: 2026-03-18*
