# Phase 1: Open Closed Seams - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert every contribution point that a plugin needs to extend from hardcoded union types and const arrays into dynamic registries that accept runtime registration. This is pure infrastructure — no new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Key guidance from research:
- Use Map-based registries (consistent with existing command registry pattern)
- Maintain backward compatibility — existing code that references union types should still work
- Each registry should support register/unregister/getAll/getById operations
- Use the Disposable pattern (return unsubscribe function from register calls)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Command registry (`lib/command-registry.ts`) — already dynamic, use as pattern template
- Detection adapter registry (`detection-workflow/`) — already has `registerAdapter()` pattern
- Custom guard registry (Rust `CustomGuardRegistry`) — dynamic at Rust level

### Established Patterns
- Zustand stores with `createSelectors` for reactive state
- Singleton class instances (command registry, extension registry in Athas)
- `Map<string, T>` for O(1) lookup by ID

### Integration Points
- `ActivityBarItemId` union in `features/activity-bar/types.ts`
- `BottomPaneTab` union in `features/bottom-pane/bottom-pane-store.ts`
- `RightSidebarPanel` union in `features/right-sidebar/types.ts`
- `GuardId` union in `lib/workbench/guard-registry.ts`
- `FileType` union in `lib/workbench/file-type-registry.ts`
- Switch statements in `sidebar-panel.tsx`, `bottom-pane.tsx`, `pane-route-renderer.tsx`
- Status bar segments in `components/desktop/status-bar.tsx`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow existing patterns from command registry and detection adapter registry.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
