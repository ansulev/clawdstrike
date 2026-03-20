# Roadmap: Plugin-Contributed Views (v3.0)

## Overview

Close the gap between the plugin system's contribution point types (which already exist from v1.0) and actual view rendering. The ViewRegistry becomes the central switchboard routing plugin components to 7 visual slots. The journey starts with the registry + container foundation and status bar fix, then opens the highest-value slot (editor tabs with keep-alive), extends to bottom/right panels, and finishes with activity bar navigation, gutter decorations, and context menus.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: ViewRegistry Foundation** - Central view registry, ViewContainer with ErrorBoundary/Suspense, status bar fix, SDK ViewsApi
- [x] **Phase 2: Editor Tab Views** - Plugin components in pane tabs with keep-alive state preservation and LRU eviction
- [x] **Phase 3: Bottom Panel and Right Sidebar** - Plugin tabs in bottom panel and right sidebar alongside built-in panels
- [x] **Phase 4: Activity Bar, Gutters, and Context Menus** - Dynamic sidebar navigation, CodeMirror gutter extensions, and context menu items
- [ ] **Phase 5: Layout Wiring + SDK Injection** - Mount orphaned components in app layout, inject ViewsApi into PluginActivationContext, fix href/entrypoint bug

## Phase Details

### Phase 1: ViewRegistry Foundation
**Goal**: A central registry exists for plugin view contributions, every plugin view renders inside ErrorBoundary + Suspense isolation, and the status bar placeholder gap is closed
**Depends on**: Nothing (first phase; assumes v1.0 plugin infrastructure is complete)
**Requirements**: VREG-01, VREG-02, VREG-03, VREG-04, VREG-05, VCONT-01, VCONT-02, VCONT-03, SBAR-01, SDKV-01, SDKV-02, SDKV-03
**Success Criteria** (what must be TRUE):
  1. A plugin calling `ctx.views.registerEditorTab()` in its `activate()` hook causes the view to appear in `viewRegistry.getViewsBySlot("editorTab")`, and calling the returned dispose function removes it
  2. A plugin status bar widget declared with an `entrypoint` renders its actual component in the status bar instead of blank space
  3. When a plugin view component throws during render, the ErrorBoundary catches it and displays a fallback with the plugin name, error message, and a working "Reload View" button -- the rest of the workbench remains functional
  4. `useViewsBySlot("editorTab")` re-renders consuming components when a plugin registers or unregisters a view
**Plans:** 2 plans
Plans:
- [x] 01-01-PLAN.md -- ViewRegistry singleton + ViewContainer with ErrorBoundary/Suspense
- [x] 01-02-PLAN.md -- SDK ViewsApi + PluginLoader view routing + status bar fix

### Phase 2: Editor Tab Views
**Goal**: Plugins can open full-panel views in the editor area as tabs, with state preserved across tab switches and split-pane support
**Depends on**: Phase 1
**Requirements**: ETAB-01, ETAB-02, ETAB-03, ALIVE-01, ALIVE-02, ALIVE-03
**Success Criteria** (what must be TRUE):
  1. A plugin editor tab appears in the tab bar with its label and icon, and clicking it shows the plugin component in the editor area -- clicking a policy tab switches back to the policy editor
  2. Switching away from a plugin tab and back preserves the component's internal state (scroll position, form inputs, selections) without re-mounting
  3. Opening a plugin view via `paneStore.openApp("plugin:myPlugin.myView")` renders the plugin component in a split pane, and each pane instance has independent state
  4. When more than 5 hidden plugin tabs accumulate, the oldest hidden tab is destroyed (LRU eviction) and re-opening it creates a fresh mount
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md -- PluginViewTabStore + ViewTabRenderer with keep-alive and LRU eviction
- [x] 02-02-PLAN.md -- Tab bar integration + split-pane support + human verification

