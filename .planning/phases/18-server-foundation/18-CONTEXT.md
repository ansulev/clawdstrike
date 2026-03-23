# Phase 18: Server Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

hushd serves a WebSocket presence endpoint at `/api/v1/presence` with room management, heartbeat-based stale detection, and workspace-relative path normalization. Pure Rust server-side work — no client code in this phase.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Follow existing hushd patterns:
- New `presence.rs` module in `crates/services/hushd/src/api/`
- PresenceHub struct with DashMap for per-file room state
- broadcast::Sender<PresenceEvent> added to AppState
- WebSocket auth via query parameter Bearer token (WS upgrade can't carry custom headers)
- Server-assigned colors with 8-color palette (assign by connection order)
- 15s heartbeat interval, 45s TTL for stale detection

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/services/hushd/src/api/events.rs` — SSE streaming pattern with broadcast channel subscriber, keepalive, auth
- `crates/services/hushd/src/state.rs` — AppState with broadcast::Sender<DaemonEvent>, config, auth_store
- `crates/services/hushd/src/auth/middleware.rs` — Bearer token extraction, require_auth, require_scope
- `crates/services/hushd/src/api/v1.rs` — V1Error struct for API error responses
- `crates/services/hushd/src/rate_limit.rs` — DashMap usage pattern (already in Cargo.toml)

### Established Patterns
- Routes registered in `api/mod.rs` create_router() function
- Each endpoint in its own file (events.rs, broker.rs, agent_status.rs)
- broadcast::channel(1024) for multi-subscriber fan-out
- Fail-closed: validate auth before upgrading WebSocket
- axum 0.8 built-in WebSocket via WebSocketUpgrade extract

### Integration Points
- AppState: add `presence_hub: Arc<PresenceHub>` field
- Router: mount `/api/v1/presence` in read-protected routes
- Auth: reuse require_auth middleware, extract token from query param for WS upgrade
- Dependencies: axum WS + DashMap + tokio broadcast — all already in workspace

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow existing hushd patterns exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
