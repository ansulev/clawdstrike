---
phase: 03-operational-readiness
plan: 02
subsystem: intel
tags: [otx, misp, threat-intel, enrichment, plugin, api]

# Dependency graph
requires:
  - phase: 01-enrichment-infrastructure
    provides: ThreatIntelSource interface, ThreatIntelSourceRegistry, EnrichmentOrchestrator
  - phase: 02-first-party-plugins
    provides: VirusTotal and GreyNoise plugin patterns (factory + manifest + TDD structure)
provides:
  - AlienVault OTX ThreatIntelSource plugin (IP, domain, URL, hash)
  - MISP ThreatIntelSource plugin (IP, domain, URL, hash, email) with configurable base URL
  - MITRE ATT&CK technique extraction from MISP Galaxy tags
affects: [03-operational-readiness, enrichment-ui, threat-intel-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OTX DirectConnect API v2 integration (X-OTX-API-KEY header auth)"
    - "MISP restSearch API integration (POST with Authorization header)"
    - "Configurable base_url for self-hosted services via requiredSecrets"
    - "MITRE ATT&CK Galaxy tag parsing from MISP event tags"

key-files:
  created:
    - apps/workbench/src/lib/plugins/threat-intel/otx-plugin.ts
    - apps/workbench/src/lib/plugins/threat-intel/misp-plugin.ts
    - apps/workbench/src/lib/plugins/threat-intel/__tests__/otx-plugin.test.ts
    - apps/workbench/src/lib/plugins/threat-intel/__tests__/misp-plugin.test.ts
  modified: []

key-decisions:
  - "Placed plugins in threat-intel/ directory alongside VT and GN (not examples/ as plan specified) for consistency"
  - "OTX pulse count thresholds: >5 malicious, 1-5 suspicious, 0 benign"
  - "MISP event count thresholds: >3 malicious, 1-3 suspicious, 0 unknown (not benign -- no data is not absence of threat)"
  - "MISP confidence capped at 0.9 since data quality varies across instances"
  - "OTX related indicators extracted from pulse references (URLs only)"
  - "MISP related indicators extracted from co-occurring event attributes with type mapping"
  - "Used intersection type (PluginManifest & { requiredSecrets }) to avoid pre-existing TS errors on PluginManifest"

patterns-established:
  - "Self-hosted service plugin pattern: configurable base_url via requiredSecrets, trailing slash normalization"
  - "MITRE technique extraction: regex T\\d{4}(?:\\.\\d{3})? against Galaxy tag strings"
  - "Related indicator extraction from structured API responses (pulse refs for OTX, event attributes for MISP)"

requirements-completed: [OPS-04, OPS-05]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 3 Plan 2: OTX & MISP Threat Intel Plugins Summary

**AlienVault OTX and MISP ThreatIntelSource plugins with pulse-based classification, configurable self-hosted URLs, and MITRE ATT&CK Galaxy tag extraction**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T23:24:08Z
- **Completed:** 2026-03-22T23:30:19Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- OTX plugin enriches IP, domain, URL, and hash indicators via DirectConnect API v2 with pulse count classification
- MISP plugin enriches all 5 indicator types via configurable self-hosted instances with MITRE ATT&CK extraction
- Both plugins follow established TDD pattern: 45 total tests (22 OTX + 23 MISP), all passing
- MISP plugin extracts related indicators from co-occurring event attributes and MITRE techniques from Galaxy tags

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: AlienVault OTX threat intel source plugin**
   - `347b648ad` test(03-02): add failing tests for OTX plugin (RED)
   - `8f03c1a2f` feat(03-02): implement OTX plugin (GREEN)

2. **Task 2: MISP threat intel source plugin**
   - `c9a086862` test(03-02): add failing tests for MISP plugin (RED)
   - `54646aa47` feat(03-02): implement MISP plugin (GREEN)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/threat-intel/otx-plugin.ts` - OTX ThreatIntelSource: pulse-based classification, X-OTX-API-KEY auth, 30min cache
- `apps/workbench/src/lib/plugins/threat-intel/misp-plugin.ts` - MISP ThreatIntelSource: configurable base URL, MITRE extraction, 15min cache
- `apps/workbench/src/lib/plugins/threat-intel/__tests__/otx-plugin.test.ts` - 22 tests for OTX plugin
- `apps/workbench/src/lib/plugins/threat-intel/__tests__/misp-plugin.test.ts` - 23 tests for MISP plugin

## Decisions Made
- **File location:** Placed plugins in `threat-intel/` directory (not `examples/` as plan specified) to maintain consistency with existing VT and GN plugins
- **OTX thresholds:** >5 pulses = malicious, 1-5 = suspicious, 0 = benign (matches plan spec)
- **MISP zero-match verdict:** Returns "unknown" (not "benign") because absence of MISP data does not prove indicator is safe
- **MISP confidence cap:** 0.9 maximum because MISP data quality varies across self-hosted instances
- **requiredSecrets type:** Used TypeScript intersection type to extend PluginManifest cleanly, avoiding pre-existing TS errors where PluginManifest does not yet declare requiredSecrets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] File path correction: threat-intel/ instead of examples/**
- **Found during:** Task 1 pre-implementation analysis
- **Issue:** Plan specified `apps/workbench/src/lib/plugins/examples/` but existing VT/GN plugins live in `apps/workbench/src/lib/plugins/threat-intel/`
- **Fix:** Placed OTX and MISP plugins in `threat-intel/` for consistency with established codebase convention
- **Verification:** All imports resolve correctly, tests pass

---

**Total deviations:** 1 auto-fixed (1 blocking path correction)
**Impact on plan:** Path change necessary for codebase consistency. No functional difference.

## Issues Encountered
- Pre-existing TypeScript errors in shodan-plugin, abuseipdb-plugin, enrichment-bridge (out of scope, not caused by this plan's changes)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Six threat intel source plugins now complete (VT, GN, Shodan, AbuseIPDB, OTX, MISP)
- All share consistent patterns: factory function, manifest with requiredSecrets, TDD test suites
- Ready for Phase 3 Plan 3 (enrichment orchestrator wiring) and Plan 4 (UI integration)

## Self-Check: PASSED

All 4 created files verified present. All 4 task commits verified in git log.

---
*Phase: 03-operational-readiness*
*Completed: 2026-03-22*
