---
phase: 02-sidebar-panels-editor-tabs
plan: 02
subsystem: ui
tags: [react, zustand, sidebar-panels, posture, sentinels, findings, intel]

# Dependency graph
requires:
  - phase: 01-activity-bar-sidebar-shell
    provides: ActivityBar, SidebarPanel shell, ExplorerPanel layout pattern
provides:
  - HeartbeatPanel component with posture ring, stat counts, quick links
  - SentinelPanel component with filterable grouped sentinel list
  - FindingsPanel component with severity badges and collapsible intel section
  - Shared posture-utils.ts (derivePosture, POSTURE_CONFIG, Posture type)
affects: [02-03 sidebar integration, home-page posture reuse]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared utility extraction pattern, sidebar panel layout pattern]

key-files:
  created:
    - apps/workbench/src/features/shared/posture-utils.ts
    - apps/workbench/src/features/activity-bar/panels/heartbeat-panel.tsx
    - apps/workbench/src/features/activity-bar/panels/sentinel-panel.tsx
    - apps/workbench/src/features/activity-bar/panels/findings-panel.tsx
  modified:
    - apps/workbench/src/components/workbench/home/home-page.tsx

key-decisions:
  - "Extracted posture logic to shared utility instead of duplicating between HomePage and HeartbeatPanel"
  - "Intel items display using Intel.title (actual field name) rather than .label (plan spec was incorrect)"
  - "IntelType values displayed as-is (detection_rule, ioc, etc.) since there is no short-label mapping"

patterns-established:
  - "Sidebar panel layout: panel header (32px) + filter input + ScrollArea + footer status bar"
  - "Collapsible sections with chevron rotation and Set<string> tracking"
  - "Store-connected panels use createSelectors .use. pattern for fine-grained subscriptions"

requirements-completed: [SIDE-03, SIDE-04, SIDE-05]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 02 Plan 02: Sidebar Panels Summary

**HeartbeatPanel with posture ring and stat grid, SentinelPanel with filterable grouped list, FindingsPanel with severity badges and collapsible intel section -- all wired to Zustand stores with openApp navigation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T15:06:28Z
- **Completed:** 2026-03-18T15:16:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted posture derivation logic (derivePosture, POSTURE_CONFIG, Posture type) to shared utility, eliminating duplication between HomePage and HeartbeatPanel
- Built HeartbeatPanel with 80px SVG posture ring, 2x2 stat grid (sentinels/findings/approvals/fleet), and 4 quick links wired to paneStore.openApp
- Built SentinelPanel with text filter, status-grouped collapsible sections (active/paused/retired), status dots, mode labels, and create button
- Built FindingsPanel with severity badge pills using SEVERITY_COLORS/SEVERITY_LABELS_SHORT, status labels from STATUS_CONFIG, collapsible intel section with dashed divider

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract posture utilities and create HeartbeatPanel** - `0acc6cfe6` (feat)
2. **Task 2: Create SentinelPanel and FindingsPanel** - `b1b61ec3f` (feat)

## Files Created/Modified
- `apps/workbench/src/features/shared/posture-utils.ts` - Shared posture derivation: Posture type, derivePosture function, POSTURE_CONFIG constant
- `apps/workbench/src/features/activity-bar/panels/heartbeat-panel.tsx` - HeartbeatPanel: posture ring, stat grid, quick links, empty state
- `apps/workbench/src/features/activity-bar/panels/sentinel-panel.tsx` - SentinelPanel: filter, grouped sentinel list, create button, status dots
- `apps/workbench/src/features/activity-bar/panels/findings-panel.tsx` - FindingsPanel: severity badges, status labels, collapsible intel section
- `apps/workbench/src/components/workbench/home/home-page.tsx` - Removed inline posture definitions, now imports from shared utility

## Decisions Made
- Used `Intel.title` instead of `Intel.label` as specified in plan interfaces -- the plan's interface section documented `label` but the actual codebase type uses `title`
- Posture logic shared via simple module import rather than context or store -- keeps it side-effect-free
- Approval count displayed as "---" since no approval store exists (per research doc)
- Intel type values displayed as-is from IntelType enum (detection_rule, ioc, etc.) without short-label mapping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Intel.label does not exist on Intel type**
- **Found during:** Task 2 (FindingsPanel)
- **Issue:** Plan specified `intel.label` for display and filtering, but the actual Intel interface uses `title` not `label`
- **Fix:** Changed all references from `intel.label` to `intel.title` in FindingsPanel
- **Files modified:** apps/workbench/src/features/activity-bar/panels/findings-panel.tsx
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** b1b61ec3f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor naming correction. No scope creep.

## Issues Encountered
- Pre-existing test failures in App.test.tsx and desktop-layout.test.tsx (9 tests) -- confirmed these fail on the base branch without any of this plan's changes. Out of scope per deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 sidebar panels (heartbeat, sentinel, findings) are ready for integration into SidebarPanel switch statement (Plan 02-03)
- posture-utils.ts provides shared posture logic for any future panel or component
- Panels call openApp which was implemented in Plan 02-01 (already committed)

## Self-Check: PASSED

All 4 created files exist. Both task commits verified in git log.

---
*Phase: 02-sidebar-panels-editor-tabs*
*Completed: 2026-03-18*
