---
phase: 02-cli-scaffolding
plan: 01
subsystem: cli
tags: [typescript, clack-prompts, scaffolding, cli, esm]

requires:
  - phase: 01-testing-harness
    provides: plugin-sdk/testing sub-path export for generated test templates

provides:
  - "@clawdstrike/create-plugin CLI package with interactive and non-interactive modes"
  - "Template engine for scaffolding plugin project directories"
  - "Config file generators (package.json, tsconfig, tsup, vitest, gitignore)"
  - "Placeholder source/test template generators for Plan 02-02 to replace"

affects: [02-cli-scaffolding, 03-dev-server]

tech-stack:
  added: ["@clack/prompts"]
  patterns: ["kebab-case name validation", "flag parsing with getFlag helper", "template generator functions returning strings"]

key-files:
  created:
    - packages/cli/create-plugin/package.json
    - packages/cli/create-plugin/tsconfig.json
    - packages/cli/create-plugin/tsup.config.ts
    - packages/cli/create-plugin/src/types.ts
    - packages/cli/create-plugin/src/index.ts
    - packages/cli/create-plugin/src/cli.ts
    - packages/cli/create-plugin/src/prompts.ts
    - packages/cli/create-plugin/src/flags.ts
    - packages/cli/create-plugin/src/engine.ts
    - packages/cli/create-plugin/src/templates/config.ts
    - packages/cli/create-plugin/src/templates/source.ts
  modified:
    - package.json

key-decisions:
  - "Used @clack/prompts single type parameter API (select<Value> not select<Options, Value>)"
  - "Placeholder source/test templates generate createPlugin() stub with guards/commands contribution stubs"
  - "Engine uses writeProjectFile helper wrapping fs/promises writeFile for consistent path joining"

patterns-established:
  - "Template generators: pure functions returning string content, no side effects"
  - "Config generators in templates/config.ts, source generators in templates/source.ts"
  - "CLI routing: --non-interactive flag switches between parseFlags() and runInteractivePrompts()"

requirements-completed: [SCAF-01, SCAF-02, SCAF-03, SCAF-06]

duration: 5min
completed: 2026-03-23
---

# Phase 2 Plan 1: CLI Scaffolding Infrastructure Summary

**@clawdstrike/create-plugin CLI with @clack/prompts interactive mode, flag parsing, template engine, and 5 config file generators**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T00:32:48Z
- **Completed:** 2026-03-23T00:37:49Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created @clawdstrike/create-plugin package with full CLI entry point routing --non-interactive to flag parser or interactive prompts
- Built interactive prompts using @clack/prompts collecting name (kebab-case validated), display name, publisher, type (6 options), contributions (multi-select with type defaults), and package manager
- Implemented template engine that creates project directories with package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, .gitignore, src/index.ts, and tests/plugin.test.ts
- Added placeholder source/test template generators ready for Plan 02-02 to replace with type-specific templates

## Task Commits

Each task was committed atomically:

1. **Task 1: Create package structure and CLI entry point** - `d74df839` (feat) -- pre-existing from prior execution
2. **Task 2: Template engine and config file generators** - `5e08c008` (feat)

## Files Created/Modified
- `packages/cli/create-plugin/package.json` - NPM package definition with @clack/prompts dep and bin entry
- `packages/cli/create-plugin/tsconfig.json` - Strict TypeScript config matching plugin-sdk pattern
- `packages/cli/create-plugin/tsup.config.ts` - ESM build with shebang banner
- `packages/cli/create-plugin/src/types.ts` - PluginType, ContributionPoint, ScaffoldOptions, PLUGIN_TYPE_DEFAULTS
- `packages/cli/create-plugin/src/index.ts` - Shebang entry point importing and calling main()
- `packages/cli/create-plugin/src/cli.ts` - CLI router: --non-interactive to flags, otherwise to prompts
- `packages/cli/create-plugin/src/prompts.ts` - Interactive prompts via @clack/prompts with cancel handling
- `packages/cli/create-plugin/src/flags.ts` - parseFlags() with kebab-case validation and sensible defaults
- `packages/cli/create-plugin/src/engine.ts` - scaffoldProject() creating dirs and writing all template files
- `packages/cli/create-plugin/src/templates/config.ts` - 5 config file generators
- `packages/cli/create-plugin/src/templates/source.ts` - Placeholder source/test generators using createPlugin()
- `package.json` - Added packages/cli/create-plugin to workspaces

## Decisions Made
- Used @clack/prompts single-parameter generic API (`select<Value>`) matching the installed v0.11.0 types
- Placeholder source templates generate a working createPlugin() stub with guards/commands contribution stubs so the engine is testable in isolation before Plan 02-02 adds real type-specific templates
- Engine uses a writeProjectFile helper wrapping fs/promises writeFile for consistent path joining

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created engine.ts placeholder for Task 1 tsc verification**
- **Found during:** Task 1 (package structure and CLI entry)
- **Issue:** cli.ts imports scaffoldProject from engine.ts, but the plan placed engine.ts creation in Task 2; tsc would fail without it
- **Fix:** Created a minimal placeholder engine.ts with the scaffoldProject signature throwing "not yet implemented"
- **Files modified:** packages/cli/create-plugin/src/engine.ts
- **Verification:** tsc --noEmit passed with placeholder
- **Committed in:** d74df839 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for Task 1 verification to pass. No scope creep.

## Issues Encountered
- Task 1 files were already committed in a prior execution run (commit d74df839 from a Phase 3 plan that included these files). The files I generated were identical to the committed versions, so no new commit was needed for Task 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02-02 can replace the placeholder source/test templates in templates/source.ts with 6 type-specific templates
- Plan 02-03 can add unit tests for flag parsing and template generation
- The template engine is fully functional and ready to scaffold projects

## Self-Check: PASSED

All 12 created files verified on disk. Both commits (d74df8395, 5e08c0081) found in git history.

---
*Phase: 02-cli-scaffolding*
*Completed: 2026-03-23*
