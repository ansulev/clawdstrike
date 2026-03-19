# Phase 4: Plugin SDK Package - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `@clawdstrike/plugin-sdk` — a TypeScript package that plugin authors import to get typed APIs for all contribution points, lifecycle hooks, and workbench services.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — SDK packaging phase. Key guidance:
- Package location: `packages/sdk/plugin-sdk/` (alongside hush-ts)
- Export `createPlugin()` factory that enforces activate/deactivate contract at type level
- Re-export contribution point types from `apps/workbench/src/lib/plugins/types.ts`
- API surface: commands, panes, guards, policies, detections, findings, sentinels, fleet, editor, storage
- Use barrel exports (`index.ts`) for clean import paths
- Include JSDoc documentation on all public APIs

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workbench/src/lib/plugins/types.ts` (291 LOC) — all contribution point types
- `apps/workbench/src/lib/plugins/manifest-validation.ts` — createTestManifest helper
- `apps/workbench/src/lib/plugins/plugin-registry.ts` — RegisteredPlugin type
- `apps/workbench/src/lib/plugins/plugin-loader.ts` — PluginModule interface

### Integration Points
- Plugin authors will `import { createPlugin, type PluginManifest } from '@clawdstrike/plugin-sdk'`
- SDK types must match what PluginLoader expects

</code_context>

<specifics>
## Specific Ideas

No specific requirements — SDK scaffold phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
