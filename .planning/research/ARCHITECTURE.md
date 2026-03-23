# Architecture Patterns: Real-Time Presence & Awareness

**Domain:** Real-time presence layer for Tauri 2 desktop security IDE
**Researched:** 2026-03-22

## Recommended Architecture

### Design Principle: Presence-Only, Not Collaborative Editing

This is NOT a Yjs/CRDT collaborative editing integration. The workbench does not need document synchronization -- operators work on their own policy files. What is needed is **presence awareness**: who is online, what file they are viewing, and where their cursor sits. This distinction dramatically simplifies the architecture.

The approach is a dedicated WebSocket channel from hushd to each workbench client, carrying lightweight presence messages. The client side uses a new Zustand store as the single source of truth, feeding CodeMirror 6 decoration extensions and UI indicator components.

### System Overview

```
+-------------------+     WebSocket      +------------------+
| Workbench Client  |<------------------>| hushd (axum)     |
|                   |                    |                  |
| PresenceSocket    |  join/leave/       | PresenceHub      |
|   (connection)    |  cursor/heartbeat  |   (room mgr)     |
|        |          |                    |   (broadcast)    |
|        v          |                    +------------------+
| presence-store    |
|   (Zustand)       |
|     |        |    |
|     v        v    |
| CM6 ext   UI      |
| (cursors) (pills) |
+-------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **PresenceHub** (Rust, hushd) | Room management, message broadcast, heartbeat tracking, connection lifecycle | WebSocket clients, hushd AppState |
| **PresenceSocket** (TS, class) | WebSocket connection lifecycle, reconnection, message framing, auth | hushd WebSocket endpoint, presence-store |
| **presence-store** (Zustand) | Analyst roster, per-file presence, cursor positions, connection status | PresenceSocket, UI components, CodeMirror extensions |
| **PresenceCursorExtension** (CM6) | Remote cursor/selection decoration rendering | presence-store (read-only subscription) |
| **PresenceIndicators** (React) | Activity bar pills, tab badges, status bar section | presence-store (selectors) |

### Data Flow

#### Outbound (local operator action -> server -> other clients)

```
1. Operator opens file / moves cursor / closes file
2. pane-store or CM6 updateListener detects change
3. presence-store.actions.broadcastXxx() called
4. PresenceSocket.send() serializes and sends JSON frame
5. hushd PresenceHub broadcasts to all other clients in the room
```

#### Inbound (remote analyst update -> local UI)

```
1. hushd PresenceHub broadcasts message to WebSocket
2. PresenceSocket.onMessage routes by message type
3. presence-store.setState() via immer mutation
4. Zustand selectors trigger React re-renders for:
   - Activity bar presence pills
   - Pane tab presence dots
   - Status bar "3 analysts online"
5. CM6 presence extension reads from store, rebuilds Decoration set
```

## Patterns to Follow

### Pattern 1: PresenceSocket -- Connection Manager Class (matches FleetEventStream)

Follow the exact pattern established by `FleetEventStream` at `features/fleet/fleet-event-stream.ts`: a non-React class that owns the WebSocket lifecycle and calls store setters via callbacks.

**Why:** The FleetEventStream pattern is proven in this codebase. It cleanly separates connection lifecycle from React rendering, supports reconnection with backoff, and feeds a Zustand store. Presence needs the same qualities but with WebSocket instead of SSE.

**What:**
```typescript
// features/presence/presence-socket.ts
export class PresenceSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: PresenceSocketOptions) {}

  connect(): void { /* WS open + auth handshake */ }
  disconnect(): void { /* clean close + cancel timers */ }
  send(msg: PresenceMessage): void { /* JSON.stringify + ws.send */ }

  // Private
  private onMessage(event: MessageEvent): void { /* parse + route to opts callbacks */ }
  private scheduleReconnect(): void { /* exponential backoff, same as FleetEventStream */ }
  private startHeartbeat(): void { /* 15s interval, server detects timeout at 45s */ }
}
```

**Integration with hushd auth:** Reuse the Bearer token from `useFleetConnectionStore.getState().actions.getCredentials()`. The WebSocket upgrade request sends the token as a query parameter (`?token=xxx`) since WebSocket API does not support custom headers. hushd validates the same way it validates SSE connections.

### Pattern 2: Zustand Presence Store (matches operator-store, fleet-connection patterns)

**Why:** All 15+ stores in the workbench use `create<State>()(immer(...))` with `createSelectors`. The presence store must follow suit. The store is the single source of truth for all presence data -- components and CM6 extensions read from it, PresenceSocket writes to it.

**What:**
```typescript
// features/presence/stores/presence-store.ts

