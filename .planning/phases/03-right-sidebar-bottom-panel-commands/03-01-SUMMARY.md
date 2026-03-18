---
phase: 03-right-sidebar-bottom-panel-commands
plan: 01
subsystem: ui
tags: [zustand, react, sidebar, audit, immer, tailwind]

# Dependency graph
requires:
  - phase: 02-sidebar-panels-editor-tabs
    provides: activity-bar store pattern, bottom-pane store, SpeakeasyPanel component
provides:
  - RightSidebar container with resizable width and SpeakeasyPanel inline rendering
  - RightSidebarResizeHandle with inverted drag direction
  - right-sidebar-store (Zustand + immer + createSelectors)
  - RightSidebarPanel type union
  - AuditTailPanel with local audit event streaming
  - Bottom pane 4th "Audit" tab
affects: [03-02-PLAN, desktop-layout integration, view-commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline prop pattern for SpeakeasyPanel overlay-to-embed toggle]

key-files:
  created:
    - apps/workbench/src/features/right-sidebar/types.ts
    - apps/workbench/src/features/right-sidebar/stores/right-sidebar-store.ts
    - apps/workbench/src/features/right-sidebar/components/right-sidebar.tsx
    - apps/workbench/src/features/right-sidebar/components/right-sidebar-resize-handle.tsx
    - apps/workbench/src/features/bottom-pane/audit-tail-panel.tsx
  modified:
    - apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx
    - apps/workbench/src/features/bottom-pane/bottom-pane-store.ts
    - apps/workbench/src/features/bottom-pane/bottom-pane.tsx

key-decisions:
  - "Added inline prop to SpeakeasyPanel instead of CSS-hack approach for de-overlaying fixed positioning"
  - "Right sidebar uses 200px collapse threshold (higher than left sidebar's 120px) per UI-SPEC"

patterns-established:
  - "inline prop pattern: components with fixed overlay rendering accept inline?: boolean to switch to flex-column layout for embedding"

requirements-completed: [RBAR-01, RBAR-02, RBAR-03, STATE-02, BPAN-01, BPAN-02, BPAN-03]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 3 Plan 01: Right Sidebar + Audit Tab Summary

**Right sidebar infrastructure (store, container, resize handle) with inline SpeakeasyPanel, plus AuditTailPanel as 4th bottom pane tab**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T17:16:41Z
- **Completed:** 2026-03-18T17:20:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created right sidebar store (Zustand + immer + createSelectors) with visible, activePanel, width state and toggle/show/hide/setActivePanel/setWidth actions
- Built RightSidebar container with panel header ("Speakeasy" title, collapse button) and SpeakeasyPanel rendered inline
- Built RightSidebarResizeHandle mirroring left sidebar with inverted drag direction, 200px collapse threshold, 480px max
- Created AuditTailPanel with last 50 local audit events, source/event-type colored badges, relative timestamps, expandable detail rows, pause/resume/clear/open-full footer
- Added 4th "Audit" tab to bottom pane while preserving existing Terminal/Problems/Output tabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Right sidebar types, store, container, and resize handle** - `64dc1283d` (feat)
2. **Task 2: AuditTailPanel and bottom pane Audit tab integration** - `34a18f02f` (feat)

## Files Created/Modified
- `apps/workbench/src/features/right-sidebar/types.ts` - RightSidebarPanel type union ("speakeasy")
- `apps/workbench/src/features/right-sidebar/stores/right-sidebar-store.ts` - Zustand store with visible, activePanel, width state
- `apps/workbench/src/features/right-sidebar/components/right-sidebar.tsx` - Container with panel header and inline SpeakeasyPanel
- `apps/workbench/src/features/right-sidebar/components/right-sidebar-resize-handle.tsx` - Resize handle with inverted drag, 200px collapse, 480px max
- `apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx` - Added inline prop for embedded rendering
- `apps/workbench/src/features/bottom-pane/audit-tail-panel.tsx` - Compact streaming audit tail for bottom pane
- `apps/workbench/src/features/bottom-pane/bottom-pane-store.ts` - Extended BottomPaneTab union with "audit"
- `apps/workbench/src/features/bottom-pane/bottom-pane.tsx` - Added Audit tab button and AuditTailPanel conditional render

## Decisions Made
- **Inline prop instead of CSS hack:** The plan's approach of using `[&>div.fixed]:static` CSS overrides to de-overlay SpeakeasyPanel would not work because `position: fixed` escapes containing blocks by design. Instead, added an `inline?: boolean` prop to SpeakeasyPanel that conditionally renders as `flex-1 min-h-0 flex flex-col` without the fixed overlay, backdrop, border, and shadow. This is a cleaner, more maintainable approach.
- **200px collapse threshold:** Right sidebar uses 200px (vs left sidebar's 120px) as specified in UI-SPEC, reflecting the wider minimum useful width for chat content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SpeakeasyPanel inline prop instead of CSS override hack**
- **Found during:** Task 1 (Right sidebar container)
- **Issue:** Plan specified `[&>div.fixed]:static [&>div.fixed]:inset-auto` CSS overrides to de-overlay SpeakeasyPanel. This approach cannot work because `position: fixed` creates a new stacking context that escapes CSS containment. The fixed-positioned elements would still render relative to the viewport, not the sidebar container.
- **Fix:** Added `inline?: boolean` prop to SpeakeasyPanel. When `inline={true}`, the component skips the backdrop div and renders as `flex-1 min-h-0 flex flex-col bg-zinc-950` instead of the fixed overlay. The internal structure (RoomHeader, MessageList, compose area, ClassificationFooter) remains unchanged.
- **Files modified:** `apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx`
- **Verification:** tsc --noEmit passes; SpeakeasyPanel remains backward-compatible (inline defaults to false)
- **Committed in:** 64dc1283d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for correctness. The inline prop approach is strictly better than the planned CSS hack -- cleaner, more explicit, and actually functional. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Right sidebar infrastructure is complete and ready for desktop-layout integration (Plan 02)
- AuditTailPanel is wired into bottom pane and ready for use
- Plan 02 will handle: desktop-layout flex row insertion, command registration (8 new commands), and wiring

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (64dc1283d, 34a18f02f) verified in git log.

---
*Phase: 03-right-sidebar-bottom-panel-commands*
*Completed: 2026-03-18*
