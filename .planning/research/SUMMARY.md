# Research Summary: Plugin Developer Experience

**Domain:** Developer tooling for the ClawdStrike plugin ecosystem
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Executive Summary

The ClawdStrike plugin ecosystem v1 milestone is 100% complete, providing PluginManifest types, PluginRegistry, PluginLoader with Ed25519 trust verification, `@clawdstrike/plugin-sdk` with `createPlugin()`, and Marketplace UI. The missing layer is developer experience tooling: scaffolding, dev server, testing, playground, and documentation.

The codebase already contains strong foundations to build on. The SDK test file includes a working `makeMockContext()` that needs promotion to a public API. The workbench runs on Vite 6 with React 19 and CodeMirror 6, providing the infrastructure for both hot-reload dev mode and an in-app plugin playground. The existing `hush pkg init` scaffolding in Rust generates guard/policy packages, but workbench plugins are TypeScript projects requiring a Node.js scaffolding tool.

The recommended approach is to build five packages/features in order: (1) testing harness as an SDK sub-export, (2) CLI scaffolding as `@clawdstrike/create-plugin`, (3) Vite dev plugin for hot reload, (4) mdBook + TypeDoc documentation, (5) built-in plugin playground panel. This ordering respects dependencies: generated test files import from the testing harness, the dev server builds on scaffold output, and the playground depends on all other pieces.

## Key Findings

**Stack:** Node.js for CLI scaffolding (`@clawdstrike/create-plugin`), Vite plugin for dev server, vitest for testing, mdBook + TypeDoc for docs
**Architecture:** Five new packages/features integrated into the existing workspace; playground is an internal workbench plugin
**Critical pitfall:** Workbench CSP (`script-src 'self' 'wasm-unsafe-eval'`) blocks blob URL imports -- the plugin playground must use a dev server route, not client-side eval

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Testing Harness** - Promote `makeMockContext()` to `@clawdstrike/plugin-sdk/testing` with spy context, assertion helpers
   - Addresses: Plugin authors need to test without full workbench
   - Avoids: SDK type drift pitfall (add CI guardrail in this phase)

2. **CLI Scaffolding** - `@clawdstrike/create-plugin` with type-specific templates (guard, detection, ui, intel, compliance, full)
   - Addresses: Zero-to-plugin experience, consistent project structure
   - Avoids: Template drift pitfall (generate from SDK types)

3. **Dev Server** - `vite-plugin-clawdstrike` with custom HMR for plugin hot reload + dev console panel
   - Addresses: Edit-reload-test loop, plugin debugging
   - Avoids: React state loss pitfall (use StorageApi for persistence)

4. **Documentation** - mdBook plugin dev guide section + TypeDoc API reference
   - Addresses: API discoverability, onboarding, contribution point reference
   - Avoids: No pitfalls; straightforward integration with existing docs

5. **Plugin Playground** - Built-in workbench panel with CodeMirror editor, live preview, contribution inspector
   - Addresses: Interactive plugin prototyping, no separate toolchain needed
   - Avoids: CSP pitfall (use dev server route not blob URL)

**Phase ordering rationale:**
- Testing harness is prerequisite for scaffolding (generated tests import from it)
- CLI scaffolding is prerequisite for dev server (dev server loads scaffolded projects)
- Documentation can run in parallel with dev server once APIs stabilize
- Playground is the capstone, requiring all other pieces to be functional

**Research flags for phases:**
- Phase 3 (Dev Server): Needs validation of Vite custom HMR approach with PluginLoader lifecycle
- Phase 5 (Playground): Needs CSP experimentation and client-side TS transform strategy validation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools observed in codebase or well-established |
| Features | HIGH | Built on existing SDK, loader, registry APIs |
| Architecture | HIGH | Package locations, dependency graph derived from workspace analysis |
| Pitfalls | HIGH (CSP, type drift), MEDIUM (HMR state) | CSP is observable in tauri.conf.json; HMR state loss is a known Vite pattern |

## Gaps to Address

- Client-side TypeScript transform strategy for playground (sucrase vs esbuild-wasm vs Vite dev route) needs implementation validation
- CSP modification scope for playground blob URLs needs security review
- Whether `@clack/prompts` or `inquirer` is better for create-plugin prompts (preference, not critical)
- Plugin dev server integration with Tauri dev mode (`tauri dev` vs `vite dev` alone)
