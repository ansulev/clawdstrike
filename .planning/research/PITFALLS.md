# Domain Pitfalls

**Domain:** Real-time analyst presence and cursor awareness in a Tauri 2 + React 19 + CodeMirror 6 desktop IDE
**Researched:** 2026-03-22

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: CM6 Extension Rebuild Storm

**What goes wrong:** The `extensions` array in `yaml-editor.tsx` is rebuilt via `useMemo` whenever its dependencies change. If the remote cursor data is included as a `useMemo` dependency, every cursor movement from any analyst rebuilds the entire CodeMirror extension set -- destroying and recreating the editor.

**Why it happens:** CodeMirror 6 distinguishes between extension configuration (immutable after creation) and dynamic state (facets, state effects). Passing changing data as an extension dependency triggers full editor recreation.

**Consequences:** Editor flickers, cursor position resets, undo history lost, typing feels laggy. This is the single most likely rewrite-causing bug.

**Prevention:** Use a `Facet` + `StateEffect` to inject remote cursor data into the editor **after** creation. The `presenceCursors()` extension itself is added once to the `extensions` array and never changes. Remote cursor positions are pushed via `view.dispatch({ effects: updateRemoteCursors.of(newPositions) })`. The existing `guard-gutter.ts` already uses this exact pattern with `updateGuardRanges` StateEffect.

**Detection:** If you see `useEffect(() => { ... }, [extensions])` re-firing when a remote analyst moves their cursor, you have this bug.

### Pitfall 2: WebSocket/SSE Credential Divergence

**What goes wrong:** The fleet SSE connection and the presence WebSocket use different credential retrieval paths. When the fleet token rotates or the user re-authenticates, one connection uses the new token while the other has the stale token.

**Why it happens:** The fleet connection stores credentials in a closure (`_credentials` in `use-fleet-connection.ts`). If the presence socket captures the token at connect time and does not re-read on reconnection, it will use a stale token after fleet re-authentication.

**Consequences:** Presence WebSocket fails to reconnect after token rotation. Silent failure -- no error in UI, just "0 analysts online" forever.

**Prevention:** PresenceSocket must call `useFleetConnectionStore.getState().actions.getCredentials()` at each reconnection attempt, not cache the token from initial connection. This matches how `FleetEventStream` uses `getApiKey: () => _credentials.apiKey` as a function, not a captured value.

**Detection:** Disconnect fleet, reconnect with new credentials, check if presence WebSocket recovers.

### Pitfall 3: Presence Store Triggering Unnecessary CM6 Re-renders

**What goes wrong:** Components subscribe to the entire `analysts` Map in the presence store. Every cursor movement from any analyst triggers React re-renders of the entire pane tree, status bar, activity bar, and sidebar.

**Why it happens:** Zustand's default equality check is reference equality. A Map mutation via immer creates a new Map reference even if only one entry changed. Components subscribed to `(s) => s.analysts` re-render on every change.

**Consequences:** Typing lag, janky UI, dropped frames when 5+ analysts are active.

**Prevention:** Design selectors to be granular:
- Status bar: `(s) => s.analysts.size` -- only re-renders when count changes
- Tab dots: `(s) => s.viewersByFile.get(specificPath)?.size ?? 0` -- only re-renders when that specific file's viewer count changes
- CM6 bridge: Do NOT use React at all for pushing data to CodeMirror. Subscribe to the raw Zustand store (`usePresenceStore.subscribe`) outside React and call `view.dispatch()` directly

**Detection:** React DevTools profiler showing `FileEditorShell` or `PaneContainer` re-rendering at 20Hz when remote analysts are active.

## Moderate Pitfalls

### Pitfall 4: Cursor Position Stale After Document Edit

