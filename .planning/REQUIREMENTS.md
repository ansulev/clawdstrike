# Requirements: ClawdStrike Workbench IDE Pivot

**Defined:** 2026-03-17
**Core Value:** Security operators can work across multiple views simultaneously with a folder-first, IDE-grade navigation model

## v1 Requirements

### Activity Bar

- [x] **ABAR-01**: Activity bar renders as 48px vertical icon rail on the far left
- [x] **ABAR-02**: Clicking an activity bar icon switches the sidebar to the corresponding panel
- [x] **ABAR-03**: Clicking the active activity bar icon collapses the sidebar
- [x] **ABAR-04**: Activity bar shows 7 icons (Heartbeat, Sentinels, Findings, Explorer, Library, Fleet, Compliance) plus Settings at bottom
- [x] **ABAR-05**: Active icon is visually distinguished (highlight/indicator)
- [x] **ABAR-06**: Activity bar icons use existing sigil icon set from sidebar-icons.tsx

### Sidebar Panels

- [x] **SIDE-01**: Sidebar renders the panel corresponding to the active activity bar item
- [x] **SIDE-02**: Sidebar is resizable with drag handle and collapse threshold
- [x] **SIDE-03**: HeartbeatPanel shows system status (posture ring, sentinel/finding/approval/fleet counts, quick links)
- [x] **SIDE-04**: SentinelPanel shows filterable sentinel list with status dots and create button
- [x] **SIDE-05**: FindingsPanel shows findings list with severity badges and intel section
- [x] **SIDE-06**: ExplorerPanel shows detection project file tree (existing component, integrated as sidebar panel)
- [x] **SIDE-07**: LibraryPanel shows policy catalog browser adapted for sidebar width
- [x] **SIDE-08**: FleetPanel shows connection status, agent summary list, and topology minimap link
- [x] **SIDE-09**: CompliancePanel shows framework selector and compliance score summary
- [x] **SIDE-10**: Clicking items in sidebar panels opens detail views as editor tabs via openApp

### Editor Area (Pane System)

- [x] **PANE-01**: paneStore gains openApp(route, label) that opens route as new tab or focuses existing
- [x] **PANE-02**: All 19 existing routes render correctly as pane tabs
- [x] **PANE-03**: PaneTabBar shows view tabs with close button per tab
- [x] **PANE-04**: Default layout opens Home tab on app launch
- [x] **PANE-05**: Pane splitting (horizontal/vertical) continues to work for all app types

### Right Sidebar

- [x] **RBAR-01**: Right sidebar zone renders to the right of the editor area
- [x] **RBAR-02**: Right sidebar is resizable and collapsible
- [x] **RBAR-03**: SpeakeasyPanel renders in the right sidebar (moved from current location)
- [x] **RBAR-04**: Right sidebar toggleable via Cmd+Shift+B

### Bottom Panel

- [x] **BPAN-01**: AuditTailPanel added as 4th bottom panel tab
- [x] **BPAN-02**: AuditTailPanel shows last N audit entries with auto-refresh
- [x] **BPAN-03**: Existing Terminal, Problems, Output tabs continue to work

### Lab Decomposition

- [x] **LAB-01**: Swarm Board openable as independent editor tab (not only via Lab container)
- [x] **LAB-02**: Threat Hunt openable as independent editor tab
- [x] **LAB-03**: Simulator openable as independent editor tab
- [x] **LAB-04**: Lab container preserved as optional convenience grouping

### Commands & Navigation

- [x] **CMD-01**: sidebar.toggle command (Cmd+B) shows/hides entire sidebar
- [x] **CMD-02**: sidebar.explorer command (Cmd+Shift+E) switches to Explorer panel
- [x] **CMD-03**: Sidebar commands for each panel (sentinels, findings, library, fleet, compliance, heartbeat)
- [x] **CMD-04**: sidebar.toggleRight command (Cmd+Shift+B) toggles right sidebar
- [ ] **CMD-05**: Navigate commands use openApp pattern to open routes as pane tabs
- [ ] **CMD-06**: App-opening commands (Mission Control, Approvals, Audit, Receipts, Topology, Swarm Board, Hunt, Simulator)

