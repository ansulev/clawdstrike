# Requirements: ClawdStrike Workbench v1.1 — IDE Completeness

**Defined:** 2026-03-18
**Core Value:** Security operators get a professional-grade IDE with search, quick navigation, and file management — closing the gap from "IDE scaffold" to "real tool"

## v1.1 Requirements

### Search

- [x] **SRCH-01**: User can find text in the current file via Cmd+F with match highlighting and navigation
- [x] **SRCH-02**: User can find and replace text in the current file via Cmd+H
- [x] **SRCH-03**: User can search across all workspace files via Cmd+Shift+F with results list
- [x] **SRCH-04**: Search results show file path, line number, and matching context
- [x] **SRCH-05**: Search supports case-sensitive, whole-word, and regex toggles

### Quick Navigation

- [x] **NAV-01**: User can open any file by name via Cmd+P (Quick Open) with fuzzy matching
- [x] **NAV-02**: Quick Open shows recent files at the top when input is empty
- [x] **NAV-03**: Breadcrumb bar above the editor shows path (Project > Folder > File) with click navigation
- [x] **NAV-04**: User can go to a specific line number via Cmd+G

### File Tree

- [x] **TREE-01**: User can create a new file from Explorer context menu or toolbar button
- [x] **TREE-02**: User can rename a file via context menu or F2 key
- [x] **TREE-03**: User can delete a file via context menu with confirmation dialog
- [x] **TREE-04**: Explorer shows file status indicators (modified dot, error badge)

### Tab System

- [x] **TAB-01**: Tab bar shows navigation arrows when tabs overflow horizontal space
- [x] **TAB-02**: User can scroll through tabs with scroll wheel or arrow buttons
- [x] **TAB-03**: Tab context menu includes "Close to the Right" and "Close Saved"

### Detection Engineering

- [x] **DET-01**: Editor gutter shows "Run Test" button on hover for testable guards
- [x] **DET-02**: Editor gutter shows coverage gap indicators (uncovered MITRE techniques)
- [ ] **DET-03**: Guard configuration shows execution order with drag-to-reorder

### Terminal

- [x] **TERM-01**: User can split terminal panel horizontally to show two sessions side by side
- [x] **TERM-02**: User can rename terminal sessions via double-click on tab title

### Detection Editor Integration

- [x] **DINT-01**: Guards browser opens as a pane tab (not full-page overlay) for side-by-side with policy editor
- [x] **DINT-02**: Compare/diff view opens as a pane tab (not overlay) supporting split-pane comparison
- [x] **DINT-03**: Visual builders (Sigma, YARA, OCSF) open as editor tabs from Explorer or command palette
- [x] **DINT-04**: Evidence Pack, Explainability, Version History render as resizable right-sidebar panels
- [x] **DINT-05**: Live Agent Tab and SDK Integration Tab promoted to standalone pane-openable views
- [x] **DINT-06**: Hunt findings can draft policies (hunt → policy pipeline connected)
- [x] **DINT-07**: Coverage gap analysis accessible as a pane tab with MITRE heatmap
- [x] **DINT-08**: TrustPrint suite (pattern explorer, provider wizard, threshold tuner) accessible from command palette

## v2 Requirements

### Advanced IDE

- **ADV-01**: Go to Symbol (Cmd+Shift+O) for guard names, policy sections
- **ADV-02**: Welcome/getting started tab with quick-start templates
- **ADV-03**: Right sidebar Outline panel showing document structure
- **ADV-04**: Keybinding customization UI
- **ADV-05**: Session restore (reopen last files/layout on startup)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Git integration | Workbench manages detection projects, not source control |
| Multi-cursor editing | CodeMirror supports it, but not priority for YAML/policy editing |
| Minimap | Low value for policy files (typically <200 lines) |
| Custom themes | Dark-only for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRCH-01 | Phase 1 | Complete |
| SRCH-02 | Phase 1 | Complete |
| SRCH-03 | Phase 2 | Complete |
| SRCH-04 | Phase 2 | Complete |
| SRCH-05 | Phase 2 | Complete |
| NAV-01 | Phase 3 | Complete |
| NAV-02 | Phase 3 | Complete |
| NAV-03 | Phase 3 | Complete |
| NAV-04 | Phase 3 | Complete |
| TREE-01 | Phase 4 | Complete |
| TREE-02 | Phase 4 | Complete |
| TREE-03 | Phase 4 | Complete |
| TREE-04 | Phase 4 | Complete |
| TAB-01 | Phase 5 | Complete |
| TAB-02 | Phase 5 | Complete |
| TAB-03 | Phase 5 | Complete |
| DET-01 | Phase 6 | Complete |
| DET-02 | Phase 6 | Complete |
| DET-03 | Phase 6 | Pending |
| TERM-01 | Phase 5 | Complete |
| TERM-02 | Phase 5 | Complete |
| DINT-01 | Phase 7 | Complete |
| DINT-02 | Phase 7 | Complete |
| DINT-03 | Phase 7 | Complete |
| DINT-04 | Phase 7 | Complete |
| DINT-05 | Phase 7 | Complete |
| DINT-06 | Phase 7 | Complete |
| DINT-07 | Phase 7 | Complete |
| DINT-08 | Phase 7 | Complete |

**Coverage:**
- v1.1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after v1.1 milestone initialization*
