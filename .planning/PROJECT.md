# ClawdStrike Workbench IDE

## What This Is

ClawdStrike Workbench is a Tauri 2 + React 19 desktop security operations IDE — policy authoring, threat simulation, compliance scoring, fleet management, swarm orchestration, receipt verification, and real-time analyst collaboration. VS Code/Cursor-like layout with activity bar, splittable panes, file tree, and panel system. Live features include real-time fleet monitoring via SSE, swarm board with animated graph visualization, automated threat intelligence pipeline, and multiplayer presence with colored cursors in shared policy editors.

## Core Value

Security operators can work across multiple views simultaneously — policy editor beside simulation results, swarm board beside audit log — with a folder-first navigation model and IDE-grade keyboard workflows. Live data flows keep operators in the loop without context switching.

## Requirements

### Validated

- ✓ Activity bar (48px icon rail) with 8+ icons — v1.0
- ✓ 8 sidebar panels (Heartbeat, Sentinels, Findings, Explorer, Search, Library, Fleet, Compliance) — v1.0/v1.1
- ✓ Binary tree pane system with openApp/closeView/setActiveView — v1.0
- ✓ PaneTabBar with close buttons, gold active underline, overflow scrolling — v1.0/v1.1
- ✓ Right sidebar with Speakeasy — v1.0
- ✓ 13+ Zustand stores with createSelectors — v1.0
- ✓ Command registry with 80+ commands — v1.0/v1.1
- ✓ Command palette (Cmd+K) — v1.0
- ✓ Global search (Cmd+Shift+F) — v1.1
- ✓ In-file find/replace (Cmd+F/H) — v1.1
- ✓ Quick Open file picker (Cmd+P) — v1.1
- ✓ File tree CRUD (create/rename/delete) with context menus — v1.1
- ✓ Breadcrumb navigation — v1.1
- ✓ Tab context menus (Close Others, Close to Right, Close Saved) — v1.1
- ✓ Terminal splits and named sessions — v1.1
- ✓ Inline detection test controls (gutter play buttons) — v1.1
- ✓ Coverage gap indicators in editor gutter — v1.1
- ✓ File-first editor (FileEditorShell) with live CodeMirror editing — v1.1
- ✓ Labeled filter bar in Explorer — v1.2
- ✓ Fleet SSE streaming with heartbeat/drift detection — v1.3
- ✓ Fleet topology map, agent detail, bulk deploy — v1.3
- ✓ Signal→Finding→Intel automated pipeline — v1.3
- ✓ Draft Detection and Draft Policy Guard from findings — v1.3
- ✓ Launch Swarm from editor toolbar — v1.3
- ✓ Swarm board: policy eval glow, animated receipt edges, trust graph — v1.3
- ✓ Receipt inspector pane tab — v1.3
- ✓ Findings badge count on activity bar — v1.3
- ✓ Bidirectional finding↔detection links — v1.3

- ✓ File & folder icons (shield for policy, SIG/YAR badges, folder open/close) — v1.2
- ✓ Tree visual refinement (indent guides, active file highlight, collapsible roots) — v1.2
- ✓ Context menu completeness (root/file/folder menus, viewport clamping) — v1.2
- ✓ Fix broken tests (App, desktop-layout, shortcut-provider) — v1.4
- ✓ Search AbortController + staleness guard — v1.4
- ✓ Terminal dynamic sizing — v1.4
- ✓ Meta+W keybinding conflict resolved — v1.4
- ✓ Multi-policy-store bridge deleted, all consumers migrated — v1.4
- ✓ hushd PresenceHub with WebSocket endpoint, room management, heartbeat timeout — v2.0
- ✓ PresenceSocket client with jittered backoff reconnect, presence-store Zustand — v2.0
- ✓ Status bar connection indicator, pane tab dots, activity bar pills, analyst roster panel — v2.0
- ✓ Speakeasy presence context ("N analysts viewing this file") — v2.0
- ✓ CodeMirror remote cursors (colored carets), selection highlights, hover name labels — v2.0
- ✓ File room membership wiring (view_file/leave_file + path normalization) — v2.0

### Active

(None — planning next milestone)

## Current State

v2.0 Presence & Awareness shipped. The workbench now supports real-time analyst collaboration with WebSocket-based presence, colored cursors in shared policy editors, and presence indicators across the UI. Foundation laid for Tracks B-D (shared investigations, co-editing, orchestration).