interface AnalystPresence {
  odentity: string;         // fingerprint from OperatorIdentity
  displayName: string;
  sigil: string;
  color: string;            // assigned by server or hashed from fingerprint
  activeFile: string | null;
  cursor: { line: number; ch: number } | null;
  selection: { anchor: number; head: number } | null;
  lastSeen: number;         // Unix ms
}

interface PresenceStoreState {
  connected: boolean;
  connectionError: string | null;
  analysts: Map<string, AnalystPresence>;  // fingerprint -> presence
  /** Analysts currently viewing a specific file path */
  viewersByFile: Map<string, Set<string>>; // filePath -> Set<fingerprint>
  actions: PresenceActions;
}
```

**Selector examples for UI:**
- `usePresenceStore((s) => s.analysts.size)` -- analyst count for status bar
- `usePresenceStore((s) => s.viewersByFile.get(filePath))` -- file-level viewers for tab badge
- `usePresenceStore((s) => [...s.analysts.values()].filter(a => a.activeFile === path))` -- cursors for CM6

### Pattern 3: CodeMirror 6 Remote Cursor Extension (matches guard-gutter pattern)

**Why:** The codebase already has two custom CM6 extensions (`guard-gutter.ts`, `coverage-gutter.ts`) using `StateField`, `StateEffect`, `Decoration`, and `EditorView.theme`. The remote cursor extension follows the same structure but uses `ViewPlugin` (like y-codemirror.next does) because it needs to subscribe to external state changes.

The y-codemirror.next library uses a `ViewPlugin.fromClass()` pattern with `Decoration.mark()` for selection highlights and `Decoration.widget()` with a custom `WidgetType` for cursor carets with name labels. We replicate this pattern without the Yjs dependency because we do not need CRDT document sync.

**What:**
```typescript
// lib/workbench/codemirror/presence-cursors.ts

import { ViewPlugin, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { RangeSet, Facet } from "@codemirror/state";

/** Facet to inject remote analyst positions into the editor. */
export const remotePresenceFacet = Facet.define<RemoteCursor[]>({
  combine: (inputs) => inputs.flat(),
});

interface RemoteCursor {
  fingerprint: string;
  displayName: string;
  color: string;
  cursor: number;          // absolute position in doc
  selectionFrom?: number;
  selectionTo?: number;
}

class CursorCaretWidget extends WidgetType {
  constructor(readonly name: string, readonly color: string) { super(); }
  toDOM(): HTMLElement {
    const caret = document.createElement("span");
    caret.className = "cm-remote-caret";
    caret.style.borderLeftColor = this.color;
    const label = document.createElement("span");
    label.className = "cm-remote-caret-label";
    label.textContent = this.name;
    label.style.backgroundColor = this.color;
    caret.appendChild(label);
    return caret;
  }
}

const presenceCursorsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }
    update(update: ViewUpdate) {
      // Rebuild when facet value changes or doc changes
      this.decorations = this.buildDecorations(update.view);
    }
    buildDecorations(view: EditorView): DecorationSet {
      const cursors = view.state.facet(remotePresenceFacet);
      // Build Decoration.widget for each cursor + Decoration.mark for each selection
      // Sort by position, return RangeSet.of(decorations)
    }
  },
  { decorations: (v) => v.decorations }
);

export function presenceCursors(): Extension[] {
  return [
    presenceCursorsPlugin,
    EditorView.theme({ /* .cm-remote-caret, .cm-remote-caret-label styles */ }),
  ];
}
```

**Integration with YamlEditor:** Add `presenceCursors()` to the extensions array in `yaml-editor.tsx`, gated on a `showPresenceCursors` prop. The calling component (FileEditorShell) reads presence data from the store and reconfigures the facet via `EditorView.dispatch({ effects: [...] })`.

### Pattern 4: PresenceHub on hushd (axum WebSocket handler)

**Why:** hushd already uses axum with `Router`, `State`, and authentication middleware. axum has built-in WebSocket support via `axum::extract::ws::WebSocketUpgrade`. The existing `DaemonEvent` broadcast channel pattern in `events.rs` provides a template for server-side message fan-out.

**What:**
```rust
// crates/services/hushd/src/api/presence.rs

use axum::extract::ws::{WebSocket, WebSocketUpgrade, Message};
use tokio::sync::broadcast;

