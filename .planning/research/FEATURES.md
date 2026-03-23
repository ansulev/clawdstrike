# Feature Landscape

**Domain:** Real-time analyst presence and cursor awareness in a Tauri 2 + React 19 + CodeMirror 6 desktop security IDE
**Researched:** 2026-03-22

## Table Stakes

Features users expect from any presence system. Missing = feature feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Online analyst roster | Users need to know who else is connected | Low | Zustand store + simple list component |
| "Who's viewing this file" indicator on tabs | Google Docs, Figma, VS Code Live Share all do this | Low | Colored dots/pills on pane-tab-bar.tsx |
| Reconnection with backoff | Network drops are common; must auto-recover | Medium | Follow FleetEventStream pattern exactly |
| Connection status in status bar | Operators need to see if presence is working | Low | Green/amber/red dot like fleet indicator |
| Graceful degradation when hushd is not connected | Workbench must work fully in local/offline mode | Low | presence-store defaults to empty; all UI gated on `connected` |

## Differentiators

Features that set the workbench apart. Not expected in every tool, but high value for security operations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Colored remote cursors in CodeMirror | See exactly where colleagues are editing/reviewing policy | Medium | CM6 ViewPlugin with Decoration.widget for carets + Decoration.mark for selections |
| Remote selection highlighting | See what text a colleague has selected (for review/discussion) | Medium | Same CM6 extension, adds mark decorations for selection ranges |
| Cursor name labels | Hover over a remote cursor to see who it belongs to | Low | WidgetType subclass with CSS label, like y-codemirror.next's YRemoteCaretWidget |
| File-scoped presence rooms | Only receive cursor updates for files you have open | Medium | Server-side per-file room tracking. Prevents message flood |
| Presence in Speakeasy chat | "Connor is typing..." or "3 analysts viewing this finding" | Low | Bridge presence-store to SpeakeasyPanel props |
| Activity bar analyst pills | Colored sigil dots in the activity bar showing who is online | Low | Small component reading presence-store |
| Heartbeat-based stale detection | Detect and remove analysts who disconnected without clean close | Low | 15s heartbeat interval, 45s server timeout |

## Anti-Features

Features to explicitly NOT build in v2.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Collaborative document editing (CRDT/OT) | Massive complexity; operators work on their own policies, not shared documents | Presence only -- see where others are looking, not edit the same doc |
| Follow mode ("follow cursor of analyst X") | Niche use case, complex state management around pane navigation | Defer to v2.1+; table stakes presence is sufficient for v2.0 |
| Voice/video chat | Out of scope; there are dedicated tools for this | Speakeasy text chat is the communication channel |
| Presence across different hushd instances | Multi-server federation is a separate infrastructure project | Single-hushd deployment; presence hub is in-process |
| Typing indicator in editor | Sends too much data; cursor position is sufficient signal | Cursor movement already implies activity |
| Analyst permissions on presence (hide from others) | Adds complexity; security teams are collaborative by nature | All connected analysts are visible |
| Minimap presence indicators | VS Code Live Share does this but it requires minimap implementation | Not building minimap in v2.0 |

## Feature Dependencies

```
WebSocket connection manager -> Presence store (store needs data from socket)
Presence store -> All UI indicators (UI reads from store)
Presence store -> CM6 cursor extension (extension reads cursor data from store)
Fleet auth (existing) -> WebSocket auth (reuse Bearer token)
Operator identity (existing) -> Analyst fingerprint/sigil/color (identity provides these)
hushd PresenceHub (Rust) -> WebSocket connection manager (server must exist first)
Pane store view changes (existing) -> Presence broadcast (notify server when file changes)
```

## MVP Recommendation

Prioritize:
1. **WebSocket connection manager** (PresenceSocket) -- foundation for everything
2. **hushd PresenceHub** (Rust WebSocket handler) -- server side must exist
3. **Zustand presence store** -- single source of truth for all presence data
4. **Online roster + status bar indicator** -- immediate visible proof that presence works
5. **Tab presence dots** -- low-effort, high-visibility feature
6. **CM6 remote cursors** -- the headline differentiator

Defer:
- **Speakeasy "is typing" integration** -- nice but not essential for v2.0 launch
- **Follow mode** -- complex, niche use case
- **Activity bar analyst pills** -- cosmetic; roster covers the information need

## Sources

- [VS Code Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare) -- reference for what table-stakes presence looks like
- [Figma multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) -- reference for cursor + name label UX
- [y-codemirror.next](https://github.com/yjs/y-codemirror.next) -- reference for CM6 cursor rendering approach
- Existing codebase: `fleet-event-stream.ts`, `swarm-coordinator.ts`, `operator-store.tsx` -- patterns to follow
