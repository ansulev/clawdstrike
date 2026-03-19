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

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0
