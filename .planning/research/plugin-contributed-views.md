# Plugin-Contributed Views for ClawdStrike Workbench

**Researched:** 2026-03-18
**Domain:** Plugin UI rendering in a Tauri 2 + React 19 desktop IDE
**Overall confidence:** MEDIUM-HIGH (based on codebase analysis + training data; web search unavailable)

---

## 1. Component Rendering Pipeline for Plugins

### The Three Approaches

There are three viable architectures for letting plugins contribute React components to the host workbench. For a Tauri 2 desktop app, they differ sharply in complexity, performance, and security boundary strength.

#### Approach A: In-Process Plugins (Direct React Component Export)

The plugin's `activate()` function registers React components directly into host-side registries. The components run in the same React tree, share the same React runtime, and have access to all workbench hooks, stores, and context providers.

```typescript
// Plugin code
import { createPlugin } from "@clawdstrike/plugin-sdk";

export default createPlugin({
  manifest: { /* ... */ },
  activate(ctx) {
    ctx.views.registerEditorTab({
      id: "my-plugin.threat-map",
      label: "Threat Map",
      icon: "IconMap",
      component: () => import("./ThreatMapView"),  // React.lazy-compatible
    });
  },
});
```

**How it works in Tauri:**
- Plugin module resolved via `import()` (Vite handles bundling for local plugins) or from a pre-bundled `.js` file loaded from disk via `convertFileSrc()` + script injection.
- The host wraps the imported component in `React.lazy()` + `<Suspense>` and mounts it in the appropriate slot.
- Component shares the host's React context tree -- can use `useWorkbench()`, `useMultiPolicy()`, etc.

**Tradeoffs:**
- Zero overhead: no iframe, no message passing, no serialization
- Full access to host React tree (hooks, context, stores)
- No sandbox: a malicious plugin could read/write any workbench state
- Suitable for: internal/first-party plugins (trust tier = "internal")

#### Approach B: Iframe-Sandboxed Plugins

The plugin renders its own React tree inside an iframe. Communication with the host happens via `postMessage` RPC. The host provides a bridge SDK (`@clawdstrike/plugin-bridge`) that wraps postMessage calls into typed async methods.

```typescript
// Host side: ViewContainerIframe
<iframe
  src={pluginViewUrl}
  sandbox="allow-scripts"
  style={{ width: '100%', height: '100%', border: 'none' }}
  onLoad={(e) => bridgePort.connect(e.target.contentWindow)}
/>
```

**How it works in Tauri:**
- Plugin is a bundled HTML+JS payload served from the local filesystem via `asset:` protocol or a local HTTP server.
- The iframe gets `sandbox="allow-scripts"` but NOT `allow-same-origin`, preventing access to the host's localStorage, cookies, or DOM.
- postMessage channel provides typed request/response for reading workbench state, executing commands, etc.
- Plugin can use any framework (React, Preact, Svelte, vanilla JS).

