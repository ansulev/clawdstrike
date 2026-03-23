# Phase 20: UI Presence Indicators - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual presence indicators across the workbench shell: status bar connection dot + online count, colored dots on pane tabs, analyst pills on activity bar, analyst roster sidebar panel, and Speakeasy presence context. All components read from presence-store via granular selectors.

</domain>

<decisions>
## Implementation Decisions

### Roster Panel Placement
- New sidebar panel with "People" icon added to activity bar — standard VS Code collaboration pattern
- Empty state when solo: "No other analysts connected" with subtle text (no empty illustration)
- Each analyst row shows: name + colored sigil dot + current file path + "online" badge
- Roster sorted alphabetically by display name

### Tab & Activity Bar Presence
- Presence dots appear right side of pane tab label, max 3 colored dots + "+N" overflow text
- Activity bar analyst pills: 8px colored circles stacked vertically below activity bar icons
- Max 5 pills visible, then "+N" text below
- Clicking a presence dot navigates to that analyst's current file

### Status Bar & Speakeasy
- Status bar indicator in left section after existing items: "● 3 online" format
- Green dot = connected, amber = reconnecting, red = disconnected
- Clicking status bar indicator toggles the analyst roster sidebar panel
- Speakeasy: subtle text above message input: "3 analysts viewing this file"
- Presence scoped to files only in v2.0 — finding-scoped presence deferred to Track B

### Claude's Discretion
- Exact CSS styling, spacing, animations (follow existing dark theme patterns)
- Component decomposition within the constraints above
- Tailwind utility class choices

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workbench/src/components/desktop/status-bar.tsx` — Existing status bar component to add presence indicator to
- `apps/workbench/src/features/panes/pane-tab-bar.tsx` — Tab bar with close buttons, gold active underline — add dots here
- `apps/workbench/src/features/activity-bar/components/activity-bar.tsx` — 48px icon rail — add pills here
- `apps/workbench/src/features/activity-bar/stores/activity-bar-store.ts` — Sidebar panel registry
- `apps/workbench/src/features/activity-bar/types.ts` — SidebarPanelConfig type for registering new panels
- `apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx` — Chat panel for presence context
- `apps/workbench/src/features/presence/stores/presence-store.ts` — Data source (built in Phase 19)

### Established Patterns
- Sidebar panels registered in activity-bar-store with icon + component
- Status bar items are inline elements in the status-bar.tsx component
- Tab bar items rendered in pane-tab-bar.tsx map loop
- Dark theme with zinc/slate backgrounds, gold accents

### Integration Points
- presence-store selectors: `usePresenceStore(s => s.connectionState)`, `usePresenceStore(s => s.analysts.size)`, `usePresenceStore(s => s.viewersByFile.get(path))`
- Activity bar: register "People" panel in activity-bar-store config
- Status bar: add PresenceStatusIndicator component inline
- Tab bar: add PresenceTabDots component per tab
- Speakeasy: add presence context line in speakeasy-panel.tsx

</code_context>

<specifics>
## Specific Ideas

No specific references beyond the decisions above — follow existing component patterns.

</specifics>

<deferred>
## Deferred Ideas

- Finding-scoped presence (Track B: Shared Investigation Sessions)
- Presence for non-file views (swarm board, fleet dashboard)
- Analyst avatar images (use colored sigil dots for v2.0)

</deferred>
