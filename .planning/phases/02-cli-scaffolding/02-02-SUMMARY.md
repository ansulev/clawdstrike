---
phase: 02-cli-scaffolding
plan: 02
subsystem: cli
tags: [typescript, templates, scaffolding, createPlugin, plugin-sdk]

requires:
  - phase: 01-testing-harness
    provides: plugin-sdk/testing sub-path with createSpyContext and assertContributions
  - phase: 02-cli-scaffolding
    provides: CLI package structure, template engine, ScaffoldOptions types (Plan 01)

provides:
  - "6 type-specific source templates (guard, detection, ui, intel, compliance, full) generating createPlugin() boilerplate"
  - "Test template with createSpyContext/assertContributions imports and type-specific assertions"
  - "Source router dispatching to correct template by PluginType"

affects: [02-cli-scaffolding, 03-dev-server]

tech-stack:
  added: []
  patterns: ["Template functions return string literals with interpolated ScaffoldOptions values", "Type-specific assertion selection via switch on PluginType"]

key-files:
  created:
    - packages/cli/create-plugin/src/templates/guard.ts
    - packages/cli/create-plugin/src/templates/detection.ts
    - packages/cli/create-plugin/src/templates/ui.ts
    - packages/cli/create-plugin/src/templates/intel.ts
    - packages/cli/create-plugin/src/templates/compliance.ts
    - packages/cli/create-plugin/src/templates/full.ts
    - packages/cli/create-plugin/src/templates/test.ts
  modified:
    - packages/cli/create-plugin/src/templates/source.ts

key-decisions:
  - "Each template generates standalone code with typed const declarations (not inline objects) for readability"
  - "Test template uses getTypeSpecificAssertions() helper to switch assertion lines per plugin type"
  - "Source router uses exhaustive switch with default throw for unknown types"

patterns-established:
  - "Template modules: single export function taking ScaffoldOptions, returning string"
  - "Generated code pattern: typed const declarations at module scope, createPlugin() default export"
  - "Test pattern: describe block with activate/contributions/manifest test cases"

requirements-completed: [SCAF-04, SCAF-05]

duration: 3min
completed: 2026-03-23
---

# Phase 2 Plan 2: Plugin Type Templates Summary

**6 type-specific source templates generating createPlugin() boilerplate with GuardContribution, FileTypeContribution, EditorTabContribution, ThreatIntelSourceContribution, ComplianceFrameworkContribution, and test template using createSpyContext**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T00:40:56Z
- **Completed:** 2026-03-23T00:44:01Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created 6 type-specific source templates each generating a complete src/index.ts with createPlugin(), typed manifest, and contribution registrations in activate()
- Built test template that imports createSpyContext and assertContributions from @clawdstrike/plugin-sdk/testing with type-aware assertion blocks
- Replaced placeholder source.ts with a router that dispatches all 6 plugin types to their dedicated template modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard, detection, and UI source templates** - `63527599e` (feat)
2. **Task 2: Intel, compliance, full templates + test template + source router** - `494ca6e58` (feat)

## Files Created/Modified
- `packages/cli/create-plugin/src/templates/guard.ts` - Guard plugin template with GuardContribution, configFields, configure command
- `packages/cli/create-plugin/src/templates/detection.ts` - Detection plugin template with FileTypeContribution, DetectionAdapterContribution, validate command
- `packages/cli/create-plugin/src/templates/ui.ts` - UI extension template with EditorTabContribution, ActivityBarItemContribution, open command
- `packages/cli/create-plugin/src/templates/intel.ts` - Threat intel template with ThreatIntelSourceContribution, requiredSecrets, lookup command
- `packages/cli/create-plugin/src/templates/compliance.ts` - Compliance template with ComplianceFrameworkContribution, audit command
- `packages/cli/create-plugin/src/templates/full.ts` - Kitchen sink template combining all 6 major contribution types
- `packages/cli/create-plugin/src/templates/test.ts` - Test template with createSpyContext/assertContributions and per-type assertions
- `packages/cli/create-plugin/src/templates/source.ts` - Source router dispatching to type-specific template modules

## Decisions Made
- Each template generates standalone typed const declarations at module scope rather than inline objects in createPlugin() -- improves readability of generated code
- Test template uses a private getTypeSpecificAssertions() helper that switches on plugin type to produce appropriate assertion lines (guards check spy.guards.registered, detection checks spy.fileTypes.registered, etc.)
- Source router throws on unknown plugin type with descriptive error message rather than falling back to a default template

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02-03 can add unit tests for flag parsing and template generation, including integration tests that scaffold all 6 types
- All 6 templates produce TypeScript that compiles under strict mode
- Test template correctly references plugin-sdk/testing imports

## Self-Check: PASSED

All 8 created/modified files verified on disk. Both commits (63527599e, 494ca6e58) found in git history.

---
*Phase: 02-cli-scaffolding*
*Completed: 2026-03-23*
