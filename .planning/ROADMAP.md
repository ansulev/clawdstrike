# Roadmap: ClawdStrike Workbench IDE Pivot

## Overview

Transform the ClawdStrike Workbench from a sidebar-nav dashboard into a VS Code/Cursor-like security IDE. The workbench already has Zustand stores, command registry, binary tree pane system, bottom pane, and 19 routable pages. This roadmap layers IDE chrome (activity bar, sidebar panels, right sidebar) on top of that foundation, then rewires navigation so routes become "apps" opened in editor tabs. Four phases deliver progressively: shell structure, panel content, secondary zones, and full app-based navigation.

**Canonical refs for downstream agents:**
- `docs/plans/workbench-dev/ide-pivot.md` -- Full IDE pivot plan with component hierarchy, route migration map, file change list
- `docs/plans/workbench-dev/patterns-reference.md` -- Athas patterns to port
- `docs/plans/workbench-dev/INDEX.md` -- Original workbench dev roadmap (foundation context)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Activity Bar + Sidebar Shell** - Decompose sidebar into activity bar + panel container, wire panel switching, new stores, basic commands
- [ ] **Phase 2: Sidebar Panels + Editor Tabs** - Build 7 sidebar panels, add openApp to pane store, render routes as editor tabs
- [ ] **Phase 3: Right Sidebar + Bottom Panel + Commands** - Right sidebar zone with Speakeasy, audit tail tab, per-panel sidebar commands
- [ ] **Phase 4: Lab Decomposition + App Navigation** - Break Lab into 3 independent apps, rewrite navigate commands to openApp pattern

## Phase Details

### Phase 1: Activity Bar + Sidebar Shell
**Goal**: Operators see a VS Code-style activity bar controlling sidebar content, replacing the flat nav
**Depends on**: Nothing (builds on existing foundation from workbench-dev Phase A/C)
**Requirements**: ABAR-01, ABAR-02, ABAR-03, ABAR-04, ABAR-05, ABAR-06, CMD-01, CMD-02, STATE-01, STATE-03, SHELL-01, SHELL-02, SHELL-03, SHELL-04
**Success Criteria** (what must be TRUE):
  1. A 48px vertical icon rail with 7+1 icons renders to the left of the sidebar, and clicking an icon switches the sidebar to show the corresponding panel content
  2. Clicking the already-active icon collapses the sidebar; Cmd+B toggles sidebar visibility; Cmd+Shift+E jumps to Explorer panel
  3. The active icon is visually distinguished and icons use the existing sigil icon set from sidebar-icons.tsx
  4. Titlebar, StatusBar, and the existing pane/bottom-pane layout continue to render correctly in the updated desktop-layout.tsx; all 11 existing Zustand stores work unchanged
  5. activity-bar-store (Zustand) tracks activeItem, sidebarVisible, and sidebarWidth with createSelectors pattern
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Activity bar types, Zustand store, and all four new components (ActivityBar, ActivityBarItem, SidebarPanel, SidebarResizeHandle)
- [x] 01-02-PLAN.md -- Shell integration (desktop-layout.tsx), sidebar commands (Cmd+B, Cmd+Shift+E), visual verification

### Phase 2: Sidebar Panels + Editor Tabs
**Goal**: Each activity bar item reveals a useful sidebar panel, and clicking items in panels opens detail views as editor tabs in the pane system
**Depends on**: Phase 1
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08, SIDE-09, SIDE-10, PANE-01, PANE-02, PANE-03, PANE-04, PANE-05
**Success Criteria** (what must be TRUE):
  1. Seven sidebar panels render real content: HeartbeatPanel (posture ring + counts), SentinelPanel (filterable list), FindingsPanel (severity badges + intel), ExplorerPanel (file tree), LibraryPanel (catalog browser), FleetPanel (agent summary + topology link), CompliancePanel (framework selector + scores)
  2. The sidebar is resizable with a drag handle and collapses at a threshold
  3. paneStore.openApp(route, label) opens a route as a new editor tab or focuses an existing tab with that route
  4. All 19 existing routes render correctly as pane tabs with a visible tab bar showing close buttons
  5. App launches with a default Home tab; pane splitting (horizontal/vertical) works for all app types
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md -- Pane store enhancements (openApp, closeView, setActiveView), PaneTabBar + PaneTab components, unit tests
- [ ] 02-02-PLAN.md -- Posture utility extraction, HeartbeatPanel, SentinelPanel, FindingsPanel
- [ ] 02-03-PLAN.md -- LibraryPanel, FleetPanel, CompliancePanel, SidebarPanel integration, tab.close command (Cmd+W)

### Phase 3: Right Sidebar + Bottom Panel + Commands
**Goal**: Operators have a right sidebar for Speakeasy chat, an audit tail in the bottom panel, and per-panel sidebar commands
**Depends on**: Phase 2
**Requirements**: RBAR-01, RBAR-02, RBAR-03, RBAR-04, BPAN-01, BPAN-02, BPAN-03, CMD-03, CMD-04, STATE-02
**Success Criteria** (what must be TRUE):
  1. A resizable, collapsible right sidebar renders to the right of the editor area with SpeakeasyPanel inside it
  2. Cmd+Shift+B toggles right sidebar visibility; right-sidebar-store tracks visible, activePanel, and width
  3. AuditTailPanel appears as a 4th tab in the bottom panel showing last N audit entries with auto-refresh
  4. Sidebar commands for each panel (sentinels, findings, library, fleet, compliance, heartbeat) are registered and discoverable via command palette
  5. Existing Terminal, Problems, and Output bottom panel tabs continue to work unchanged
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Lab Decomposition + App Navigation
**Goal**: Lab is decomposed into independent apps and all navigation uses the openApp pattern, completing the IDE pivot
**Depends on**: Phase 3
**Requirements**: LAB-01, LAB-02, LAB-03, LAB-04, CMD-05, CMD-06
**Success Criteria** (what must be TRUE):
  1. Swarm Board, Threat Hunt, and Simulator are each openable as independent editor tabs without going through the Lab container
  2. Lab container is preserved as an optional convenience grouping but is no longer the only way to access its sub-apps
  3. Navigate commands (Mission Control, Approvals, Audit, Receipts, Topology, Swarm Board, Hunt, Simulator) use paneStore.openApp() to open routes as pane tabs
  4. All app-opening commands are registered, categorized, and discoverable via command palette
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Activity Bar + Sidebar Shell | 2/2 | Complete | 2026-03-18 |
| 2. Sidebar Panels + Editor Tabs | 0/3 | Not started | - |
| 3. Right Sidebar + Bottom Panel + Commands | 0/2 | Not started | - |
| 4. Lab Decomposition + App Navigation | 0/2 | Not started | - |
