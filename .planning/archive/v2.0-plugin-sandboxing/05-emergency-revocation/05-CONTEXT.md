# Phase 5: Emergency Revocation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Operator can revoke a plugin fleet-wide via hushd and all workbench instances kill it immediately. Revoked plugins show warning badge, cannot be reactivated. Offline instances sync revocations on reconnect. Time-limited revocations expire and allow reactivation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Use existing revocation store patterns from `crates/hush-multi-agent/revocation.rs`
- hushd SSE broadcasts revocation events to all connected workbenches
- Local revocation cache for offline resilience
- Revoked plugin state in PluginRegistry (deactivated + revoked flag)
- In-flight bridge calls return PLUGIN_REVOKED error with graceful drain
- Time-limited revocations with expiry timestamp
- UI: warning badge on revoked plugins, disabled reactivation button

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Revocation store patterns (`crates/hush-multi-agent/revocation.rs`) — InMemory + SQLite-backed
- hushd SSE event broadcasting (existing pattern)
- PluginRegistry lifecycle states (can add "revoked" state)
- PluginBridgeHost (can check revocation before dispatch)
- Fleet connection store (for hushd connectivity)

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-sandboxing.md` (Emergency revocation section)

</specifics>

<deferred>
## Deferred Ideas

None — final phase of v2.0.

</deferred>
