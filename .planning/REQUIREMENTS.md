# Requirements: Plugin-Contributed Views (v3.0)

## Overview

Enable plugins to contribute React components and CodeMirror extensions to every visual slot in the ClawdStrike workbench -- editor tabs, bottom panel tabs, right sidebar panels, activity bar panels, gutter decorations, status bar widgets, and context menus. Internal (in-process) plugins render directly in the host React tree via React.lazy with ErrorBoundary isolation and keep-alive state preservation.

## Scope

**v3.0 (this milestone):** ViewRegistry, in-process view rendering for all 7 contribution slots, keep-alive tab state with LRU eviction, ErrorBoundary crash isolation, SDK ViewsApi.

**v3.1+ (deferred):** iframe-sandboxed view rendering for community plugins, plugin-provided React context providers, view-level permission scoping, plugin view theming API, hot-reload for external plugin views.

## Requirements

### VREG: View Registry

- **VREG-01**: A `ViewRegistry` singleton stores `ViewRegistration` objects keyed by `"{pluginId}.{viewId}"`, providing `registerView()`, `getView()`, `getViewsBySlot()`, and `onViewRegistryChange()` methods
- **VREG-02**: `ViewRegistration` includes `id`, `slot` (one of: `editorTab`, `activityBarPanel`, `bottomPanelTab`, `rightSidebarPanel`, `statusBarWidget`, `gutterDecoration`, `contextMenuItem`), `label`, `icon`, `component` (React ComponentType or CodeMirror Extension factory), `priority`, and `meta`
- **VREG-03**: The registry uses the Map + snapshot + listeners pattern (matching `status-bar-registry.ts`) with `useSyncExternalStore` for React integration via a `useViewsBySlot(slot)` hook
- **VREG-04**: `registerView()` returns a dispose function; calling it removes the view and notifies listeners
- **VREG-05**: The PluginLoader's `routeContributions()` method routes `editorTabs`, `bottomPanelTabs`, `rightSidebarPanels`, `activityBarItems`, `gutterDecorations`, and `contextMenuItems` manifest contributions to the ViewRegistry

### VCONT: View Container

- **VCONT-01**: A `ViewContainer` component wraps every plugin view in `<ErrorBoundary>` + `<Suspense>`, passing slot-specific props (`viewId`, `isActive`, `storage`)
- **VCONT-02**: The ErrorBoundary renders a fallback UI showing the plugin name, error message, and a "Reload View" button that remounts the component -- a plugin view crash does not take down the workbench
- **VCONT-03**: The Suspense fallback renders a loading skeleton appropriate to the slot (full-panel spinner for editor tabs, inline spinner for status bar widgets)

### SBAR: Status Bar Fix

- **SBAR-01**: The PluginLoader's `routeStatusBarItemContribution()` resolves the entrypoint module and uses the exported component as the render function, replacing the current `render: () => null` placeholder

### ETAB: Editor Tab Views

- **ETAB-01**: A `ViewTab` type exists alongside `PolicyTab` in the tab system, so plugin editor tabs appear in the tab bar with label, icon, and close button
- **ETAB-02**: Plugin editor tab components receive `EditorTabProps` extending `ViewProps` with `setTitle()` and `setDirty()` callbacks
- **ETAB-03**: Plugin views are openable via `paneStore.openApp("plugin:{pluginId}.{viewId}")` for split-pane support, with each pane receiving its own component instance

### ALIVE: Keep-Alive Tab State

- **ALIVE-01**: A `ViewTabRenderer` renders all opened plugin editor tabs simultaneously, hiding inactive tabs via `display: none` instead of unmounting, preserving component state (scroll position, form inputs, selections)
- **ALIVE-02**: The `isActive` prop is passed to plugin components so they can pause expensive operations (timers, subscriptions) when hidden
- **ALIVE-03**: An LRU eviction policy destroys the oldest hidden plugin view when the count of kept-alive views exceeds a configurable maximum (default 5)

### BPAN: Bottom Panel Tab Views

- **BPAN-01**: The bottom panel tab bar renders plugin-contributed tabs alongside built-in tabs (Problems, Test Runner, Evidence Pack, Explainability), sourced from the ViewRegistry `bottomPanelTab` slot
- **BPAN-02**: Plugin bottom panel tab components receive `BottomPanelTabProps` extending `ViewProps` with `panelHeight: number`

