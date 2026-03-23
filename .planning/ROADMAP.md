# Roadmap: Plugin Developer Experience (v6.0)

## Overview

Build the developer experience layer on top of the complete plugin runtime (v1.0). The journey starts with a testing harness that validates the SDK API surface, then uses those test utilities in a CLI scaffolding tool that gives plugin authors a zero-to-plugin-in-one-command experience. A Vite dev server plugin adds hot reload for the edit-test-debug loop. Documentation captures the stable APIs. Finally, an in-app playground lets authors prototype plugins without leaving the workbench. Each phase delivers a standalone, useful tool; together they form a cohesive plugin authoring experience.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Testing Harness** - Export mock/spy contexts and assertion helpers from `@clawdstrike/plugin-sdk/testing`
- [ ] **Phase 2: CLI Scaffolding** - Create `@clawdstrike/create-plugin` package with 6 template types and interactive prompts
- [ ] **Phase 3: Dev Server** - Build `vite-plugin-clawdstrike` with custom HMR, state preservation, and dev console panel
- [ ] **Phase 4: Documentation** - Add mdBook plugin development guide and TypeDoc API reference
- [ ] **Phase 5: Plugin Playground** - Built-in workbench panel with CodeMirror editor, live preview, and contribution inspector

## Phase Details

### Phase 1: Testing Harness
**Goal**: Plugin authors can unit test their plugins in isolation without running the workbench, using mock and spy contexts that faithfully implement the PluginContext interface
**Depends on**: Nothing (first phase; builds on existing `makeMockContext()` in SDK test file)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. A plugin author can `import { createSpyContext } from "@clawdstrike/plugin-sdk/testing"` in a vitest file, call `plugin.activate(ctx)`, and assert that `ctx.guards.registered` contains the expected guard contributions
  2. `createMockContext()` returns a fully-stubbed PluginContext that satisfies the type checker and does not throw on any API call
  3. `assertContributions(plugin, { guards: 1, commands: 2 })` throws a readable vitest assertion error when the plugin's manifest declares a different contribution count
  4. The `/testing` sub-path import does not pull in main SDK code (tree-shaking verified by bundle size check)
**Plans:** 2 plans
Plans:
- [ ] 01-01-PLAN.md — Core testing module: MockStorageApi, createMockContext, createSpyContext, /testing sub-path export
- [ ] 01-02-PLAN.md — Assertion helpers: assertContributions, assertManifestValid, self-contained manifest validation

### Phase 2: CLI Scaffolding
**Goal**: A plugin author can run one command and get a working, buildable, testable plugin project with type-safe boilerplate for their chosen contribution points
**Depends on**: Phase 1 (generated test files import from `plugin-sdk/testing`)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05, SCAF-06, SCAF-07
**Success Criteria** (what must be TRUE):
  1. Running `npm create @clawdstrike/plugin my-guard --type guard --non-interactive` produces a directory with `package.json`, `src/index.ts`, `tests/plugin.test.ts`, and config files that all pass `npm run build && npm test` without modification
  2. Interactive mode presents prompts for name, display name, publisher, type, and contribution points, then generates a project matching those selections
  3. Each of the 6 template types (guard, detection, ui, intel, compliance, full) generates a project that compiles under TypeScript strict mode and whose tests pass
  4. The generated `src/index.ts` uses `createPlugin()` from the SDK with a properly typed manifest and contribution stubs for the selected plugin type
**Plans:** 3 plans
Plans:
- [ ] 02-01-PLAN.md — Package structure, CLI entry with @clack/prompts, flag parsing, template engine, config file generators
- [ ] 02-02-PLAN.md — Six plugin type templates (guard, detection, ui, intel, compliance, full) and test template with createSpyContext
- [ ] 02-03-PLAN.md — Unit tests for flag parsing and templates, integration test scaffolding all 6 types

