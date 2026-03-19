# Architecture Patterns

**Domain:** Plugin Developer Experience
**Researched:** 2026-03-18

## Recommended Architecture

### System Overview

```
                    Plugin Author's Machine
                    ========================

  npm create @clawdstrike/plugin     @clawdstrike/plugin-sdk
  --------------------------------   -----------------------
  | Scaffold project structure   |   | Types + createPlugin |
  | Interactive prompts          |   | /testing entry point |
  | Template generation          |   |   createMockContext  |
  --------------------------------   |   createSpyContext   |
          |                          -----------------------
          v                                    |
  my-guard-plugin/                             |
  ├── src/index.ts (createPlugin)              |
  ├── tests/plugin.test.ts  <-----------------'
  ├── package.json
  └── tsup.config.ts


                    Workbench Dev Mode
                    ==================

  vite-plugin-clawdstrike            Workbench (Vite + React)
  --------------------------         -------------------------
  | Watch plugin/ directory |  HMR   | PluginLoader           |
  | Detect file changes     | -----> |   deactivate old       |
  | Send custom HMR event   |        |   re-import module     |
  | Serve transpiled plugin |        |   route contributions  |
  --------------------------         |   activate new         |
                                     -------------------------
                                              |
                                     -------------------------
                                     | Dev Console Panel      |
                                     |   lifecycle events     |
                                     |   console output       |
                                     |   contribution list    |
                                     -------------------------


                    Plugin Playground (future)
                    ==========================

  CodeMirror Editor                  Live Preview
  ----------------                   ------------
  | TypeScript    |  sucrase/eval    | Guard UI  |
  | plugin code   | ------------->   | Panels    |
  | with SDK      |                  | Commands  |
  ----------------                   ------------
        |
  Contribution Inspector
  ----------------------
  | guards: [...]      |
  | commands: [...]     |
  | fileTypes: [...]    |
  ----------------------
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `@clawdstrike/create-plugin` | Scaffold new plugin projects from templates | `@clawdstrike/plugin-sdk` (types for validation) |
| `@clawdstrike/plugin-sdk/testing` | Mock/spy contexts for plugin unit tests | `@clawdstrike/plugin-sdk` (implements PluginContext interface) |
| `vite-plugin-clawdstrike` | File watching + HMR for plugin dev mode | Vite server (custom events), PluginLoader (via client handler) |
| Dev Console Panel | Display plugin lifecycle events and logs | PluginRegistry (event subscription), console proxy |
| Plugin Playground | In-app plugin editor and live preview | CodeMirror, PluginLoader, PluginRegistry, sucrase |
| Contribution Inspector | Tree view of plugin registrations | PluginRegistry, guard/file-type/status-bar registries |

### Data Flow

**Scaffolding flow:**
```
User runs `npm create @clawdstrike/plugin`
  --> @clack/prompts collects: name, type, contributions
  --> Template engine interpolates values into .tmpl files
  --> Files written to disk: package.json, src/index.ts, tests/, configs
  --> npm install runs (installs @clawdstrike/plugin-sdk)
```

**Dev server flow:**
```
Plugin author edits src/index.ts
  --> Vite chokidar detects change
  --> vite-plugin-clawdstrike handles the update
  --> Server sends WebSocket: { type: 'custom', event: 'clawdstrike:plugin-update', data: { pluginId, path, timestamp } }
  --> Client handler receives event
  --> pluginLoader.deactivatePlugin(pluginId) -- cleans up old contributions
  --> pluginRegistry.unregister(pluginId)
  --> import(`${path}?t=${timestamp}`) -- cache-busted re-import
  --> pluginRegistry.register(newManifest)
  --> pluginLoader.loadPlugin(pluginId)
  --> New contributions appear in workbench
```

**Testing flow:**
```
Plugin author runs `vitest`
  --> Test imports createSpyContext from @clawdstrike/plugin-sdk/testing
  --> Test imports plugin from ./src/index.ts
  --> createSpyContext() creates a mock PluginContext with call recording
  --> plugin.activate(ctx) runs -- contributions recorded on spy
  --> Assertions verify: ctx.guards.registered.length === 1
  --> Assertions verify: ctx.commands.registered[0].id === "expected"
```

## Patterns to Follow

### Pattern 1: Secondary Package Exports for Testing
**What:** Expose testing utilities via `@clawdstrike/plugin-sdk/testing` sub-path export
**When:** Library packages need test helpers that shouldn't be in the main bundle
**Example:**
```json
// package.json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./testing": { "types": "./dist/testing.d.ts", "import": "./dist/testing.js" }
  }
}
```
```typescript
// src/testing.ts
import type { PluginContext, Disposable, GuardContribution } from "./types";

interface SpyContext extends PluginContext {
  guards: GuardsApi & { registered: GuardContribution[] };
  commands: CommandsApi & { registered: { cmd: CommandContribution; handler: () => void }[] };
}

