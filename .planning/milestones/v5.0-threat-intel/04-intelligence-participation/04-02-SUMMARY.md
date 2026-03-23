---
phase: 04-intelligence-participation
plan: 02
subsystem: ui
tags: [abuseipdb, misp, threat-reporting, react, fetch]

requires:
  - phase: 04-intelligence-participation
    provides: ThreatIntelSourceRegistry, EnrichmentOrchestrator, Finding/ExtractedIoc types

provides:
  - reportToAbuseIPDB function with Key header auth to AbuseIPDB v2 API
  - reportToMisp function with Authorization header auth to configurable MISP instance
  - mapIocTypeToMispAttrType for IOC-to-MISP attribute type mapping
  - ReportThreatDialog component with target selection and indicator filtering
  - FindingDetailActions bar with Report to... button for confirmed findings

affects: [finding-detail, enrichment-pipeline, intel-workflow]

tech-stack:
  added: []
  patterns: [bidirectional-threat-reporting, api-key-callback-prop]

key-files:
  created:
    - apps/workbench/src/lib/workbench/threat-reporting.ts
    - apps/workbench/src/lib/workbench/__tests__/threat-reporting.test.ts
    - apps/workbench/src/components/workbench/findings/report-threat-dialog.tsx
    - apps/workbench/src/components/workbench/findings/finding-detail-actions.tsx
  modified: []

key-decisions:
  - "AbuseIPDB Key header auth matches v2 API spec (not Authorization)"
  - "MISP severity mapping: critical/high=1, medium=2, low=3 (MISP threat_level_id)"
  - "getApiKey callback prop defers credential sourcing to caller (SecretsApi wiring)"
  - "AbuseIPDB target filters indicators to IP-type only; MISP shows all types"
  - "FindingDetailActions is a standalone component (not modifying finding-detail.tsx inline)"
  - "Default AbuseIPDB category [21] (Exploited Host) when none selected"

patterns-established:
  - "API key callback prop pattern: getApiKey(service) => Promise<string | null>"
  - "Report dialog filters indicators by target capability"

requirements-completed: [ADV-02]

duration: 5min
completed: 2026-03-22
---

# Phase 4 Plan 2: Bidirectional Threat Reporting Summary

**AbuseIPDB and MISP report-back service with dialog UI, IOC type mapping, and confirmed-finding actions bar**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T23:43:49Z
- **Completed:** 2026-03-22T23:48:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Threat reporting service with AbuseIPDB v2 and MISP REST API integrations
- IOC type mapping covers IP, domain, SHA-256/SHA-1/MD5, URL, and email
- Report Threat dialog with target selection, indicator filtering, category checkboxes, and inline result feedback
- Finding detail actions bar shows "Report to..." button only for confirmed findings
- 19 unit tests with mocked fetch covering success, failure, and mapping paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Threat reporting service (TDD)** - `2a0058e85` (test: RED), `fe20b9b69` (feat: GREEN)
2. **Task 2: Report threat dialog and finding detail actions** - `4cc00f62a` (feat)

_Note: Task 1 followed TDD with RED (failing tests) then GREEN (implementation) commits._

## Files Created/Modified
- `apps/workbench/src/lib/workbench/threat-reporting.ts` - AbuseIPDB and MISP reporting functions with typed payloads and results
- `apps/workbench/src/lib/workbench/__tests__/threat-reporting.test.ts` - 19 tests covering both APIs, error paths, and IOC type mapping
- `apps/workbench/src/components/workbench/findings/report-threat-dialog.tsx` - Modal dialog with target/indicator selection, categories, and result display
- `apps/workbench/src/components/workbench/findings/finding-detail-actions.tsx` - Actions bar with lifecycle buttons and Report to... for confirmed findings

## Decisions Made
- AbuseIPDB uses `Key` header (not `Authorization`) per their v2 API spec
- MISP threat_level_id mapped from severity: critical/high=1, medium=2, low=3
- API key sourcing via `getApiKey(service)` callback prop -- defers to caller for SecretsApi wiring
- AbuseIPDB target filters indicators to IP-type only since AbuseIPDB only accepts IPs
- FindingDetailActions created as standalone component rather than modifying existing finding-detail.tsx actions inline
- Default AbuseIPDB category 21 (Exploited Host) used when no categories are selected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Threat reporting service ready for integration with finding detail view
- getApiKey callback pattern established for downstream SecretsApi wiring
- FindingDetailActions can replace inline action buttons in finding-detail.tsx

## Self-Check: PASSED

All 4 created files verified on disk. All 3 commit hashes verified in git log.

---
*Phase: 04-intelligence-participation*
*Completed: 2026-03-22*
