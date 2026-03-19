# Plugin Developer Experience Research

**Domain:** Developer tooling for the ClawdStrike plugin ecosystem
**Researched:** 2026-03-18
**Overall confidence:** HIGH (based on codebase analysis) / MEDIUM (external patterns from training data)

## Executive Summary

ClawdStrike's plugin ecosystem (v1 milestone, 100% complete) provides the runtime infrastructure: PluginManifest types, PluginRegistry, PluginLoader with trust verification, `@clawdstrike/plugin-sdk` with `createPlugin()`, and Marketplace UI. What is missing is the **developer experience layer** -- the tooling that makes writing, testing, debugging, and documenting plugins fast and pleasant.

This research examines six areas: CLI scaffolding, dev server with hot reload, mock testing harness, plugin playground, documentation generation, and integration with the existing toolchain. The key findings are:

1. **CLI scaffolding should be a Node.js package** (`@clawdstrike/create-plugin`), not a Rust command in `hush-cli`. The existing `hush pkg init` scaffolds Rust/WASM guard packages -- workbench plugins are TypeScript/React and belong in a Node toolchain. Use `npm create @clawdstrike/plugin` (or `bun create`).

2. **Dev server should leverage Vite's existing watch mode** with a custom Vite plugin that handles plugin-specific HMR. The workbench already runs on Vite (port 1421) with `@vitejs/plugin-react`. A `vite-plugin-clawdstrike-dev` can intercept HMR updates for plugin entry points, deactivate the old plugin via the PluginLoader, and reactivate the new one.

3. **Testing harness already has a prototype** in the SDK test file (`makeMockContext()`). This should be promoted to an exported `@clawdstrike/plugin-sdk/testing` entry point with a richer mock context, assertion helpers, and vitest integration.

4. **Plugin playground should be a built-in workbench panel** (not a separate app). It should use the existing CodeMirror infrastructure (already in `apps/workbench` dependencies) with TypeScript language support, and the existing PluginLoader to evaluate plugin code in real-time.

5. **Documentation should use mdBook** (already the project standard, `docs/book.toml`), with a dedicated "Plugin Development" section. TypeDoc for API reference is appropriate but should be built as a separate artifact linked from the mdBook.

6. **The workbench Tauri backend has `tauri-plugin-fs`** with read/write permissions but no file watcher. For dev mode file watching, Vite's built-in chokidar watcher is sufficient since plugin dev happens during `vite dev` mode.

## 1. CLI Scaffolding

### Current State

Two scaffolding commands exist in the codebase:

| Command | Language | Generates | Package |
|---------|----------|-----------|---------|
| `hush init` | Rust (dialoguer prompts) | `.clawdstrike/policy.yaml`, `config.toml`, keys | `hush-cli` |
| `hush pkg init --pkg-type guard --name <name>` | Rust | `Cargo.toml`, `src/lib.rs`, `clawdstrike-pkg.toml`, tests, `.cargo/config.toml` | `hush-cli` |

Both scaffold **Rust/WASM** artifacts. Workbench plugins are **TypeScript/React** projects that need:
- `package.json` with `@clawdstrike/plugin-sdk` dependency
- `tsconfig.json` with appropriate module settings
- `src/index.ts` with `createPlugin()` boilerplate
- `manifest.json` matching `PluginManifest` schema
- `vitest.config.ts` for testing
- `tsup.config.ts` for building
- `.gitignore`

### Recommendation: `@clawdstrike/create-plugin` Node Package

**Why Node.js, not Rust:**
- Plugin authors are TypeScript developers -- they have Node/Bun, not necessarily Rust
- Template interpolation in TypeScript is trivial (template literals); in Rust it requires templating crates
- `npm create` / `bun create` is the standard DX for scaffolding JS/TS projects
- The plugin SDK is already a Node package (`@clawdstrike/plugin-sdk`)
- Avoids bloating `hush-cli` with TS template strings

**Package location:** `packages/cli/create-plugin/` (new directory)

