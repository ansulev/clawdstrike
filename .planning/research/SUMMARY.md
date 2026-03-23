# Project Research Summary

**Project:** ClawdStrike Workbench v2.0 — Real-Time Presence & Awareness
**Domain:** Real-time analyst presence layer for a Tauri 2 + React 19 + CodeMirror 6 desktop security IDE
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

The ClawdStrike Workbench v2.0 presence feature is a purpose-built presence awareness layer — not collaborative editing. Analysts need to see who is online, what files colleagues are viewing, and where remote cursors sit; they do not share documents or need CRDT synchronization. This distinction is the single most important architectural decision: it eliminates Yjs, y-codemirror.next, and all the complexity of operational transform, replacing them with a lightweight WebSocket channel, a dedicated Zustand store, and a custom CodeMirror 6 ViewPlugin. The recommended stack requires zero new dependencies on both the Rust and TypeScript sides — everything needed is already present in the codebase (axum WebSocket support, DashMap, CodeMirror view/state packages, Zustand + immer).

The recommended approach builds in four sequential phases following strict dependency order: server-side PresenceHub first, then the client-side connection manager and Zustand store, then the UI indicator components, and finally the CodeMirror cursor extension as the headline differentiator. This ordering is non-negotiable — the UI indicators and CM6 extension both depend on presence-store data, which depends on the WebSocket connection, which depends on the hushd server endpoint. The architecture mirrors existing, proven patterns already established in the codebase: PresenceSocket matches FleetEventStream exactly, presence-store matches operator-store and fleet-connection-store, and the CM6 ViewPlugin follows the same StateEffect pattern already used by guard-gutter.ts.

The top risk is the CM6 extension rebuild storm: if remote cursor data is passed as a `useMemo` dependency in the extensions array, every cursor movement destroys and recreates the editor. This prevention must be built in from the start — use a Facet + StateEffect to push presence data into the editor after creation, never via the extensions array. The secondary risk is credential divergence between the fleet SSE connection and the presence WebSocket; mitigation is to always call the credentials getter function on each reconnect rather than capturing a token at connect time.

## Key Findings

### Recommended Stack

No new dependencies are needed on either side. The Rust side uses axum's built-in WebSocket support (`axum::extract::ws`), `tokio::sync::broadcast` for fan-out (identical to the existing SSE broadcaster pattern in events.rs), and DashMap for concurrent room state — all already present in hushd. The TypeScript side uses the native browser WebSocket API (not `tauri-plugin-websocket`, which adds unnecessary IPC overhead for same-origin connections) and `@codemirror/view`'s `ViewPlugin`, `Decoration`, and `WidgetType` (already installed). All evaluated alternatives added complexity or bundle weight without benefit for this specific use case.

**Core technologies:**
- axum built-in WebSocket (`axum::extract::ws`): server endpoint — already included, no new feature flag needed
- `tokio::sync::broadcast`: presence event fan-out — same pattern as SSE events.rs broadcaster already in hushd
- DashMap: concurrent per-file room state — already used in hushd for other concurrent maps
- Native browser WebSocket API: client connection — avoids Tauri IPC overhead, same-origin so no CSP issues
- `@codemirror/view` (ViewPlugin, Decoration, WidgetType): remote cursor rendering — already installed; replicates y-codemirror.next's visual result without the Yjs dependency

### Expected Features

**Must have (table stakes):**
- Online analyst roster — who is connected; Zustand store + simple list component
- "Who's viewing this file" indicator on pane tabs — Google Docs / Figma / VS Code Live Share UX norm
- Auto-reconnect with exponential backoff + jitter — network drops are common; must self-recover
- Connection status in status bar — green/amber/red dot like the existing fleet indicator
- Graceful offline degradation — presence-store defaults to empty; workbench is fully functional without hushd

**Should have (differentiators):**
- Colored remote cursors in CodeMirror — headline feature; see exactly where colleagues are reviewing policy
- Remote selection highlighting — same CM6 extension, Decoration.mark for selection ranges
- Cursor name labels on hover — WidgetType with CSS label, matching y-codemirror.next's YRemoteCaretWidget
- File-scoped presence rooms — only receive updates for files you have open; prevents message flood
- Heartbeat-based stale analyst detection — 15s heartbeat interval, 45s server timeout
- Presence indicators in Speakeasy chat panel — "3 analysts viewing this finding"
- Activity bar analyst pills — colored sigil dots showing who is online

