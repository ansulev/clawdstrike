# Domain Pitfalls

**Domain:** Plugin Developer Experience
**Researched:** 2026-03-18

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: CSP Blocks Plugin Playground Evaluation
**What goes wrong:** The workbench CSP is `script-src 'self' 'wasm-unsafe-eval'`. The plugin playground tries to evaluate user-written TypeScript by creating a Blob URL and importing it. `blob:` is not in `script-src`, so the import fails silently or throws a CSP violation error.
**Why it happens:** Blob URLs are a common pattern for dynamic module loading, but Tauri apps have strict CSP by default. The `'wasm-unsafe-eval'` directive is there for WASM, not for arbitrary JS eval.
**Consequences:** Plugin playground is completely non-functional. Users see a blank preview with no error message (CSP violations are often silent).
**Prevention:** Use one of these approaches:
1. Serve transpiled plugin code from a Vite dev server route (`/__plugin-eval/`) so it loads from `'self'`
2. Add `blob:` to the CSP's `script-src` (less secure, requires security review)
3. Use `import.meta.hot.accept()` to dynamically update a known module path
**Detection:** Test plugin playground in Tauri dev mode, not just `vite dev` (Vite dev has no CSP). Check browser DevTools console for CSP violation messages.

### Pitfall 2: SDK Type Drift from Workbench Types
**What goes wrong:** `@clawdstrike/plugin-sdk/src/types.ts` is a manual copy of `apps/workbench/src/lib/plugins/types.ts`. When a contributor updates the workbench types (e.g., adds a field to `GuardContribution`), the SDK copy is not updated. Plugins built against the SDK compile successfully but fail at runtime because the workbench expects the new field.
**Why it happens:** The SDK is a standalone publishable package and cannot import from the private workbench app. The decision to copy types (Phase 04) was correct for package independence, but creates a maintenance burden.
**Consequences:** Silent runtime failures. Plugin's `GuardContribution` is missing a field that the workbench's `routeGuardContribution()` expects. Guard appears in registry but renders incorrectly or crashes.
**Prevention:** Add a CI check (in `scripts/architecture-guardrails.sh` or a new script) that diffs the relevant type interfaces between SDK and workbench. The check should:
1. Extract interface names from both files
2. Diff the type signatures
3. Fail CI if they diverge
**Detection:** TypeScript errors in the workbench test suite if workbench imports from SDK (but it doesn't). The CI guardrail is the detection mechanism.

### Pitfall 3: Template Drift from SDK Updates
**What goes wrong:** The `@clawdstrike/create-plugin` scaffolding templates hardcode `PluginManifest` field names and `createPlugin()` usage patterns. When the SDK adds new required fields (e.g., `contributions.fleetProviders`), old scaffolded projects still compile but new template projects fail if the template hasn't been updated.
**Why it happens:** Templates are static strings that reference SDK APIs. There's no automated connection between template content and SDK type changes.
**Consequences:** `npm create @clawdstrike/plugin` generates projects with TypeScript errors. Bad first impression for new plugin authors.
**Prevention:**
1. Generate templates programmatically from SDK types (template functions import types and construct defaults)
2. Add a CI test that runs the scaffolding tool, builds the output, and runs its tests (`npx tsx create-plugin my-test --non-interactive && cd my-test && npm test`)
3. Use the SDK's `createPlugin()` identity function in tests to validate generated code compiles
**Detection:** CI test that scaffolds and builds a plugin project.

## Moderate Pitfalls

### Pitfall 4: HMR Reload Drops React Component State
**What goes wrong:** When the Vite dev plugin triggers a plugin reload, any React components contributed by the plugin (editor tabs, panels) are unmounted and remounted. React state (form inputs, scroll positions, drag state) is lost.
**Why it happens:** The reload cycle deactivates the old plugin (disposing all contributions, unmounting components) and activates the new one (re-registering, mounting fresh components). React state lives in the component tree, which is destroyed.
**Prevention:** Document that plugins should use `context.storage.set()`/`get()` for important state, not React `useState()`. The StorageApi persists across reloads. For the dev server, serialize storage before deactivation and restore after reactivation.
**Detection:** Manual testing -- edit a plugin that has a form, check if form values survive reload.

### Pitfall 5: Multiple Plugin Modules in Watch Directory
**What goes wrong:** The Vite dev plugin watches a `plugins/` directory for changes. If multiple plugin files exist, a change to one file causes the watcher to emit events for all files (due to transitive dependencies or shared imports). All plugins deactivate and reactivate, even those that didn't change.
**Why it happens:** Vite's module graph tracks dependencies. If plugins share imports (e.g., a shared utility file), changing the utility invalidates all dependent plugins.
**Prevention:** Track the specific plugin ID per file path. Only deactivate/reactivate the plugin whose entry file (or transitive dependency) changed. Use Vite's `moduleGraph` to determine which plugin is affected.
**Detection:** Open dev console; expect only one "deactivated" + "activated" event pair per file change.

### Pitfall 6: createPlugin() Confusion (Identity Function)
**What goes wrong:** Plugin authors expect `createPlugin()` to "do something" at runtime -- validate the manifest, register contributions, connect to the workbench. It doesn't; it's a pure identity function for TypeScript inference. Authors file bugs saying "my plugin doesn't appear in the workbench" when they forgot to configure the PluginLoader.
**Why it happens:** The name `createPlugin()` implies creation/construction. In reality, it's `definePlugin()` semantically.
**Prevention:** Clear JSDoc documentation on `createPlugin()`. The getting-started guide should show the full lifecycle: `createPlugin()` -> PluginLoader -> workbench. Consider adding a `console.info()` in dev mode: "Plugin 'x' defined. Use PluginLoader.loadPlugin() to activate."
**Detection:** FAQ in docs. If support tickets mention "plugin not loading", add a diagnostic check.

## Minor Pitfalls

### Pitfall 7: Node Version Mismatch
**What goes wrong:** The workspace requires Node 24 (mise.toml `node = "24"`), but plugin authors may have Node 20 or 22. The create-plugin tool or SDK testing may use Node 24 APIs that don't exist on older versions.
**Why it happens:** The workspace pins to Node 24 for the latest features, but published packages should support older Node.
**Prevention:** Set `engines.node >= 20` in SDK and create-plugin package.json files (matching existing SDK config). Avoid using Node 24-only APIs in published packages. Test in CI with Node 20 and Node 24.
**Detection:** CI matrix testing with multiple Node versions.

### Pitfall 8: Bun vs npm Install Differences
**What goes wrong:** The workbench uses `bun install` and `bun run dev`. Plugin authors using npm may encounter workspace resolution differences or lockfile conflicts.
**Prevention:** Document both npm and bun commands. Test scaffolded projects with both package managers in CI. The create-plugin tool should detect the package manager and generate appropriate config.
**Detection:** CI tests with both npm and bun.

### Pitfall 9: TypeDoc Staleness
**What goes wrong:** TypeDoc API reference is generated once and becomes stale as the SDK evolves. Plugin authors reference outdated docs.
**Prevention:** Generate TypeDoc in CI on every commit to main. Serve from a versioned URL (e.g., `/api/v0.1/`). Add a mise task: `mise run docs:plugin-api`.
**Detection:** CI step that generates and deploys docs.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Testing Harness | SpyContext may not cover all PluginContext APIs | Enumerate all API surfaces from PluginContext interface; add a type test asserting SpyContext extends PluginContext |
| CLI Scaffolding | Generated `import` paths break if SDK package name changes | Use the literal `@clawdstrike/plugin-sdk` string, not a variable; CI test validates scaffold output |
| Dev Server | Vite `@vite-ignore` dynamic import may not work with all module formats | Test with ESM-only plugins; document that plugins must use ESM (`"type": "module"` in package.json) |
| Dev Server | HMR handler not loaded when workbench starts without dev plugin | Register HMR handler in the Vite plugin's `transformIndexHtml` hook to inject the client-side script |
| Documentation | mdBook sidebar gets cluttered with plugin docs | Use collapsible sections in SUMMARY.md (mdBook fold feature is enabled) |
| Playground | sucrase cannot handle all TypeScript features (decorators, enums) | Document supported TS features; use `tsconfig` `target: "esnext"` in playground |
| Playground | Large plugin code slows down sucrase transform | Add debounce (300ms) to "Run" button; show loading indicator |

## Sources

- `apps/workbench/src-tauri/tauri.conf.json` -- CSP policy (script-src 'self' 'wasm-unsafe-eval')
- `packages/sdk/plugin-sdk/src/types.ts` -- SDK type definitions (copy of workbench types)
- `apps/workbench/src/lib/plugins/types.ts` -- Workbench type definitions (source of truth)
- `apps/workbench/src/lib/plugins/plugin-loader.ts` -- PluginLoader lifecycle and dynamic import pattern
- `packages/sdk/plugin-sdk/src/create-plugin.ts` -- identity function documentation
- `mise.toml` -- Node 24 requirement
- `packages/sdk/plugin-sdk/package.json` -- engines.node >= 20
