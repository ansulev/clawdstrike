---
phase: 05-layout-wiring-sdk-injection
plan: 01
subsystem: ui
tags: [react, plugin-views, bottom-panel, right-sidebar, context-menu, layout-wiring]

# Dependency graph
requires:
  - phase: 03-right-sidebar-bottom-panel-commands
    provides: BottomPanelTabs and RightSidebarPanels components
  - phase: 04-lab-decomposition-app-navigation
    provides: PluginContextMenuItems component with when-clause filtering
provides:
  - BottomPanelTabs mounted in policy-editor.tsx with Problems, Test Runner, Evidence Pack, Explainability built-in tabs
  - RightSidebarPanels mounted in policy-editor.tsx with Version History, Evidence Pack, Explainability, Publish built-in panels
  - PluginContextMenuItems embedded in TabContextMenu for tab right-click context menu
affects: [05-02-PLAN, plugin-sdk-injection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unified panel state via single rightSidebarPanelId replacing 4 boolean state variables"
    - "builtInTabs/builtInPanels arrays via useMemo for decoupled component composition"

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/editor/policy-editor.tsx
    - apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx

key-decisions:
  - "Replaced 4 independent sidebar booleans (historyOpen, evidenceOpen, explainOpen, publishOpen) with single rightSidebarPanelId string state"
  - "BottomPanelTabs replaces standalone TestRunnerPanel in resizable bottom panel, adding Problems/Evidence/Explainability as tabs"
  - "RightSidebarPanels uses fragment return for parent flex positioning, replacing 4 conditional sidebar divs"

patterns-established:
  - "Built-in tab/panel arrays defined via useMemo and passed as props to plugin-aware container components"
  - "Single panel ID state variable for mutually-exclusive sidebar panels (radio-button pattern)"

requirements-completed: [BPAN-01, BPAN-02, RSIDE-01, RSIDE-02, CTXM-03]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 5 Plan 1: Layout Wiring Summary

**BottomPanelTabs, RightSidebarPanels, and PluginContextMenuItems mounted in live app layout, closing 3 v3.0 integration gaps**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T23:56:17Z
- **Completed:** 2026-03-21T12:40:02Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- BottomPanelTabs mounted in policy-editor.tsx bottom panel with 4 built-in tabs (Problems, Test Runner, Evidence Pack, Explainability) -- plugin views auto-appear via ViewRegistry
- RightSidebarPanels mounted in policy-editor.tsx replacing 4 independent conditional sidebar blocks with unified component and single panel ID state
- PluginContextMenuItems embedded in TabContextMenu of policy-tab-bar.tsx with menu="tab" and tabId WhenContext

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount BottomPanelTabs in policy-editor.tsx bottom panel area** - `cb35c7eac` (feat)
2. **Task 2: Mount RightSidebarPanels in policy-editor.tsx right sidebar area** - `26e431f5e` (feat)
3. **Task 3: Embed PluginContextMenuItems in TabContextMenu** - `50ae43943` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/policy-editor.tsx` - Added BottomPanelTabs import/render with builtInTabs array, RightSidebarPanels import/render with builtInPanels array, replaced 4 boolean sidebar states with single rightSidebarPanelId
- `apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx` - Added PluginContextMenuItems import/render inside TabContextMenu with menu="tab" and WhenContext

## Decisions Made
- Replaced 4 independent sidebar booleans (historyOpen, evidenceOpen, explainOpen, publishOpen) with single `rightSidebarPanelId` string state -- cleaner mutual exclusion, fewer state variables
- BottomPanelTabs replaces standalone TestRunnerPanel in the resizable bottom panel area, adding Problems/Evidence/Explainability as additional tabs alongside Test Runner
- Kept showProblems standalone rendering in the non-testRunner branch for backward compat -- Problems panel shows inline when bottom panel is closed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 orphaned components are now mounted and reachable in the live app
- Phase 5 Plan 2 (SDK injection + entrypoint bug fix) can proceed independently
- Plugin-contributed bottom panel tabs, right sidebar panels, and context menu items will now appear at runtime when plugins register views

## Self-Check: PASSED

- All 3 source/summary files exist on disk
- All 3 task commits verified in git log (cb35c7eac, 26e431f5e, 50ae43943)
- BottomPanelTabs: 3 references in policy-editor.tsx (import + memo comment + render)
- RightSidebarPanels: 3 references in policy-editor.tsx (import + memo comment + render)
- PluginContextMenuItems: 2 references in policy-tab-bar.tsx (import + render)

---
*Phase: 05-layout-wiring-sdk-injection*
*Completed: 2026-03-21*
