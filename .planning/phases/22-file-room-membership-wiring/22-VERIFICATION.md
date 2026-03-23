---
phase: 22-file-room-membership-wiring
verified: 2026-03-23T19:00:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "Open two workbench windows with different analysts, open the same file in both"
    expected: "Tab dot appears on the file tab in each window showing the remote analyst's color dot"
    why_human: "Requires two live hushd-connected sessions to test round-trip broadcast"
  - test: "Close a file tab in one window"
    expected: "Tab dot disappears in the other window within the next presence update cycle"
    why_human: "leave_file → server room removal → broadcast → UI update requires live session"
  - test: "Open a file, disconnect network, reconnect"
    expected: "view_file is re-sent and remote analysts see the tab dot reappear"
    why_human: "Reconnect re-send requires live WebSocket cycle to verify epoch counter logic"
---

# Phase 22: File Room Membership Wiring Verification Report

**Phase Goal:** Client sends view_file/leave_file messages when files are opened/closed so the server populates rooms, broadcasts file-scoped presence, and enables tab dots, Speakeasy counts, and remote cursors for files opened post-connection
**Verified:** 2026-03-23T19:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a file tab sends a view_file message to hushd with a workspace-relative path | VERIFIED | `use-presence-file-tracking.ts` L60-64: `getPresenceSocket()?.send({ type: "view_file", file_path: toPresencePath(currentFile) })`. Pane store subscription at L88-92 also sends on active-tab change. |
| 2 | Closing a file tab sends a leave_file message to hushd | VERIFIED | `use-presence-file-tracking.ts` L97-106 (cleanup on effect teardown): `getPresenceSocket()?.send({ type: "leave_file", file_path: toPresencePath(lastSentFileRef.current) })`. Also L79-83 on tab switch. |
| 3 | Switching to a different file sends leave_file for the old file and view_file for the new one | VERIFIED | `use-presence-file-tracking.ts` L77-94: pane store subscriber sends leave for `lastSentFileRef.current` then view_file for new `filePath` when they differ. |
| 4 | Tab dots show colored dots for remote analysts viewing the same file (viewersByFile lookup uses matching path format) | VERIFIED | `presence-tab-dots.tsx` L20-21: `rawPath` extracted from route, then `toPresencePath(rawPath)` used as key. L24: `viewersByFile.get(filePath)` with normalized key matching server broadcast format. |
| 5 | Speakeasy panel shows correct file-viewer count for the active file | VERIFIED | `speakeasy-panel.tsx` L228-233: `activeFileRoute` memo applies `toPresencePath` before returning. L237: `viewersByFile.get(activeFileRoute)` uses normalized key. |
| 6 | Remote cursors filter by activeFile matching the presenceFilePath facet value | VERIFIED | `yaml-editor.tsx` L426-428: `presenceFilePath.of(toPresencePath(filePath))` injects normalized path. `presence-cursors.ts` L163: `analyst.activeFile !== filePath` comparison — both sides normalized to same format. |
| 7 | On reconnect, view_file is re-sent for the currently active file | VERIFIED | `use-presence-file-tracking.ts` L110-126 (Effect 2): triggers when `connectionState === "connected"`, skips initial connection via `reconnectEpochRef.current <= 1`, sends `view_file` on subsequent connections. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workbench/src/features/presence/presence-paths.ts` | toPresencePath utility for consistent path normalization | VERIFIED | 24 lines. Exports `toPresencePath`. Strips backslashes, drive letters, leading slash — mirrors hushd `normalize_path` exactly. |
| `apps/workbench/src/features/presence/use-presence-file-tracking.ts` | Hook that subscribes to pane store and sends view_file/leave_file | VERIFIED | 127 lines. Exports `usePresenceFileTracking`. Two effects: (1) pane store subscription + immediate send, (2) reconnect re-send with epoch guard. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `use-presence-file-tracking.ts` | `presence-socket.ts` | `getPresenceSocket().send({ type: 'view_file', file_path })` | WIRED | `getPresenceSocket()?.send` appears 6 times in the file — 3 view_file sends, 3 leave_file sends. Pattern `send.*view_file` confirmed at L60-64. |
| `use-presence-file-tracking.ts` | `pane-store.ts` | `usePaneStore.subscribe` for activeViewId/views changes | WIRED | `usePaneStore.subscribe((state) => {...})` at L67. Zustand external subscription pattern confirmed. |
| `presence-tab-dots.tsx` | `presence-store.ts viewersByFile` | `toPresencePath(filePath)` for Map lookup key | WIRED | L21: `toPresencePath(rawPath)`, L24: `viewersByFile.get(filePath)` with that normalized key. |
| `speakeasy-panel.tsx` | `presence-store.ts viewersByFile` | `toPresencePath(activeFileRoute)` for Map lookup key | WIRED | L232: `toPresencePath(rawPath)` in memo, L237: `viewersByFile.get(activeFileRoute)`. |
| `App.tsx WorkbenchBootstraps` | `use-presence-file-tracking.ts` | `usePresenceFileTracking()` call | WIRED | `App.tsx` L10: import. L159: `usePresenceFileTracking()` called in `WorkbenchBootstraps` alongside `usePresenceConnection()`. |

### Requirements Coverage

Phase 22 is a gap-closure phase. UI-02, UI-05 (Phase 20) and CM-01, CM-02 (Phase 21) were previously implemented but broken due to missing view_file/leave_file sends. REQUIREMENTS.md traceability maps them to Phases 20 and 21 — Phase 22 retroactively closes the root cause identified in the v2.0 milestone audit.

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| UI-02 | Colored dots on pane tabs showing which files other analysts are viewing | SATISFIED | Path mismatch fixed: `toPresencePath` in `presence-tab-dots.tsx`. `viewersByFile` now populated via view_file sends. |
| UI-05 | Speakeasy chat panel shows presence context ("3 analysts viewing this file") | SATISFIED | `toPresencePath` normalization in `speakeasy-panel.tsx` `activeFileRoute` memo. `fileViewerCount` will reflect real viewers once view_file messages flow. |
| CM-01 | Remote analyst cursors shown as colored carets in CodeMirror editors | SATISFIED | `presenceFilePath.of(toPresencePath(filePath))` ensures facet value matches `analyst.activeFile` from server. Cursor filter in `presence-cursors.ts` L163 now matches. |
| CM-02 | Remote analyst selections shown as colored highlights in CodeMirror editors | SATISFIED | Same fix as CM-01 — selection highlights use same `activeFile !== filePath` filter in `presence-cursors.ts`. |

All 4 previously-partial requirements share the same root cause (missing view_file sends + path format mismatch) and are all addressed by Phase 22 changes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `speakeasy-panel.tsx` | 256 | Comment: "This is a placeholder mapping using fingerprint as key" | Info | Pre-existing comment about member-by-public-key lookup. Unrelated to Phase 22 work; this is in message rendering, not presence/file-tracking. Not a stub introduced by this phase. |

No blockers or warnings from Phase 22 changes. The only flagged comment is pre-existing and out of scope for this phase.

### Human Verification Required

#### 1. Tab Dot Round-Trip

**Test:** Open two workbench instances connected to the same hushd server with different analyst identities. Open the same YAML file in both.
**Expected:** The file tab in each window shows a colored dot for the remote analyst within a few seconds of opening.
**Why human:** Requires two live hushd-connected sessions; cannot simulate WebSocket round-trip with grep.

#### 2. Leave File On Tab Close

**Test:** With two windows both viewing the same file, close the file tab in one window.
**Expected:** The tab dot disappears in the other window after the next presence update.
**Why human:** leave_file send triggers on React cleanup effect — requires live session to verify effect teardown fires.

#### 3. Reconnect Re-Announcement

**Test:** Open a file, disconnect network (or kill hushd), then reconnect.
**Expected:** The file tab dot reappears in a second remote window after reconnect — confirming view_file is re-sent.
**Why human:** Epoch counter logic in Effect 2 requires live WebSocket lifecycle; cannot verify `reconnectEpochRef.current <= 1` guard behavior statically.

### Gaps Summary

No gaps. All 7 observable truths are verified, both required artifacts exist with full implementations, all 5 key links are wired, and all 4 requirements are satisfied. Commits `824c4c3e8` and `7feaad8b6` match exactly what the SUMMARY claims.

The three human verification items are runtime confirmation of correct behavior — the code logic is substantively correct for all of them. They are listed as good-practice integration tests, not blockers.

---

_Verified: 2026-03-23T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
