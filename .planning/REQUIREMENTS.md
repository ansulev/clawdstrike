# Requirements: ClawdStrike Workbench v2.0 — Presence & Awareness

**Defined:** 2026-03-23
**Core Value:** Security operators see who else is online, what files colleagues are viewing, and where remote cursors sit — turning the solo IDE into a team-aware workspace.

## v2.0 Requirements

Requirements for the Presence & Awareness milestone. Each maps to roadmap phases.

### Connection & Transport

- [x] **CONN-01**: Workbench connects to hushd via WebSocket at `/api/v1/presence` with Bearer auth
- [x] **CONN-02**: Connection auto-reconnects with exponential backoff and random jitter on disconnect
- [ ] **CONN-03**: Connection status indicator in status bar (green/amber/red dot)
- [ ] **CONN-04**: Workbench functions fully when hushd is unavailable (graceful offline degradation)

### Presence Protocol

- [ ] **PRES-01**: Analyst presence is broadcast to all connected clients (join/leave/heartbeat)
- [x] **PRES-02**: Server detects stale analysts via heartbeat timeout (15s interval, 45s TTL)
- [x] **PRES-03**: Presence is scoped to file rooms (only receive cursor updates for files you have open)
- [x] **PRES-04**: File paths are normalized to workspace-relative before transmission
- [x] **PRES-05**: hushd PresenceHub manages per-file rooms with DashMap and broadcast fan-out

### UI Indicators

- [ ] **UI-01**: Online analyst count displayed in status bar
- [ ] **UI-02**: Colored dots on pane tabs showing which files other analysts are viewing
- [ ] **UI-03**: Activity bar analyst pills (colored sigil dots for online analysts)
- [ ] **UI-04**: Analyst roster panel in sidebar showing name, sigil, current file, and connection status
- [ ] **UI-05**: Speakeasy chat panel shows presence context ("3 analysts viewing this file")

### CodeMirror Awareness

- [ ] **CM-01**: Remote analyst cursors shown as colored carets in CodeMirror editors
- [ ] **CM-02**: Remote analyst selections shown as colored highlights in CodeMirror editors
- [ ] **CM-03**: Cursor name labels appear on hover over remote cursors
- [ ] **CM-04**: Cursor positions use line:column coordinates (stable across independent edits)
- [ ] **CM-05**: Cursor updates throttled to 50ms and delivered via Facet + StateEffect (no extension rebuild)

## v2.1+ Requirements

Deferred to future milestones (Tracks B-D). Tracked but not in current roadmap.

### Shared Investigation Sessions (Track B)
- **INVEST-01**: Investigation = swarm session with analyst nodes on swarm board
- **INVEST-02**: Shared findings feed with intel objects at shareability "swarm"
- **INVEST-03**: Investigation timeline as shared annotation stream
- **INVEST-04**: Task assignment (analyst → finding → "investigate this")

### Co-Editing (Track C)
- **CRDT-01**: CRDT layer for policy YAML (Yjs or Automerge)
- **CRDT-02**: Conflict-free concurrent edits with undo
- **CRDT-03**: Edit receipts (signed diffs for audit trail)

### Investigation Orchestration (Track D)
- **ORCH-01**: Shared runbook templates
- **ORCH-02**: Role-based views (lead vs junior analyst)
- **ORCH-03**: Investigation status board (Kanban-style)
- **ORCH-04**: Export investigation report with receipt chain

## Out of Scope

| Feature | Reason |
|---------|--------|
| Collaborative document editing (CRDT/OT) | Ed25519 signed receipts require single-author provenance; CRDT undermines receipt chain of trust |
| Follow mode (follow colleague's cursor across panes) | Niche use case, complex pane-navigation state; defer to v2.1+ |
| Typing indicator in editor | Cursor movement is sufficient signal; typing indicator floods the wire protocol |
| Minimap presence indicators | No minimap exists in current workbench |
| Analyst permission to hide presence | Security teams are collaborative by nature; unnecessary for SOC workflows |
| tauri-plugin-websocket | Routes through Rust IPC adding latency; native browser WebSocket is sufficient for same-origin |
| Yjs/y-codemirror.next dependency | Awareness-only feature doesn't need ~45KB CRDT framework; custom ViewPlugin suffices |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 19 | Complete |
| CONN-02 | Phase 19 | Complete |
| CONN-03 | Phase 20 | Pending |
| CONN-04 | Phase 19 | Pending |
| PRES-01 | Phase 19 | Pending |
| PRES-02 | Phase 18 | Complete |
| PRES-03 | Phase 18 | Complete |
| PRES-04 | Phase 18 | Complete |
| PRES-05 | Phase 18 | Complete |
| UI-01 | Phase 20 | Pending |
| UI-02 | Phase 20 | Pending |
| UI-03 | Phase 20 | Pending |
| UI-04 | Phase 20 | Pending |
| UI-05 | Phase 20 | Pending |
| CM-01 | Phase 21 | Pending |
| CM-02 | Phase 21 | Pending |
| CM-03 | Phase 21 | Pending |
| CM-04 | Phase 21 | Pending |
| CM-05 | Phase 21 | Pending |

**Coverage:**
- v2.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