### RSIDE: Right Sidebar Panel Views

- **RSIDE-01**: The right sidebar renders plugin-contributed panels alongside built-in panels (Guard Config, Compare, Version History), sourced from the ViewRegistry `rightSidebarPanel` slot
- **RSIDE-02**: Plugin right sidebar panel components receive `RightSidebarPanelProps` extending `ViewProps` with `sidebarWidth: number`

### ABAR: Activity Bar Panel Views

- **ABAR-01**: The `navSections` array in `DesktopSidebar` is backed by a registry so plugins can add sidebar navigation items dynamically alongside built-in items
- **ABAR-02**: When a plugin activity bar item is active, the main content area renders the plugin panel component directly (bypassing react-router) via the ViewRegistry
- **ABAR-03**: Plugin activity bar panel components receive `ActivityBarPanelProps` extending `ViewProps` with `isCollapsed: boolean`

### GUTR: Gutter Decoration Extensions

- **GUTR-01**: A `GutterExtensionRegistry` collects CodeMirror `Extension` objects contributed by plugins, keyed by `"{pluginId}.{decorationId}"`
- **GUTR-02**: The yaml-editor includes all registered gutter extensions in its CodeMirror `EditorState` extension array, recompartmentalizing when extensions are added or removed
- **GUTR-03**: Plugin gutter contributions export a CodeMirror Extension factory function (not a React component), receiving a `GutterConfig` with editor state access

### CTXM: Context Menu Extensions

- **CTXM-01**: A `ContextMenuRegistry` stores context menu item declarations contributed by plugins, including `id`, `label`, `command` (command ID to execute), `icon`, `when` (visibility predicate), and `menu` (target: `editor`, `sidebar`, `tab`, `finding`, `sentinel`)
- **CTXM-02**: Context menu rendering evaluates the `when` predicate against current workbench context and shows/hides items accordingly
- **CTXM-03**: Clicking a plugin context menu item executes the referenced command via the existing command registry

### SDKV: SDK Views API

- **SDKV-01**: The `PluginContext` in `@clawdstrike/plugin-sdk` exposes a `views` namespace with `registerEditorTab()`, `registerBottomPanelTab()`, `registerRightSidebarPanel()`, and `registerStatusBarWidget()` methods, each returning a `Disposable`
- **SDKV-02**: SDK view contribution types accept either a React `ComponentType` directly (in-process) or a `() => Promise<{ default: ComponentType }>` lazy import function
- **SDKV-03**: The SDK exports all view prop interfaces (`ViewProps`, `EditorTabProps`, `BottomPanelTabProps`, `RightSidebarPanelProps`, `ActivityBarPanelProps`, `StatusBarWidgetProps`) for plugin authors to type their components

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VREG-01 | Phase 1 | Complete |
| VREG-02 | Phase 1 | Complete |
| VREG-03 | Phase 1 | Complete |
| VREG-04 | Phase 1 | Complete |
| VREG-05 | Phase 1 | Complete |
| VCONT-01 | Phase 1 | Complete |
| VCONT-02 | Phase 1 | Complete |
| VCONT-03 | Phase 1 | Complete |
| SBAR-01 | Phase 1 | Complete |
| SDKV-01 | Phase 1 | Complete |
| SDKV-02 | Phase 1 | Complete |
| SDKV-03 | Phase 1 | Complete |
| ETAB-01 | Phase 2 | Complete |
| ETAB-02 | Phase 2 | Complete |
| ETAB-03 | Phase 2 | Complete |
| ALIVE-01 | Phase 2 | Complete |
| ALIVE-02 | Phase 2 | Complete |
| ALIVE-03 | Phase 2 | Complete |
| BPAN-01 | Phase 3 | Complete |
| BPAN-02 | Phase 3 | Complete |
| RSIDE-01 | Phase 3 | Complete |
| RSIDE-02 | Phase 3 | Complete |
| ABAR-01 | Phase 4 | Pending |
| ABAR-02 | Phase 4 | Pending |
| ABAR-03 | Phase 4 | Pending |
| GUTR-01 | Phase 4 | Pending |
| GUTR-02 | Phase 4 | Pending |
| GUTR-03 | Phase 4 | Pending |
| CTXM-01 | Phase 4 | Pending |
| CTXM-02 | Phase 4 | Pending |
| CTXM-03 | Phase 4 | Pending |
