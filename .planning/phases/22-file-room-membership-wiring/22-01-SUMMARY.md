---
phase: 22-file-room-membership-wiring
plan: 01
subsystem: presence
tags: [websocket, presence, zustand, codemirror, path-normalization]

requires:
  - phase: 19-client-connection-store
    provides: PresenceSocket singleton and getPresenceSocket() accessor
  - phase: 20-ui-presence-indicators
    provides: viewersByFile Map in presence store, PresenceTabDots, Speakeasy file viewer count
  - phase: 21-codemirror-cursor-extension
    provides: presenceFilePath facet for CM6 cursor scoping
provides:
  - toPresencePath() utility for consistent path normalization matching hushd
  - usePresenceFileTracking hook sending view_file/leave_file on tab changes
  - Aligned viewersByFile lookups in tab dots, Speakeasy, and CM6 extension
affects: []

tech-stack:
  added: []
  patterns: [path-normalization-at-boundary, zustand-external-subscription-for-file-tracking]

key-files:
  created:
    - apps/workbench/src/features/presence/presence-paths.ts
    - apps/workbench/src/features/presence/use-presence-file-tracking.ts
  modified:
    - apps/workbench/src/App.tsx
    - apps/workbench/src/features/presence/components/presence-tab-dots.tsx
    - apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx
    - apps/workbench/src/components/ui/yaml-editor.tsx

key-decisions:
  - "toPresencePath mirrors hushd normalize_path exactly: strip backslashes, drive letters, leading slash"
  - "File tracking hook uses Zustand external subscription (not React state) for pane store changes"
  - "Reconnect re-send uses epoch counter to skip initial connection"

patterns-established:
  - "Path normalization at boundary: always normalize via toPresencePath before sending to server or looking up in viewersByFile"

requirements-completed: [UI-02, UI-05, CM-01, CM-02]

duration: 3min
completed: 2026-03-23
---

# Phase 22 Plan 01: File Room Membership Wiring Summary

**view_file/leave_file outbound messages wired from pane tab changes to hushd, with toPresencePath normalizing all paths to match server format across tab dots, Speakeasy, and CM6 cursors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T18:33:00Z
- **Completed:** 2026-03-23T18:36:16Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created toPresencePath() utility that mirrors hushd's normalize_path (strips backslashes, drive letters, leading slash)
- Created usePresenceFileTracking hook that sends view_file on file open and leave_file on file close/switch, including reconnect re-announcement
- Fixed path mismatch in all 3 viewersByFile consumer sites (tab dots, Speakeasy panel, CM6 presenceFilePath facet)
- TypeScript compiles cleanly with no new errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Path normalization utility + file tracking hook + bootstrap wiring** - `824c4c3e8` (feat)
2. **Task 2: Align viewersByFile lookups in tab dots, Speakeasy, and CM6 extension** - `7feaad8b6` (fix)

## Files Created/Modified
- `apps/workbench/src/features/presence/presence-paths.ts` - toPresencePath() utility matching hushd normalize_path
- `apps/workbench/src/features/presence/use-presence-file-tracking.ts` - Hook sending view_file/leave_file on tab changes + reconnect
- `apps/workbench/src/App.tsx` - Added usePresenceFileTracking to WorkbenchBootstraps
- `apps/workbench/src/features/presence/components/presence-tab-dots.tsx` - Normalized path before viewersByFile lookup
- `apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx` - Normalized activeFileRoute before viewersByFile lookup
- `apps/workbench/src/components/ui/yaml-editor.tsx` - Normalized presenceFilePath facet value

## Decisions Made
- toPresencePath mirrors hushd normalize_path exactly (backslash replace, drive letter strip, leading slash strip)
- File tracking hook uses Zustand external subscription pattern (same as dirty-sync in pane-store)
- Reconnect re-send uses epoch counter ref to distinguish initial connect from reconnect

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- File-scoped presence is now end-to-end: open file -> server room join -> broadcast -> UI update
- All 4 partial requirements (UI-02, UI-05, CM-01, CM-02) from the v2.0 milestone audit are closed

---
*Phase: 22-file-room-membership-wiring*
*Completed: 2026-03-23*
