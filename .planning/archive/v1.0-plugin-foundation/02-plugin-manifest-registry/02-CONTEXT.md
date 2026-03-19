# Phase 2: Plugin Manifest and Registry - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the PluginManifest type and PluginRegistry singleton. A plugin's capabilities are fully described by its manifest (contribution points, activation events, trust tier, dependencies). The registry tracks all known plugins with lifecycle states (not-installed → installed → activated → deactivated).

</domain>

<decisions>
## Implementation Decisions

### Manifest Structure
- Port ExtensionManifest from Athas as starting point, replace language-specific fields with security-domain contribution points
- Contribution point fields: `guards`, `detectionAdapters`, `fileTypes`, `commands`, `keybindings`, `activityBarItems`, `editorTabs`, `bottomPanelTabs`, `rightSidebarPanels`, `statusBarItems`, `threatIntelSources`, `complianceFrameworks`
- Trust tier field: `trust: "internal" | "community" | "mcp"` — determines loading strategy
- Activation events: `onStartup`, `onFileType:{type}`, `onCommand:{id}`, `onGuardEvaluate:{id}`
- Ed25519 signature field for distribution trust

### Registry Pattern
- Singleton class (same pattern as Athas ExtensionRegistry and existing command-registry.ts)
- Map<string, RegisteredPlugin> for O(1) lookup
- State lifecycle: not-installed → installing → installed → activating → activated → deactivated → error
- Subscribable events (register/unregister/stateChange) for UI reactivity
- `getByContributionType(type)` for filtering plugins by what they contribute

### Claude's Discretion
- Exact TypeScript type names and file organization within features/plugins/
- Whether to use Zustand store or class singleton (Athas uses class; command-registry uses class)
- Test structure and coverage approach
- Whether manifest validation uses Zod, io-ts, or manual type guards

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Athas ExtensionManifest (355 LOC) — port and adapt
- Athas ExtensionRegistry (565 LOC) — port core patterns
- Command registry singleton pattern (`lib/command-registry.ts`)
- Guard registry from Phase 1 (`lib/workbench/guard-registry.ts`) — Map + Proxy pattern

### Established Patterns
- `createSelectors` for Zustand stores
- Singleton class instances exported as module-level const
- Disposable pattern (register returns unsubscribe function)
- Map-based registries with Proxy backward compat (Phase 1)

### Integration Points
- Phase 1 registries (guard, file type, status bar, capsule renderer) — plugins will register into these
- Command registry — plugins contribute commands
- Activity bar store — plugins contribute sidebar panels
- Pane store — plugins contribute editor tabs

</code_context>

<specifics>
## Specific Ideas

- Reference implementation: `.planning/research/athas-extension-system.md`
- Security-domain contribution points are the differentiator from VS Code/Athas
- Ed25519 signature field enables trust verification in Phase 3

</specifics>

<deferred>
## Deferred Ideas

- Plugin loader (Phase 3)
- Trust verification (Phase 3)
- SDK package (Phase 4)
- Marketplace UI (Phase 6)

</deferred>
