# Requirements: ClawdStrike Workbench v1.2 — Explorer Polish

**Defined:** 2026-03-19
**Core Value:** The Explorer panel looks and feels like a professional IDE file tree — clear icons, labeled filters, visual hierarchy, and complete context menus

## v1.2 Requirements

### File & Folder Icons

- [ ] **ICON-01**: Policy files show a shield icon in gold (#d4a84b)
- [ ] **ICON-02**: Sigma files show a "SIG" label badge or sigma symbol
- [ ] **ICON-03**: YARA files show a "YAR" label badge or magnifying glass icon
- [ ] **ICON-04**: OCSF files show a JSON brackets icon
- [ ] **ICON-05**: Folders show open/closed folder icon based on expansion state

### Labeled Filter Bar

- [x] **FILT-01**: Filter bar shows labeled toggles (Policy, Sigma, YARA, OCSF) instead of anonymous dots
- [x] **FILT-02**: Each toggle shows file count: "Policy (5)"
- [x] **FILT-03**: Active filter has filled background, inactive is ghost/outline
- [x] **FILT-04**: Footer shows correct grammar and matches active filter count

### Tree Visual Refinement

- [ ] **TREE-VIS-01**: Nested files show vertical indent guide lines
- [ ] **TREE-VIS-02**: Currently open file has subtle background highlight in tree
- [ ] **TREE-VIS-03**: Root sections collapsible by clicking header (chevron rotates)
- [ ] **TREE-VIS-04**: Root headers show item count badge: "workspace (12)"
- [ ] **TREE-VIS-05**: Empty state shows prominent "Open Folder" hero button
- [ ] **TREE-VIS-06**: Footer grammar correct: "1 file" vs "5 files"

### Context Menu Completeness

- [ ] **CTX-01**: Root context menu with Remove from Workspace, Open in Finder, Refresh, New File
- [ ] **CTX-02**: File context menu with Open, Rename, Delete, Copy Path, Copy Relative Path, Reveal in Finder
- [ ] **CTX-03**: Folder context menu with New File, New Folder, Collapse All, Reveal in Finder
- [ ] **CTX-04**: Context menu viewport-clamped (no overflow offscreen)

## v1.3 Requirements (Gap Closure)

### Integration Wiring Fixes

- [x] **DET-01**: Gutter play button runs test scenarios in FileEditorShell (not just legacy PolicyEditor)
- [x] **DET-03**: Guard test results appear in TestRunnerPanel when triggered from FileEditorShell gutter
- [x] **FLAT-07**: edit.newTab (Cmd+T) creates a pane tab via pane-store (not legacy multi-policy-store)
- [x] **FLAT-08**: All navigate("/editor") call sites replaced with pane-store openFile/openApp

### Swarm Board Evolution

- [x] **SWARM-01**: "Launch Swarm" button in editor toolbar spawns new swarm session with active policy
- [x] **SWARM-02**: Swarm Board opens as a pane tab alongside editor (split view)
- [x] **SWARM-03**: Swarm session pre-configured with active policy and connected sentinels
- [x] **SWARM-04**: Agent nodes pulse/glow when evaluating a policy (real-time)
- [x] **SWARM-05**: Receipts appear as animated edges flowing between nodes
- [ ] **SWARM-06**: Trust graph updates live as agents join/leave
- [ ] **SWARM-07**: Click receipt edge to open receipt inspector in pane tab

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ICON-01 | Phase 1 | Pending |
| ICON-02 | Phase 1 | Pending |
| ICON-03 | Phase 1 | Pending |
| ICON-04 | Phase 1 | Pending |
| ICON-05 | Phase 1 | Pending |
| FILT-01 | Phase 2 | Complete |
| FILT-02 | Phase 2 | Complete |
| FILT-03 | Phase 2 | Complete |
| FILT-04 | Phase 2 | Complete |
| TREE-VIS-01 | Phase 3 | Pending |
| TREE-VIS-02 | Phase 3 | Pending |
| TREE-VIS-03 | Phase 3 | Pending |
| TREE-VIS-04 | Phase 3 | Pending |
| TREE-VIS-05 | Phase 3 | Pending |
| TREE-VIS-06 | Phase 3 | Pending |
| CTX-01 | Phase 4 | Pending |
| CTX-02 | Phase 4 | Pending |
| CTX-03 | Phase 4 | Pending |
| CTX-04 | Phase 4 | Pending |
| DET-01 | Phase 11 | Complete |
| DET-03 | Phase 11 | Complete |
| FLAT-07 | Phase 11 | Complete |
| FLAT-08 | Phase 11 | Complete |
| SWARM-01 | Phase 12 | Complete |
| SWARM-02 | Phase 12 | Complete |
| SWARM-03 | Phase 12 | Complete |
| SWARM-04 | Phase 13 | Complete |
| SWARM-05 | Phase 13 | Complete |
| SWARM-06 | Phase 13 | Pending |
| SWARM-07 | Phase 13 | Pending |

**Coverage:**
- v1.2 requirements: 19 total (4 complete, 15 pending)
- v1.3 gap closure requirements: 11 total (0 complete, 11 pending)
- Total: 30 requirements
- Mapped to phases: 30
- Unmapped: 0
