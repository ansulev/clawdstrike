---
phase: 03-operational-readiness
plan: 01
subsystem: intel
tags: [shodan, abuseipdb, threat-intel, plugin, enrichment, api]

# Dependency graph
requires:
  - phase: 01-enrichment-infrastructure
    provides: ThreatIntelSource interface, EnrichmentResult type, PluginManifest
  - phase: 02-first-plugins
    provides: Pattern for threat intel source plugins (VT, GN reference implementations)
provides:
  - Shodan ThreatIntelSource plugin (IP + domain enrichment)
  - AbuseIPDB ThreatIntelSource plugin (IP abuse scoring)
  - PluginSecretDeclaration type for manifest requiredSecrets field
affects: [03-02, 03-03, 03-04, 04-01, 04-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shodan auth via query parameter (key={apiKey}) not header"
    - "AbuseIPDB auth via Key header (capital K)"
    - "Domain indicator enrichment via DNS resolution then IP enrichment"
    - "PluginSecretDeclaration array in PluginManifest for generic API key forms"

key-files:
  created:
    - apps/workbench/src/lib/plugins/threat-intel/shodan-plugin.ts
    - apps/workbench/src/lib/plugins/threat-intel/abuseipdb-plugin.ts
    - apps/workbench/src/lib/plugins/threat-intel/__tests__/shodan-plugin.test.ts
    - apps/workbench/src/lib/plugins/threat-intel/__tests__/abuseipdb-plugin.test.ts
  modified:
    - packages/sdk/plugin-sdk/src/types.ts
    - packages/sdk/plugin-sdk/src/index.ts
    - apps/workbench/src/lib/plugins/types.ts

key-decisions:
  - "Plugins placed in threat-intel/ directory (not examples/) to match VT/GN pattern"
  - "Added PluginSecretDeclaration type to SDK and workbench PluginManifest (Rule 3: blocking issue)"
  - "Shodan confidence scaling: 0 vulns=0.3, 1-5 vulns=0.5, 6+ vulns=0.7"
  - "AbuseIPDB classification: 0-25=benign, 26-75=suspicious, 76-100=malicious, 0+0reports=unknown"

patterns-established:
  - "requiredSecrets manifest field: plugins declare API key requirements for generic settings UI"
  - "Domain-to-IP resolution pattern: DNS resolve then enrich resolved IP with relatedIndicators linking back"

requirements-completed: [OPS-02, OPS-03]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 3 Plan 1: Shodan and AbuseIPDB Threat Intel Source Plugins Summary

**Shodan IP/domain enrichment with ports/vulns/geo and AbuseIPDB IP abuse scoring with confidence-mapped classification, both following the VT/GN plugin pattern with TDD**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T23:24:04Z
- **Completed:** 2026-03-22T23:31:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Shodan plugin enriches IP indicators with open ports, services, known vulnerabilities, and geolocation
- Shodan plugin enriches domain indicators by resolving DNS to IP, then enriching the resolved IP with relatedIndicators
- AbuseIPDB plugin enriches IP indicators with abuse confidence score, report counts, ISP, and country data
- Both plugins return normalized ThreatVerdict with classification and confidence
- Added PluginSecretDeclaration type to enable generic API key settings UI in 03-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Shodan threat intel source plugin**
   - `f104da770` (test: failing tests for Shodan plugin -- RED)
   - `41534a038` (feat: implement Shodan plugin -- GREEN)
2. **Task 2: AbuseIPDB threat intel source plugin**
   - `b1b9313b1` (test: failing tests for AbuseIPDB plugin -- RED)
   - `7f9e92d7b` (feat: implement AbuseIPDB plugin -- GREEN)

## Files Created/Modified
- `apps/workbench/src/lib/plugins/threat-intel/shodan-plugin.ts` - Shodan ThreatIntelSource with IP/domain enrichment, DNS resolution, health check
- `apps/workbench/src/lib/plugins/threat-intel/abuseipdb-plugin.ts` - AbuseIPDB ThreatIntelSource with abuse scoring, IP-only enrichment, health check
- `apps/workbench/src/lib/plugins/threat-intel/__tests__/shodan-plugin.test.ts` - 26 tests covering manifest, routing, normalization, health check, errors
- `apps/workbench/src/lib/plugins/threat-intel/__tests__/abuseipdb-plugin.test.ts` - 25 tests covering manifest, routing, classification mapping, health check, errors
- `packages/sdk/plugin-sdk/src/types.ts` - Added PluginSecretDeclaration type and requiredSecrets field to PluginManifest
- `packages/sdk/plugin-sdk/src/index.ts` - Export PluginSecretDeclaration
- `apps/workbench/src/lib/plugins/types.ts` - Added PluginSecretDeclaration type and requiredSecrets field to workbench PluginManifest

## Decisions Made
- **Plugin location:** Placed in `threat-intel/` directory to match the established VT/GN pattern, not `examples/` as the plan filename suggested
- **PluginSecretDeclaration type:** Added to both SDK and workbench PluginManifest as a blocking requirement -- the plan requires `requiredSecrets` but the type did not exist
- **Shodan vuln-based classification:** Suspicious if any vulns present, benign otherwise. Confidence scales with vuln count (0=0.3, 1-5=0.5, 6+=0.7)
- **AbuseIPDB score mapping:** 0-25=benign, 26-75=suspicious, 76-100=malicious. Special case: 0 score + 0 reports = unknown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added PluginSecretDeclaration type to PluginManifest**
- **Found during:** Task 1 (Shodan plugin)
- **Issue:** Plan requires `requiredSecrets` field on PluginManifest, but the type did not have this field
- **Fix:** Added `PluginSecretDeclaration` interface and `requiredSecrets?: PluginSecretDeclaration[]` to both SDK and workbench PluginManifest types
- **Files modified:** packages/sdk/plugin-sdk/src/types.ts, packages/sdk/plugin-sdk/src/index.ts, apps/workbench/src/lib/plugins/types.ts
- **Verification:** TypeScript compilation passes, tests reference the field successfully
- **Committed in:** f104da770 (Task 1 RED commit)

**2. [Rule 1 - Bug] Plugin file paths adjusted to match codebase pattern**
- **Found during:** Task 1 (Shodan plugin)
- **Issue:** Plan specifies `examples/shodan-plugin.ts` but existing VT/GN plugins live in `threat-intel/` directory
- **Fix:** Created plugins in `threat-intel/` directory to match established pattern
- **Files modified:** Created in correct directory from start
- **Verification:** Files consistent with VT/GN plugin locations

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. The PluginSecretDeclaration addition enables the 03-03 settings UI plan. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shodan and AbuseIPDB plugins ready for registration via PluginLoader
- PluginSecretDeclaration type enables the 03-03 API key settings UI
- OTX and MISP plugins (03-02) can proceed independently

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 03-operational-readiness*
*Completed: 2026-03-22*
