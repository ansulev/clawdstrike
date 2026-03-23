# Phase 11: Integration Wiring Fixes - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix broken cross-phase wiring from the file-first editor cutover. Dead gutter buttons, stale navigate("/editor") calls, legacy store dispatch, and dead code cleanup. All issues identified by v1.3 milestone audit.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — concrete bug-fix phase with well-defined solutions from the audit integration checker:

1. **Gutter play button fix:** Wire `onRunGuardTest` in FileEditorShell mirroring `yaml-preview-panel.tsx` lines 82-114. Use `generateScenariosFromPolicy`, `testScenarioToSuite`, and test runner dispatch.

2. **navigate("/editor") replacement:** Replace all 7 non-PolicyEditor call sites with `usePaneStore.getState().openFile()` or `openApp()`. Specific files:
   - `edit-commands.ts` line 48 (edit.newTab)
   - `file-commands.ts` lines 99, 109 (file.new, file.open)
   - `policy-commands.ts` line 51
   - `guards-page.tsx` line 622
   - `library-gallery.tsx` line 257
   - `sentinel-swarm-pages.tsx` line 545

3. **edit.newTab fix:** Replace `multiDispatch({ type: "NEW_TAB" })` with `usePolicyTabsStore.getState().newTab()` followed by `usePaneStore.getState().openApp("/file/__new__/" + newTabId)`.

4. **Dead code removal:** Remove `policy-editor.tsx` (dead after file-first cutover) and its navigate("/editor") calls. Clean up duplicate nav/app commands from command palette.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateScenariosFromPolicy` from `@/lib/workbench/test-scenario-generator` — generates guard test scenarios
- `testScenarioToSuite` helper in `yaml-preview-panel.tsx` line 25 — converts TestScenario to SuiteScenario
- `useTestRunner` hook from `@/lib/workbench/test-store` — provides dispatch for IMPORT_SCENARIOS
- `usePaneStore.openFile(absPath, name)` — opens file as pane tab
- `usePaneStore.openApp(route, label)` — opens app route as pane tab
- `usePolicyTabsStore.newTab()` — creates new untitled tab in file-first store

### Established Patterns
- FileEditorShell wraps content with `<TestRunnerProvider>` — test runner context already available
- `useWorkbench().state.activePolicy` provides current policy for scenario generation
- `usePolicyEditStore` manages per-tab editing state
- `isPolicyFileType()` gates policy-only features

### Integration Points
- `FileEditorShell` at `apps/workbench/src/features/editor/file-editor-shell.tsx` — needs `onRunGuardTest` callback
- `YamlEditor` accepts `onRunGuardTest` prop (already defined in interface)
- Command registries in `src/lib/commands/` — edit, file, policy commands
- `guards-page.tsx`, `library-gallery.tsx`, `sentinel-swarm-pages.tsx` — non-command call sites

</code_context>

<specifics>
## Specific Ideas

All fixes are derived from the v1.3 audit integration checker findings (MISSING-01, MISSING-02, MISSING-04). No additional requirements.

</specifics>

<deferred>
## Deferred Ideas

- Extract `testScenarioToSuite` to shared module (currently duplicated in yaml-preview-panel.tsx and guard-card.tsx)
- Resolve Meta+W keybinding conflict between tab.close and edit.closeTab
- Search staleness guard for rapid typing

</deferred>