pub struct PresenceHub {
    /// Per-file rooms: file_path -> set of connected analyst fingerprints
    rooms: DashMap<String, HashSet<String>>,
    /// Broadcast channel for presence events
    tx: broadcast::Sender<PresenceEvent>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PresenceEvent {
    Join { fingerprint: String, display_name: String, color: String },
    Leave { fingerprint: String },
    ViewFile { fingerprint: String, file_path: String },
    CursorMove { fingerprint: String, file_path: String, line: u32, ch: u32 },
    Selection { fingerprint: String, file_path: String, anchor: u32, head: u32 },
    Heartbeat { fingerprint: String },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    // Auth validated via query param token
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_presence_socket(socket, state))
}
```

The PresenceHub uses `tokio::sync::broadcast` for fan-out (same pattern as the SSE events broadcaster). Each client subscribes to the broadcast channel. The hub filters messages so clients only receive events for files they are currently viewing.

### Pattern 5: TransportAdapter Extension for Presence

**Why:** The SwarmCoordinator already defines a `TransportAdapter` interface and `InProcessEventBus`. Presence could theoretically use the same abstraction. However, presence has fundamentally different semantics (stateful per-client, ephemeral, not pub-sub topics) so it should NOT be shoehorned into the SwarmCoordinator. A dedicated PresenceSocket is cleaner.

**Decision:** Presence gets its own connection manager. The SwarmCoordinator's TransportAdapter is designed for eventual Gossipsub swap. Presence is point-to-point with hushd as the hub. Different problem, different solution.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Yjs for Presence-Only

**What:** Adding `yjs`, `y-codemirror.next`, and a Y-WebSocket provider to get cursor awareness.
**Why bad:** Yjs is a CRDT framework for collaborative document editing. Using it just for presence adds ~45KB bundle weight, introduces document sync complexity, and creates a mismatch -- the workbench has no shared document state. The awareness protocol portion of Yjs is ~200 lines; replicating that specific behavior in a custom presence store is simpler and more maintainable.
**Instead:** Custom `PresenceSocket` + Zustand store + CM6 `ViewPlugin` with `Decoration.widget()`. This gives the same visual result (colored cursors with name labels) without the CRDT machinery.

### Anti-Pattern 2: Polling for Presence

**What:** Using HTTP polling (like fleet agent polling) for presence updates.
**Why bad:** Presence needs sub-second latency for cursor movement to feel real-time. Polling at even 500ms creates visible lag. SSE is one-directional (server to client only) so it cannot carry cursor updates from client to server.
**Instead:** WebSocket. Bidirectional, low-latency, persistent connection. The browser WebSocket API is stable and well-supported in Tauri webviews.

### Anti-Pattern 3: Storing Presence in the Pane Store

**What:** Adding `viewers: string[]` to `PaneView` in the pane-store.
**Why bad:** The pane-store manages UI layout state (splits, tabs, active views). Mixing in ephemeral network state (who is viewing what) violates single-responsibility and causes unnecessary re-renders of the entire pane tree when a remote analyst moves their cursor.
**Instead:** Dedicated `presence-store` with targeted selectors. Components that need presence data subscribe to the presence store independently.

### Anti-Pattern 4: Running WebSocket Through Tauri IPC

**What:** Opening the WebSocket in Rust (via `tauri-plugin-websocket`) and forwarding messages through Tauri IPC commands.
**Why bad:** Adds an unnecessary hop. The browser WebSocket API in Tauri's webview works fine for connecting to hushd directly. The IPC overhead would add latency to every cursor update. The Tauri WebSocket plugin is designed for cases where you need Rust-side WebSocket logic (e.g., bypassing CSP restrictions for external services), not for connecting to your own backend.
**Instead:** Native browser `WebSocket` from the frontend JS, connecting directly to hushd's WebSocket endpoint. Same origin, no CSP issues.

### Anti-Pattern 5: Broadcasting Every Keystroke's Cursor Position

**What:** Sending a cursor update message on every single `ViewUpdate` where `selectionSet` is true.
**Why bad:** Fast typing generates cursor updates at 60+ per second. This floods the WebSocket and the server broadcast channel.
**Instead:** Throttle cursor broadcasts to 50ms (20 updates/sec max). This is imperceptible to viewers but reduces message volume by 3x. Use `requestAnimationFrame` or a simple timer-based throttle.

## Integration Points with Existing Code

### Existing Files to Modify

| File | Modification | Reason |
|------|-------------|--------|
| `features/fleet/use-fleet-connection.ts` | Export `getCredentials` for presence auth reuse | WebSocket auth token |
| `components/ui/yaml-editor.tsx` | Add `showPresenceCursors` prop, include `presenceCursors()` extension | CM6 cursor rendering |
| `features/editor/file-editor-shell.tsx` | Read presence store, pass remote cursors to YamlEditor via facet reconfiguration | Bridge store to editor |
| `components/desktop/status-bar.tsx` | Add analyst count indicator | Presence visibility |
| `features/panes/pane-tab-bar.tsx` | Add presence dots/avatars on tabs | Per-file awareness |
| `features/activity-bar/stores/activity-bar-store.ts` | No changes needed | Presence indicators are separate components |
| `features/right-sidebar/components/right-sidebar.tsx` | Add "Analysts" panel option | Team roster |
| `crates/services/hushd/src/api/mod.rs` | Add `presence` module, add WebSocket route | Server endpoint |
| `crates/services/hushd/Cargo.toml` | No new deps needed (`axum` already includes WS) | axum has built-in WS |

### New Files to Create

| File | Purpose |
|------|---------|
| `features/presence/presence-socket.ts` | WebSocket connection manager class |
| `features/presence/stores/presence-store.ts` | Zustand presence state |
| `features/presence/types.ts` | PresenceMessage, AnalystPresence, etc. |
| `features/presence/hooks/use-presence-broadcast.ts` | Hook that bridges pane-store/CM6 changes to PresenceSocket |
| `features/presence/components/presence-pills.tsx` | Colored analyst pills for activity bar / status bar |
| `features/presence/components/presence-tab-dots.tsx` | Per-tab viewer indicators |
| `features/presence/components/analyst-roster.tsx` | Right sidebar panel listing online analysts |
| `lib/workbench/codemirror/presence-cursors.ts` | CM6 ViewPlugin for remote cursor decorations |
| `crates/services/hushd/src/api/presence.rs` | WebSocket handler + PresenceHub |
| `crates/services/hushd/src/presence.rs` | PresenceHub state management |

## Scalability Considerations

| Concern | 2-5 analysts | 10-20 analysts | 50+ analysts |
|---------|-------------|----------------|-------------|
| Message volume | Trivial (~100 msg/s) | Moderate (~1K msg/s), throttling handles it | Per-file rooms limit broadcast; cursor updates only sent to file-viewers |
| Server memory | Negligible | ~10KB per connection | PresenceHub DashMap scales; broadcast channel is O(subscribers) |
| Client rendering | 1-4 cursor decorations, no perf concern | 10-15 decorations, still fine for CM6 | Limit visible cursors to same-file analysts; badge "12 viewing" instead of rendering all |
| Reconnection storms | N/A | Jittered backoff prevents thundering herd | Same + server-side rate limit on WS upgrades |

## Wire Protocol

JSON over WebSocket with `type` discriminator (matching the `SwarmEnvelope.type` pattern):

```typescript
// Client -> Server
type ClientMessage =
  | { type: "join"; fingerprint: string; displayName: string; sigil: string }
  | { type: "view_file"; filePath: string }       // started viewing
  | { type: "leave_file"; filePath: string }       // stopped viewing
  | { type: "cursor"; filePath: string; line: number; ch: number }
  | { type: "selection"; filePath: string; anchor: number; head: number }
  | { type: "heartbeat" }

