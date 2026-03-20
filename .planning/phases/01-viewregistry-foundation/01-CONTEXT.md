# Phase 1: ViewRegistry Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Central ViewRegistry for all view contribution slots, ViewContainer with ErrorBoundary/Suspense, fix status bar `render: () => null` gap, SDK ViewsApi for plugin authors.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance:
- ViewRegistry extends the proven status-bar-registry pattern (Map + snapshot + listeners)
- Single registry handles all slot types: editorTab, bottomPanelTab, rightSidebarPanel, activityBarPanel, statusBarWidget, gutterDecoration, contextMenuItem
- ViewContainer wraps plugin components in ErrorBoundary + Suspense with fallback UI
- Fix existing status bar items that render `() => null` — they should render real components
- SDK gains ViewsApi namespace on PluginContext for registerEditorTab, registerBottomPanelTab, etc.
- useViewsBySlot(slot) hook for reactive rendering from registry
- All register functions return Disposable for clean unregistration

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- status-bar-registry.ts (Phase 1 v1.0) — proven Map + snapshot + listeners pattern
- guard-registry.ts — Map + Proxy + Disposable pattern
- Plugin SDK context.ts — PluginContext interface to extend
- ErrorBoundary pattern from existing workbench components

### Integration Points
- status-bar.tsx (fix render gap)
- Plugin SDK context.ts (add ViewsApi)
- Plugin loader (route view contributions)

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-contributed-views.md`

</specifics>

<deferred>
## Deferred Ideas

- Editor tab rendering (Phase 2)
- Bottom panel + right sidebar rendering (Phase 3)
- Activity bar + gutters + context menus (Phase 4)

</deferred>