**Tradeoffs:**
- Strong security boundary (can't touch host state directly)
- Significant complexity: serialization layer, async-only API, separate React tree
- Performance overhead: postMessage serialization, separate JS context, double React runtime
- Suitable for: community/third-party plugins (trust tier = "community")

#### Approach C: Micro-Frontend Patterns (Module Federation / single-spa)

Module Federation (webpack 5) or Vite's equivalent (`@originjs/vite-plugin-federation`) allows separately-built bundles to share modules at runtime. The plugin is built as a "remote" that exposes React components; the host is a "shell" that consumes them.

**Why this is NOT recommended for ClawdStrike:**

1. **Tauri + Vite friction.** Module Federation was designed for webpack. The Vite federation plugin (`@originjs/vite-plugin-federation`) exists but is not production-battle-tested at the level webpack's is. ClawdStrike uses Vite.

2. **Shared module version coupling.** Module Federation requires the host and remote to share exact versions of React, react-dom, and other shared libraries. This creates tight version coupling between the workbench and every plugin. When the workbench upgrades React, all plugins must rebuild.

3. **Runtime remote loading complexity.** Federating modules at runtime requires a manifest discovery protocol, remote entry scripts, and careful chunk loading orchestration. This is roughly equivalent in complexity to the in-process approach but with more moving parts.

4. **Not needed for the trust model.** ClawdStrike has two clear trust tiers: internal (full access) and community (sandboxed). Module Federation sits awkwardly between them -- it gives full React tree access (like Approach A) but with the complexity of external loading (like Approach B).

5. **single-spa** adds a framework-agnostic shell layer that is total overkill for a single-framework (React 19) desktop app.

### Recommendation: Tiered Approach (A for internal, B for community)

Use **Approach A (in-process)** for internal/first-party plugins. These are the 90% case -- security team tools built by the ClawdStrike team or trusted partners. They get full React context, zero overhead, and simple `React.lazy()` loading.

Use **Approach B (iframe sandbox)** for community/third-party plugins in a future milestone. This is explicitly deferred in the REQUIREMENTS.md v2 scope ("iframe sandbox for community plugins"). The architecture should be designed so that contribution point interfaces are the same for both tiers -- only the rendering container differs.

**Do not use Module Federation.** The complexity is not justified for either trust tier.

---

## 2. View Contribution Types: Component API Design

Each contribution point should follow a consistent pattern. The key design decision is: **contribution declarations in the manifest are data-only (JSON-serializable), while the actual React component is resolved at activation time via the entrypoint field or the activate() hook.**

This is already the pattern established in Phase 1-4: the manifest declares `entrypoint: string` for view contributions, and the PluginLoader resolves the module. But currently, the loader registers a `render: () => null` placeholder for status bar items (see plugin-loader.ts line 387). The view rendering pipeline needs to close this gap.

### View Registry Architecture

Create a central `ViewRegistry` that the PluginLoader routes view contributions to, parallel to how it already routes guards to `guard-registry` and file types to `file-type-registry`.

```typescript
// lib/plugins/view-registry.ts

import type { ComponentType } from "react";

export interface ViewRegistration {
  /** Unique view ID (namespaced by plugin: "pluginId.viewId") */
  id: string;
  /** The contribution point this view belongs to */
  slot: ViewSlot;
  /** Display label */
  label: string;
  /** Icon identifier (Lucide/Tabler icon name) */
  icon?: string;
  /** The React component to render. Resolved lazily. */
  component: ComponentType<ViewProps>;
  /** Priority/sort order within the slot */
  priority?: number;
  /** Additional slot-specific metadata */
  meta?: Record<string, unknown>;
}

export type ViewSlot =
  | "editorTab"
  | "activityBarPanel"
  | "bottomPanelTab"
  | "rightSidebarPanel"
  | "statusBarWidget"
  | "gutterDecoration"
  | "contextMenuItem";

export interface ViewProps {
  /** The view's unique ID */
  viewId: string;
  /** Whether this view is currently visible/focused */
  isActive: boolean;
  /** Plugin-scoped storage API */
  storage: { get(key: string): unknown; set(key: string, value: unknown): void };
}
```

### Per-Slot Component API Contracts

#### Editor Tab

The highest-value contribution point. Plugin provides a full panel component that renders in the main editor area (the `<Outlet />` region or a pane within it).

```typescript
interface EditorTabContribution {
  id: string;
  label: string;
  icon?: string;
  /** Module path to dynamic import() the component */
  entrypoint: string;
}

// The resolved component receives:
interface EditorTabProps extends ViewProps {
  /** Called when the tab wants to update its title */
  setTitle: (title: string) => void;
  /** Called when the tab has unsaved changes */
  setDirty: (dirty: boolean) => void;
}
```

**Wiring to existing infra:** The workbench currently uses `react-router-dom` `<Route>` elements for page-level views (see App.tsx). Plugin editor tabs should NOT create new routes. Instead, they should integrate with the existing tab system in `multi-policy-store.tsx` or a new "views" concept that sits alongside policy tabs. The cleanest approach: add a `ViewTab` type to the tab bar that renders the plugin component directly, alongside the existing `PolicyTab` type.

**Architecture pattern:**
```typescript
// In the editor area, a ViewContainer component handles rendering:
function ViewContainer({ registration }: { registration: ViewRegistration }) {
  const Component = registration.component;
  return (
    <ErrorBoundary fallback={<ViewErrorFallback viewId={registration.id} />}>
      <Suspense fallback={<ViewLoadingFallback />}>
        <Component viewId={registration.id} isActive={true} storage={...} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

#### Activity Bar Panel

Plugin contributes a sidebar panel component that renders when its activity bar item is selected.

```typescript
interface ActivityBarPanelContribution {
  id: string;
  label: string;
  icon: string;          // Required -- activity bar items always have icons
  section: string;       // e.g. "security", "analysis"
  href: string;          // Route path
  order?: number;        // Sort priority
  entrypoint: string;    // Module path for the panel component
}

// The resolved component receives:
interface ActivityBarPanelProps extends ViewProps {
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean;
}
```

**Wiring:** Currently the `DesktopSidebar` has hardcoded `navSections` with `NavItem[]` entries. Phase 1 opened the `AppId` type as an open string, but the sidebar items array is still static. The contribution needs to:
1. Add the item to the sidebar navigation (already supported via `ActivityBarItemContribution` in types.ts)
2. Register a route so the `<Outlet />` renders the plugin component
3. Or: skip routing entirely and render the component inline when the sidebar item is active

**Recommendation:** Skip route registration. Instead, have the sidebar track the active plugin view ID. When a plugin view is active, the main content area renders the plugin component directly instead of routing to a built-in page. This avoids the complexity of dynamic route injection with react-router-dom.

```typescript
// In DesktopLayout or a wrapper:
const activePluginView = viewRegistry.getActiveView();
if (activePluginView) {
  return <ViewContainer registration={activePluginView} />;
} else {
  return <Outlet />; // Normal route-based rendering
}
```

#### Bottom Panel Tab

Plugin contributes a tab in the bottom panel (currently: Problems, Test Runner, Evidence Pack, Explainability).

```typescript
interface BottomPanelTabContribution {
  id: string;
  label: string;
  icon?: string;
  entrypoint: string;
}

// The resolved component receives:
interface BottomPanelTabProps extends ViewProps {
  /** The panel's current height in pixels */
  panelHeight: number;
}
```

**Wiring:** The policy-editor.tsx currently hardcodes the bottom panel tabs. The panel needs a tab registry that built-in tabs and plugin tabs both register into. This follows the exact same Map + useSyncExternalStore pattern already used by `StatusBarRegistry`.

#### Right Sidebar Panel

Plugin contributes a panel in the right sidebar (currently: Guard Config, Compare, Version History).

```typescript
interface RightSidebarPanelContribution {
  id: string;
  label: string;
  icon?: string;
  entrypoint: string;
}

// The resolved component receives:
interface RightSidebarPanelProps extends ViewProps {
  /** Current width of the right sidebar */
  sidebarWidth: number;
}
```

**Wiring:** Same registry pattern as bottom panel tabs.

#### Status Bar Widget

Already partially implemented. The `StatusBarRegistry` accepts `render: () => ReactNode` functions. The gap is that the PluginLoader currently registers `render: () => null` for plugin status bar items because it doesn't resolve the component from the entrypoint.

```typescript
interface StatusBarWidgetContribution {
  id: string;
  side: "left" | "right";
  priority: number;
  entrypoint: string;     // Module exporting a React component
}

// The resolved component receives:
interface StatusBarWidgetProps {
  viewId: string;
}
```

**Fix:** In the PluginLoader's `routeStatusBarItemContribution()`, resolve the entrypoint module and use the exported component as the render function. Since status bar items are small, they don't need Suspense boundaries -- they can be synchronously imported during plugin activation.

#### Gutter Decorations

Plugin contributes decorations to the CodeMirror editor gutter (e.g., breakpoints, coverage indicators, severity markers).

```typescript
interface GutterDecorationContribution {
  id: string;
  /** Which gutter to decorate ("line-numbers" or a custom gutter name) */
  gutter?: string;
  entrypoint: string;     // Module exporting CodeMirror Extension
}

// The entrypoint module exports a CodeMirror Extension factory:
export function createGutterExtension(config: GutterConfig): Extension {
  return gutter({
    class: "cm-plugin-gutter",
    lineMarker: (view, line) => { /* ... */ },
  });
}
```

**Important:** Gutter decorations are NOT React components. They are CodeMirror `Extension` objects (from `@codemirror/view`). The plugin provides a CodeMirror extension factory, and the host editor (yaml-editor.tsx) includes it in the editor's extension array. This is fundamentally different from the other contribution points.

**Wiring:** The yaml-editor currently builds its extension array statically. Add a `gutterExtensionRegistry` that collects CodeMirror extensions from plugins, and pass the collected extensions to the EditorState configuration.

#### Context Menu Items

Plugin contributes items to right-click context menus throughout the workbench.

```typescript
interface ContextMenuContribution {
  id: string;
  label: string;
  /** Command ID to execute when clicked */
  command: string;
  /** Optional icon */
  icon?: string;
  /** Context predicate: when to show this item */
  when?: string;
  /** Menu location: which context menu to add to */
  menu: "editor" | "sidebar" | "tab" | "finding" | "sentinel";
}
```

**Note:** Context menu items are NOT React components. They are data declarations that map to command executions. The `when` predicate is evaluated against the current workbench context (active file type, selection state, etc.) to determine visibility. This is the VS Code pattern -- context menu items are contribution-point data, not components.

---

## 3. Wiring to Existing Phase 1 Registries

### Current State of Each Registry

| Registry | File | Pattern | Plugin Support | Gap |
|----------|------|---------|---------------|-----|
| Guard Registry | `guard-registry.ts` | Map + Proxy | `registerGuard()` returns dispose | **Complete** -- fully wired in PluginLoader |
| File Type Registry | `file-type-registry.ts` | Map + Proxy | `registerFileType()` returns dispose | **Complete** -- fully wired in PluginLoader |
| Status Bar Registry | `status-bar-registry.ts` | Map + listeners | `registerStatusBarItem()` returns dispose | **Partial** -- wired but render is `() => null` |
| Activity Bar | `desktop-sidebar.tsx` | Static `navSections` array | `ActivityBarItemContribution` type exists | **Not wired** -- no dynamic registration |
| Editor Tabs | `multi-policy-store.tsx` | Tab array in store | `EditorTabContribution` type exists | **Not wired** -- no view rendering |
| Bottom Panel | `policy-editor.tsx` | Hardcoded panels | `BottomPanelTabContribution` type exists | **Not wired** -- no dynamic tabs |
| Right Sidebar | `policy-editor.tsx` | Hardcoded panels | `RightSidebarPanelContribution` type exists | **Not wired** -- no dynamic panels |
| Command Registry | `command-palette.tsx` | Dynamic commands | `CommandContribution` type exists | **Not wired** in PluginLoader |
| Gutter | `yaml-editor.tsx` | Static CM extensions | No contribution type | **Not designed yet** |

### What Needs to Happen

**Phase 1 (Status Bar fix):** Update `PluginLoader.routeStatusBarItemContribution()` to resolve the entrypoint module and use the exported component as the render function instead of `() => null`.

**Phase 2 (View Registry):** Create a `ViewRegistry` singleton (same Map + listeners pattern) that stores `ViewRegistration` objects. The PluginLoader routes `editorTabs`, `bottomPanelTabs`, `rightSidebarPanels`, and `activityBarItems` contributions to this registry.

**Phase 3 (View Containers):** Create `ViewContainer` components for each slot that:
- Read from the ViewRegistry
- Wrap plugin components in `ErrorBoundary` + `Suspense`
- Pass slot-specific props (panel height, sidebar width, etc.)
- Handle the active/inactive lifecycle

**Phase 4 (Dynamic Sidebar):** Convert `navSections` from a static array to a registry-backed data source. Built-in items register at module scope (like status bar items do now). Plugin items register via the ViewRegistry.

### PluginLoader Routing Additions

The current `routeContributions()` method in plugin-loader.ts handles guards, fileTypes, and statusBarItems. It needs to be extended:

```typescript
private routeContributions(manifest: PluginManifest, disposables: Disposable[]): void {
  const contributions = manifest.contributions;
  if (!contributions) return;

  // Existing routes
  if (contributions.guards) { /* ... */ }
  if (contributions.fileTypes) { /* ... */ }
  if (contributions.statusBarItems) { /* ... (fix render resolution) */ }

  // New view routes
  if (contributions.editorTabs) {
    for (const tab of contributions.editorTabs) {
      const dispose = viewRegistry.register({
        id: `${manifest.id}.${tab.id}`,
        slot: "editorTab",
        label: tab.label,
        icon: tab.icon,
        component: React.lazy(() => this.resolveViewComponent(manifest, tab.entrypoint)),
        meta: {},
      });
      disposables.push(dispose);
    }
  }
  // Similar for bottomPanelTabs, rightSidebarPanels, activityBarItems
}
```

---

## 4. Lazy Loading and Code Splitting

### In-Process Plugins (Internal)

Use `React.lazy()` + `<Suspense>` for every view component. This is React's built-in code splitting mechanism and integrates perfectly with Vite's dynamic import chunking.

```typescript
// Resolution chain:
// 1. Manifest declares entrypoint: "./views/ThreatMap.tsx"
// 2. PluginLoader resolves to absolute path: "/path/to/plugin/views/ThreatMap.tsx"
// 3. Component created as: React.lazy(() => import(path))
// 4. Host renders: <Suspense fallback={<Spinner />}><LazyComponent /></Suspense>
```

**Key considerations for Tauri:**

1. **File paths vs URLs.** In Tauri, local plugin files need `convertFileSrc()` to create asset-protocol URLs that the WebView can load. Vite's `import()` works for plugins bundled with the workbench. For installed plugins (downloaded to disk), use `convertFileSrc()` to convert the file path to an `asset://` URL, then `import()` that URL.

2. **Pre-bundling.** Plugins should be distributed as pre-bundled ESM modules (single `.js` file or a small set of chunks). This avoids the need for the host to run a bundler. The plugin SDK should include build instructions (tsup/esbuild config) that output a single ESM entry point.

3. **Shared dependencies.** Internal plugins should NOT bundle React, react-dom, or workbench utilities. They should mark these as `externals` in their build config. The host provides them at runtime. This keeps plugin bundles small (typically 5-50KB instead of 500KB+).

```javascript
// Plugin tsup.config.ts
export default {
  entry: ["src/index.ts"],
  format: ["esm"],
  external: [
    "react",
    "react-dom",
    "@clawdstrike/plugin-sdk",
    // Workbench APIs are injected by the loader, not bundled
  ],
  splitting: true,
};
```

4. **Chunk granularity.** Each view contribution should be a separate dynamic import so that only the views the user actually opens are loaded. A plugin that contributes an editor tab and a bottom panel tab should have two separate lazy-loaded chunks.

### Iframe Plugins (Community) -- Future

For sandboxed community plugins, the plugin bundles its own React runtime and renders inside an iframe. No code splitting concern for the host -- the iframe loads the plugin's own bundle independently.

The host only creates the iframe element and establishes the postMessage bridge. The plugin handles its own loading/splitting internally.

### Performance Budget

| Metric | Target | Rationale |
|--------|--------|-----------|
| Plugin activation (no views) | < 5ms | Manifest routing is pure data processing |
| First view render (lazy load) | < 200ms | Typical for a 30KB ESM chunk on desktop SSD |
| View switch (already loaded) | < 16ms | React state update, no network/disk I/O |
| Memory per plugin view | < 10MB | React component tree + plugin-specific state |
| Maximum concurrent plugin views | ~20 | Bounded by available pane slots |

---

## 5. Plugin View Lifecycle

### Mount/Unmount Semantics

Plugin views follow React's standard component lifecycle, but the host adds view-specific lifecycle events that plugins can subscribe to.

```typescript
// Extended PluginContext for view-aware plugins
interface ViewLifecycleApi {
  /** Called when a plugin view gains focus (tab selected, pane focused) */
  onViewFocus(viewId: string, callback: () => void): Disposable;
  /** Called when a plugin view loses focus */
  onViewBlur(viewId: string, callback: () => void): Disposable;
  /** Called when a plugin view is about to be closed */
  onViewClose(viewId: string, callback: () => boolean | Promise<boolean>): Disposable;
  /** Called when the view's visibility changes (e.g., tab hidden but not destroyed) */
  onViewVisibilityChange(viewId: string, callback: (visible: boolean) => void): Disposable;
}
```

### State Preservation When Switching Tabs

**Problem:** When a user switches from a plugin's editor tab to a policy tab and back, the plugin component unmounts and remounts. Any component-local state (scroll position, form inputs, selection) is lost.

**Solution: Keep-alive pattern.** Instead of unmounting inactive tab components, hide them with `display: none`. This is the pattern used by VS Code's webview panels and by the existing workbench tab system.

```typescript
// ViewTabRenderer - renders all active plugin views, hides inactive ones
function ViewTabRenderer({ tabs }: { tabs: ViewRegistration[] }) {
  const activeTabId = useActiveTabId();

  return (
    <>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{ display: tab.id === activeTabId ? "block" : "none" }}
          className="h-full w-full"
        >
          <ViewContainer registration={tab} />
        </div>
      ))}
    </>
  );
}
```

**Tradeoffs:**
- Pro: Perfect state preservation -- scroll position, selections, form state all maintained
- Pro: Instant tab switching (no re-render)
- Con: Memory usage -- hidden views still consume memory
- Con: Hidden views still run effects (timers, subscriptions)
- Mitigation: Provide `isActive` prop so plugins can pause expensive operations when hidden. Add a configurable maximum for kept-alive views (LRU eviction of the oldest hidden views).

### Split Pane Support

Plugin views should be renderable in split panes. The existing binary tree pane system (from the workbench-dev roadmap) supports `openApp(appId)` -- plugin views need to be openable via the same mechanism.

```typescript
// Opening a plugin view in a split pane:
paneStore.openApp(`plugin:${pluginId}.${viewId}`);

// The pane system's content renderer checks for the "plugin:" prefix:
function PaneContent({ appId }: { appId: string }) {
  if (appId.startsWith("plugin:")) {
    const viewId = appId.slice("plugin:".length);
    const registration = viewRegistry.get(viewId);
    if (registration) {
      return <ViewContainer registration={registration} />;
    }
    return <ViewNotFound />;
  }
  // Built-in app rendering...
  return <BuiltInAppContent appId={appId} />;
}
```

Each pane gets its own instance of the plugin component. State is NOT shared between pane instances unless the plugin uses external state management (Zustand store, context provider). This matches the VS Code pattern where opening the same file in two panes creates two independent editor instances.

### Lifecycle State Machine

```
           register()              activate()             focus()
DECLARED ──────────> REGISTERED ──────────> MOUNTED ──────────> ACTIVE
                                               │                  │
                                               │   blur()         │
                                               │<─────────────────│
                                               │                  │
                                          hide() │            show()
                                               │                  │
                                               v                  │
                                            HIDDEN ───────────────┘
                                               │
                                        unmount() │
                                               v
                                           DESTROYED
```

- **DECLARED:** Contribution exists in manifest but module not loaded
- **REGISTERED:** View registered in ViewRegistry, component created as React.lazy
- **MOUNTED:** Component rendered in DOM (possibly hidden via display:none)
- **ACTIVE:** Component visible and focused
- **HIDDEN:** Component mounted but not visible (tab switched away)
- **DESTROYED:** Component unmounted (pane closed, plugin deactivated)

### Error Isolation

Every plugin view MUST be wrapped in an `ErrorBoundary`. A plugin view crash must NOT take down the workbench. The error boundary renders a fallback UI with the plugin name, error message, and a "Reload" button that remounts the component.

```typescript
function PluginViewErrorFallback({ viewId, error, resetError }: {
  viewId: string;
  error: Error;
  resetError: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <p className="text-sm text-[#c45c5c] font-medium mb-2">
        Plugin view crashed
      </p>
      <p className="text-xs text-[#6f7f9a] mb-4 max-w-md">
        {error.message}
      </p>
      <button onClick={resetError} className="text-xs text-[#d4a84b] hover:underline">
        Reload View
      </button>
    </div>
  );
}
```

---

## 6. Detailed Architecture: ViewRegistry

### Registry Implementation

Following the established pattern from `status-bar-registry.ts` (Map + snapshot + listeners):

```typescript
// lib/plugins/view-registry.ts

const viewMap = new Map<string, ViewRegistration>();
const listeners = new Set<() => void>();
let snapshotBySlot = new Map<ViewSlot, ViewRegistration[]>();

function rebuildSnapshots(): void {
  const slotMap = new Map<ViewSlot, ViewRegistration[]>();
  for (const reg of viewMap.values()) {
    const list = slotMap.get(reg.slot) ?? [];
    list.push(reg);
    slotMap.set(reg.slot, list);
  }
  // Sort each slot by priority
  for (const [slot, list] of slotMap) {
    list.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    slotMap.set(slot, list);
  }
  snapshotBySlot = slotMap;
}

function notify(): void {
  rebuildSnapshots();
  for (const listener of listeners) listener();
}

export function registerView(reg: ViewRegistration): () => void {
  if (viewMap.has(reg.id)) throw new Error(`View "${reg.id}" already registered`);
  viewMap.set(reg.id, reg);
  notify();
  return () => { viewMap.delete(reg.id); notify(); };
}

export function getViewsBySlot(slot: ViewSlot): ViewRegistration[] {
  return snapshotBySlot.get(slot) ?? [];
}

export function getView(id: string): ViewRegistration | undefined {
  return viewMap.get(id);
}

export function onViewRegistryChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// React hook
export function useViewsBySlot(slot: ViewSlot): ViewRegistration[] {
  return useSyncExternalStore(
    onViewRegistryChange,
    () => getViewsBySlot(slot),
  );
}
```

### SDK Extension

Add view registration to the `PluginContext`:

```typescript
// In plugin-sdk/src/context.ts
export interface ViewsApi {
  /** Register an editor tab view */
  registerEditorTab(contribution: EditorTabViewContribution): Disposable;
  /** Register a bottom panel tab */
  registerBottomPanelTab(contribution: BottomPanelTabViewContribution): Disposable;
  /** Register a right sidebar panel */
  registerRightSidebarPanel(contribution: RightSidebarPanelViewContribution): Disposable;
  /** Register a status bar widget */
  registerStatusBarWidget(contribution: StatusBarWidgetViewContribution): Disposable;
}

// EditorTabViewContribution differs from manifest EditorTabContribution:
// it takes a component instead of entrypoint string
export interface EditorTabViewContribution {
  id: string;
  label: string;
  icon?: string;
  /** React component or lazy import function */
  component: ComponentType<ViewProps> | (() => Promise<{ default: ComponentType<ViewProps> }>);
}
```

The distinction matters: manifest contributions use `entrypoint: string` (resolved by the loader). SDK contributions from within `activate()` use direct component references (for in-process plugins that can pass React components directly).

---

## 7. Implementation Phases

### Phase 1: ViewRegistry + ViewContainer (Foundation)

1. Create `lib/plugins/view-registry.ts` with Map + snapshot + listeners pattern
2. Create `components/plugins/view-container.tsx` with ErrorBoundary + Suspense
3. Add `ViewsApi` to PluginContext
4. Wire PluginLoader to route view contributions to ViewRegistry
5. Fix status bar `render: () => null` gap

### Phase 2: Editor Tab Views

1. Add `ViewTab` type to the tab system alongside `PolicyTab`
2. Create `ViewTabRenderer` with keep-alive pattern
3. Wire "Open Plugin View" command to command palette
4. Wire `paneStore.openApp("plugin:...")` for split-pane support

### Phase 3: Bottom Panel + Right Sidebar

1. Create `BottomPanelTabRegistry` (or extend ViewRegistry slots)
2. Modify policy-editor.tsx to render dynamic bottom panel tabs
3. Create `RightSidebarPanelRegistry`
4. Modify editor right sidebar to render dynamic panels

### Phase 4: Activity Bar + Navigation

1. Convert `navSections` to registry-backed data
2. Add "plugin view active" state to DesktopLayout
3. Render plugin panel components when their sidebar item is active
4. Handle route transitions between built-in and plugin views

### Phase 5: Gutter Extensions + Context Menus

1. Create `GutterExtensionRegistry` for CodeMirror extensions
2. Pass collected gutter extensions to yaml-editor
3. Create `ContextMenuRegistry` for data-driven context menu items
4. Wire context menu items to command execution

---

## 8. Pitfalls and Warnings

### Critical: React Context Access

Plugin components rendered in-process share the host React tree. This means they CAN access host context providers (useWorkbench, useMultiPolicy, etc.). This is a feature for internal plugins but a risk if the boundary is unclear.

**Mitigation:** Create a `PluginContextBoundary` component that wraps plugin views. For internal plugins, it passes through all host contexts. For community plugins (future iframe tier), it provides isolated contexts.

### Critical: Bundle Size Explosion

If plugins bundle their own copies of React, the total app size balloons.

**Mitigation:** The plugin build config MUST externalize React and react-dom. The plugin SDK documentation should enforce this. Plugin validation (at install time) should check the bundle size and warn if it exceeds a threshold (e.g., 500KB).

### Moderate: Import Path Resolution in Tauri

Vite's `import()` works for modules in the project's dependency tree. For plugins installed to a local directory (e.g., `~/.clawdstrike/plugins/`), the import path is a filesystem path that Vite doesn't know about.

**Mitigation:** Use Tauri's `convertFileSrc()` to convert filesystem paths to `asset://` URLs. Pre-bundle plugins as self-contained ESM modules that don't need Vite resolution.

### Moderate: Hot Reload During Development

Plugin authors developing in-process plugins need hot reload. If the plugin is a separate npm package in the workspace, Vite's HMR should propagate changes. If the plugin is external, the developer needs to rebuild and reload manually.

**Mitigation:** Provide a `--dev-plugin` flag that watches a local plugin directory and triggers hot-reload on changes. Or integrate with Vite's `server.watch` to include plugin directories.

### Minor: Memory Leaks from Keep-Alive

Hidden plugin views that are never revisited consume memory indefinitely.

**Mitigation:** LRU eviction. Track the last-focused timestamp for each kept-alive view. When the count exceeds a maximum (configurable, default 5), destroy the oldest hidden view. The user can reopen it (fresh mount) if needed.

---

## 9. Reference Implementations

### VS Code Extension API (Webview Panels)

VS Code's `WebviewPanel` API is the closest reference. Extensions call `vscode.window.createWebviewPanel()` to open a panel in the editor area. The panel renders HTML in an iframe-like webview. Communication is via `postMessage`. This is the Approach B pattern.

For VS Code's Tree Views and custom editor providers, the extension provides data and the host renders it. This is closer to what ClawdStrike does with guard config fields (data-driven rendering).

ClawdStrike's in-process approach (Approach A) goes further than VS Code -- it allows direct React component rendering without the webview serialization boundary. This is possible because ClawdStrike controls the trust model (signed plugins, known publishers) and the desktop context (no web security model concerns).

### Athas Extension System

Athas's `ExtensionRegistry` + `ExtensionLoader` is the direct ancestor of ClawdStrike's plugin system. Athas focuses on language extensions (LSP, grammars, formatters). It does NOT have view contribution points -- extensions contribute data (language configs, commands) but not React components.

ClawdStrike's view contribution system extends beyond Athas by adding component-level contributions. The registry and loader patterns are the same; the new piece is the `ViewRegistry` and `ViewContainer`.

---

## 10. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| In-process rendering (Approach A) | HIGH | Standard React.lazy pattern, proven in the codebase |
| Iframe sandbox (Approach B) | MEDIUM | Well-understood pattern but not yet implemented; deferred to v2 |
| ViewRegistry design | HIGH | Direct extension of proven status-bar-registry.ts pattern |
| Keep-alive tab switching | HIGH | Standard DOM display:none pattern, used by VS Code |
| Gutter extensions via CodeMirror | MEDIUM | CodeMirror Extension API is well-documented but plugin integration untested |
| Dynamic route injection | LOW | Recommend avoiding; use view-state approach instead |
| Tauri asset:// import for external plugins | MEDIUM | convertFileSrc is documented but ESM import from asset:// paths needs validation |

---

## Sources

- Codebase analysis: plugin-loader.ts, status-bar-registry.ts, guard-registry.ts, types.ts (SDK + workbench), App.tsx, desktop-layout.tsx, desktop-sidebar.tsx, yaml-editor.tsx, policy-editor.tsx, plugin-registry.ts, plugin-installer.ts, activation-events.ts, create-plugin.ts
- Reference: Athas extension-registry.ts, extension-loader.ts
- Training data: VS Code Extension API (WebviewPanel), React.lazy/Suspense patterns, Module Federation architecture, single-spa, CodeMirror 6 Extension API
- Note: Web search was unavailable. Tauri asset:// import claim should be validated with official Tauri 2 docs before implementation.
