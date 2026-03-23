---
phase: 17-command-modernization-store-migration
plan: 02
subsystem: ui
tags: [zustand, react, store-migration, bridge-removal]

requires:
  - phase: 17-command-modernization-store-migration
    provides: Zustand stores (policy-tabs-store, policy-edit-store, workbench-ui-store)
provides:
  - 31 production files migrated from useWorkbench/useMultiPolicy bridge hooks to direct Zustand store calls
  - 15 remaining files deferred to Plan 03 (complex helper-method consumers)
affects: [17-03, store-deletion]

tech-stack:
  added: []
  patterns:
    - "usePolicyTabsStore(s => s.activeTabId) pattern for tab state"
    - "usePolicyEditStore(s => s.editStates.get(tabId)) for per-tab editing"
    - "useWorkbenchUIStore(s => s.sidebarCollapsed) for UI chrome"
    - "Direct store.getState().method() calls replace dispatch({type:...})"

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/editor/editor-visual-panel.tsx
    - apps/workbench/src/components/workbench/editor/inheritance-chain.tsx
    - apps/workbench/src/components/workbench/editor/guard-card.tsx
    - apps/workbench/src/components/workbench/editor/yaml-preview-panel.tsx
    - apps/workbench/src/components/workbench/editor/base-ruleset-selector.tsx
    - apps/workbench/src/components/workbench/editor/settings-panel.tsx
    - apps/workbench/src/components/workbench/editor/origin-editor.tsx
    - apps/workbench/src/components/workbench/editor/live-agent-tab.tsx
    - apps/workbench/src/components/workbench/guards/guards-page.tsx
    - apps/workbench/src/components/workbench/origins/origins-page.tsx
    - apps/workbench/src/components/workbench/compliance/compliance-dashboard.tsx
    - apps/workbench/src/components/workbench/compliance/framework-detail.tsx
    - apps/workbench/src/components/workbench/hierarchy/hierarchy-page.tsx
    - apps/workbench/src/components/workbench/receipts/receipt-inspector.tsx
    - apps/workbench/src/components/workbench/compare/compare-layout.tsx
    - apps/workbench/src/components/workbench/compare/policy-selector.tsx
    - apps/workbench/src/components/workbench/simulator/scenario-builder.tsx
    - apps/workbench/src/components/workbench/simulator/observe-synth-panel.tsx
    - apps/workbench/src/components/workbench/simulator/trustprint-lab.tsx
    - apps/workbench/src/components/workbench/simulator/threat-matrix.tsx
    - apps/workbench/src/components/workbench/simulator/fleet-testing-panel.tsx
    - apps/workbench/src/components/workbench/workbench-sidebar.tsx
    - apps/workbench/src/components/desktop/desktop-sidebar.tsx
    - apps/workbench/src/components/desktop/titlebar.tsx
    - apps/workbench/src/components/desktop/desktop-layout.tsx
    - apps/workbench/src/components/workbench/library/policy-card.tsx
    - apps/workbench/src/features/editor/file-editor-shell.tsx
    - apps/workbench/src/features/editor/file-editor-toolbar.tsx
    - apps/workbench/src/features/activity-bar/panels/heartbeat-panel.tsx
    - apps/workbench/src/features/activity-bar/panels/compliance-panel.tsx
    - apps/workbench/src/features/policy/use-auto-save.ts

key-decisions:
  - "Used usePolicyTabsStore/usePolicyEditStore selectors for reactive reads instead of reconstructing full PolicyTab objects"
  - "dispatch({type:'...'}) replaced with direct store method calls (e.g. usePolicyEditStore.getState().updateGuard())"
  - "15 complex helper-method consumers (loadPolicy, saveFile, exportYaml, openFile, etc.) deferred -- require careful inline reimplementation"
  - "useWorkbenchUIStore used for sidebar/editor-tab/sync-direction (3 files)"

