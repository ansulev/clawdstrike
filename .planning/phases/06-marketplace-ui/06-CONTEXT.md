# Phase 6: Marketplace UI - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the marketplace UI in the Library sidebar panel — operators can discover, install, and manage plugins from within the workbench.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Add a "Plugins" tab to the existing Library sidebar panel (LibraryPanel already has category tabs)
- Plugin cards show name, publisher, version, description, install/uninstall button
- Search queries the plugin registry (or local plugin list for v1)
- Installed plugins section with uninstall capability
- Install downloads, verifies (Ed25519), and activates without restart
- Reuse existing Library panel patterns (card layout, search, categories)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- LibraryPanel (`features/activity-bar/panels/library-panel.tsx`) — existing catalog browser
- PluginRegistry from Phase 2 — tracks all plugins with lifecycle states
- PluginLoader from Phase 3 — handles install/activate/deactivate
- Plugin trust verification from Phase 3 — Ed25519 signature checking

### Integration Points
- LibraryPanel gains a "Plugins" tab alongside existing policy catalog
- Plugin cards call PluginLoader.loadPlugin() on install
- Plugin cards call PluginLoader.deactivatePlugin() on uninstall
- PluginRegistry provides the data source for installed/available plugins

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-trust-distribution.md` (Library/catalog section)

</specifics>

<deferred>
## Deferred Ideas

- Remote plugin registry API integration (v2)
- Plugin auto-updates (v2)
- Plugin ratings and reviews (v2)

</deferred>
