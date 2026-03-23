---
phase: 03-operational-readiness
plan: 03
subsystem: ui
tags: [react, settings, badges, threat-intel, secure-store, plugin-ecosystem]

# Dependency graph
requires:
  - phase: 03-operational-readiness (plans 01, 02)
    provides: Shodan, AbuseIPDB, OTX, MISP plugin implementations with requiredSecrets manifests
provides:
  - PluginSecretsSettings component for generic API key configuration
  - EnrichmentBadges component for finding list source visibility
  - Plugins tab in Settings page
  - Intel column in findings list
affects: [03-04-PLAN, marketplace-ui, finding-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [manifest-driven-form-rendering, source-badge-config-map]

key-files:
  created:
    - apps/workbench/src/components/workbench/settings/plugin-secrets-settings.tsx
    - apps/workbench/src/components/workbench/findings/enrichment-badges.tsx
    - apps/workbench/src/components/workbench/settings/__tests__/plugin-secrets-settings.test.tsx
    - apps/workbench/src/components/workbench/findings/__tests__/enrichment-badges.test.tsx
  modified:
    - apps/workbench/src/components/workbench/settings/settings-page.tsx
    - apps/workbench/src/components/workbench/findings/findings-list.tsx

key-decisions:
  - "Secret store key format: plugin:{pluginId}:{secretKey} for namespace isolation"
  - "Fallback to threatIntelSources contribution name when requiredSecrets is absent"
  - "Brand colors chosen to match each service's actual branding (VT=#394EFF, GN=#28A745, SH=#B80000, AB=#D32F2F, OTX=#00B0A6, MISP=#1A237E)"
  - "Unknown sources get gray (#6f7f9a) badge with first 2 chars uppercase"

patterns-established:
  - "Manifest-driven forms: UI generated from plugin manifest declarations rather than hardcoded"
  - "Source badge config map: centralized color/abbreviation config for extensibility"

requirements-completed: [OPS-01, OPS-06]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 3 Plan 3: Plugin Secrets Settings & Enrichment Badges Summary

**Generic plugin API key settings UI driven by manifest requiredSecrets, and enrichment source badges (VT, GN, SH, AB, OTX, MISP) on finding list rows**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T23:34:28Z
- **Completed:** 2026-03-22T23:40:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PluginSecretsSettings component renders API key forms for each intel plugin, driven by manifest requiredSecrets
- Keys persist to secure store (Stronghold on desktop, ephemeral memory on web) with plugin:{id}: prefix
- EnrichmentBadges component displays compact brand-colored pills indicating which sources enriched each finding
- Both components fully tested with 15 passing tests (8 + 7)

## Task Commits

Each task was committed atomically:

1. **Task 1: Plugin secrets settings UI** (TDD)
   - `caf33a7f9` test(03-03): add failing tests for plugin secrets settings UI
   - `573efdc67` feat(03-03): implement plugin secrets settings UI and add Plugins tab
   - `ac8ad046f` fix(03-03): add type annotation to plugin registry mock for tsc compatibility

2. **Task 2: Enrichment source badges** (TDD)
   - `01049c7c5` test(03-03): add failing tests for enrichment source badges
   - `39688d593` feat(03-03): implement enrichment source badges and add Intel column to findings list

## Files Created/Modified
- `apps/workbench/src/components/workbench/settings/plugin-secrets-settings.tsx` - Generic plugin API key settings component with per-secret password fields, save/change/test-connection flow
- `apps/workbench/src/components/workbench/settings/settings-page.tsx` - Added "Plugins" tab with IconKey to TABS array
- `apps/workbench/src/components/workbench/findings/enrichment-badges.tsx` - Compact source badge pills with brand colors and deduplication
- `apps/workbench/src/components/workbench/findings/findings-list.tsx` - Added "Intel" column with EnrichmentBadges between Confidence and Age
- `apps/workbench/src/components/workbench/settings/__tests__/plugin-secrets-settings.test.tsx` - 8 tests for settings UI
- `apps/workbench/src/components/workbench/findings/__tests__/enrichment-badges.test.tsx` - 7 tests for badge rendering

## Decisions Made
- Secret store key format uses `plugin:{pluginId}:{secretKey}` for namespace isolation from other secure store keys
- When a plugin has no requiredSecrets declared, falls back to deriving an api_key field from threatIntelSources contribution name
- Brand colors match each service's actual branding for instant recognition
- Unknown/custom sources get a generic gray badge with the first 2 characters of the source name uppercased

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type annotation on mock**
- **Found during:** Task 1 (post-implementation verification)
- **Issue:** `vi.fn(() => [])` infers return type as `never[]`, causing tsc errors when passing typed fixtures
- **Fix:** Added explicit `RegisteredPlugin[]` return type annotation to the mock
- **Files modified:** plugin-secrets-settings.test.tsx
- **Verification:** `npx tsc --noEmit` shows no errors in modified files
- **Committed in:** ac8ad046f

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type annotation fix. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Settings UI and badge components complete, ready for Plan 04 (integration testing / end-to-end flow)
- All 6 threat intel plugins (VT, GN, SH, AB, OTX, MISP) now have corresponding badge colors
- Plugin secrets settings will auto-detect any future intel plugins via registry filtering

## Self-Check: PASSED

All 5 created files verified on disk. All 5 commit hashes found in git log.

---
*Phase: 03-operational-readiness*
*Completed: 2026-03-22*