**What goes wrong:** Analyst A broadcasts cursor at position 150. Analyst B (viewing the same file locally) edits text before position 150, inserting 20 characters. The remote cursor for A is now drawn at position 150 in B's document, but A's actual position (in A's document) corresponds to position 170 in B's document.

**Prevention:** Since this is presence-only (not collaborative editing), documents are NOT shared. Each operator has their own copy. Cursor positions are informational -- they show approximately where the other analyst is looking. Use **line:column** coordinates instead of absolute character offsets. Line/column positions are stable across minor edits and do not require operational transform. The wire protocol should send `{ line: number, ch: number }` not `{ pos: number }`.

### Pitfall 5: Thundering Herd on Reconnection

**What goes wrong:** hushd restarts. All 10 connected workbench clients detect disconnect simultaneously and all attempt to reconnect at the same time, overwhelming the freshly restarted server.

**Prevention:** Add random jitter to the reconnection backoff. Instead of `delay = base * 2^attempt`, use `delay = (base * 2^attempt) + random(0, base)`. The existing `FleetEventStream` does NOT have jitter -- so add it to PresenceSocket from the start.

### Pitfall 6: File Path Normalization Mismatch

**What goes wrong:** Analyst A's workbench sends `view_file` with path `/Users/alice/.clawdstrike/workspace/policy.yaml`. Analyst B's workbench has the same file at `/Users/bob/.clawdstrike/workspace/policy.yaml`. The server treats these as different files, so A and B never see each other's presence.

**Prevention:** Use workspace-relative paths, not absolute paths, in presence messages. The file tree already uses `projectRoot` from `project-store.tsx` as the base. Strip the project root and send only the relative portion (e.g., `policy.yaml`, `rulesets/strict.yaml`). Normalize on the client side before sending.

### Pitfall 7: Memory Leak from Unsubscribed ViewPlugin

**What goes wrong:** When a pane tab is closed, the CodeMirror EditorView is destroyed, but the presence cursor ViewPlugin's subscription to the Zustand store is not cleaned up. After opening and closing 20 files, there are 20 orphaned store subscriptions still receiving updates.

**Prevention:** The CM6 ViewPlugin has a `destroy()` method that is called when the editor is torn down. The store subscription must be created in the plugin's constructor and unsubscribed in `destroy()`. Do NOT use React hooks for this bridge -- the subscription must live in the plugin's lifecycle, not React's.

### Pitfall 8: WebSocket Blocking Tauri Event Loop

**What goes wrong:** Using `tauri-plugin-websocket` routes all WebSocket messages through Tauri's IPC bridge. Under high cursor-update volume, the IPC queue backs up, causing lag in unrelated Tauri operations (file dialogs, menu events).

**Prevention:** Use the native browser WebSocket API, which runs in the webview's event loop and does not touch Tauri IPC. This is the recommended approach per STACK.md.

## Minor Pitfalls

### Pitfall 9: Color Collision for Similar Fingerprints

**What goes wrong:** Two analysts get assigned the same presence color because their fingerprints happen to hash to the same index in the 8-color palette.

**Prevention:** Assign colors server-side based on connection order, not fingerprint hash. The `roster` message from the server includes the assigned color. If deterministic-from-fingerprint is preferred, use a larger palette (12-16 colors) and include a contrast check against the existing roster.

### Pitfall 10: Heartbeat Timer Not Cleared on Component Unmount

**What goes wrong:** If the React root unmounts (e.g., Tauri window close) without calling `PresenceSocket.disconnect()`, the heartbeat `setInterval` keeps firing, causing "cannot read properties of null" errors.

**Prevention:** Register a `window.addEventListener('beforeunload', ...)` listener in the PresenceSocket constructor that calls `disconnect()`. Also ensure the Zustand store's initialization block (like the fleet store's `attemptReconnect`) handles cleanup.

### Pitfall 11: Presence Data Serialization Size

**What goes wrong:** Sending full `AnalystPresence` objects (including sigil, displayName, all metadata) on every cursor move message bloats the WebSocket frame.

**Prevention:** The `roster` message sends full data once. Subsequent `analyst_cursor` and `analyst_selection` messages send only `fingerprint` + position data. The client-side store merges position updates into the existing analyst record. This is already how the wire protocol is designed in ARCHITECTURE.md.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| PresenceSocket (connection) | Credential divergence with fleet SSE (Pitfall 2) | Use function reference for token, not captured value |
| hushd PresenceHub (Rust) | File path normalization (Pitfall 6) | Normalize to workspace-relative paths on both sides |
| Presence store (Zustand) | Over-subscribing causes re-render storm (Pitfall 3) | Granular selectors, raw subscribe for CM6 bridge |
| CM6 cursor extension | Extension rebuild storm (Pitfall 1) | Facet + StateEffect, NOT extension array dependency |
| CM6 cursor extension | ViewPlugin memory leak (Pitfall 7) | Unsubscribe in destroy() method |
| UI indicators | Minor re-render overhead | Use `(s) => s.analysts.size` not `(s) => s.analysts` |
| Reconnection | Thundering herd (Pitfall 5) | Add jitter to backoff delay |
| Testing | Hard to test WebSocket lifecycle without integration harness | Mock PresenceSocket class; test store and CM6 extension in isolation |

## Sources

- [CodeMirror collab discussion](https://discuss.codemirror.net/t/how-to-show-peers-cursors-on-cm6-collab-editor/3996) -- Marijn notes position mapping is not convergent across peers
- [y-codemirror.next source](https://github.com/yjs/y-codemirror.next/blob/main/src/y-remote-selections.js) -- ViewPlugin lifecycle management reference
- Existing codebase: `guard-gutter.ts` StateEffect pattern, `fleet-event-stream.ts` reconnection pattern, `use-fleet-connection.ts` credential closure
- [Zustand re-render optimization](https://github.com/pmndrs/zustand/discussions/2779) -- selector granularity patterns