### Phase 3: Dev Server
**Goal**: Plugin authors get instant feedback when editing plugin source files -- changes appear in the running workbench within 200ms without losing plugin state or workbench layout
**Depends on**: Phase 2 (dev server loads scaffolded plugin projects)
**Requirements**: DEVS-01, DEVS-02, DEVS-03, DEVS-04, DEVS-05, DEVS-06
**Success Criteria** (what must be TRUE):
  1. With the workbench running in dev mode and `vite-plugin-clawdstrike` active, saving a change to a plugin's `src/index.ts` triggers a reload cycle and the updated contributions appear in the workbench without a full page refresh
  2. Plugin storage state set via `context.storage.set()` before a hot reload is still readable via `context.storage.get()` after the reload completes
  3. The dev console bottom panel shows timestamped lifecycle events (activated, deactivated, error) and console output from the active dev plugin
  4. Changing a shared utility imported by one plugin only reloads that plugin, leaving other loaded plugins untouched
**Plans:** 3 plans
Plans:
- [ ] 03-01-PLAN.md — Vite plugin package: file watching, HMR WebSocket events, per-file plugin ID mapping
- [ ] 03-02-PLAN.md — Client-side HMR handler: deactivate/unregister/reimport/reload cycle, storage state preservation
- [ ] 03-03-PLAN.md — Dev console bottom panel: lifecycle event store, console interceptor, PluginDevConsole component

### Phase 4: Documentation
**Goal**: Plugin authors can learn the entire plugin development lifecycle -- from scaffolding to publishing -- through structured guides and auto-generated API reference
**Depends on**: Phase 1 (testing API must be stable to document), can run in parallel with Phase 3
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05
**Success Criteria** (what must be TRUE):
  1. `mdbook build docs` succeeds and the "Plugin Development" section renders with all listed pages (Getting Started, Manifest, Contribution Points, Testing, Dev Server, Playground, Publishing)
  2. The "Getting Started" guide walks a reader from `npm create @clawdstrike/plugin` through building and loading the plugin in the workbench -- every command in the guide is copy-pasteable and works
  3. `mise run docs:plugin-api` generates TypeDoc output into `docs/book/api/` and the mdBook links to it
  4. CI fails if TypeDoc generation breaks (catches stale JSDoc or missing exports)
**Plans:** 2 plans
Plans:
- [ ] 04-01-PLAN.md — mdBook plugin development guide pages (Getting Started, Manifest, Contribution Points, Testing, Dev Server, Playground, Publishing)
- [ ] 04-02-PLAN.md — TypeDoc API reference generation, mise task, and CI integration

### Phase 5: Plugin Playground
**Goal**: A plugin author can write, run, and debug a plugin entirely within the workbench -- seeing contributions register in real time, errors with source-mapped line numbers, and a tree view of all registered contributions
**Depends on**: Phase 3 (uses same HMR patterns and dev console), Phase 1 (playground needs same mock context patterns for preview isolation)
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07
**Success Criteria** (what must be TRUE):
  1. Opening the "Plugin Dev" activity bar item shows a CodeMirror editor pre-loaded with a `createPlugin()` template, and clicking "Run" causes the plugin's contributions to appear in the workbench
  2. The contribution inspector in the right sidebar shows a tree of all registered contributions (guards, commands, fileTypes) from the playground plugin, updating on each run
  3. When the playground plugin throws during activation, the error boundary displays the stack trace with line numbers that match the CodeMirror editor, and the workbench remains functional
  4. Console output from the playground plugin appears in the bottom panel plugin console with severity icons, and does not leak into the global browser console
  5. Plugin evaluation works in Tauri dev mode without CSP violations (code served from `/__plugin-eval/` route, not blob URLs)
**Plans:** 2 plans
Plans:
- [ ] 05-01-PLAN.md — Core playground infrastructure: store, transpiler, eval server, CodeMirror editor, toolbar, plugin registration
- [ ] 05-02-PLAN.md — Contribution inspector, plugin console panel, error boundary with source-mapped traces

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Testing Harness | 0/2 | Planning complete | - |
| 2. CLI Scaffolding | 0/3 | Planning complete | - |
| 3. Dev Server | 0/3 | Planning complete | - |
| 4. Documentation | 0/2 | Planned | - |
| 5. Plugin Playground | 0/2 | Planning complete | - |