### State Management

- [x] **STATE-01**: activity-bar-store (Zustand) tracks activeItem, sidebarVisible, sidebarWidth
- [x] **STATE-02**: right-sidebar-store (Zustand) tracks visible, activePanel, width
- [x] **STATE-03**: All 11 existing Zustand stores continue to work unchanged

### Layout Shell

- [x] **SHELL-01**: desktop-layout.tsx updated with ActivityBar + LeftSidebar + EditorArea + RightSidebar zones
- [x] **SHELL-02**: desktop-sidebar.tsx decomposed into ActivityBar and SidebarPanel components
- [x] **SHELL-03**: StatusBar continues to render at the bottom
- [x] **SHELL-04**: Titlebar continues to render at the top

## v2 Requirements

### Extensions

- **EXT-01**: Context-sensitive Inspector in right sidebar (shows relevant details for focused item)
- **EXT-02**: User-customizable activity bar order
- **EXT-03**: Multiple detection project roots (VS Code multi-root workspaces)
- **EXT-04**: Virtual tree nodes for built-in rulesets
- **EXT-05**: File tree status decorations (validation status badges)

### Advanced Layout

- **ALYT-01**: Drag tabs between panes
- **ALYT-02**: Activity bar badge counts (findings, approvals)
- **ALYT-03**: Sidebar panel memory (remember scroll position per panel)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full VS Code extension API | Overkill; MCP plugin is the right model |
| Tree-sitter editor | CodeMirror + schema completions is correct for YAML/Sigma/YARA |
| Vim emulation | Not needed for security policy editing |
| Full file system abstraction | DetectionProject tree is the right model |
| Database viewer | Irrelevant to security policy IDE |
| AI chat panel | ClawdStrike is security layer, not agent; Speakeasy is operator chat |
| Theme switching | Dark-only for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ABAR-01 | Phase 1 | Complete |
| ABAR-02 | Phase 1 | Complete |
| ABAR-03 | Phase 1 | Complete |
| ABAR-04 | Phase 1 | Complete |
| ABAR-05 | Phase 1 | Complete |
| ABAR-06 | Phase 1 | Complete |
| SIDE-01 | Phase 2 | Complete |
| SIDE-02 | Phase 2 | Complete |
| SIDE-03 | Phase 2 | Complete |
| SIDE-04 | Phase 2 | Complete |
| SIDE-05 | Phase 2 | Complete |
| SIDE-06 | Phase 2 | Complete |
| SIDE-07 | Phase 2 | Complete |
| SIDE-08 | Phase 2 | Complete |
| SIDE-09 | Phase 2 | Complete |
| SIDE-10 | Phase 2 | Complete |
| PANE-01 | Phase 2 | Complete |
| PANE-02 | Phase 2 | Complete |
| PANE-03 | Phase 2 | Complete |
| PANE-04 | Phase 2 | Complete |
| PANE-05 | Phase 2 | Complete |
| RBAR-01 | Phase 3 | Complete |
| RBAR-02 | Phase 3 | Complete |
| RBAR-03 | Phase 3 | Complete |
| RBAR-04 | Phase 3 | Complete |
| BPAN-01 | Phase 3 | Complete |
| BPAN-02 | Phase 3 | Complete |
| BPAN-03 | Phase 3 | Complete |
| LAB-01 | Phase 4 | Complete |
| LAB-02 | Phase 4 | Complete |
| LAB-03 | Phase 4 | Complete |
| LAB-04 | Phase 4 | Complete |
| CMD-01 | Phase 1 | Complete |
| CMD-02 | Phase 1 | Complete |
| CMD-03 | Phase 3 | Complete |
| CMD-04 | Phase 3 | Complete |
| CMD-05 | Phase 4 | Pending |
| CMD-06 | Phase 4 | Pending |
| STATE-01 | Phase 1 | Complete |
| STATE-02 | Phase 3 | Complete |
| STATE-03 | Phase 1 | Complete |
| SHELL-01 | Phase 1 | Complete |
| SHELL-02 | Phase 1 | Complete |
| SHELL-03 | Phase 1 | Complete |
| SHELL-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation (added STATE-03 to traceability, corrected count)*
