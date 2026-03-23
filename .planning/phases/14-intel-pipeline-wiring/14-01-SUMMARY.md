---
phase: 14-intel-pipeline-wiring
plan: 01
subsystem: ui
tags: [zustand, sse, signals, findings, badge, activity-bar, pipeline]

# Dependency graph
requires:
  - phase: 13-realtime-swarm-visualization
    provides: signal-store and finding-store Zustand stores
provides:
  - Fleet SSE check event -> signal-store bridge via checkEventToSignal
  - useSignalCorrelator mounted in WorkbenchBootstraps for auto-clustering
  - Badge count on Findings activity bar icon for emerging findings
affects: [14-02-PLAN, findings-panel, fleet-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [module-level helper for SSE-to-signal conversion, getState() side-effect at call site not reducer]

key-files:
  created: []
  modified:
    - apps/workbench/src/features/fleet/use-fleet-connection.ts
    - apps/workbench/src/App.tsx
    - apps/workbench/src/features/activity-bar/components/activity-bar-item.tsx
    - apps/workbench/src/features/activity-bar/components/activity-bar.tsx

key-decisions:
  - "SignalSource uses full object shape (sentinelId, guardId, externalFeed, provenance) not simple string"
  - "checkEventToSignal placed as module-level helper in use-fleet-connection.ts, not in reducer"
  - "Badge styled with #c45c5c red background and 0.4 box-shadow glow, caps at 99+"

patterns-established:
  - "SSE-to-store bridge: side-effect at call site after pure reducer, never inside reducer"
  - "Badge prop pattern: optional number prop on ActivityBarItem, conditionally passed from parent"

requirements-completed: [INTEL-01, INTEL-02, INTEL-03, INTEL-04]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 14 Plan 01: Intel Pipeline Wiring Summary

**Fleet SSE check events bridged to signal-store, auto-correlated into findings via useSignalCorrelator, with red badge count on Findings activity bar icon**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T23:14:21Z
- **Completed:** 2026-03-22T23:16:20Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Fleet SSE check events converted to Signal objects and ingested into signal-store with severity derived from verdict (deny->high, warn->medium, else low)
- useSignalCorrelator mounted in WorkbenchBootstraps enabling auto-correlation of signals into findings with 2s debounce
- Findings activity bar icon displays red badge with emerging findings count, capping at "99+" for overflow

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge Fleet SSE check events to signal-store** - `939639a` (feat) - previously committed
2. **Task 2: Mount useSignalCorrelator in WorkbenchBootstraps** - `32621dd` (feat) - previously committed
3. **Task 3: Add badge count to Findings activity bar icon** - `ea07b8d` (feat)

## Files Created/Modified
- `apps/workbench/src/features/fleet/use-fleet-connection.ts` - Added checkEventToSignal helper and signal ingestion in SSE onEvent callback
- `apps/workbench/src/App.tsx` - Added useSignalCorrelator() call in WorkbenchBootstraps
- `apps/workbench/src/features/activity-bar/components/activity-bar-item.tsx` - Added optional badge prop with red dot rendering
- `apps/workbench/src/features/activity-bar/components/activity-bar.tsx` - Passes emergingFindingsCount as badge to findings ActivityBarItem

## Decisions Made
- SignalSource uses the full object shape from sentinel-types.ts (not a simple string) to match the canonical type definition
- checkEventToSignal is a module-level pure function in use-fleet-connection.ts, keeping the reducer (fleet-event-reducer.ts) free of side-effects
- Badge styled with red (#c45c5c) background matching the project's muted palette, with subtle glow shadow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected SignalSource shape in checkEventToSignal**
- **Found during:** Task 1 (Bridge Fleet SSE check events)
- **Issue:** Plan specified `source: "fleet"` as a simple string, but the actual `SignalSource` type is an interface with sentinelId, guardId, externalFeed, and provenance fields
- **Fix:** Used the full object shape: `{ sentinelId: null, guardId: check.guard ?? null, externalFeed: null, provenance: "guard_evaluation" }`
- **Files modified:** apps/workbench/src/features/fleet/use-fleet-connection.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 939639a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix for type correctness)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered
- Tasks 1 and 2 were already committed from a prior execution attempt; Task 3 was the only remaining work

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Signal pipeline is fully wired: Fleet SSE -> signal-store -> correlator -> finding-store -> badge
- Ready for Plan 02 (finding detail and detection engineering wiring)
- All four INTEL requirements (01-04) satisfied

---
*Phase: 14-intel-pipeline-wiring*
*Completed: 2026-03-22*
