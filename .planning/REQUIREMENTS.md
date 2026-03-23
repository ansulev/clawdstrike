# Requirements: Plugin Developer Experience (v6.0)

## Overview

Provide the developer tooling layer for the ClawdStrike plugin ecosystem. The runtime infrastructure (PluginManifest, PluginRegistry, PluginLoader, SDK, Marketplace) is complete from v1.0. This milestone builds the experience layer: testing, scaffolding, dev server, documentation, and an in-app playground that make writing, testing, debugging, and shipping plugins fast and pleasant.

## Scope

**v6.0 (this milestone):** Testing harness, CLI scaffolding, Vite dev server with HMR, mdBook + TypeDoc documentation, in-app plugin playground.

**Deferred:** In-app TypeScript language service (full LS in CodeMirror), visual plugin builder (drag-and-drop), plugin dependency resolution, production hot reload.

## Requirements

### TEST: Testing Harness

- **TEST-01**: `@clawdstrike/plugin-sdk` exports a `/testing` sub-path entry point (`import { ... } from "@clawdstrike/plugin-sdk/testing"`) that is tree-shakeable and does not pull in the main SDK bundle
- **TEST-02**: `createMockContext(overrides?)` returns a `PluginContext` with no-op stubs for all APIs (commands, guards, fileTypes, statusBar, sidebar, storage), accepting partial overrides for selective replacement
- **TEST-03**: `createSpyContext(overrides?)` returns a `PluginContext` that records all API calls, exposing `spy.commands.registered`, `spy.guards.registered`, `spy.storage.entries()`, and `spy.subscriptions` for assertion
- **TEST-04**: `MockStorageApi` provides an in-memory `Map`-backed implementation of the `StorageApi` interface with `get()`, `set()`, and `entries()` methods
- **TEST-05**: `assertContributions(plugin, expected)` validates that a plugin's manifest declares the expected contribution type counts (guards, commands, fileTypes, etc.) and throws vitest-compatible assertion errors on mismatch
- **TEST-06**: `assertManifestValid(manifest)` re-exports the workbench's `validateManifest()` logic in a test-friendly wrapper that throws assertion errors with field-level details on invalid manifests

### SCAF: CLI Scaffolding

- **SCAF-01**: `@clawdstrike/create-plugin` is a Node.js package in `packages/cli/create-plugin/` runnable via `npm create @clawdstrike/plugin` or `bun create @clawdstrike/plugin`
- **SCAF-02**: Interactive mode uses `@clack/prompts` to collect plugin name (kebab-case validated), display name, publisher, plugin type, contribution points (multi-select), and package manager preference
- **SCAF-03**: Non-interactive mode accepts `--name`, `--type`, `--contributions`, and `--publisher` flags for CI/scripted usage
- **SCAF-04**: Six plugin type templates are available: `guard`, `detection`, `ui`, `intel`, `compliance`, `full` -- each generating type-appropriate boilerplate with `createPlugin()`, manifest, and contribution stubs
- **SCAF-05**: Every generated project includes a working `tests/plugin.test.ts` that imports `createSpyContext` from `@clawdstrike/plugin-sdk/testing` and asserts on activation behavior
- **SCAF-06**: Generated projects include `package.json` (with `@clawdstrike/plugin-sdk` dependency), `tsconfig.json` (strict, ESM), `tsup.config.ts` (ESM + DTS output), `vitest.config.ts`, and `.gitignore`
- **SCAF-07**: A CI integration test scaffolds a project with each template type, runs `npm install && npm run build && npm test`, and asserts all pass

### DEVS: Dev Server

- **DEVS-01**: `vite-plugin-clawdstrike` is a Vite plugin package in `packages/dev/vite-plugin-clawdstrike/` that watches plugin source directories for changes during `vite dev`
- **DEVS-02**: On plugin file change, the Vite plugin sends a custom HMR WebSocket event (`clawdstrike:plugin-update`) with pluginId, entry path, and timestamp to the workbench frontend
- **DEVS-03**: The client-side HMR handler deactivates the old plugin via `PluginLoader.deactivatePlugin()`, unregisters it from `PluginRegistry`, re-imports the module with cache-busting query param, re-registers the manifest, and re-loads the plugin
- **DEVS-04**: Plugin storage state (`context.storage`) is serialized before deactivation and restored after reactivation so plugin state survives hot reloads
- **DEVS-05**: A dev console bottom panel tab displays plugin lifecycle events (registered, activating, activated, error, deactivated), intercepted console output from plugins, contribution registrations/unregistrations, and timing information
- **DEVS-06**: The Vite plugin tracks per-file plugin ID mappings so changing a shared utility file only reloads the affected plugin, not all plugins in the watch directory