export function createSpyContext(overrides?: Partial<SpyContext>): SpyContext { ... }
```

### Pattern 2: Vite Custom HMR Events
**What:** Use Vite's `server.ws.send()` for custom hot-reload events
**When:** Framework-specific HMR that goes beyond standard module replacement
**Example:**
```typescript
// vite-plugin-clawdstrike (server side)
export default function clawdstrikeDevPlugin(): Plugin {
  return {
    name: 'vite-plugin-clawdstrike',
    configureServer(server) {
      server.watcher.on('change', (path) => {
        if (isPluginFile(path)) {
          server.ws.send({
            type: 'custom',
            event: 'clawdstrike:plugin-update',
            data: { pluginId: extractPluginId(path), path, timestamp: Date.now() }
          });
        }
      });
    },
  };
}

// Client-side handler (injected via virtual module)
if (import.meta.hot) {
  import.meta.hot.on('clawdstrike:plugin-update', async (data) => {
    await pluginLoader.deactivatePlugin(data.pluginId);
    pluginRegistry.unregister(data.pluginId);
    const mod = await import(`${data.path}?t=${data.timestamp}`);
    pluginRegistry.register(mod.default.manifest);
    await pluginLoader.loadPlugin(data.pluginId);
  });
}
```

### Pattern 3: Template Generation from Types
**What:** Generate scaffolding templates programmatically from SDK types
**When:** Template content must stay in sync with evolving type definitions
**Example:**
```typescript
// create-plugin/src/templates/guard.ts
import type { GuardContribution, ConfigFieldDef } from "@clawdstrike/plugin-sdk";

function generateGuardTemplate(name: string): string {
  const guardId = name.replace(/-/g, '_');
  // Template references the actual type structure
  return `
import { createPlugin } from "@clawdstrike/plugin-sdk";
import type { PluginContext, GuardContribution } from "@clawdstrike/plugin-sdk";

const guard: GuardContribution = {
  id: "${guardId}",
  name: "${toTitleCase(name)}",
  technicalName: "${guardId}",
  description: "TODO: Describe what this guard checks",
  category: "custom",
  defaultVerdict: "deny",
  icon: "IconShield",
  configFields: [
    { key: "enabled", label: "Enabled", type: "toggle", defaultValue: true },
  ],
};

export default createPlugin({ ... });
`;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: eval() for Plugin Evaluation
**What:** Using `eval()` or `new Function()` to execute plugin code in the playground
**Why bad:** CSP violation (`script-src 'self' 'wasm-unsafe-eval'` does not allow eval), security risk, no module semantics
**Instead:** Use dynamic `import()` with Blob URLs (if CSP is extended) or serve transpiled code from a dev server route (`/__plugin-eval/:hash`)

### Anti-Pattern 2: Importing Workbench Internals from SDK
**What:** Having `@clawdstrike/plugin-sdk` import types from `apps/workbench/src/lib/plugins/types.ts`
**Why bad:** SDK is a published package; workbench is a private app. Import path would break for external users.
**Instead:** Copy types (current approach) with CI guardrail to detect drift. This is the same pattern VS Code uses (vscode.d.ts is a copy, not an import).

### Anti-Pattern 3: Global Console Proxy
**What:** Overwriting `console.log` globally to capture plugin output
**Why bad:** Captures ALL console output, not just plugin output. Breaks debugging tools.
**Instead:** Provide a `context.log()` API in PluginContext, or use a scoped console proxy that only captures output during `activate()` execution.

### Anti-Pattern 4: Full Page Reload for Plugin Changes
**What:** Reloading the entire workbench when a plugin file changes
**Why bad:** Loses all workbench state (open files, scroll positions, panel layout)
**Instead:** Surgical deactivate -> re-import -> reactivate cycle via PluginLoader

## Scalability Considerations

| Concern | 1 plugin in dev | 10 plugins loaded | 50 plugins loaded |
|---------|-----------------|-------------------|-------------------|
| HMR speed | <100ms | <100ms (watches specific files) | <200ms |
| Memory (dev console) | Trivial | Buffer last 1000 events per plugin | Cap total events, LRU per plugin |
| Playground eval | <50ms (single file) | N/A (playground edits one plugin) | N/A |
| Registry lookup | O(1) Map | O(1) Map | O(1) Map |
| Contribution routing | O(k) per plugin, k = contributions | O(n*k) total | O(n*k) total, amortized |

## Sources

- `apps/workbench/src/lib/plugins/plugin-loader.ts` -- PluginLoader lifecycle and contribution routing
- `apps/workbench/src/lib/plugins/plugin-registry.ts` -- PluginRegistry event emission
- `apps/workbench/vite.config.ts` -- Vite 6 server config, HMR settings
- `apps/workbench/src-tauri/tauri.conf.json` -- CSP policy
- `packages/sdk/plugin-sdk/src/context.ts` -- PluginContext interface
- `packages/sdk/plugin-sdk/tests/create-plugin.test.ts` -- existing mock patterns
