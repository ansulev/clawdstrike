---
phase: 21-codemirror-cursor-extension
plan: 01
subsystem: ui
tags: [codemirror, presence, cursors, websocket, zustand, viewplugin]

# Dependency graph
requires:
  - phase: 19-client-connection-store
    provides: usePresenceStore, getPresenceSocket, PresenceSocket, AnalystPresence types
  - phase: 20-ui-presence-indicators
    provides: presence UI wiring (tab dots, activity pills, people panel)
provides:
  - "CM6 ViewPlugin extension for remote cursor carets + selection highlights"
  - "presenceCursors() factory function for static extension inclusion"
  - "presenceFilePath Facet for per-editor file path injection"
  - "updateRemoteCursors StateEffect for data injection without extension rebuild"
  - "Outbound cursor/selection send via getPresenceSocket throttled to 50ms"
affects: [yaml-editor, file-editor-shell, presence-system]

# Tech tracking
tech-stack:
  added: []
  patterns: [ViewPlugin+Facet+StateEffect for CM6 data injection, raw Zustand subscribe outside React, WidgetType for inline DOM decorations]

key-files:
  created:
    - apps/workbench/src/lib/workbench/codemirror/presence-cursors.ts
  modified:
    - apps/workbench/src/components/ui/yaml-editor.tsx
    - apps/workbench/src/features/editor/file-editor-shell.tsx

key-decisions:
  - "Facet+StateEffect injection: cursor data flows via StateEffect dispatched from Zustand subscription, never as extension array dependency"
  - "presenceFilePath Facet: file identity injected via Facet.define, read inside ViewPlugin for cursor filtering and outbound path"
  - "Prec.low wrapping: all presence extension components use low priority to avoid conflicts with guard-gutter and coverage-gutter"
  - "50ms throttle with JSON dedup: outbound sends throttled and deduplicated to minimize WebSocket traffic"
  - "MAX_REMOTE_CURSORS=20: hard cap prevents decoration explosion in large sessions"
  - "filePath added to useMemo deps: safe because it is route-derived and stable per editor instance (not cursor data)"

patterns-established:
  - "ViewPlugin store subscription: subscribe to Zustand store in ViewPlugin constructor, dispatch StateEffect for data injection, unsubscribe in destroy()"
  - "CursorCaretWidget: WidgetType with inline label shown via CSS :hover, no event capture"
  - "Selection mark: Decoration.mark with inline style for 20% opacity color highlight"

requirements-completed: [CM-01, CM-02, CM-03, CM-04, CM-05]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 21 Plan 01: CodeMirror Cursor Extension Summary

**CM6 ViewPlugin rendering colored remote cursor carets with hover labels and 20% opacity selection highlights, throttled outbound via getPresenceSocket**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T17:20:28Z
- **Completed:** 2026-03-23T17:24:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created presence-cursors.ts with full ViewPlugin lifecycle: subscribe to store, build decorations, send outbound, cleanup on destroy
- CursorCaretWidget renders 2px colored caret with floating name label on hover (CSS :hover transition)
- Selection highlights rendered as Decoration.mark with 20% opacity (color + "33" hex suffix)
- Outbound cursor/selection sends throttled to 50ms with JSON dedup
- Integrated presenceCursors() into yaml-editor.tsx as static extension (no cursor data in useMemo deps)
- File path passed through FileEditorShell -> GuardTestYamlEditor -> YamlEditor -> presenceFilePath Facet

## Task Commits

Each task was committed atomically:

1. **Task 1: Create presence-cursors.ts ViewPlugin extension** - `fbdf0fbb9` (feat)
2. **Task 2: Wire presenceCursors into YamlEditor extensions array** - `39a3534ed` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/workbench/codemirror/presence-cursors.ts` - New CM6 extension: ViewPlugin + StateField + StateEffect + CursorCaretWidget + theme + factory function
- `apps/workbench/src/components/ui/yaml-editor.tsx` - Added presenceCursors() to extensions, filePath prop, presenceFilePath Facet injection
- `apps/workbench/src/features/editor/file-editor-shell.tsx` - Added filePath prop to GuardTestYamlEditor, forwarded tabMeta.filePath at both call sites

## Decisions Made
- Facet+StateEffect pattern (following guard-gutter.ts precedent) ensures cursor data updates never trigger extension rebuild
- presenceFilePath Facet provides file identity to the ViewPlugin outside React context
- Prec.low priority prevents conflicts with existing gutter extensions
- filePath is safe as useMemo dependency because it is route-derived and stable per editor mount

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five CM requirements (CM-01 through CM-05) addressed
- Remote cursor rendering and outbound cursor sends are complete
- Presence system is now end-to-end: server (Phase 18) -> client store (Phase 19) -> UI indicators (Phase 20) -> editor cursors (Phase 21)

## Self-Check: PASSED

- FOUND: apps/workbench/src/lib/workbench/codemirror/presence-cursors.ts
- FOUND: .planning/phases/21-codemirror-cursor-extension/21-01-SUMMARY.md
- FOUND: commit fbdf0fbb9
- FOUND: commit 39a3534ed

---
*Phase: 21-codemirror-cursor-extension*
*Completed: 2026-03-23*
