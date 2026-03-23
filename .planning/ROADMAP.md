# Roadmap: ClawdStrike Workbench v2.0 — Presence & Awareness

## Overview

Add real-time analyst presence and awareness to the workbench. Four phases build a strict dependency chain: hushd WebSocket server endpoint, then client connection manager and Zustand store, then UI presence indicators across the shell, then CodeMirror cursor/selection awareness as the headline differentiator. Zero new dependencies on either side — everything needed is already in the codebase.

**Prior milestones:**
- v1.0: IDE shell (activity bar, panes, sidebar panels, commands)
- v1.1: IDE completeness (search, nav, file tree, editor, detection integration)
- v1.2: Explorer polish (icons, filters, indent guides, context menus)
- v1.3: Live features (fleet SSE, swarm board, intel pipeline)
- v1.4: Cleanup & store migration (test fixes, search/terminal bugs, bridge deletion)

## Phases

- [ ] **Phase 18: Server Foundation** - hushd PresenceHub with axum WebSocket endpoint, room management, heartbeat timeout, path normalization
- [ ] **Phase 19: Client Connection & Store** - PresenceSocket class with reconnect/jitter, presence-store Zustand store, offline degradation
- [ ] **Phase 20: UI Presence Indicators** - Status bar connection dot, online count, pane tab dots, activity bar pills, analyst roster, Speakeasy presence
- [ ] **Phase 21: CodeMirror Cursor Extension** - Remote cursors, selections, hover labels, line:column coordinates, Facet+StateEffect delivery

## Phase Details

### Phase 18: Server Foundation
**Goal**: hushd serves a WebSocket presence endpoint that tracks which analysts are viewing which files and broadcasts presence events to connected clients
**Depends on**: Nothing (server-side work, no client dependency)
**Requirements**: PRES-05, PRES-02, PRES-04, PRES-03
**Success Criteria** (what must be TRUE):
  1. A WebSocket client can connect to hushd at `/api/v1/presence` with a Bearer token and receive a welcome message confirming authentication
  2. When two clients join the same file room, each receives the other's join event; when one disconnects, the other receives a leave event
  3. If a connected client stops sending heartbeats for 45 seconds, the server evicts it and broadcasts a leave event to remaining room members
  4. File paths sent by clients are normalized to workspace-relative form before being used as room keys (absolute paths from different workstations resolve to the same room)
**Plans**: TBD

Plans:
- [ ] 18-01: PresenceHub struct, DashMap room state, broadcast fan-out, heartbeat timeout, WS endpoint with auth

### Phase 19: Client Connection & Store
**Goal**: The workbench maintains a persistent WebSocket connection to hushd and exposes all presence data through a Zustand store that the rest of the app reads from
**Depends on**: Phase 18 (server endpoint must exist for real connection)
**Requirements**: CONN-01, CONN-02, CONN-04, PRES-01
**Success Criteria** (what must be TRUE):
  1. When the workbench starts with hushd running, the connection indicator transitions to "connected" and the analyst appears in their own roster
  2. When hushd goes down and comes back, the workbench automatically reconnects within a bounded time (exponential backoff with jitter) without user intervention
  3. When hushd is unavailable, the workbench functions normally with all features except presence (no errors, no spinners, empty presence state)
  4. When a second analyst connects from another workbench, both clients see each other in the presence roster within one heartbeat interval
**Plans**: TBD

Plans:
- [ ] 19-01: PresenceSocket class (WS lifecycle, reconnect with jittered backoff, heartbeat timer, message routing)
- [ ] 19-02: presence-store Zustand store (analysts Map, viewersByFile index, selectors, offline defaults)

### Phase 20: UI Presence Indicators
**Goal**: Analysts can see at a glance who is online, which files colleagues are viewing, and how many people are looking at their current file
**Depends on**: Phase 19 (presence-store must be populated for UI to render)
**Requirements**: CONN-03, UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. The status bar shows a colored dot (green=connected, amber=reconnecting, red=disconnected) and an online analyst count
  2. Pane tabs for files being viewed by other analysts display colored dots matching each remote analyst's assigned color
  3. The activity bar shows colored analyst pills indicating who is online
  4. A sidebar roster panel lists each online analyst with their name, sigil color, currently-viewed file, and connection status
  5. The Speakeasy chat panel shows presence context (e.g., "3 analysts viewing this file") when a file-scoped conversation is active
**Plans**: TBD

Plans:
- [ ] 20-01: Connection status dot in status bar, online analyst count
- [ ] 20-02: Pane tab presence dots, activity bar analyst pills, analyst roster panel
- [ ] 20-03: Speakeasy presence context bridge

### Phase 21: CodeMirror Cursor Extension
**Goal**: Analysts see exactly where colleagues' cursors and selections are in shared policy files, with colored carets, highlighted selections, and name labels
**Depends on**: Phase 20 (UI indicators validate the full data pipeline before adding CM6 complexity)
**Requirements**: CM-01, CM-02, CM-03, CM-04, CM-05
**Success Criteria** (what must be TRUE):
  1. When two analysts open the same policy file, each sees the other's cursor as a colored vertical caret in the editor at the correct line and column
  2. When a remote analyst selects a range of text, the selection appears as a colored highlight in the local editor
  3. Hovering over a remote cursor caret displays a label with the analyst's name
  4. Rapid cursor movement from a remote analyst updates smoothly without editor flicker, jank, or extension rebuild (Facet+StateEffect delivery, not extension array mutation)
  5. Closing a file tab cleanly removes all cursor decorations and unsubscribes from presence updates for that file (no memory leak)
**Plans**: TBD

Plans:
- [ ] 21-01: PresenceCursorExtension ViewPlugin (Facet+StateEffect, cursor carets, selection highlights, name labels, throttle, cleanup)

## Progress

**Execution Order:** 18 -> 19 -> 20 -> 21

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Server Foundation | 0/1 | Not started | - |
| 19. Client Connection & Store | 0/2 | Not started | - |
| 20. UI Presence Indicators | 0/3 | Not started | - |
| 21. CodeMirror Cursor Extension | 0/1 | Not started | - |
