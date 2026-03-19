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
- [x] **DET-03**: Guard configuration shows execution order with drag-to-reorder

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

### File-First Editor (Option C Flatten)

- [x] **FLAT-01**: Opening a file from Explorer creates a pane tab directly (no "Editor" container tab)
- [x] **FLAT-02**: FileEditorShell component wraps each file tab with file-type-specific chrome (toolbar, visual/yaml toggle)
- [x] **FLAT-03**: Policy files show contextual toolbar (validate, format, test, deploy, publish) inside FileEditorShell
- [x] **FLAT-04**: PolicyTabBar removed — PaneTabBar is the sole tab bar for files and apps
- [x] **FLAT-05**: Multi-policy-store state keyed by file path, bridged to pane view IDs
- [x] **FLAT-06**: Pane splitting replaces Editor's internal split mode (two files side-by-side)
- [x] **FLAT-07**: Dirty indicator (gold dot) on pane tabs for files with unsaved changes
- [x] **FLAT-08**: `/editor` route removed or redirects to home; `/file/:path` route renders FileEditorShell

### Default Workspace Bootstrap

- [x] **BOOT-01**: On first launch with no prior project, `~/.clawdstrike/workspace/` is scaffolded with policies/, sigma/, yara/, scenarios/ dirs and example files
- [x] **BOOT-02**: Explorer auto-mounts the default workspace on launch — no empty state
- [x] **BOOT-03**: Built-in rulesets written as editable copies (permissive, default, strict, ai-agent, cicd) in policies/
- [ ] **BOOT-04**: "Add Folder" button at bottom of Explorer lets users mount additional directories
- [x] **BOOT-05**: Multi-root workspace folders persist across restarts via localStorage

### Live CodeMirror Editor

- [x] **LIVE-01**: FileEditorShell renders YamlEditor (CodeMirror) instead of pre tag for all file types
- [x] **LIVE-02**: Typing updates policy-edit-store and marks pane tab dirty
- [x] **LIVE-03**: Cmd+Z / Cmd+Shift+Z undo/redo work per-file through edit store undo stack
- [x] **LIVE-04**: Validation errors appear in Problems panel for active file
- [x] **LIVE-05**: Cmd+S saves file to disk via Tauri fs and clears dirty indicator

### Visual Polish

- [ ] **POLISH-01**: Only one Home tab opens on launch (no duplicates)
- [x] **POLISH-02**: Breadcrumbs show relative path from project root (not absolute)
- [x] **POLISH-03**: Explorer tree refreshes after file create/rename/delete
- [x] **POLISH-04**: Status bar shows active file name, line/column, file type, dirty state
- [ ] **POLISH-05**: Pane tab deduplication prevents opening same file twice

### Session Restore

- [ ] **SESS-01**: On quit, pane tree serialized to localStorage
- [ ] **SESS-02**: On launch, pane tree restored — files reopen in previous positions
- [ ] **SESS-03**: Dirty unsaved files show recovery banner
- [ ] **SESS-04**: "Restored N files" toast on successful session restore

### Full Editor Experience

- [x] **EDIT-01**: Policy files show Visual/YAML split toggle — EditorVisualPanel (guard cards) alongside YamlEditor
- [x] **EDIT-02**: Guard cards display with enable/disable toggles, config fields, drag-to-reorder
- [ ] **EDIT-03**: Run button with dropdown shows 3 quick test presets that execute inline with flash result
- [ ] **EDIT-04**: Test Runner panel renders below editor when toggled, with results and coverage strip
- [ ] **EDIT-05**: FileEditorToolbar has sidebar toggle buttons for History, Evidence, Explain, Publish
- [ ] **EDIT-06**: Native validation (Tauri) runs on policy changes with richer error diagnostics
- [ ] **EDIT-07**: Auto-versioning creates snapshot on each save
- [x] **EDIT-08**: Features gated to policy file types — non-policy files show only visual builder + CodeMirror

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
| DET-03 | Phase 6 | Complete |
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

| FLAT-01 | Phase 8 | Complete |
| FLAT-02 | Phase 8 | Complete |
| FLAT-03 | Phase 8 | Complete |
| FLAT-04 | Phase 8 | Complete |
| FLAT-05 | Phase 8 | Complete |
| FLAT-06 | Phase 8 | Complete |
| FLAT-07 | Phase 8 | Complete |
| FLAT-08 | Phase 8 | Complete |

| BOOT-01 | Phase 9 | Complete |
| BOOT-02 | Phase 9 | Complete |
| BOOT-03 | Phase 9 | Complete |
| BOOT-04 | Phase 9 | Pending |
| BOOT-05 | Phase 9 | Complete |

| LIVE-01 | Phase 10 | Complete |
| LIVE-02 | Phase 10 | Complete |
| LIVE-03 | Phase 10 | Complete |
| LIVE-04 | Phase 10 | Complete |
| LIVE-05 | Phase 10 | Complete |

| POLISH-01 | Phase 11 | Pending |
| POLISH-02 | Phase 11 | Complete |
| POLISH-03 | Phase 11 | Complete |
| POLISH-04 | Phase 11 | Complete |
| POLISH-05 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 42 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after v1.1 milestone initialization*
