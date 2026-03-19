# Phase 2: iframe Sandbox - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Community plugins run in null-origin iframes with zero access to host window, Tauri IPC, cookies, localStorage, or network. The PluginLoader forks by trust tier — internal plugins load in-process, community plugins load in iframes with the bridge from Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance from research:
- Use `srcdoc` with `sandbox="allow-scripts"` (no `allow-same-origin`)
- Strict CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`
- Plugin bundle injected into srcdoc as inline script
- PluginBridgeClient (Phase 1) auto-instantiated in iframe context
- PluginLoader.loadPlugin() checks manifest.trust — "internal" → dynamic import, "community" → iframe
- Same PluginContext API regardless of trust tier (bridge proxies for community)
- iframe gets a MessagePort via initial handshake

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- PluginBridgeClient/Host from Phase 1 (`lib/plugins/bridge/`)
- PluginLoader (`lib/plugins/plugin-loader.ts`) — needs fork-by-trust-tier
- PluginRegistry (`lib/plugins/plugin-registry.ts`) — tracks trust tier

### Integration Points
- PluginLoader.loadPlugin() gains community path
- Bridge host created per community plugin
- iframe element created and managed by loader

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-sandboxing.md` (iframe sandbox section)

</specifics>

<deferred>
## Deferred Ideas

- Permission enforcement at bridge (Phase 3)
- Audit trail per bridge call (Phase 4)

</deferred>