### DOCS: Documentation

- **DOCS-01**: `docs/src/SUMMARY.md` includes a "Plugin Development" section with pages: Getting Started, Plugin Manifest, Contribution Points (with sub-pages for guards, commands, file types, UI extensions, threat intel, compliance), Testing Plugins, Dev Server, Plugin Playground, Publishing
- **DOCS-02**: The "Getting Started" page walks through `npm create @clawdstrike/plugin`, project structure, first build, and loading the plugin in the workbench dev server
- **DOCS-03**: TypeDoc generates API reference from `@clawdstrike/plugin-sdk` source into `docs/book/api/` and is linked from the mdBook plugin section
- **DOCS-04**: A `mise run docs:plugin-api` task generates the TypeDoc output, and CI runs this task to catch broken JSDoc comments
- **DOCS-05**: The "Testing Plugins" page documents `createMockContext()`, `createSpyContext()`, `assertContributions()`, and `assertManifestValid()` with working code examples

### PLAY: Plugin Playground

- **PLAY-01**: A built-in internal plugin contributes an activity bar item ("Plugin Dev"), an editor pane with a CodeMirror editor, a right sidebar panel (contribution inspector), and a bottom panel tab (plugin console)
- **PLAY-02**: The CodeMirror editor uses `@codemirror/lang-javascript` with TypeScript mode enabled and is pre-loaded with a `createPlugin()` template
- **PLAY-03**: A "Run" button transpiles the editor content from TypeScript to JavaScript (using sucrase or equivalent), loads it as a dynamic module via the PluginLoader, and renders its contributions in a live preview area
- **PLAY-04**: The contribution inspector displays a tree view of all contributions registered by the playground plugin (guards, commands, fileTypes, status bar items, sidebar items) and highlights additions/removals on each run
- **PLAY-05**: The plugin console captures `console.log/warn/error` from the playground plugin's execution context via a scoped proxy (not a global override) and displays them with severity filtering and a clear button
- **PLAY-06**: An error boundary wraps the live preview area, displaying stack traces with source-mapped line numbers pointing to the CodeMirror editor when a plugin throws during activation
- **PLAY-07**: Plugin evaluation uses a dev server route (`/__plugin-eval/`) to serve transpiled code from a `'self'` origin, avoiding CSP violations with blob URLs in Tauri

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| TEST-04 | Phase 1 | Complete |
| TEST-05 | Phase 1 | Complete |
| TEST-06 | Phase 1 | Complete |
| SCAF-01 | Phase 2 | Complete |
| SCAF-02 | Phase 2 | Complete |
| SCAF-03 | Phase 2 | Complete |
| SCAF-04 | Phase 2 | Complete |
| SCAF-05 | Phase 2 | Complete |
| SCAF-06 | Phase 2 | Complete |
| SCAF-07 | Phase 2 | Complete |
| DEVS-01 | Phase 3 | Complete |
| DEVS-02 | Phase 3 | Complete |
| DEVS-03 | Phase 3 | Complete |
| DEVS-04 | Phase 3 | Complete |
| DEVS-05 | Phase 3 | Complete |
| DEVS-06 | Phase 3 | Complete |
| DOCS-01 | Phase 4 | Complete |
| DOCS-02 | Phase 4 | Complete |
| DOCS-03 | Phase 4 | Complete |
| DOCS-04 | Phase 4 | Complete |
| DOCS-05 | Phase 4 | Complete |
| PLAY-01 | Phase 5 | Complete |
| PLAY-02 | Phase 5 | Complete |
| PLAY-03 | Phase 5 | Complete |
| PLAY-04 | Phase 5 | Complete |
| PLAY-05 | Phase 5 | Complete |
| PLAY-06 | Phase 5 | Complete |
| PLAY-07 | Phase 5 | Complete |
