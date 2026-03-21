---
phase: 03-bottom-panel-right-sidebar
plan: 01
subsystem: ui
tags: [react, view-registry, bottom-panel, right-sidebar, plugin-views, vitest]

# Dependency graph
requires:
  - phase: 01-viewregistry-foundation
    provides: ViewRegistry singleton with useViewsBySlot hook, ViewContainer with ErrorBoundary/Suspense
provides:
  - BottomPanelTabs component merging built-in + plugin bottom panel tabs
  - RightSidebarPanels component merging built-in + plugin right sidebar panels
  - BuiltInTab and BuiltInPanel interfaces for caller-provided panel definitions
affects: [policy-editor integration, phase-4-activity-bar]

# Tech tracking
tech-stack:
  added: []
  patterns: [plugin-view-wrapper-injection, unified-tab-descriptor, toggle-deselect-pattern]

key-files:
  created:
    - apps/workbench/src/components/workbench/editor/bottom-panel-tabs.tsx
    - apps/workbench/src/components/workbench/editor/__tests__/bottom-panel-tabs.test.tsx
    - apps/workbench/src/components/workbench/editor/right-sidebar-panels.tsx
    - apps/workbench/src/components/workbench/editor/__tests__/right-sidebar-panels.test.tsx
  modified: []

key-decisions:
  - "BuiltInTab/BuiltInPanel interfaces decouple components from specific built-in panels -- caller passes definitions"
  - "Plugin view wrappers (BottomPanelPluginView, RightSidebarPluginView) use useMemo to clone registration with injected slot-specific props"
  - "RightSidebarPanels returns a fragment (content + icon strip) for parent flex positioning instead of wrapping in a container"
  - "Unified tab/panel descriptors merge built-in and plugin entries with type discriminator for render dispatch"

patterns-established:
  - "Plugin-view-wrapper pattern: clone ViewRegistration with wrapped component that injects slot-specific props (panelHeight, sidebarWidth)"
  - "Unified descriptor pattern: merge built-in items (with ReactNode content) and plugin items (with ViewRegistration) into single sorted array"
  - "Toggle-deselect: clicking active panel button calls onPanelChange(null) to close sidebar"

requirements-completed: [BPAN-01, BPAN-02, RSIDE-01, RSIDE-02]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 3 Plan 1: Bottom Panel and Right Sidebar Summary

**BottomPanelTabs and RightSidebarPanels components wiring plugin-contributed views from ViewRegistry alongside built-in panels with slot-specific prop injection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T12:46:55Z
- **Completed:** 2026-03-19T12:50:51Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- BottomPanelTabs component renders a tab bar merging built-in tabs (Problems, Test Runner, etc.) with plugin tabs from useViewsBySlot("bottomPanelTab"), injecting panelHeight to plugin views
- RightSidebarPanels component renders a vertical icon strip with toggle buttons for built-in and plugin panels from useViewsBySlot("rightSidebarPanel"), injecting sidebarWidth to plugin views
- Both components use ViewContainer for ErrorBoundary + Suspense isolation of plugin views
- Plugin tab/panel disposal removes entries from UI without breaking other panels
- 13 new tests (6 + 7) all passing, plus 14 existing Phase 1 tests unbroken (27 total verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: BottomPanelTabs component with built-in + plugin tab bar** - `50096c479` (feat)
2. **Task 2: RightSidebarPanels component with built-in + plugin panel selector** - `95fa6dfad` (feat)

_Both tasks followed TDD: RED (test fails on missing module) -> GREEN (implementation passes all tests)_

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/bottom-panel-tabs.tsx` - BottomPanelTabs component with BuiltInTab interface, plugin tab merging, and BottomPanelPluginView wrapper
- `apps/workbench/src/components/workbench/editor/__tests__/bottom-panel-tabs.test.tsx` - 6 tests covering built-in rendering, plugin rendering, tab switching, ViewContainer rendering, disposal, panelHeight
- `apps/workbench/src/components/workbench/editor/right-sidebar-panels.tsx` - RightSidebarPanels component with BuiltInPanel interface, plugin panel merging, and RightSidebarPluginView wrapper
- `apps/workbench/src/components/workbench/editor/__tests__/right-sidebar-panels.test.tsx` - 7 tests covering built-in rendering, plugin rendering, panel switching, ViewContainer rendering, disposal, sidebarWidth, toggle-deselect

## Decisions Made
- BuiltInTab/BuiltInPanel interfaces decouple components from specific built-in panels -- the caller passes definitions as props, making the components reusable
- Plugin view wrappers clone the ViewRegistration with a component that injects slot-specific props (panelHeight/sidebarWidth) via useMemo for stable references
- RightSidebarPanels returns a React fragment rather than wrapping itself, letting the parent control flex layout positioning
- Unified tab/panel descriptors merge built-in and plugin entries using a type discriminator for render dispatch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both components are self-contained and ready for integration into policy-editor.tsx (the actual wiring of BottomPanelTabs and RightSidebarPanels into the policy editor layout is a follow-up integration task)
- Phase 4 (Activity Bar, Gutters, Context Menus) can proceed; it depends on Phase 1 and Phase 3 which are now both complete
- Phase 2 (Editor Tab Views) is independent and can proceed in parallel

## Self-Check: PASSED

- FOUND: apps/workbench/src/components/workbench/editor/bottom-panel-tabs.tsx
- FOUND: apps/workbench/src/components/workbench/editor/__tests__/bottom-panel-tabs.test.tsx
- FOUND: apps/workbench/src/components/workbench/editor/right-sidebar-panels.tsx
- FOUND: apps/workbench/src/components/workbench/editor/__tests__/right-sidebar-panels.test.tsx
- FOUND: .planning/phases/03-bottom-panel-right-sidebar/03-01-SUMMARY.md
- FOUND: commit 50096c479
- FOUND: commit 95fa6dfad

---
*Phase: 03-bottom-panel-right-sidebar*
*Completed: 2026-03-19*
