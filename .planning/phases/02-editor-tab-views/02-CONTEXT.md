# Phase 2: Editor Tab Views - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin components render in pane tabs via React.lazy + Suspense. Keep-alive state with LRU eviction. Split pane support for plugin tabs.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Plugin tabs open via paneStore.openApp("plugin:{pluginId}:{viewId}", label)
- PaneRouteRenderer checks ViewRegistry for plugin: prefixed routes
- Keep-alive via display:none with LRU eviction (max 5 hidden tabs)
- Each plugin view wrapped in ViewContainer (ErrorBoundary + Suspense)
- Tab bar shows plugin-contributed icon and label

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- ViewRegistry from Phase 1 (getViewsBySlot("editorTab"))
- ViewContainer from Phase 1 (ErrorBoundary + Suspense)
- PaneRouteRenderer (needs plugin route support)
- pane-store.ts openApp (already works with any route string)

</code_context>

<specifics>
## Specific Ideas
No specific requirements.
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>
