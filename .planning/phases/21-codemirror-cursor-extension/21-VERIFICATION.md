---
phase: 21-codemirror-cursor-extension
verified: 2026-03-23T18:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open a shared policy file with a second analyst connected via presence"
    expected: "A colored 2px vertical caret appears at the remote analyst's cursor position, and a floating label with their name appears on hover"
    why_human: "Requires live WebSocket presence session with multiple connected clients to observe rendering"
  - test: "Remote analyst makes a selection in the shared file"
    expected: "A translucent colored highlight (20% opacity of analyst color) appears over the selected region"
    why_human: "Requires live multi-user session to observe selection rendering"
  - test: "Rapidly move cursor in the shared editor"
    expected: "Remote cursors update smoothly with no editor flicker or extension rebuild"
    why_human: "Requires live session and subjective assessment of render smoothness"
  - test: "Close a file tab while another analyst is viewing it"
    expected: "All remote cursor decorations are removed from the editor and the store subscription is released with no memory leak"
    why_human: "Cleanup is programmatically verifiable (destroy method exists) but the absence of memory leaks requires runtime observation"
---

# Phase 21: CodeMirror Cursor Extension Verification Report

**Phase Goal:** Analysts see exactly where colleagues' cursors and selections are in shared policy files, with colored carets, highlighted selections, and name labels
**Verified:** 2026-03-23T18:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Remote analyst cursors appear as colored vertical carets in the editor at the correct line and column | VERIFIED | `CursorCaretWidget.toDOM()` creates `.cm-remote-caret` span with `borderLeftColor = this.color`; `buildDecorations()` converts line:column to absolute pos via `doc.line(line).from + ch` and creates `Decoration.widget` |
| 2 | Remote analyst selections appear as colored highlights in the editor | VERIFIED | `buildDecorations()` creates `Decoration.mark({ class: "cm-remote-selection", attributes: { style: "background-color: ${c.color}33" } })` for every analyst with a non-empty selection range |
| 3 | Hovering over a remote cursor caret displays a floating label with the analyst's name | VERIFIED | `CursorCaretWidget.toDOM()` creates `.cm-remote-caret-label` child span with `textContent = this.displayName`; theme sets `opacity: "0"` by default and `.cm-remote-caret:hover .cm-remote-caret-label { opacity: "1" }` |
| 4 | Rapid cursor movement updates smoothly without extension rebuild or editor flicker | VERIFIED | Facet+StateEffect pattern: cursor data flows via `updateRemoteCursors` StateEffect dispatched from Zustand subscription, never as extension array dependency; `presenceCursors()` added once to extensions array with no cursor data in `useMemo` deps |
| 5 | Closing a file tab removes all cursor decorations and unsubscribes from presence updates | VERIFIED | `destroy()` calls `this.unsubscribe?.()`, clears `this.throttleTimer`, and sets `this.decorations = Decoration.none` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workbench/src/lib/workbench/codemirror/presence-cursors.ts` | ViewPlugin with Facet+StateEffect cursor injection, CursorCaretWidget, selection marks, hover labels, throttled outbound, store subscription, cleanup | VERIFIED | 408-line implementation; substantive, fully implemented |
| `apps/workbench/src/components/ui/yaml-editor.tsx` | Integrates `presenceCursors()` into the extensions array | VERIFIED | Line 424: `base.push(...presenceCursors())`, line 426: `base.push(presenceFilePath.of(filePath))` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `presence-cursors.ts ViewPlugin` | `usePresenceStore` | Raw `usePresenceStore.subscribe()` outside React in constructor | WIRED | Line 156: `this.unsubscribe = usePresenceStore.subscribe((state) => { ... })` |
| `presence-cursors.ts ViewPlugin` | `getPresenceSocket()` | Outbound cursor/selection send in `sendCursorUpdate()` | WIRED | Line 36 import; line 294 usage: `const socket = getPresenceSocket()` |
| `yaml-editor.tsx` | `presence-cursors.ts` | Static import + `presenceCursors()` in extensions array | WIRED | Line 23 import; line 424 usage in `useMemo` |
| `presence-cursors.ts` | `ViewPlugin.destroy()` | Unsubscribe from store + clear throttle timer | WIRED | Lines 190-199: `destroy()` calls `this.unsubscribe?.()`, clears timer, resets decorations |
| `file-editor-shell.tsx` | `GuardTestYamlEditor` | `filePath={tabMeta.filePath ?? undefined}` at both call sites | WIRED | Lines 359 and 371 both pass `filePath` prop; `GuardTestYamlEditor` accepts it (line 75) and forwards to `YamlEditor` (line 130) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CM-01 | 21-01-PLAN.md | Remote analyst cursors shown as colored carets in CodeMirror editors | SATISFIED | `CursorCaretWidget` renders `.cm-remote-caret` span with `borderLeftColor = this.color`; `Decoration.widget` placed at line:column position |
| CM-02 | 21-01-PLAN.md | Remote analyst selections shown as colored highlights in CodeMirror editors | SATISFIED | `Decoration.mark` with `background-color: ${c.color}33` (20% opacity) spans selection range |
| CM-03 | 21-01-PLAN.md | Cursor name labels appear on hover over remote cursors | SATISFIED | `.cm-remote-caret-label` with `textContent = displayName`; CSS `:hover` rule sets `opacity: "1"` |
| CM-04 | 21-01-PLAN.md | Cursor positions use line:column coordinates (stable across independent edits) | SATISFIED | Wire messages send `{ line, ch }` and `{ anchor_line, anchor_ch, head_line, head_ch }`; inbound coordinates converted from line:column via `doc.line(line).from + ch` |
| CM-05 | 21-01-PLAN.md | Cursor updates throttled to 50ms and delivered via Facet + StateEffect (no extension rebuild) | SATISFIED | `THROTTLE_MS = 50` constant; `scheduleOutboundCursor()` guards with `if (this.throttleTimer != null) return`; StateEffect injection via `updateRemoteCursors`; no cursor data in `useMemo` deps |

All 5 CM requirements are SATISFIED. No orphaned requirements detected — REQUIREMENTS.md maps exactly CM-01 through CM-05 to Phase 21 and marks all Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `presence-cursors.ts` | 90 | `return []` | Info | `StateField.create()` returning `[]` is the correct initial-state pattern for this field — not a stub |

No blocker or warning anti-patterns found. The `return []` at line 90 is the `StateField.create()` initializer (correct pattern, not a stub). No TODOs, FIXMEs, placeholder comments, or unimplemented handlers were found in any of the three modified files.

### Human Verification Required

The following items require a live multi-user presence session to fully verify:

**1. Colored caret rendering in live session**
- Test: Connect two workbench instances to the same file over the presence WebSocket; move cursor in one
- Expected: The other instance shows a 2px colored vertical bar at the correct position
- Why human: Requires running infrastructure (presence server from Phase 18) with two connected clients

**2. Selection highlight in live session**
- Test: Make a multi-line selection in one analyst's editor
- Expected: The other analyst sees a semi-transparent colored overlay on the same region
- Why human: Requires live session; the 20% opacity rendering cannot be inspected programmatically

**3. Smooth update performance**
- Test: Type rapidly in one editor while watching the remote cursor in the other
- Expected: Cursor moves smoothly at most every 50ms, no editor flicker or recomposition
- Why human: Subjective smoothness assessment and absence of flicker require observation

**4. Cleanup on tab close**
- Test: Close a file tab while a second analyst still has it open and is moving their cursor
- Expected: No cursor decorations remain in the closed editor; no further store subscriptions fire
- Why human: Memory leak absence requires runtime profiling to confirm

### Gaps Summary

No gaps. All five must-have truths are verified. Both required artifacts exist and are substantive (non-stub) implementations. All four key links are fully wired. All five CM requirements are satisfied. Both task commits (`fbdf0fbb9`, `39a3534ed`) exist in git history. The `filePath` prop threads correctly through `FileEditorShell -> GuardTestYamlEditor -> YamlEditor -> presenceFilePath Facet`. The useMemo dependency array contains `filePath` (safe, route-derived, stable per mount) but correctly excludes all cursor data (`analysts`, `viewersByFile`, cursor positions).

---

_Verified: 2026-03-23T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