**CLI interface:**

```bash
# Interactive mode (prompts for name, type, contribution points)
npm create @clawdstrike/plugin

# Non-interactive mode
npm create @clawdstrike/plugin my-guard-plugin --type guard --contributions guards,commands

# Bun alternative
bun create @clawdstrike/plugin my-guard-plugin
```

**Plugin type templates:**

| Type | Template Contents | Use Case |
|------|-------------------|----------|
| `guard` | Guard contribution, config fields, policy eval stub | Custom security guard |
| `detection` | File type + detection adapter contributions | Custom detection format |
| `ui` | Activity bar item, editor tab, panel | UI extension |
| `intel` | Threat intel source contribution | Threat feed integration |
| `compliance` | Compliance framework contribution | Compliance mapping |
| `full` | All contribution points, kitchen sink | Reference/learning |

**Generated project structure (guard type):**

```
my-guard-plugin/
  package.json            # name, version, @clawdstrike/plugin-sdk dep
  tsconfig.json           # strict, ESM, bundler module resolution
  tsup.config.ts          # ESM + CJS + DTS output
  vitest.config.ts        # node environment, tests/**/*.test.ts
  manifest.json           # PluginManifest (also embedded in src/index.ts)
  src/
    index.ts              # createPlugin({ manifest, activate, deactivate })
    guard.ts              # Guard config fields and evaluate stub
  tests/
    plugin.test.ts        # Uses createMockContext() from SDK
  .gitignore
  README.md
```

**Interactive prompts (using `@clack/prompts`):**

1. Plugin name (kebab-case, validated)
2. Display name (human-readable)
3. Publisher (defaults to npm whoami or git user.name)
4. Plugin type (guard / detection / ui / intel / compliance / full)
5. Contribution points (multi-select, filtered by type)
6. Package manager (npm / bun -- auto-detect)

