# Phase 22: File Room Membership Wiring - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Send view_file/leave_file messages from the client to the server when files are opened/closed. Normalize file paths to workspace-relative before sending. This wires the final connection between the client (Phase 19) and server rooms (Phase 18), enabling file-scoped presence features (tab dots, Speakeasy counts, remote cursors).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — gap closure phase with clear root cause.

Key guidance from audit:
- Send `{ type: "view_file", file_path: workspaceRelativePath }` when a file tab becomes active
- Send `{ type: "leave_file", file_path: workspaceRelativePath }` when a file tab is closed
- Normalize paths to workspace-relative BEFORE sending (strip project root prefix)
- Best integration point: usePresenceConnection hook or a new usePresenceFileTracking hook that subscribes to pane store changes
- The server's normalize_path strips leading `/` — client should send paths WITHOUT leading `/` for consistency
- PresenceSocket already has send() method and getPresenceSocket() export for non-React consumers

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workbench/src/features/presence/presence-socket.ts` — PresenceSocket.send() for outbound messages
- `apps/workbench/src/features/presence/types.ts` — ClientMessage types already declared (view_file, leave_file)
- `apps/workbench/src/features/presence/use-presence-connection.ts` — Bootstrap hook, good place to add file tracking
- `apps/workbench/src/features/panes/pane-store.ts` — usePaneStore tracks active views and open tabs
- `apps/workbench/src/features/editor/file-editor-shell.tsx` — File tab wrapper, knows current filePath
- `crates/services/hushd/src/api/presence.rs` — Server already handles ViewFile/LeaveFile (lines 433-450)

### Established Patterns
- usePresenceConnection already subscribes to fleet connection state
- Pane store has activeViewId and views Map for tracking which files are open
- File routes follow pattern `/file/{absolutePath}` or `/file/__new__/{tabId}`

### Integration Points
- Subscribe to pane store changes (activeViewId, views) to detect file open/close
- Extract file path from route (strip `/file/` prefix)
- Normalize to workspace-relative (strip project root from absolute path)
- Send via getPresenceSocket().send()

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward wiring fix.

</specifics>

<deferred>
## Deferred Ideas

None — gap closure phase.

</deferred>