**Defer (v2.1+):**
- Follow mode (follow a colleague's cursor across panes) — niche use case, complex pane-navigation state
- Minimap presence indicators — no minimap in v2.0
- Analyst permission to hide their own presence — security teams are collaborative by nature
- Typing indicator in editor — cursor movement is sufficient signal; typing indicator floods the wire
- Collaborative document editing (CRDT/OT) — operators work on their own policy files; explicitly out of scope

### Architecture Approach

The architecture is a hub-and-spoke WebSocket system with hushd as the central presence hub. Each workbench client maintains a persistent WebSocket connection to hushd's `/api/v1/presence` endpoint. The server tracks per-file "rooms" via DashMap and broadcasts presence events only to clients viewing the same file. The client side has a strict unidirectional data flow: PresenceSocket receives raw WebSocket messages and writes to presence-store; all UI components and CodeMirror extensions read from presence-store via selectors. The store never talks to the socket directly after initialization, and the socket never talks to UI components. Wire protocol is JSON over WebSocket with a `type` discriminator (matches the SwarmEnvelope pattern), using line:column cursor coordinates (not absolute offsets) to stay stable across independent per-operator edits.

**Major components:**
1. **PresenceHub** (Rust, hushd) — room management, DashMap of filePath -> analyst set, broadcast channel fan-out, heartbeat timeout tracking, workspace-relative path normalization
2. **PresenceSocket** (TypeScript class) — WebSocket lifecycle, reconnect with jittered backoff, heartbeat timer, message routing to store callbacks; direct parallel of FleetEventStream
3. **presence-store** (Zustand + immer) — single source of truth: `analysts: Map<fingerprint, AnalystPresence>`, `viewersByFile: Map<filePath, Set<fingerprint>>`, `connected: boolean`; exposes granular selectors to prevent re-render storms
4. **PresenceCursorExtension** (CM6 ViewPlugin) — reads from presence-store via raw `usePresenceStore.subscribe` (outside React), builds Decoration.widget for carets and Decoration.mark for selections, unsubscribes in `destroy()`
5. **PresenceIndicators** (React components) — activity bar pills, pane tab dots, status bar count, analyst roster panel; all read from presence-store via targeted selectors

### Critical Pitfalls

1. **CM6 extension rebuild storm** — remote cursor data included as a `useMemo` dependency destroys and recreates the entire editor on every cursor move; prevent by using Facet + StateEffect to inject data post-creation (identical to guard-gutter.ts's `updateGuardRanges` pattern). This is the highest-probability rewrite-causing bug and must be addressed from the first line of Phase 4 code.

2. **WebSocket credential divergence with fleet SSE** — capturing the auth token at connect time means stale credentials after fleet re-authentication; prevent by calling `getCredentials()` as a function reference on every reconnect attempt, never caching the token value.

3. **Presence store re-render storm** — subscribing to `(s) => s.analysts` (full Map) causes re-renders of the entire pane tree on every cursor move from any analyst; prevent with granular selectors (`s.analysts.size` for count, `s.viewersByFile.get(path)?.size` for tab dots) and raw `usePresenceStore.subscribe` outside React for the CM6 bridge.

4. **ViewPlugin memory leak** — closing a pane tab without destroying the store subscription leaves orphaned subscriptions accumulating with each file open/close cycle; prevent by subscribing in the plugin constructor and unsubscribing in `destroy()`.

5. **Thundering herd on hushd restart** — all clients reconnect simultaneously; prevent with random jitter on reconnect backoff. The existing FleetEventStream intentionally does NOT have jitter — add it to PresenceSocket from the start.

6. **File path normalization mismatch** — absolute paths differ per operator workstation, preventing cross-analyst room matching; prevent by normalizing to workspace-relative paths before sending (strip projectRoot from project-store).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Server Foundation (hushd PresenceHub)
**Rationale:** All client-side work depends on the server endpoint existing. Building the server first allows the client to be tested against real infrastructure from day one. The Rust side has zero new dependencies, making this a low-risk starting phase.
**Delivers:** Working WebSocket endpoint at `/api/v1/presence` with room management, fan-out broadcast, heartbeat timeout, auth validation via query param token, and workspace-relative path normalization
**Addresses:** Server requirement for all presence features; path normalization (Pitfall 6) enforced at the room key level
**Avoids:** Building client code against a mock that diverges from real server behavior
**Research flag:** Standard pattern — axum WebSocket is well-documented; no research-phase needed

### Phase 2: Connection Infrastructure (PresenceSocket + presence-store)
**Rationale:** PresenceSocket and presence-store are a single logical unit — the store is empty without the socket, and the socket has nowhere to write without the store. Both must be built together. All UI and CM6 work reads from the store, so this is the shared dependency for Phases 3 and 4.
**Delivers:** Working WebSocket connection with reconnect / jitter / heartbeat, Zustand store with full analyst roster and viewersByFile index, connection status signal for status bar
**Uses:** Native browser WebSocket API, Zustand + immer, `createSelectors` pattern from existing stores
**Implements:** PresenceSocket (FleetEventStream pattern) and presence-store (operator-store pattern)
**Avoids:** Pitfall 2 (credential divergence — implement getCredentials() function reference from day one); Pitfall 5 (jitter in backoff from day one)
**Research flag:** Standard pattern — skip research-phase

### Phase 3: UI Presence Indicators
**Rationale:** Low-complexity, high-visibility features that prove presence is working end-to-end. Status bar indicator, pane tab dots, and analyst roster panel can all be built from presence-store selectors with minimal complexity. These serve as the integration validation that the full stack (hushd -> PresenceSocket -> presence-store -> React) is functioning before adding CM6 complexity.
**Delivers:** Online analyst count in status bar, colored dots on pane tabs for files being viewed by others, right sidebar analyst roster panel, Speakeasy chat presence bridging
**Addresses:** All "must have" table stakes features; differentiator features except CM6 cursors
**Avoids:** Pitfall 3 (granular selectors enforced from the start — `s.analysts.size` not `s.analysts`)
**Research flag:** Standard pattern — skip research-phase

### Phase 4: CodeMirror Cursor Extension
**Rationale:** The headline differentiator but also the highest-risk phase due to CM6's extension lifecycle. Sequenced last so the presence data pipeline (Phases 1-3) is fully validated before introducing CM6 complexity. The ViewPlugin + Facet + StateEffect pattern is proven by guard-gutter.ts in the codebase.
**Delivers:** Colored remote cursors with name labels in the YAML policy editor, remote selection highlighting, throttled cursor broadcast (50ms), store-to-CM6 bridge via raw Zustand subscribe (outside React)
**Implements:** PresenceCursorExtension (ViewPlugin pattern from y-codemirror.next, minus Yjs dependency)
**Avoids:** Pitfall 1 (Facet + StateEffect, never extension array dependency — must be verified before writing); Pitfall 7 (destroy() cleanup)
**Research flag:** Review guard-gutter.ts and coverage-gutter.ts implementations in detail before planning Phase 4 tasks — the Facet reconfiguration sequence is the critical path

### Phase Ordering Rationale

- Phase 1 before all others: server endpoint is a hard dependency for any client work; no mock can substitute for real hushd behavior
- Phase 2 before Phases 3 and 4: presence-store is the shared data source for all consumers; store shape must be stable before building anything that reads it
- Phase 3 before Phase 4: UI indicators serve as a simple end-to-end integration test validating the data pipeline before introducing CM6 complexity
- Phase 4 last: highest technical risk; isolating it reduces blast radius if the CM6 approach needs adjustment
- Anti-features are explicitly excluded from all phases: no CRDT, no follow mode, no typing indicator, no full document sync

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (CM6 cursor extension):** The Facet + StateEffect pattern for injecting external data post-construction is the correct approach but the exact dispatch sequencing with React lifecycle needs validation against the existing guard-gutter.ts and coverage-gutter.ts implementations before writing Phase 4 tasks. Recommend reading those files during planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (hushd PresenceHub):** axum WebSocket is well-documented; DashMap + broadcast channel pattern already used in hushd
- **Phase 2 (PresenceSocket + presence-store):** Direct parallel of FleetEventStream and operator-store; follow existing code
- **Phase 3 (UI indicators):** Standard Zustand selector + React component work; no novel patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all capabilities confirmed present in existing packages. No ambiguity about technology choices. |
| Features | HIGH | Derived from explicit competitor analysis (VS Code Live Share, Figma) and the existing codebase's fleet/swarm patterns. Clear must-have/defer split. |
| Architecture | HIGH | Component boundaries and data flow are fully specified and validated against existing patterns (FleetEventStream, guard-gutter.ts, operator-store). Wire protocol specified. |
| Pitfalls | HIGH | All critical pitfalls grounded in actual CM6/Zustand/WebSocket behavior and cross-referenced to specific files in the existing codebase. |

**Overall confidence:** HIGH

### Gaps to Address

- **Color assignment strategy:** Research identified two valid approaches (deterministic from fingerprint hash vs. server-assigned by connection order). Fingerprint-hash is simpler and gives deterministic cross-session color; server-assigned avoids palette collision. Recommend server-assigned with an 8-color palette; decide during Phase 1 planning and document as an explicit decision.

- **axum WS auth via query param middleware:** The existing auth middleware extracts Bearer tokens from headers. WebSocket upgrade requests cannot carry custom headers, so the token must come from a query parameter. The exact axum extractor pattern for this needs verification during Phase 1 implementation — the hushd SSE auth code is the closest reference.

- **Speakeasy chat integration depth:** FEATURES.md lists "presence in Speakeasy chat" as a differentiator but the architecture does not fully specify how presence-store bridges to SpeakeasyPanel props. This is low-risk (prop-passing from the store) but should be scoped explicitly in Phase 3 task breakdown.

- **hushd AppState extension point:** PresenceHub needs to be injected into hushd's `AppState`. Whether to add it as a direct field or wrap in an Arc depends on the current AppState structure in `crates/services/hushd/src/api/mod.rs`. Minor implementation detail but worth confirming before Phase 1 planning begins.

- **CM6 Facet reconfiguration performance under throttle:** Need to verify that dispatching Facet updates at 20/sec (50ms throttle) does not cause CM6 rendering issues. Likely fine based on y-codemirror.next doing the same, but should be validated during Phase 4 implementation.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `features/fleet/fleet-event-stream.ts` — authoritative pattern for PresenceSocket design
- Existing codebase: `lib/workbench/codemirror/guard-gutter.ts` — authoritative pattern for CM6 StateEffect injection
- Existing codebase: `features/fleet/use-fleet-connection.ts` — credential function reference pattern
- [axum::extract::ws](https://docs.rs/axum/latest/axum/extract/ws/index.html) — WebSocket handler API
- [CodeMirror Decoration example](https://codemirror.net/examples/decoration/) — widget decoration pattern
- [CodeMirror collab discussion](https://discuss.codemirror.net/t/how-to-show-peers-cursors-on-cm6-collab-editor/3996) — Marijn's guidance on peer cursor implementation; line:column vs absolute offset recommendation

### Secondary (MEDIUM confidence)
- [y-codemirror.next](https://github.com/yjs/y-codemirror.next) — reference for ViewPlugin cursor rendering pattern (studied for pattern, not used as dependency)
- [Figma multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) — reference for cursor + name label UX expectations
- [Zustand WebSocket patterns](https://github.com/pmndrs/zustand/discussions/1651) — community consensus on WS + Zustand integration
- [Zustand re-render optimization](https://github.com/pmndrs/zustand/discussions/2779) — selector granularity guidance

### Tertiary (LOW confidence)
- [VS Code Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare) — used to calibrate table-stakes UX expectations only; not an implementation reference
- [Tauri 2 WebSocket plugin](https://v2.tauri.app/plugin/websocket/) — confirmed NOT needed for same-origin connections; used to rule out this approach

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
