# Phase 4: Plugin Audit Trail - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Every plugin action is recorded as an Ed25519-signed receipt, queryable locally and forwardable to hushd. Permission denials always generate receipts.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key guidance:
- Generate PluginActionReceipt for every bridge call (or at least security-relevant ones)
- Permission denials ALWAYS generate receipts
- Receipts signed with operator Ed25519 key (existing operator-crypto.ts)
- Local receipt store (IndexedDB or localStorage) with query API
- Forward receipts to hushd audit ledger when connected
- Workbench audit view with filtering by plugin, action, result, time

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Receipt types from `crates/hush-core/src/receipt.rs`
- Operator crypto (`operator-crypto.ts`) for Ed25519 signing
- Local audit store (`lib/workbench/local-audit.ts`)
- AuditTailPanel (bottom panel) for displaying audit events
- Bridge host permission middleware (Phase 3) — hook point for receipt generation

</code_context>

<specifics>
## Specific Ideas

Reference: `.planning/research/plugin-sandboxing.md` (Plugin audit trail section)

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
