# Phase 16: Search, Terminal & Keybinding Fixes - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 3 distinct bugs: search race condition (AbortController + staleness guard), terminal hardcoded dimensions (ResizeObserver), and Meta+W keybinding conflict resolution.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — concrete fixes:

1. **Search race condition (SRCH-06, SRCH-07)**: Add AbortController to `performSearch` in `search-store.ts`. Store the controller as module-level state. On each new search, abort the previous. After await resolves, compare `query` at dispatch time vs current `get().query` — if different, discard results (staleness guard).

2. **Terminal sizing (TERM-03)**: Replace hardcoded `width={800} height={240}` in `terminal-panel.tsx` with a `useRef` + `ResizeObserver` pattern that measures the container element and passes dynamic dimensions to `TerminalRenderer`.

3. **Meta+W conflict (KEY-01)**: The `tab.close` (context: "pane") and `edit.closeTab` (context: "editor") both bind Meta+W. When route starts with `/file/`, both contexts are active. Resolution: remove `edit.closeTab` keybinding (Meta+W) and let `tab.close` be the single handler. The pane-level close is the correct behavior in an IDE — closing the pane tab, not an internal editor concept.

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- `apps/workbench/src/features/search/stores/search-store.ts` — `performSearch` at ~line 115, no cancellation
- `apps/workbench/src/features/bottom-pane/terminal-panel.tsx` — `TerminalRenderer` at lines 48-53 with hardcoded 800x240
- `apps/workbench/src/lib/commands/view-commands.ts` — `tab.close` with Meta+W (line 171)
- `apps/workbench/src/lib/commands/edit-commands.ts` — `edit.closeTab` with Meta+W (line 57)

</code_context>

<specifics>
No specific requirements beyond fixing the 3 bugs.
</specifics>

<deferred>
None.
</deferred>
