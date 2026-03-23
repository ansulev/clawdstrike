# Phase 12: Editor-to-Swarm Bridge - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge the policy editor to the swarm board — a "Launch Swarm" button in the editor toolbar creates a new .swarm bundle tied to the active policy, pre-seeds sentinel agent nodes, and opens the swarm board as a pane tab.

</domain>

<decisions>
## Implementation Decisions

### Launch Swarm Button UX
- Button placed after RunButtonGroup in FileEditorToolbar, gated on `isPolicyFileType(tabMeta.fileType)`
- Single button with tooltip "Launch Swarm" — no dropdown
- Creates a new .swarm bundle (not scratch board) for investigation persistence
- Icon: `IconTopologyRing` from `@tabler/icons-react`

### Swarm Session Pre-configuration
- Set `manifest.policyRef` to the active file's absolute path — links investigation to source policy
- Auto-seed one `agentSession` node per active sentinel from `sentinel-store` — board starts ready to coordinate
- Bundle naming: `{policyFileName}-{timestamp}.swarm` (e.g., `strict-policy-2026-03-21.swarm`)
- Opens in same pane group as new tab (user splits manually if wanted via pane system)

### Claude's Discretion
- Exact node positioning for auto-seeded sentinel nodes (grid layout, centered, etc.)
- Whether to show a toast notification after swarm creation
- Error handling for edge cases (no project root, Tauri not available)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nav.newSwarm` command in `navigate-commands.ts` — creates bundle and opens in pane tab (reference implementation)
- `createSwarmBundle(parentDir, name)` in `tauri-bridge.ts` — creates .swarm directory with manifest.json + board.json
- `SwarmBundleManifest` type with `policyRef` field in `swarm-bundle.ts`
- `usePaneStore.openApp(route, label)` — opens swarm board as pane tab with dedup
- `sentinel-store.tsx` — Zustand store with `sentinels` map, `activeSentinelId`, sentinel metadata
- `FileEditorToolbar` at `features/editor/file-editor-toolbar.tsx` — existing toolbar with RunButtonGroup
- `SwarmBoardPage` at `components/workbench/swarm-board/swarm-board-page.tsx` — extracts bundlePath from route
- `swarm-board-store.tsx` (`features/swarm/stores/`) — `loadFromBundle(bundlePath)` reads board.json via Tauri

### Established Patterns
- Toolbar buttons use `<button className="h-7 w-7 ...">` with `@tabler/icons-react` 16px icons
- Policy-only features gated by `isPolicyFileType(tabMeta.fileType)` or `isPolicy` local variable
- Async Tauri operations guarded by `isDesktop()` check
- Bundle path encoding: `encodeURIComponent(bundlePath)` in route construction

### Integration Points
- `FileEditorToolbar` — add button after RunButtonGroup
- `createSwarmBundle` — extend manifest to include policyRef
- `swarm-board-store.loadFromBundle` — reads board.json, could auto-seed nodes if sentinel data present
- `sentinel-store` — read active sentinels to seed agent session nodes
- `SwarmBoardCanvas` — already handles dynamic node addition via store

</code_context>

<specifics>
## Specific Ideas

- The `nav.newSwarm` command is the reference implementation — adapt its bundle creation logic for the toolbar button but add policyRef and sentinel seeding
- `SwarmBundleManifest.policyRef` field already exists in the type — just needs to be populated
- `SwarmBoardPersisted` stores nodes array — pre-seed with sentinel nodes at creation time in board.json

</specifics>

<deferred>
## Deferred Ideas

- "Open Existing Swarm" dropdown option — can use existing explorer click-to-open flow
- Cross-file swarm associations (multiple policies → one swarm) — future capability
- Swarm template presets (e.g., "Red Team", "Hunt", "Compliance Audit") — future phase

</deferred>
