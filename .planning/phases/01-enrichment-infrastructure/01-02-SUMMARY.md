---
phase: 01-enrichment-infrastructure
plan: 02
subsystem: api
tags: [typescript, enrichment, orchestrator, rate-limiting, caching, ioc-extraction, token-bucket]

# Dependency graph
requires:
  - phase: 01-enrichment-infrastructure
    provides: ThreatIntelSource, Indicator, EnrichmentResult types, ThreatIntelSourceRegistry
provides:
  - EnrichmentOrchestrator class with per-source token bucket rate limiting and result caching
  - enrichmentOrchestrator singleton instance
  - extractIndicators function for IOC parsing from findings and signals
affects: [01-03-PLAN, phase-2-plugins, phase-2-enrichment-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [token-bucket rate limiting, cache-key composition, Promise.allSettled fan-out, IOC regex extraction, deduplication accumulator]

key-files:
  created:
    - apps/workbench/src/lib/workbench/enrichment-orchestrator.ts
    - apps/workbench/src/lib/workbench/__tests__/enrichment-orchestrator.test.ts
    - apps/workbench/src/lib/workbench/indicator-extractor.ts
    - apps/workbench/src/lib/workbench/__tests__/indicator-extractor.test.ts

key-decisions:
  - "TokenBucket uses simple 60s window refill (not sliding window) matching the maxPerMinute contract"
  - "Cache keyed by sourceId:indicatorType:indicatorValue string tuple, TTL from EnrichmentResult.cacheTtlMs"
  - "Domain extraction limited to typed evidence keys (domain, host, blocked_domain) to reduce false positives from general text scanning"
  - "Hash algorithm detection by hex string length: 32=MD5, 40=SHA-1, 64=SHA-256"

patterns-established:
  - "EnrichmentOrchestrator: Promise.allSettled fan-out with per-source error isolation"
  - "extractIndicators accumulator: Map<string, IndicatorAccumulator> keyed by type:value for dedup with signal ID tracking"

requirements-completed: [FOUND-05, FOUND-08]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 1 Plan 2: EnrichmentOrchestrator and Indicator Extraction Summary

**EnrichmentOrchestrator with per-source token bucket rate limiting, result caching by (sourceId, type, value) tuple, AbortSignal cancellation, and extractIndicators parsing IPs/domains/hashes from guard results with deduplication**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T03:41:06Z
- **Completed:** 2026-03-22T03:49:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built EnrichmentOrchestrator with token bucket rate limiting enforcing maxPerMinute per source
- Result caching by (sourceId, indicatorType, indicatorValue) with configurable TTL from EnrichmentResult.cacheTtlMs
- AbortSignal cancellation and onResult streaming callback for progressive result delivery
- Built extractIndicators that parses IPs from egress violations, domains from evidence keys, hashes with algorithm detection
- Deduplication by (type, value) with signal ID tracking for context linking
- 25 total tests across 2 test files (13 orchestrator, 12 extractor)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build EnrichmentOrchestrator with token bucket rate limiting and caching** - `a0976390e` (feat)
2. **Task 2: Build extractIndicators function with tests** - `cf13d986b` (feat)

_Both tasks followed TDD: tests written first (RED), implementation written (GREEN), no refactoring needed._

## Files Created/Modified
- `apps/workbench/src/lib/workbench/enrichment-orchestrator.ts` - EnrichmentOrchestrator class with TokenBucket, cache, enrich(), clearCache(), clearCacheForSource()
- `apps/workbench/src/lib/workbench/__tests__/enrichment-orchestrator.test.ts` - 13 tests: rate limiting (3), caching (3), orchestration (4), streaming (1), cache management (2)
- `apps/workbench/src/lib/workbench/indicator-extractor.ts` - extractIndicators function with regex-based IOC parsing and deduplication
- `apps/workbench/src/lib/workbench/__tests__/indicator-extractor.test.ts` - 12 tests: IP extraction (2), domain (1), hash (2), passthrough (1), dedup (2), context (2), edge cases (2)

## Decisions Made
- TokenBucket uses simple 60s window refill (full replenishment after elapsed >= 60s) rather than sliding window -- matches the maxPerMinute contract semantics
- Cache keyed by `${sourceId}:${indicator.type}:${indicator.value}` string composition, TTL from each EnrichmentResult.cacheTtlMs
- Domain extraction restricted to typed evidence keys (domain, host, blocked_domain, hostname, target_domain) to minimize false positives from scanning arbitrary text
- Hash algorithm detection by hex string length (32=MD5, 40=SHA-1, 64=SHA-256) with substring dedup to prevent a SHA-256 from also producing false SHA-1/MD5 matches

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Cancel test initially used setTimeout inside mock source with fake timers, causing a 5s timeout. Fixed by testing abort with pre-aborted signal to verify the orchestrator checks signal.aborted before calling source.enrich().

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EnrichmentOrchestrator ready for plugin loader routing (plan 01-03)
- extractIndicators ready for enrichment UI wiring (phase 2)
- enrichmentOrchestrator singleton available for import by bridge hooks
- No blockers for plan 01-03 or phase 2

## Self-Check: PASSED

All 4 created files verified present. Both task commits (a0976390e, cf13d986b) verified in git log.

---
*Phase: 01-enrichment-infrastructure*
*Completed: 2026-03-22*
