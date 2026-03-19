# Roadmap: ClawdStrike Workbench v1.2 — Explorer Polish

## Overview

Make the Explorer panel production-ready. The IDE shell and editor are functional — now the file tree needs to look and feel like a professional tool, not a prototype. Focus areas: file-type icons, folder visuals, labeled filter bar, indent guides, context menus, and interaction model.

**Prior milestones:**
- v1.0 (4 phases): IDE shell — activity bar, sidebar panels, pane tabs, right sidebar
- v1.1 (13 phases): IDE completeness — search, nav, file tree CRUD, editor, session restore, detection integration

## Phases

- [ ] **Phase 1: File & Folder Icons** — Replace colored dots with proper file-type icons, folder open/close icons, root chevrons
- [x] **Phase 2: Labeled Filter Bar** — Replace cryptic dots with labeled toggles showing type + count
- [ ] **Phase 3: Tree Visual Refinement** — Indent guides, active file highlight, root collapse, item counts, empty state hero
- [ ] **Phase 4: Context Menu Completeness** — Root/file/folder context menus with Copy Path, Reveal in Finder, Remove from Workspace

## Phase Details

### Phase 1: File & Folder Icons
**Goal**: Every file and folder in the tree has a clear, recognizable icon — not just a colored dot
**Depends on**: Nothing
**Requirements**: ICON-01, ICON-02, ICON-03, ICON-04, ICON-05
**Success Criteria** (what must be TRUE):
  1. Policy files (.yaml with policy content) show a shield icon in the ClawdStrike gold color
  2. Sigma files (.yml in sigma dirs) show a "SIG" badge or sigma symbol
  3. YARA files (.yar/.yara) show a "YAR" badge or magnifying glass icon
  4. OCSF files (.json) show a JSON brackets icon
  5. Folders show a folder icon that changes between closed/open state based on expansion
  6. Root section headers show a chevron (▸/▾) that toggles collapse + a folder icon
**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Create FileTypeIcon component (shield, SIG/YAR badges, braces) and wire into explorer tree, filter bar, pane tabs

### Phase 2: Labeled Filter Bar
**Goal**: Users can instantly understand and use the file type filter without guessing what colored dots mean
**Depends on**: Phase 1 (uses same icon set)
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04
**Success Criteria** (what must be TRUE):
  1. Filter bar shows labeled toggles: Policy, Sigma, YARA, OCSF (not anonymous colored dots)
  2. Each toggle shows file count in parentheses: "Policy (5)"
  3. Active filter has filled background, inactive is outline/ghost
  4. "Clear" button resets all filters
  5. Footer shows accurate count matching active filters: "5 files" (not "5 files Sigma")
**Plans:** 1 plan

Plans:
- [x] 02-01-PLAN.md — Replace FormatDot with labeled FormatToggle pills, add countFilesByType, fix footer

### Phase 3: Tree Visual Refinement
**Goal**: The tree looks polished with indent guides, proper highlighting, and smart empty states
**Depends on**: Phase 1
**Requirements**: TREE-VIS-01, TREE-VIS-02, TREE-VIS-03, TREE-VIS-04, TREE-VIS-05, TREE-VIS-06
**Success Criteria** (what must be TRUE):
  1. Nested files show vertical indent guide lines (thin dotted/solid lines connecting tree levels)
  2. The currently open file has a subtle background highlight in the tree
  3. Root sections are collapsible by clicking the header (chevron rotates)
  4. Root headers show item count badge: "workspace (12)"
  5. When no files exist, a hero "Open Folder" button is prominent (not small text at bottom)
  6. Footer grammar is correct: "1 file" vs "5 files"
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Context Menu Completeness
**Goal**: Right-click anywhere in the explorer gives useful, contextual actions
**Depends on**: Phase 3
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04
**Success Criteria** (what must be TRUE):
  1. Root context menu: "Remove from Workspace", "Open in Finder", "Refresh", "New File"
  2. File context menu: "Open", "Rename (F2)", "Delete", "Copy Path", "Copy Relative Path", "Reveal in Finder"
  3. Folder context menu: "New File", "New Folder", "Collapse All Children", "Reveal in Finder"
  4. Context menu positioned within viewport (no overflow offscreen)
**Plans:** 1 plan

Plans:
- [ ] 04-01-PLAN.md — Install tauri-plugin-opener, rewrite context menu with root/file/folder variants and viewport clamping

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. File & Folder Icons | 0/1 | Planned | - |
| 2. Labeled Filter Bar | 1/1 | Complete | 2026-03-19 |
| 3. Tree Visual Refinement | 0/2 | Not started | - |
| 4. Context Menu Completeness | 0/1 | Planned | - |