### Out of Scope

- Full VS Code extension API — MCP plugin is the right model
- Tree-sitter editor — CodeMirror + schema completions correct for YAML/Sigma/YARA
- Vim emulation — not needed for security policy editing
- Git integration — workbench manages detection projects, not source control
- Remote development — desktop-first
- Custom themes — dark-only for now

## Context

### v2.0 Milestone Complete (2026-03-23)
5 phases (18-22), 8 plans. hushd PresenceHub with axum WebSocket, PresenceSocket client with jittered backoff, presence-store Zustand, status bar/tab dots/activity pills/roster panel/Speakeasy presence, CodeMirror remote cursors with Facet+StateEffect, file room membership wiring. Zero new dependencies — all built on existing axum WS + CM6 ViewPlugin + Zustand.

### v1.4 Milestone Complete (2026-03-23)
3 phases, 5 plans. Fixed broken tests, search race condition, terminal sizing, Meta+W conflict. Migrated all components off multi-policy-store bridge. Deleted 975-line bridge layer. Code review + production polish pass.

### v1.3 Milestone Complete (2026-03-22)
4 gap closure phases (11-14), 7 plans. Completed Track B (Swarm Board Evolution) and wired Track C (Intel Pipeline). Fixed integration issues from file-first editor cutover. All 23 v1.3 requirements verified.

### v1.2 Milestone (partial — filter bar complete, icons/tree-vis/context menus pending)
Filter bar phase completed. Remaining 15 requirements deferred — explorer polish is functional but not production-polished.

### v1.1 Milestone Complete (2026-03-19)
13 phases, ~28 plans. IDE completeness: search, navigation, file tree CRUD, detection integration, file-first editor, live CodeMirror editing.

### v1.0 Milestone Complete (2026-03-18)
4 phases, 9 plans. IDE shell: activity bar, sidebar panels, pane system, right sidebar, bottom panels, 80+ commands.

### Codebase Scale
- 600+ source files
- 15+ Zustand stores, 90+ commands
- CodeMirror 6 editor with YAML/Sigma/YARA/OCSF support
- Binary tree pane system, Tauri 2 desktop integration
- @xyflow/react swarm board with custom node/edge types
- Fleet SSE streaming with InProcessEventBus coordinator

## Constraints

- **Framework**: Tauri 2 + React 19 + TypeScript
- **State**: Zustand + immer
- **Routing**: HashRouter (Tauri file:// protocol)
- **Editor**: CodeMirror 6
- **Terminal**: ghostty-web + PTY
- **Graph**: @xyflow/react
- **Testing**: All existing tests must pass

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Activity bar + sidebar panels | VS Code model proven; reuses sigil icons | ✓ Good |
| Routes as "apps" (zero page changes) | Minimal risk; pages render in panes | ✓ Good |
| FileEditorShell wraps files as pane tabs | Flattened tabs-within-tabs UX problem | ✓ Good |
| GuardTestYamlEditor wrapper for gutter | Hook must be inside TestRunnerProvider | ✓ Good |
| .swarm directory bundles | Investigation state persists as files | ✓ Good |
| createSwarmBundleFromPolicy with policyRef | Links swarm investigation to source policy | ✓ Good |
| InProcessEventBus for local swarms | No SSE needed; same-process coordinator | ✓ Good |
| Fleet SSE → signal-store bridge | Live signals feed automated finding pipeline | ✓ Good |
| Post-draft annotation for finding links | Bidirectional link without schema changes | ✓ Good |
| multi-policy-store bridge decomposition | 3 focused stores > 1 monolith; migration helper hooks | ✓ Good |
| Awareness-only (no CRDT/OT) | Ed25519 signed receipts require single-author provenance | ✓ Good |
| Native browser WebSocket (not tauri-plugin) | Avoids IPC overhead for same-origin connections | ✓ Good |
| Facet+StateEffect for CM6 cursors | Prevents extension rebuild storm on cursor updates | ✓ Good |
| Imperative PresenceSocket (not React hook) | Matches FleetEventStream pattern; survives component remounts | ✓ Good |
| Server-assigned colors, 8-color palette | Deterministic per session; no collision logic needed | ✓ Good |
| toPresencePath client normalization | Mirrors server normalize_path for consistent room keys | ✓ Good |

---
*Last updated: 2026-03-23 after v2.0 milestone complete*
