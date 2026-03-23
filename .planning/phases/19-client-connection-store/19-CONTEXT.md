# Phase 19: Client Connection & Store - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

PresenceSocket class (WebSocket lifecycle, reconnect with jittered backoff, heartbeat timer, message routing) and presence-store Zustand store (analysts Map, viewersByFile index, selectors, offline defaults). Pure client-side TypeScript infrastructure — no UI components in this phase.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Follow existing codebase patterns:
- PresenceSocket class modeled on FleetEventStream (standalone class, not React hook)
- Use native browser WebSocket API (NOT tauri-plugin-websocket)
- Auth via getCredentials() function reference on every reconnect (not cached token)
- Exponential backoff with random jitter on reconnect (FleetEventStream lacks jitter — add it)
- 15s heartbeat interval matching server expectation
- presence-store as Zustand + immer + createSelectors (matching operator-store pattern)
- Store shape: analysts: Map<fingerprint, AnalystPresence>, viewersByFile: Map<filePath, Set<fingerprint>>, connected: boolean
- Granular selectors to prevent re-render storms (s.analysts.size for count, not s.analysts for full Map)
- Cursor positions do NOT flow through Zustand — they'll go through imperative PresenceManager in Phase 21
- Offline degradation: presence-store defaults to empty, workbench fully functional without hushd

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workbench/src/features/fleet/fleet-event-stream.ts` — FleetEventStream class: SSE lifecycle, reconnect, credential closure, state machine — exact template for PresenceSocket
- `apps/workbench/src/features/fleet/use-fleet-connection.ts` — Credential function reference pattern, store integration
- `apps/workbench/src/lib/workbench/stores/operator-store.ts` — Zustand store pattern with createSelectors
- `apps/workbench/src/features/swarm/swarm-coordinator.ts` — Standalone class (not React hook) pattern for non-UI logic

### Established Patterns
- Zustand stores use createSelectors helper + immer middleware
- Non-React classes for WebSocket/SSE lifecycle management
- getCredentials() closure passed at construction, called fresh each reconnect
- Stores expose granular selectors for performance

### Integration Points
- PresenceSocket connects to hushd at `/api/v1/presence` (built in Phase 18)
- presence-store exposes data for UI indicators (Phase 20) and CM6 cursors (Phase 21)
- Bootstrap: mount in WorkbenchBootstraps or similar app-level component
- Wire protocol: JSON messages with type discriminator (ServerMessage/ClientMessage from Phase 18)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow existing FleetEventStream and operator-store patterns exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
