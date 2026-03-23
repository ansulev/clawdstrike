# Technology Stack

**Project:** ClawdStrike Workbench v2.0 -- Real-Time Presence & Awareness
**Researched:** 2026-03-22

## Recommended Stack

### Core Framework (no changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri 2 | 2.x | Desktop shell | Already the app runtime; no change needed |
| React 19 | 19.x | UI framework | Already in use across 600+ source files |
| TypeScript | 5.x | Type safety | Already in use |
| Zustand + immer | 5.x + 12.x | State management | 15+ stores already use this pattern |
| CodeMirror 6 | 6.x | Editor | Already in use with custom extensions |

### Server-Side (hushd additions)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| axum (built-in WebSocket) | workspace version | WebSocket endpoint | axum already includes `axum::extract::ws` -- no new dependency. hushd already uses axum for all HTTP routes |
| tokio::sync::broadcast | (tokio workspace) | Presence event fan-out | Same pattern used by SSE events broadcaster in `events.rs`. Already a dependency |
| DashMap | workspace version | Concurrent room state | Thread-safe HashMap for tracking per-file rooms. Already used in hushd for other concurrent maps |

### Client-Side (new for presence)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Browser WebSocket API | native | WebSocket client | Built into Tauri webview. No npm package needed. Tauri's `tauri-plugin-websocket` is unnecessary for same-origin connections |
| @codemirror/view (ViewPlugin, Decoration, WidgetType) | already installed | Remote cursor rendering | Existing dependency. ViewPlugin pattern matches y-codemirror.next's approach without the Yjs overhead |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@codemirror/state` (Facet) | already installed | Injecting remote presence data into editor state | When FileEditorShell needs to pass cursor positions into the CM6 extension |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| WS client | Native WebSocket API | `tauri-plugin-websocket` | Plugin routes through Rust IPC -- adds latency for no benefit when connecting to own backend |
| WS client | Native WebSocket API | `socket.io-client` | Overkill; we control both ends. socket.io adds 30KB+ and fallback transports we do not need |
| Cursor rendering | Custom ViewPlugin | `y-codemirror.next` | Brings full Yjs CRDT (~45KB) for a feature that needs only cursor positions, not document sync |
| Cursor rendering | Custom ViewPlugin | `@liveblocks/yjs` | SaaS dependency; we have our own hushd server |
| State sync | Custom Zustand store | `@hpkv/zustand-multiplayer` | Designed for full state sync, not presence-only; adds dependency for something trivially implemented |
| Server broadcast | `tokio::sync::broadcast` | Redis pub/sub | Single-server deployment. Redis is unnecessary complexity until multi-server hushd is needed |
| Server WS framework | axum built-in | `tungstenite` directly | axum wraps tungstenite already; using it directly means losing middleware, auth, state injection |

## Installation

### Rust (no new crates)

```toml
# crates/services/hushd/Cargo.toml
# axum already has WebSocket support via "ws" feature
# Verify axum features include "ws" (it's a default feature)
# dashmap is already a dependency
# No new entries needed
```

### TypeScript (no new packages)

```bash
# No new npm packages needed.
# All required APIs are built into the browser (WebSocket)
# and already-installed CodeMirror packages.
```

### Verification

```bash
# Confirm axum ws feature is available:
cargo doc -p axum --no-deps 2>&1 | grep -c "extract::ws"

# Confirm CodeMirror packages have needed exports:
grep -r "ViewPlugin" node_modules/@codemirror/view/dist/index.d.ts | head -1
grep -r "WidgetType" node_modules/@codemirror/view/dist/index.d.ts | head -1
grep -r "Facet" node_modules/@codemirror/state/dist/index.d.ts | head -1
```

## Key Technical Details

### WebSocket Auth Pattern

The browser WebSocket API does not support custom headers. Auth token is passed as a query parameter:

```typescript
const ws = new WebSocket(`${hushdUrl.replace('http', 'ws')}/api/v1/presence?token=${apiKey}`);
```

The hushd handler extracts the token from the query string and validates it through the same auth middleware used for SSE. This matches common WebSocket auth patterns (used by Slack, Discord, etc.).

### No WASM Needed

The presence protocol is pure JSON over WebSocket. No cryptographic operations happen in the presence path (unlike receipts/signatures). The operator's Ed25519 fingerprint is used for identification but signing is not required for presence messages -- the authenticated WebSocket connection provides identity assurance.

## Sources

- [axum::extract::ws](https://docs.rs/axum/latest/axum/extract/ws/index.html) -- built-in WebSocket support
- [Tauri 2 WebSocket plugin](https://v2.tauri.app/plugin/websocket/) -- confirmed not needed for this use case
- [y-codemirror.next](https://github.com/yjs/y-codemirror.next) -- studied for CM6 cursor rendering pattern, not used as dependency
- [Zustand WebSocket patterns](https://github.com/pmndrs/zustand/discussions/1651) -- confirmed custom approach preferred
