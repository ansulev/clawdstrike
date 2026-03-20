# Phase 4: Activity Bar, Gutters, and Context Menus - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Dynamic activity bar panel registration, CodeMirror gutter decoration extensions, and context menu item registration from plugins.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Activity bar: plugins register sidebar panels via ViewRegistry("activityBarPanel"), rendered alongside built-in items
- Gutters: CodeMirror Extension array recompartmentalization (not React components — CM gutter API)
- Context menus: registry with `when` predicates, items injected into Explorer/tab/editor context menus
- All use ViewContainer wrapper where applicable
- Built-in items unaffected by dynamic registration

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- ViewRegistry from Phase 1 (registerView with "activityBarPanel" slot)
- activity-bar-store.ts (ACTIVITY_BAR_ITEMS — opened to string in v1.0)
- sidebar-panel.tsx (switch statement — needs dynamic plugin panel rendering)
- yaml-editor.tsx (CodeMirror setup — gutter extension point)
- Command registry (context menu items can be commands with `when` predicates)

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/research/plugin-contributed-views.md` (gutter + context menu sections)
</specifics>

<deferred>
## Deferred Ideas
None — final phase.
</deferred>
