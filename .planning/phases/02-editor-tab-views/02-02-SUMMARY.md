---
phase: 02-editor-tab-views
plan: 02
subsystem: ui
tags: [react, tab-bar, split-pane, plugin-views, editor-tabs, view-registry]

# Dependency graph
requires:
  - phase: 02-editor-tab-views
    plan: 01
    provides: PluginViewTabStore (open/close/activate/LRU), ViewTabRenderer (keep-alive display:none), useSyncExternalStore hooks
  - phase: 01-viewregistry-foundation
    provides: ViewRegistry (registerView, getView, useViewsBySlot), ViewContainer (ErrorBoundary+Suspense)
provides:
  - Plugin view tabs rendered in PolicyTabBar with label, blue indicator, dirty dot, close button
  - ViewTabRenderer in PolicyEditor for active plugin view tabs
  - Split-pane secondary pane rendering plugin views via ViewContainer with independent state
  - New-tab dropdown with registered plugin editor views
affects: [activity-bar-navigation, plugin-marketplace, end-to-end-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [plugin-prefix-id-routing, conditional-view-tab-rendering]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx
    - apps/workbench/src/components/workbench/editor/policy-editor.tsx
    - apps/workbench/src/components/workbench/editor/split-editor.tsx

key-decisions:
  - "activatePluginViewTab(null) called on policy tab switch to ensure clean bidirectional switching between policy and plugin tabs"
  - "plugin: prefix for splitTabId distinguishes plugin views from policy tabs without changing multi-policy-store types"
  - "ViewContainer used in split pane (not ViewTabRenderer) so each pane instance has independent state per ETAB-03"

patterns-established:
  - "Plugin prefix routing: splitTabId starting with 'plugin:' triggers plugin view rendering path"
  - "Conditional editor area: activePluginViewTabId gates between ViewTabRenderer and normal policy editor chain"

requirements-completed: [ETAB-01, ETAB-03]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 2 Plan 2: Tab Bar Integration + Split-Pane Support Summary

**Plugin view tabs wired into PolicyTabBar with blue indicator dots and into split-pane secondary pane via ViewContainer for independent state per pane instance**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T13:23:37Z
- **Completed:** 2026-03-19T13:30:11Z
- **Tasks:** 3 (2 auto + 1 auto-approved checkpoint)
- **Files modified:** 3

## Accomplishments
- Plugin view tabs appear in PolicyTabBar after policy tabs with blue indicator dot, dirty dot, label, and close button
- PolicyEditor renders ViewTabRenderer when a plugin view tab is active, with clean bidirectional switching to/from policy tabs
- Split-pane PaneTabSelector offers open plugin view tabs as secondary pane options with [Plugin] label suffix
- Secondary pane renders plugin views via ViewContainer for independent component state per pane instance
- New-tab dropdown shows registered plugin editor views below a separator with "plugin" tag

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate plugin view tabs into PolicyTabBar and PolicyEditor** - `76319a9b0` (feat)
2. **Task 2: Add split-pane support for plugin view tabs** - `4c3dffaa7` (feat)
3. **Task 3: Verify plugin editor tab integration end-to-end** - Auto-approved (checkpoint)

## Files Created/Modified
- `apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx` - Added plugin view tab rendering after policy tabs, activatePluginViewTab(null) on policy switch, plugin views in new-tab dropdown
- `apps/workbench/src/components/workbench/editor/policy-editor.tsx` - Added ViewTabRenderer conditional render when activePluginViewTabId is non-null, before existing editor content chain
- `apps/workbench/src/components/workbench/editor/split-editor.tsx` - PaneTabSelector includes plugin view tabs, secondary pane renders ViewContainer for plugin: prefixed splitTabId

## Decisions Made
- Used `activatePluginViewTab(null)` call in `handleSwitch` to ensure clicking a policy tab always deactivates any active plugin view tab, providing clean bidirectional switching
- Plugin view tabs in split pane use `plugin:` prefix on splitTabId to distinguish from policy tab IDs without requiring type changes to multi-policy-store's `SET_SPLIT_TAB` action (splitTabId is already `string | null`)
- Split pane uses `ViewContainer` (not `ViewTabRenderer`) for plugin views so each pane instance creates its own component instance with independent state, satisfying ETAB-03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Editor Tab Views) is fully complete with both plans executed
- All plugin view slots (editor tabs, bottom panel, right sidebar) now support plugin contributions
- Phase 4 (Activity Bar, Gutters, Context Menus) can proceed as the remaining work
- 331 plugin-related tests pass with no regressions

## Self-Check: PASSED

- All 4 files exist on disk (3 modified + 1 summary)
- Both task commits verified in git log (76319a9b0, 4c3dffaa7)
- 331 plugin tests pass with no regressions

---
*Phase: 02-editor-tab-views*
*Completed: 2026-03-19*
