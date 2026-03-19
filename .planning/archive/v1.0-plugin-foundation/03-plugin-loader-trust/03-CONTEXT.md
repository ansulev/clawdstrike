# Phase 3: Plugin Loader and Trust - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the PluginLoader that loads plugins into the running workbench, routes their contributions to the correct registries (from Phase 1), and verifies trust via Ed25519 signatures before allowing activation.

</domain>

<decisions>
## Implementation Decisions

### Loading Strategy
- Internal plugins: dynamic import() of React component modules, full API access
- Community plugins: iframe sandbox with postMessage SDK (deferred to later — Phase 3 focuses on internal plugins only)
- MCP plugins: already supported via existing MCP server — just need manifest awareness
- Promise.allSettled() for parallel loading (one failure doesn't block others)

### Trust Verification
- Ed25519 signature verification using existing hush-core primitives
- Manifest signature checked before activation — reject unsigned plugins with clear error
- Operator identity (from operator-store) acts as the trust anchor for local plugins
- Built-in plugins are implicitly trusted (no signature check needed)

### Contribution Routing
- On activation, loader reads manifest contribution points and calls the appropriate register functions:
  - commands → commandRegistry.register()
  - guards → registerGuard() (Phase 1)
  - fileTypes → registerFileType() (Phase 1)
  - statusBarItems → statusBarRegistry.register() (Phase 1)
  - capsuleRenderers → registerCapsuleRenderer() (Phase 1)
- Returns Disposable[] for clean deactivation (unregister all on deactivate)

### Claude's Discretion
- Internal file structure for the loader module
- Error handling and logging approach
- Whether to use GenericPluginExtension class (Athas pattern) or function-based approach
- Activation event matching implementation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Athas ExtensionLoader (333 LOC) — port and adapt
- Ed25519 signing: `crates/hush-core/src/signing.rs` + `operator-crypto.ts`
- All Phase 1 registries (guard, file type, status bar, capsule renderer)
- Command registry
- Operator store (publisher identity)

### Integration Points
- PluginRegistry from Phase 2 — loader reads from it
- All Phase 1 registries — loader pushes contributions to them
- Operator store — for trust anchor

</code_context>

<specifics>
## Specific Ideas

- Reference: `.planning/research/athas-extension-system.md` (ExtensionLoader section)
- Reference: `.planning/research/plugin-trust-distribution.md` (Ed25519 + receipts)

</specifics>

<deferred>
## Deferred Ideas

- iframe sandbox for community plugins (future phase)
- Plugin hot-reload (future)
- Plugin dependency resolution (future)

</deferred>