**Confidence:** HIGH. The pattern is well-established (`create-react-app`, `create-vite`, `create-next-app`, VS Code's `yo code`). The ClawdStrike-specific twist is that templates embed `PluginManifest` objects and use security-domain contribution points.

### VS Code Generator Patterns to Adopt

VS Code uses Yeoman (`yo code`) with these key DX choices:

1. **Type-specific generators**: Different templates for extensions, color themes, language packs, etc. ClawdStrike should do the same (guard, detection, ui, intel, compliance).

2. **Inline manifest in code**: VS Code puts `package.json` contribution points alongside code. ClawdStrike's `createPlugin()` already does this -- the manifest is inline in `src/index.ts`, which is better than a separate `manifest.json` that can drift.

3. **Test scaffolding included**: Every generated project includes a test file with a working test. The `makeMockContext()` pattern from the SDK test file is the right foundation.

4. **Launch configuration**: VS Code generators include `.vscode/launch.json` for debugging. ClawdStrike should include a `dev` script in `package.json` that connects to the workbench dev server.

### What to Skip from yo code

- Yeoman itself (heavy, dated). Use `@clack/prompts` for interactive prompts -- lighter, better DX.
- Git init (let the user do it).
- Extensive boilerplate comments (keep it minimal -- the SDK types provide the documentation).

---

## 2. Plugin Dev Server

### Current State

The workbench runs Vite on port 1421 (`apps/workbench/vite.config.ts`) with:
- `@vitejs/plugin-react` for React 19 HMR
- Chokidar file watching (Vite built-in, ignores `src-tauri/`)
- Proxy rules for hushd and control API
- Manual chunks for CodeMirror and UI vendor bundles
- Source maps in debug mode

The PluginLoader (`apps/workbench/src/lib/plugins/plugin-loader.ts`) uses dynamic `import()` to resolve plugin modules:

```typescript
resolveModule: async (m: PluginManifest) => {
  return import(/* @vite-ignore */ m.main) as Promise<PluginModule>;
}
```

### Recommendation: Vite Plugin for Plugin Dev Mode

**Architecture:**

```
Plugin source (.ts)
  --> Vite watch (chokidar)
  --> vite-plugin-clawdstrike-dev intercepts HMR update
  --> PluginLoader.deactivatePlugin(id)
  --> Dynamic import() with cache-busting query param
  --> PluginLoader.loadPlugin(id)
  --> Contributions re-registered, activate() called
```

**Implementation: `vite-plugin-clawdstrike-dev`**

A Vite plugin that:

1. **Watches a `plugins/` directory** (or directories specified in config) for `.ts` files with `createPlugin()` exports.

2. **On file change**, sends a custom HMR message to the workbench frontend:
   ```typescript
   server.ws.send({
     type: 'custom',
     event: 'clawdstrike:plugin-update',
     data: { pluginId, entryPath, timestamp }
   });
   ```

3. **Frontend handler** receives the message and:
   - Calls `pluginLoader.deactivatePlugin(pluginId)` to clean up old contributions
   - Calls `pluginRegistry.unregister(pluginId)` to clear registry state
   - Re-imports the module with `?t=${timestamp}` query param (Vite cache busting)
   - Re-registers the manifest and re-loads the plugin

4. **State preservation** via the `StorageApi`:
   - Before deactivation, serialize `context.storage` to a temporary store
   - After reactivation, restore the storage contents
   - Plugin state (collapsed panels, scroll positions, etc.) survives reloads

**Where to put it:**

- `packages/dev/vite-plugin-clawdstrike/` -- standalone Vite plugin package
- Added to workbench's `vite.config.ts` devDependencies, enabled only in dev mode

**Dev console panel:**

A bottom panel tab (contributed by an internal dev plugin) showing:
- Plugin lifecycle events (registered, activating, activated, error, deactivated)
- Console.log/warn/error output from plugins (intercepted via a proxy)
- Contribution point registrations/unregistrations
- Activation event triggers
- Timing information (load time, activation time)

This is a new contribution to the bottom panel, using the existing `BottomPanelTabContribution` pattern.

**File watching via Tauri:**

The Tauri backend has `tauri-plugin-fs` but no built-in file watcher. For dev mode, this is unnecessary because Vite's chokidar watcher handles file changes. For production plugin loading from disk, `tauri-plugin-fs` can use `readTextFile` to load manifests. If persistent file watching is needed later, add `tauri-plugin-fs-watch` (the Tauri v2 plugin for filesystem watching via `notify`).

**Confidence:** HIGH. Vite custom HMR is well-documented and this is the standard approach for framework dev tools (Astro, SvelteKit, Nuxt all use custom Vite plugins for similar hot-reload patterns).

---

## 3. Mock Workbench Context (Testing Harness)

### Current State

The SDK test file (`packages/sdk/plugin-sdk/tests/create-plugin.test.ts`) already contains a `makeMockContext()` helper:

```typescript
function makeMockContext(overrides?: Partial<PluginContext>): PluginContext {
  const storage = new Map<string, unknown>();
  return {
    pluginId: "test.plugin",
    subscriptions: [],
    commands: {
      register: (_cmd, _handler): Disposable => () => {},
    },
    guards: {
      register: (_guard): Disposable => () => {},
    },
    fileTypes: {
      register: (_ft): Disposable => () => {},
    },
    statusBar: {
      register: (_item): Disposable => () => {},
    },
    sidebar: {
      register: (_item): Disposable => () => {},
    },
    storage: {
      get: (key) => storage.get(key),
      set: (key, value) => { storage.set(key, value); },
    },
    ...overrides,
  };
}
```

This is an internal test helper, not exported from the SDK.

### Recommendation: `@clawdstrike/plugin-sdk/testing` Entry Point

**Export from the SDK package** via a secondary entry point:

```json
// package.json exports
{
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./testing": { "types": "./dist/testing.d.ts", "import": "./dist/testing.js" }
}
```

**API surface:**

```typescript
import {
  createMockContext,
  createSpyContext,
  MockGuardRegistry,
  MockCommandRegistry,
  MockStorageApi,
  assertContributions,
} from "@clawdstrike/plugin-sdk/testing";
```

**`createMockContext(overrides?)`** -- No-op stubs for all APIs. Returns call counts and last-registered values for assertions.

**`createSpyContext(overrides?)`** -- Like mock but records all calls. Provides:
- `spy.commands.registered` -- array of all registered commands
- `spy.guards.registered` -- array of all registered guards
- `spy.storage.entries()` -- Map snapshot of storage
- `spy.subscriptions` -- array of disposables pushed

**`MockGuardRegistry`** -- An in-memory guard registry that tracks registrations without depending on workbench internals. Useful for testing guard plugins in isolation:

```typescript
const registry = new MockGuardRegistry();
const ctx = createSpyContext();
const plugin = createPlugin({ ... });
plugin.activate(ctx);
expect(ctx.guards.registered).toHaveLength(1);
expect(ctx.guards.registered[0].id).toBe("my.guard");
```

**`assertContributions(plugin, expected)`** -- Validates that a plugin's manifest declares the expected contribution types:

```typescript
assertContributions(myPlugin, {
  guards: 1,
  commands: 2,
  fileTypes: 0,
});
```

**`assertManifestValid(manifest)`** -- Re-exports the workbench's `validateManifest()` in a test-friendly wrapper that throws vitest-compatible assertion errors.

**Vitest integration:**

The SDK already uses vitest 4.x. The testing module should integrate with vitest's expect API for clear error messages. No custom test runner needed -- vitest's standard `describe/it/expect` pattern is sufficient.

**Example plugin test (generated by scaffolding):**

```typescript
import { describe, it, expect } from "vitest";
import { createSpyContext, assertContributions } from "@clawdstrike/plugin-sdk/testing";
import plugin from "../src/index";

describe("MyGuardPlugin", () => {
  it("has valid manifest", () => {
    expect(plugin.manifest.id).toBe("com.example.my-guard");
    expect(plugin.manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("registers one guard on activate", () => {
    const ctx = createSpyContext({ pluginId: plugin.manifest.id });
    plugin.activate(ctx);
    expect(ctx.guards.registered).toHaveLength(1);
    expect(ctx.guards.registered[0].category).toBe("network");
  });

  it("cleans up on deactivate", () => {
    const ctx = createSpyContext({ pluginId: plugin.manifest.id });
    const disposables = plugin.activate(ctx);
    // deactivate should not throw
    plugin.deactivate?.();
  });
});
```

**Confidence:** HIGH. This is a straightforward extraction of existing test patterns into a public API. The `makeMockContext()` function already works; it just needs to be promoted and enriched.

---

## 4. Plugin Playground

### Current State

The workbench already has:
- CodeMirror 6 with YAML, JSON, JavaScript, Python language support
- A pane system (binary tree layout from the workbench-dev milestone)
- Bottom panel tabs
- Activity bar items
- The PluginLoader can load plugins from arbitrary module paths

### Recommendation: Built-in "Plugin Dev" Panel

**Architecture:**

The playground is itself a plugin (meta!) -- an internal plugin that contributes:
- An activity bar item: "Plugin Dev" (icon: code brackets)
- An editor tab: CodeMirror editor with TypeScript language support
- A right sidebar panel: Live contribution inspector
- A bottom panel tab: Plugin console (logs, errors, events)

**Components:**

1. **Plugin Editor Pane**
   - CodeMirror 6 editor with `@codemirror/lang-javascript` (already in workbench deps)
   - TypeScript mode enabled via `@codemirror/lang-javascript`'s `javascript({ typescript: true })`
   - Pre-loaded template using `createPlugin()` boilerplate
   - Auto-save to `localStorage` or plugin storage
   - "Run" button that evaluates the plugin

2. **Live Preview Panel**
   - Shows the plugin's contributed views (guard config UI, status bar items, etc.)
   - Updates on each "Run" (not on every keystroke -- plugin evaluation can throw)
   - Error boundary around the preview with stack trace display
   - Source-mapped errors pointing to the CodeMirror editor line

3. **Contribution Inspector (Right Sidebar)**
   - Tree view of all registered contributions from the dev plugin
   - Shows guard metadata, command registrations, file type registrations
   - Highlights new/changed/removed contributions on each reload
   - Similar to Chrome DevTools' "Elements" panel but for plugin contributions

4. **Plugin Console (Bottom Panel)**
   - Captures `console.log/warn/error` from the plugin's execution context
   - Shows lifecycle events (activate called, contributions registered, errors)
   - Filter by severity (info, warn, error)
   - Clear button

**Evaluation strategy:**

The playground should NOT use `eval()` or `new Function()`. Instead:

1. Plugin code is written in the editor
2. On "Run", the code is bundled client-side using a lightweight bundler (esbuild-wasm or sucrase for transform-only)
3. The bundled code is turned into a Blob URL: `URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))`
4. Dynamic `import(blobUrl)` loads the module
5. The PluginLoader loads it via a custom `resolveModule` that returns the blob-imported module

This avoids CSP issues (`'wasm-unsafe-eval'` is already allowed in the workbench CSP) and provides proper module semantics.

**Why not a separate app:**

- Plugin authors need to see their contributions **in context** -- a guard config panel needs the real guard config UI, status bar items need the real status bar
- Reuses all existing workbench infrastructure
- No additional build/deploy pipeline
- VS Code does this with its "Extension Development Host" (a second window of the editor)

**Dependencies to add:**

- `@codemirror/lang-javascript` is already in `apps/workbench/package.json`
- May need `sucrase` (~200KB) for TypeScript stripping if not already available
- No esbuild-wasm needed if we use `sucrase` for TS->JS transform only

**Confidence:** MEDIUM. The architecture is sound but the client-side evaluation strategy (blob URLs + dynamic import) has CSP considerations. The workbench CSP allows `'wasm-unsafe-eval'` but not `blob:` in the script-src. This will need a CSP adjustment: adding `blob:` to `script-src` or using a different evaluation approach (e.g., `@vite-ignore` dynamic import of a local dev server URL). This is a known solvable problem but needs implementation validation.

---

## 5. Plugin Documentation

### Current State

The project uses mdBook for documentation:
- `docs/book.toml` -- configured with navy theme, GitHub edit links
- `docs/src/SUMMARY.md` -- organized into Getting Started, Concepts, Guides, CLI, Package Manager sections
- No "Plugin Development" section exists yet

The TypeScript packages use JSDoc-style comments (visible in the SDK source files).

### Recommendation: mdBook + TypeDoc

**1. mdBook: Plugin Development Guide Section**

Add to `docs/src/SUMMARY.md`:

```markdown
# Plugin Development

- [Getting Started](plugins/getting-started.md)
- [Plugin Manifest](plugins/manifest.md)
- [Contribution Points](plugins/contribution-points.md)
  - [Guards](plugins/guards.md)
  - [Commands](plugins/commands.md)
  - [File Types](plugins/file-types.md)
  - [UI Extensions](plugins/ui-extensions.md)
  - [Threat Intel](plugins/threat-intel.md)
  - [Compliance](plugins/compliance.md)
- [Testing Plugins](plugins/testing.md)
- [Dev Server](plugins/dev-server.md)
- [Plugin Playground](plugins/playground.md)
- [Publishing](plugins/publishing.md)
- [API Reference](plugins/api-reference.md)
```

**Key pages:**

| Page | Content |
|------|---------|
| Getting Started | `npm create @clawdstrike/plugin`, project structure, first build |
| Plugin Manifest | All `PluginManifest` fields explained with examples |
| Contribution Points | Overview of all 12 contribution point types |
| Guards | Deep dive: guard contribution, config fields, policy YAML mapping |
| Testing | `createMockContext()`, `createSpyContext()`, vitest patterns |
| Publishing | `hush pkg pack`, `hush pkg publish`, trust verification, signing |

**2. TypeDoc: API Reference**

Generate TypeDoc from `@clawdstrike/plugin-sdk` source:

```bash
npx typedoc --entryPoints packages/sdk/plugin-sdk/src/index.ts \
  --out docs/book/api \
  --theme default \
  --readme none
```

Link from mdBook: `[API Reference](/api/index.html)` (served as a sub-directory of the mdBook output).

Add a mise task:

```toml
[tasks."docs:plugin-api"]
description = "Generate TypeDoc API reference for plugin SDK"
run = "npx typedoc --entryPoints packages/sdk/plugin-sdk/src/index.ts --out docs/book/api --readme none"
```

**3. In-App Documentation (future)**

For the plugin playground, embed inline documentation using CodeMirror tooltips. When hovering over SDK types, show JSDoc descriptions. This requires TypeScript language service integration in CodeMirror (available via `@valtown/codemirror-ts` or similar). Defer this to a later phase.

**What NOT to use:**

- **Docusaurus** -- Adds a React app build pipeline for docs. mdBook is already established and lightweight.
- **Storybook** -- Overkill for plugin documentation. The plugin playground serves this role.
- **VitePress** -- Good for Vue ecosystems, not a natural fit here.

**Confidence:** HIGH. mdBook is already the project standard. TypeDoc is the standard for TypeScript API docs.

---

## 6. Existing Toolchain Integration

### Build Tools Already Available

| Tool | Version | Where | Purpose |
|------|---------|-------|---------|
| Vite | 6.x | `apps/workbench/` | Dev server + bundler |
| tsup | 8.5.x | `packages/sdk/plugin-sdk/` | Library bundler (ESM + CJS + DTS) |
| vitest | 4.x | `apps/workbench/`, SDK | Test runner |
| TypeScript | 5.x | Everywhere | Type checking |
| Biome | 2.4.x | Root `package.json` | Formatting |
| mise | Root `mise.toml` | Task runner |
| Bun | Workbench uses `bun install` | Package management |
| Node | 24 (mise.toml) | Runtime |

### Workspace Setup

Root `package.json` declares workspace members:
```json
"workspaces": [
  "packages/sdk/plugin-sdk",
  "apps/workbench",
  // ... 20+ packages
]
```

New packages should be added here. The workspace uses npm/bun workspace protocol.

### Task Runner (mise)

Add plugin dev tasks to `mise.toml`:

```toml
[tasks."plugin:create"]
description = "Scaffold a new plugin project"
run = "npm create @clawdstrike/plugin"

[tasks."plugin:dev"]
description = "Start workbench in plugin dev mode"
run = "cd apps/workbench && CLAWDSTRIKE_PLUGIN_DEV=1 bun run dev"

[tasks."docs:plugin-api"]
description = "Generate TypeDoc API reference for plugin SDK"
run = "npx typedoc --entryPoints packages/sdk/plugin-sdk/src/index.ts --out docs/book/api --readme none"
```

### CI Integration

The existing CI runs `mise run ci` which includes:
- `cargo fmt --all -- --check`
- `cargo clippy --workspace -- -D warnings`
- `cargo test --workspace`
- Workbench typecheck, test, build
- Architecture guardrails

New CI additions:
- `npm test --workspace=packages/sdk/plugin-sdk` (already works)
- `npm test --workspace=packages/cli/create-plugin` (new)
- `npm test --workspace=packages/dev/vite-plugin-clawdstrike` (new)
- TypeDoc build (to catch broken JSDoc)

**Confidence:** HIGH. Direct observation of existing toolchain.

---

## 7. Architecture Recommendation

### Package Structure

```
packages/
  cli/
    create-plugin/              # npm create @clawdstrike/plugin
      src/
        index.ts                # CLI entry point
        prompts.ts              # Interactive prompts (@clack/prompts)
        templates/              # Template files per plugin type
          guard/
            package.json.tmpl
            src/index.ts.tmpl
            tests/plugin.test.ts.tmpl
            tsconfig.json.tmpl
            tsup.config.ts.tmpl
            vitest.config.ts.tmpl
          detection/
          ui/
          intel/
          compliance/
          full/
      package.json
      tsconfig.json
  dev/
    vite-plugin-clawdstrike/    # Vite plugin for plugin HMR
      src/
        index.ts                # Plugin factory
        hmr-handler.ts          # Client-side HMR handler
      package.json
  sdk/
    plugin-sdk/                 # (existing)
      src/
        index.ts                # Public API (existing)
        testing.ts              # NEW: createMockContext, createSpyContext
        context.ts              # (existing)
        create-plugin.ts        # (existing)
        types.ts                # (existing)

apps/
  workbench/
    src/
      lib/
        plugins/
          dev/                  # NEW: Plugin playground internal plugin
            playground-plugin.ts
            PluginEditor.tsx
            ContributionInspector.tsx
            PluginConsole.tsx
```

### Dependency Graph

```
@clawdstrike/create-plugin
  --> @clack/prompts (interactive CLI)
  --> @clawdstrike/plugin-sdk (type checking generated code)

@clawdstrike/vite-plugin-clawdstrike
  --> vite (peer dep)
  --> (reads plugin entry points, sends HMR events)

@clawdstrike/plugin-sdk
  --> (no runtime deps -- zero-dep by design)
  --> /testing entry point: vitest (peer dep)

Plugin Playground (internal workbench feature)
  --> @codemirror/lang-javascript (already in workbench)
  --> sucrase (TS -> JS transform, new dep ~200KB)
  --> PluginLoader (existing)
  --> PluginRegistry (existing)
```

### Phase Ordering Rationale

1. **Testing harness first** -- Smallest scope, unblocks plugin authors immediately, validates SDK API design
2. **CLI scaffolding second** -- Depends on testing harness (generated tests import from `plugin-sdk/testing`)
3. **Dev server third** -- Needs workbench integration, builds on scaffold output
4. **Documentation fourth** -- Can be written in parallel once SDK/testing API is stable
5. **Plugin playground last** -- Most complex, depends on all other pieces, benefits from lessons learned

---

## 8. Pitfalls and Warnings

### Critical

**Pitfall: CSP blocks blob URL imports in the playground**
The workbench CSP (`script-src 'self' 'wasm-unsafe-eval'`) does not allow `blob:` URLs. The playground's client-side evaluation will fail unless the CSP is updated. Mitigation: Use a Vite dev server route (`/__plugin-eval/`) that serves the transpiled plugin code from a real URL instead of a blob URL. This keeps the CSP strict while enabling dynamic evaluation.

**Pitfall: Plugin SDK type drift**
The SDK types are copied from the workbench types (not imported). If the workbench types change, the SDK types can drift. Mitigation: Add a CI check that diffs `packages/sdk/plugin-sdk/src/types.ts` against `apps/workbench/src/lib/plugins/types.ts` and fails if they diverge. The existing `scripts/architecture-guardrails.sh` is the right place for this check.

### Moderate

**Pitfall: Hot reload drops React component state**
When a plugin contributes React components (editor tabs, panels), HMR reload will unmount and remount them, losing React state (form inputs, scroll positions). Mitigation: Plugin components should use the `StorageApi` for persistent state, not React state. Document this in the "Dev Server" guide.

**Pitfall: createPlugin() identity function confusion**
`createPlugin()` is an identity function that returns its argument unchanged. Plugin authors may expect it to "do something" at runtime (validation, registration). Mitigation: Document clearly that `createPlugin()` is for type checking only. Actual registration happens in the PluginLoader.

**Pitfall: Template drift from SDK updates**
When the SDK adds new contribution points or changes the PluginManifest shape, the scaffolding templates become outdated. Mitigation: Generate templates programmatically from SDK types rather than maintaining hand-written template strings. The template generator should import the SDK types and use them to create default values.

### Minor

**Pitfall: Node 24 requirement**
The workspace requires Node 24 (mise.toml). Plugin authors may have older Node versions. Mitigation: Set `engines.node >= 20` in the plugin SDK and create-plugin packages (matching the existing SDK package.json). The workspace requirement is stricter than the SDK requirement.

**Pitfall: Bun vs npm confusion**
The workbench uses `bun install` / `bun run dev`, but the create-plugin package should work with both npm and bun. Mitigation: Test both package managers in CI. Use `npm create` as the documented default since it's more universal.

---

## 9. Comparison: CLI Implementation Language

| Criterion | Node.js (`@clawdstrike/create-plugin`) | Rust (`hush plugin init`) |
|-----------|----------------------------------------|---------------------------|
| Target audience | TypeScript plugin authors | Already have Node | All users | Requires Rust toolchain |
| Template complexity | Trivial (template literals) | Needs templating crate |
| Distribution | npm registry | Cargo binary |
| Workspace fit | Matches SDK, workbench, adapters | Matches core crates |
| Interactive prompts | @clack/prompts (excellent DX) | dialoguer (good but different UX) |
| Maintenance burden | Same language as templates | Cross-language templates |
| Cold start | ~100ms (Node) | ~10ms (compiled) |
| Existing precedent | `hush init` and `hush pkg init` are Rust | All TS packages use npm |

**Verdict:** Node.js. Plugin authors are TypeScript developers. The scaffolding tool should speak their language. The existing `hush pkg init` remains for Rust/WASM guard packages -- these are different audiences with different needs.

---

## 10. Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI scaffolding language | Node.js | Plugin authors are TS developers |
| CLI package | `@clawdstrike/create-plugin` | npm create convention |
| Interactive prompts library | `@clack/prompts` | Modern, lightweight, excellent DX |
| Dev server approach | Vite plugin + custom HMR | Workbench already uses Vite |
| Testing harness location | `@clawdstrike/plugin-sdk/testing` | Co-located with SDK, zero extra packages |
| Playground location | Built-in workbench panel | Needs real workbench context |
| Playground evaluation | Dev server route (not blob URL) | CSP compliance |
| Documentation | mdBook + TypeDoc | Already established in project |
| Plugin type templates | 6 types (guard, detection, ui, intel, compliance, full) | Covers all contribution points |
| State preservation across reload | StorageApi serialization | Already in SDK, plugin-scoped |

---

## Sources

All findings based on direct codebase analysis:

- `packages/sdk/plugin-sdk/` -- SDK package structure, types, tests
- `apps/workbench/src/lib/plugins/` -- PluginRegistry, PluginLoader, manifest validation, trust, installer
- `apps/workbench/src/lib/plugins/examples/egress-guard-plugin.ts` -- Guard plugin example
- `crates/services/hush-cli/src/init.rs` -- `hush init` scaffolding (Rust)
- `crates/services/hush-cli/src/pkg_cli.rs` -- `hush pkg init` scaffolding (Rust, guard/policy/adapter templates)
- `apps/workbench/vite.config.ts` -- Vite configuration (port 1421, proxies, manual chunks)
- `apps/workbench/src-tauri/tauri.conf.json` -- Tauri config (CSP, window settings)
- `apps/workbench/src-tauri/capabilities/default.json` -- Tauri capabilities (fs, http, dialog)
- `apps/workbench/package.json` -- Dependencies (CodeMirror 6, React 19, Tauri 2)
- `docs/book.toml` -- mdBook configuration
- `docs/src/SUMMARY.md` -- Existing documentation structure
- `mise.toml` -- Task runner configuration
- `package.json` (root) -- Workspace members

External patterns referenced from training data (MEDIUM confidence):
- VS Code `yo code` generator patterns
- Vite custom HMR plugin API
- npm create package convention
- @clack/prompts library
- TypeDoc for TypeScript API documentation
- sucrase for fast TypeScript transformation
