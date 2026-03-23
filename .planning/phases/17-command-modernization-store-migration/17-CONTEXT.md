# Phase 17: Command Modernization & Store Migration - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Modernize file.new command to use direct store calls, migrate ~20 components from useMultiPolicy()/useWorkbench() bridge hooks to direct usePolicyTabsStore/usePolicyEditStore/useWorkbenchUIStore calls, then delete multi-policy-store.tsx (975 lines) and MultiPolicyProvider.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — mechanical refactoring:

1. **file.new modernization (CMD-01, CMD-02)**: Replace `newPolicy()` injection in file.new command with direct `usePolicyTabsStore.getState().newTab()` call. Remove `newPolicy` from `FileCommandDeps` interface. The `edit.newTab` command already does this correctly — use it as the reference pattern.

2. **Component migration (STORE-01 through STORE-03)**: For each component calling `useMultiPolicy()` or `useWorkbench()`:
   - Read the bridge hook to understand which underlying stores it accesses
   - Replace with direct imports from `policy-tabs-store`, `policy-edit-store`, or `workbench-ui-store`
   - `useMultiPolicy()` provides: tabs, activeTab, dispatch (multiDispatch), state
   - `useWorkbench()` provides: state (activePolicy), dispatch, yaml, dirty, etc.
   - Map each usage to the correct underlying store

3. **Bridge deletion (STORE-04, STORE-05)**: After all consumers migrated, delete `multi-policy-store.tsx`. Remove `MultiPolicyProvider` from any component tree (currently an empty fragment in App.tsx or similar).

Known consumers (~20 files):
- split-editor.tsx (4 callsites — heaviest user)
- editor-home-tab.tsx, policy-tab-bar.tsx, test-runner-panel.tsx, policy-command-center.tsx
- bulk-operations-dialog.tsx, status-bar.tsx, desktop-layout.tsx, home-page.tsx
- simulator-layout.tsx, hunt-layout.tsx, sentinel-swarm-pages.tsx
- deploy-panel.tsx, sdk-integration-tab.tsx
- use-auto-save.ts, init-commands.tsx

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePolicyTabsStore` — tabs, activeTabId, switchTab, newTab, setDirty, setFilePath, etc.
- `usePolicyEditStore` — editStates map, setYaml, markClean, isDirty, getTabEditState
- `useWorkbenchUIStore` — sidebar/editor tab UI state (49 lines)
- `edit.newTab` in edit-commands.ts — reference pattern for direct store newTab call

### The Bridge Layer
- `useMultiPolicy()` hook at multi-policy-store.tsx composes tabs + edit + UI stores
- `useWorkbench()` hook provides workbenchState (activePolicy, yaml) + dispatch
- `multiDispatch` maps to policy-tabs-store and policy-edit-store actions
- Both hooks are deprecated bridge hooks per the file header

### Integration Points
- App.tsx — remove MultiPolicyProvider wrapper (already empty fragment)
- init-commands.tsx — registers commands with deps from bridge hooks
- All ~20 consumer files listed above

</code_context>

<specifics>
Reference: edit.newTab in edit-commands.ts (lines 46-51) already uses the direct store pattern.
</specifics>

<deferred>
- Further policy-store.tsx (681 lines) decomposition — separate concern
- workbench-ui-store consolidation — only 49 lines, not worth splitting further
</deferred>