// Server -> Client
type ServerMessage =
  | { type: "roster"; analysts: AnalystPresence[] }  // full state on join
  | { type: "analyst_joined"; analyst: AnalystPresence }
  | { type: "analyst_left"; fingerprint: string }
  | { type: "analyst_viewing"; fingerprint: string; filePath: string }
  | { type: "analyst_cursor"; fingerprint: string; filePath: string; line: number; ch: number }
  | { type: "analyst_selection"; fingerprint: string; filePath: string; anchor: number; head: number }
  | { type: "heartbeat_ack" }
  | { type: "error"; message: string }
```

Binary WebSocket frames are unnecessary at this scale. JSON is debuggable and matches every other protocol in the workbench.

## Color Assignment

Each analyst gets a unique color derived from their Ed25519 fingerprint:

```typescript
const PRESENCE_COLORS = [
  "#5b8def", // blue
  "#e06c75", // red
  "#98c379", // green
  "#d19a66", // orange
  "#c678dd", // purple
  "#56b6c2", // cyan
  "#be5046", // rust
  "#e5c07b", // yellow
];

function presenceColor(fingerprint: string): string {
  const hash = parseInt(fingerprint.slice(0, 8), 16);
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}
```

Deterministic from fingerprint so the same analyst always gets the same color across all workbenches.

## Sources

- [y-codemirror.next -- Collaborative extensions for CodeMirror 6](https://github.com/yjs/y-codemirror.next) -- reference implementation for remote cursor rendering pattern
- [axum WebSocket documentation](https://docs.rs/axum/latest/axum/extract/ws/index.html) -- WebSocketUpgrade handler API
- [CodeMirror Decoration example](https://codemirror.net/examples/decoration/) -- widget decoration pattern
- [CodeMirror collab discussion](https://discuss.codemirror.net/t/how-to-show-peers-cursors-on-cm6-collab-editor/3996) -- Marijn's guidance on peer cursor implementation
- [Tauri 2 WebSocket plugin](https://v2.tauri.app/plugin/websocket/) -- confirmed NOT needed for same-origin connections
- [Zustand WebSocket discussion](https://github.com/pmndrs/zustand/discussions/1651) -- community patterns for WS + Zustand
