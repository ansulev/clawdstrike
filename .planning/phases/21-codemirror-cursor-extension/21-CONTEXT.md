# Phase 21: CodeMirror Cursor Extension - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

CodeMirror 6 ViewPlugin that renders remote analyst cursors and selections in policy editors. Uses Facet + StateEffect for data injection (never extension array mutation). Reads cursor data from presence-store via raw Zustand subscribe (outside React). Sends local cursor updates via PresenceSocket.

</domain>

<decisions>
## Implementation Decisions

### Cursor & Selection Visuals
- Cursor caret: 2px wide colored vertical bar, full line height, no blink — matches y-codemirror.next YRemoteCaretWidget pattern
- Selection highlight: 20% opacity of analyst's assigned color — visible but not obscuring code
- Name label: floating above caret on hover, analyst's color as background + white text, 8px rounded corners, fades after 3s
- Max 20 remote cursors per editor (typical SOC team size)

### Cursor Broadcasting
- Send cursor updates on every CM6 ViewPlugin.update() selection change, throttled to 50ms
- Payload: line + column for cursor head, plus anchor line + column if selection exists
- Send ViewFile/LeaveFile messages on file open/close to update presence rooms
- Remove remote cursor decorations immediately on AnalystLeft event from store (no fade)

### Technical Architecture (from research)
- ViewPlugin pattern (NOT StateField) — survives editor reconfiguration
- Facet + StateEffect for injecting remote cursor data post-construction (NEVER as extension array dependency)
- Raw `usePresenceStore.subscribe()` outside React for the CM6 bridge (NOT React selectors)
- Unsubscribe in ViewPlugin.destroy() to prevent memory leaks
- Prec.low to avoid conflicting with guard-gutter and coverage-gutter extensions
- line:column coordinates (NOT absolute character offsets) — stable across independent edits
- PresenceSocket.send() for outbound cursor updates (module-level getPresenceSocket() from Phase 19)

### Claude's Discretion
- Exact CSS for cursor caret and name label
- Decoration.widget vs Decoration.mark implementation details
- Internal throttle implementation (setTimeout vs requestAnimationFrame)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workbench/src/lib/workbench/codemirror/guard-gutter.ts` — EXACT template for Facet + StateEffect pattern. Uses updateGuardRanges StateEffect to inject data post-construction.
- `apps/workbench/src/lib/workbench/codemirror/coverage-gutter.ts` — Another StateEffect pattern reference
- `apps/workbench/src/components/ui/yaml-editor.tsx` — Where extensions are composed. The `useMemo` that builds the extension array. MUST NOT add cursor data as a dependency.
- `apps/workbench/src/features/presence/stores/presence-store.ts` — Data source with analysts Map, cursor positions
- `apps/workbench/src/features/presence/presence-socket.ts` — PresenceSocket with send() for outbound messages, getPresenceSocket() export

### Established Patterns
- Guard gutter: StateEffect<GuardRange[]> dispatched via view.dispatch({ effects: ... })
- Extension composition in yaml-editor.tsx useMemo with guardGutter(), coverageGutter()
- ViewPlugin with update() + destroy() lifecycle

### Integration Points
- yaml-editor.tsx: add presenceCursorExtension() to the extensions array (static, no deps)
- presence-store: subscribe to cursor updates for the current file
- PresenceSocket: send CursorUpdate messages when local selection changes
- FileEditorShell: send ViewFile/LeaveFile when opening/closing files

</code_context>

<specifics>
## Specific Ideas

Follow y-codemirror.next's YRemoteSelectionsPluginValue pattern but WITHOUT the Yjs dependency. The visual result should be identical — colored carets, colored selection highlights, name labels on hover.

</specifics>

<deferred>
## Deferred Ideas

- Minimap presence indicators (no minimap exists)
- Follow mode (following colleague's cursor across files)
- Typing indicator in editor

</deferred>