patterns-established:
  - "Pattern: read active tab state = usePolicyTabsStore(s => s.activeTabId) + usePolicyEditStore(s => s.editStates.get(id))"
  - "Pattern: mutations = store.getState().method() + usePolicyTabsStore.getState().setDirty(id, true)"

requirements-completed: [STORE-03]

duration: 23min
completed: 2026-03-23
---

# Phase 17 Plan 02: Consumer Migration Summary

**Migrated 31 of ~46 production consumer files from useWorkbench()/useMultiPolicy() bridge hooks to direct usePolicyTabsStore/usePolicyEditStore/useWorkbenchUIStore Zustand calls**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-23T00:10:35Z
- **Completed:** 2026-03-23T00:33:39Z
- **Tasks:** 2 (Task 1 complete, Task 2 partial)
- **Files modified:** 31

## Accomplishments
- 28 useWorkbench()-only consumer files fully migrated (Task 1)
- 3 additional useMultiPolicy/useWorkbench consumers migrated (desktop-layout, policy-card, use-auto-save)
- Zero new TypeScript errors -- all 31 files compile clean
- All dispatch({type:"..."}) calls replaced with direct store method calls
- Import/dependency cleanup: no multi-policy-store imports in migrated files

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate useWorkbench()-only consumers** - `2b6cd441d` (refactor)
2. **Task 2: Migrate useMultiPolicy + mixed consumers (partial)** - `67fc01774` (refactor)

## Files Created/Modified
- 28 editor/component files migrated in Task 1 (guards, compliance, compare, simulator, sidebar, titlebar, etc.)
- 3 files migrated in Task 2 (desktop-layout, policy-card, use-auto-save)
- See key-files.modified in frontmatter for complete list

## Decisions Made
- Direct Zustand selectors preferred over reconstructing full PolicyTab shape
- dispatch() calls mapped to store.getState().method() with explicit setDirty() calls
- 15 complex files deferred: they use helper methods (loadPolicy, saveFile, exportYaml, openFile, saveFileAs, copyYaml, newPolicy, etc.) that need careful inline reimplementation with Tauri bridge calls

## Deviations from Plan

### Partial Task 2 Completion

**Task 2 was partially completed (3 of 18 files migrated).**

- **Issue:** 15 files use complex helper methods from useWorkbench() (loadPolicy, saveFile, exportYaml, openFile, etc.) that call Tauri bridge functions and compose multiple store operations. Mechanical regex replacement was insufficient for these patterns.
- **Files deferred:** policy-tab-bar, bulk-operations-dialog, policy-command-center, deploy-panel, sdk-integration-tab, test-runner-panel, sentinel-swarm-pages, hunt-layout, home-page, simulator-layout, workbench-topbar, library-gallery, import-export, catalog-browser, status-bar
- **Impact:** These 15 files still use bridge hooks but the bridge layer remains functional. Plan 03 can handle these as part of the bridge deletion work, or they can be migrated in a follow-up plan.

---

**Total deviations:** 1 (partial Task 2 completion)
**Impact on plan:** 31 of ~46 consumer call sites migrated (67%). Remaining 15 files require more complex inline reimplementation. Bridge layer still functional for unmigrated files.

## Issues Encountered
- File watcher/linter interference: some edit tools had changes reverted by external processes. Resolved by using Bash-based Node.js scripts for atomic file writes.
- Multi-component files (e.g., guards-page.tsx with 500+ lines having multiple components) required multiple passes to catch all useWorkbench() calls within sub-components.
- Naming collisions: compare-layout.tsx and yaml-preview-panel.tsx had local `activeTab` state variables conflicting with store's `activeTab` selector. Resolved by renaming store variable to `storeTab` or removing unused selector.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 can proceed with bridge deletion for the 31 migrated files
- 15 remaining files need inline helper method reimplementation before their bridge imports can be removed
- TypeScript compiles clean -- no regressions introduced

---
*Phase: 17-command-modernization-store-migration*
*Completed: 2026-03-23*
