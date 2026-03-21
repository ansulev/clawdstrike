# Phase 5: Layout Wiring + SDK Injection - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Mount orphaned Phase 3+4 components into the live app layout, inject ViewsApi into PluginActivationContext, and fix the href/entrypoint bug. Pure wiring — no new components.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — wiring phase. Key tasks from audit:

1. **Mount BottomPanelTabs** — Import in policy-editor.tsx, pass builtInTabs/panelHeight/activeTabId/onTabChange
2. **Mount RightSidebarPanels** — Import in policy-editor.tsx, pass builtInPanels/sidebarWidth/activePanelId/onPanelChange
3. **Embed PluginContextMenuItems** — Import in policy-tab-bar.tsx TabContextMenu, pass menu="tab" + context + onExecuteCommand
4. **Inject ViewsApi** — Construct concrete ViewsApi implementation in PluginLoader, inject into PluginActivationContext
5. **Fix href/entrypoint** — Add `entrypoint` field to ActivityBarItemContribution, use it instead of `href` for lazy loading

</decisions>

<code_context>
## Existing Code Insights

### Files to Modify
- `apps/workbench/src/components/workbench/editor/policy-editor.tsx` — mount BottomPanelTabs + RightSidebarPanels
- `apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx` — embed PluginContextMenuItems in TabContextMenu
- `apps/workbench/src/lib/plugins/plugin-loader.ts` — inject ViewsApi, fix entrypoint routing
- `packages/sdk/plugin-sdk/src/types.ts` — add entrypoint to ActivityBarItemContribution

### Components to Wire
- `BottomPanelTabs` from `components/workbench/editor/bottom-panel-tabs.tsx`
- `RightSidebarPanels` from `components/workbench/editor/right-sidebar-panels.tsx`
- `PluginContextMenuItems` from `components/plugins/plugin-context-menu.tsx`

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/v3.0-MILESTONE-AUDIT.md` (gap details)
</specifics>

<deferred>
## Deferred Ideas
None — final gap closure phase.
</deferred>