### Phase 3: Bottom Panel and Right Sidebar
**Goal**: Plugins can contribute tabs to the bottom panel and panels to the right sidebar, rendered alongside built-in panels
**Depends on**: Phase 1
**Requirements**: BPAN-01, BPAN-02, RSIDE-01, RSIDE-02
**Success Criteria** (what must be TRUE):
  1. A plugin-contributed bottom panel tab appears alongside Problems, Test Runner, Evidence Pack, and Explainability -- selecting it renders the plugin component with the correct `panelHeight` prop
  2. A plugin-contributed right sidebar panel appears alongside Guard Config, Compare, and Version History -- selecting it renders the plugin component with the correct `sidebarWidth` prop
  3. Uninstalling a plugin that contributed panel views removes its tabs/panels from both the bottom panel and right sidebar without breaking other panels
**Plans:** 1 plan
Plans:
- [x] 03-01-PLAN.md -- BottomPanelTabs + RightSidebarPanels components with plugin view integration

### Phase 4: Activity Bar, Gutters, and Context Menus
**Goal**: Plugins can add sidebar navigation items, CodeMirror gutter decorations, and context menu items to the workbench
**Depends on**: Phase 1, Phase 3
**Requirements**: ABAR-01, ABAR-02, ABAR-03, GUTR-01, GUTR-02, GUTR-03, CTXM-01, CTXM-02, CTXM-03
**Success Criteria** (what must be TRUE):
  1. A plugin-contributed activity bar item appears in the sidebar navigation, and clicking it renders the plugin panel component in the main content area without a page navigation/route change
  2. A plugin-contributed gutter decoration (e.g., severity markers) appears in the CodeMirror editor gutter for open policy files, and installing/uninstalling the plugin adds/removes the gutter without reloading the editor
  3. A plugin-contributed context menu item appears when right-clicking in the specified context (editor, sidebar, tab, finding), respects the `when` visibility predicate, and executes the referenced command when clicked
  4. Built-in sidebar items, gutters, and context menus continue to work identically after the dynamic registration changes
**Plans:** 3 plans
Plans:
- [x] 04-01-PLAN.md -- Activity bar plugin items in DesktopSidebar + panel rendering in DesktopLayout
- [x] 04-02-PLAN.md -- GutterExtensionRegistry + CodeMirror Compartment integration in yaml-editor
- [x] 04-03-PLAN.md -- ContextMenuRegistry with when-clause predicates + PluginContextMenuItems component

### Phase 5: Layout Wiring + SDK Injection
**Goal**: All orphaned plugin view components are mounted in the live app layout, ViewsApi is injected into PluginActivationContext, and the href/entrypoint bug is fixed
**Depends on**: Phase 4
**Requirements**: BPAN-01, BPAN-02, RSIDE-01, RSIDE-02, CTXM-03
**Gap Closure**: Closes gaps from v3.0 audit
**Success Criteria** (what must be TRUE):
  1. Plugin bottom panel tabs appear alongside built-in tabs in the policy editor bottom panel
  2. Plugin right sidebar panels appear alongside built-in panels in the editor right sidebar
  3. Plugin context menu items appear in tab right-click menu with when-clause filtering
  4. Plugin activate() receives a PluginContext with working views.registerEditorTab() method
  5. ActivityBarItemContribution uses entrypoint (not href) for module loading
**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md -- Mount BottomPanelTabs + RightSidebarPanels + PluginContextMenuItems in app layout
- [ ] 05-02-PLAN.md -- Inject ViewsApi into PluginActivationContext + fix entrypoint bug

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. ViewRegistry Foundation | 2/2 | Complete | 2026-03-19 |
| 2. Editor Tab Views | 2/2 | Complete | 2026-03-19 |
| 3. Bottom Panel and Right Sidebar | 1/1 | Complete | 2026-03-19 |
| 4. Activity Bar, Gutters, and Context Menus | 3/3 | Complete | 2026-03-19 |
| 5. Layout Wiring + SDK Injection | 0/2 | Not started | - |
