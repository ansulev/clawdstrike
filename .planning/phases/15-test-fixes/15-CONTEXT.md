# Phase 15: Test Fixes - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 3 failing test files: App.test.tsx (unmocked ActivityBar), desktop-layout.test.tsx (stale DesktopSidebar mock), shortcut-provider.test.tsx (transitive deps). All tests must pass with `npm test`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — concrete test fixes:

1. **App.test.tsx**: Mock `ActivityBar` and its heavy transitive imports (`useOperator`, `useFleetConnection`, `useFindings`, `SIGIL_SYMBOLS`). The test renders the full app tree — ActivityBar pulls in deep dependency chains that break in jsdom.

2. **desktop-layout.test.tsx**: Replace stale `DesktopSidebar` mock with mocks for the actual imports: `ActivityBar` from `@/features/activity-bar/components/activity-bar`, `SidebarPanel` and `SidebarResizeHandle` from `@/features/activity-bar/components/`. The mock at line 44 targets a path (`@/components/desktop/desktop-sidebar`) that is no longer imported.

3. **shortcut-provider.test.tsx**: Check if transitive deps from `multi-policy-store` or `pane-store` cause jsdom failures. Mock as needed.

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- `apps/workbench/src/__tests__/App.test.tsx` — renders full app, expects sidebar labels
- `apps/workbench/src/components/desktop/__tests__/desktop-layout.test.tsx` — stale mock path
- `apps/workbench/src/components/desktop/__tests__/shortcut-provider.test.tsx` — uses renderWithProviders
- `apps/workbench/src/features/activity-bar/components/activity-bar.tsx` — the actual component tree
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` — sidebar panels

### Integration Points
- vitest config at `apps/workbench/vitest.config.ts`
- Test utilities at `apps/workbench/src/test-utils/` (if exists)

</code_context>

<specifics>
No specific requirements beyond making tests pass.
</specifics>

<deferred>
None — discussion stayed within phase scope.
</deferred>
