# Phase 1: postMessage RPC Bridge - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a typed RPC bridge over postMessage that lets sandboxed plugins make API calls to the host workbench. The bridge must mirror the PluginContext API so that community plugins use the same interface as internal plugins, just proxied over postMessage.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance from research:
- Use request/response pattern with unique message IDs (crypto.randomUUID)
- Support subscriptions/events across the bridge (host pushes events to iframe)
- 30-second timeout for leaked promises
- Structured error responses (not just string messages)
- Every PluginContext API method must have a bridge equivalent
- Use MessagePort for dedicated channel (avoids global postMessage noise)
- Bridge host runs in main thread, validates messages, dispatches to registries
- Bridge client runs in iframe, provides typed PluginContext proxy

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- PluginContext interface from SDK (`packages/sdk/plugin-sdk/src/context.ts`)
- PluginLoader contribution routing (`apps/workbench/src/lib/plugins/plugin-loader.ts`)
- All Phase 1 v1.0 registries (guard, file type, status bar, capsule renderer)

### Integration Points
- Bridge host will be used by PluginLoader when loading community plugins (Phase 2)
- Bridge client will be bundled into the iframe sandbox HTML (Phase 2)

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-sandboxing.md` (postMessage bridge architecture section)

</specifics>

<deferred>
## Deferred Ideas

- iframe sandbox creation (Phase 2)
- Permission enforcement at bridge level (Phase 3)
- Audit receipt generation per bridge call (Phase 4)

</deferred>
