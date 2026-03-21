---
phase: 04-policy-lab-and-polish
plan: 01
subsystem: ui
tags: [ajv, json-schema, codemirror, yaml, policy-validation, rulesets]

# Dependency graph
requires:
  - phase: 02-shared-components
    provides: Build-time extraction pattern, vitest framework, academy app scaffold
provides:
  - JSON Schema for ClawdStrike policy v1.5.0 with all 13 guard configs
  - CodeMirror lint source with Ajv validation and YAML position mapping
  - Build-time ruleset extraction script producing 10 JSON rulesets + index
  - Typed ruleset data module for component consumption
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: [ajv, ajv-formats, cmdk, pagefind, yaml, "@codemirror/lint"]
  patterns: [JSON Schema validation with Ajv, YAML CST position mapping, build-time data extraction]

key-files:
  created:
    - apps/academy/src/lib/policy-schema.ts
    - apps/academy/src/lib/policy-linter.ts
    - apps/academy/scripts/extract-rulesets.ts
    - apps/academy/src/lib/ruleset-data.ts
    - apps/academy/src/lib/__tests__/policy-linter.test.ts
    - apps/academy/src/lib/__tests__/ruleset-extraction.test.ts
  modified:
    - apps/academy/package.json
    - .gitignore

key-decisions:
  - "Ajv draft-07 (definitions) instead of draft-2020-12 ($defs) for Ajv v8 compatibility"
  - "validatePolicyYaml exported as testable function separate from CodeMirror linter wrapper"
  - "Ruleset JSON files gitignored as build artifacts (same pattern as extracted-sources)"

patterns-established:
  - "YAML position mapping via yaml library CST nodes for error source location"
  - "Build script chaining in prebuild: extraction scripts run before next build/dev"

requirements-completed: [POLI-01, POLI-02, POLI-04]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 4 Plan 1: Schema, Linter, and Ruleset Extraction Summary

**Policy v1.5.0 JSON Schema with 20 additionalProperties:false guards, Ajv CodeMirror linter with YAML CST position mapping, and build-time extraction of 10 rulesets to static JSON**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T12:55:27Z
- **Completed:** 2026-03-21T13:02:42Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- JSON Schema covering all 13 guard configs with additionalProperties:false (matching Rust deny_unknown_fields)
- CodeMirror lint source that validates YAML against the schema via Ajv and maps errors to YAML source positions
- Build-time extraction of all 10 built-in YAML rulesets to static JSON with inheritance index
- Typed ruleset-data module providing RULESET_NAMES, rulesets record, and rulesetIndex for component consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, JSON Schema, policy linter with Ajv + YAML position mapping** - `7c85d0c73` (feat)
2. **Task 2: Build-time ruleset extraction script and ruleset data module** - `0e7e7323c` (feat)

## Files Created/Modified
- `apps/academy/src/lib/policy-schema.ts` - JSON Schema for ClawdStrike policy v1.5.0 (20 object definitions with additionalProperties:false)
- `apps/academy/src/lib/policy-linter.ts` - CodeMirror lint source, YAML position mapper, Ajv error formatter
- `apps/academy/scripts/extract-rulesets.ts` - Build script converting 10 YAML rulesets to static JSON
- `apps/academy/src/lib/ruleset-data.ts` - Typed module re-exporting parsed rulesets and index
- `apps/academy/src/lib/__tests__/policy-linter.test.ts` - 8 tests for schema validation and position mapping
- `apps/academy/src/lib/__tests__/ruleset-extraction.test.ts` - 6 tests for extraction output and data module
- `apps/academy/package.json` - Prebuild script chains ruleset extraction; new deps already present
- `.gitignore` - Added src/data/rulesets/*.json as build artifacts

## Decisions Made
- Used Ajv draft-07 (`definitions`) instead of draft-2020-12 (`$defs`) because Ajv v8 defaults to draft-07 schema dialect
- Exported `validatePolicyYaml` as a standalone testable function in addition to the CodeMirror linter wrapper, enabling unit tests without EditorView
- Gitignored ruleset JSON files as build artifacts, following the same pattern established for extracted-sources in Phase 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched from $defs to definitions for Ajv v8 compatibility**
- **Found during:** Task 1 (JSON Schema compilation)
- **Issue:** Ajv v8 defaults to draft-07 which uses `definitions`, not `$defs` (draft-2020-12)
- **Fix:** Replaced all `$defs` references with `definitions` in the schema
- **Files modified:** apps/academy/src/lib/policy-schema.ts
- **Verification:** All 8 tests pass after fix
- **Committed in:** 7c85d0c73 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for Ajv compatibility. No scope creep.

## Issues Encountered
None beyond the $defs fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema and linter ready for PolicyEditor component (04-03)
- Extracted rulesets ready for InheritanceTree and RulesetComparison (04-03)
- Dependencies installed for search (cmdk, pagefind) needed by 04-02

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (7c85d0c73, 0e7e7323c) verified in git log.

---
*Phase: 04-policy-lab-and-polish*
*Completed: 2026-03-21*
