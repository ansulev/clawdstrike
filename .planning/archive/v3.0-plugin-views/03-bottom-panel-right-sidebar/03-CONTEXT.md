# Phase 3: Bottom Panel and Right Sidebar - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin tabs in bottom panel and right sidebar alongside built-ins. Plugin panels receive panelHeight/sidebarWidth props. Clean uninstall removes contributions.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Bottom panel reads from ViewRegistry("bottomPanelTab") + built-in tabs
- Right sidebar reads from ViewRegistry("rightSidebarPanel") + built-in panels
- Plugin panels wrapped in ViewContainer
- Uninstall disposes view registrations (already handled by loader)
- Plugin panels receive dimension props for responsive rendering

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- ViewRegistry from Phase 1
- bottom-pane.tsx (existing tab system)
- right-sidebar components (existing)
- ViewContainer (ErrorBoundary + Suspense)

</code_context>

<specifics>
## Specific Ideas
No specific requirements.
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>
