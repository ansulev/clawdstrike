# Roadmap: ClawdStrike Workbench v1.1 — IDE Completeness

## Overview

Close the gap from "IDE scaffold" to "professional-grade detection engineering IDE." The v1.0 milestone delivered the IDE shell (activity bar, sidebar panels, pane system, right sidebar, commands). v1.1 adds the core IDE features users expect: search, quick open, file tree mutations, tab overflow, breadcrumbs, inline detection tools, and terminal improvements.

**Canonical refs for downstream agents:**
- `docs/plans/workbench-dev/ide-pivot.md` — IDE pivot plan (v1.0 architecture)
- `docs/plans/workbench-dev/patterns-reference.md` — Athas patterns
- `.planning/phases/01-*/01-UI-SPEC.md` through `03-*/03-UI-SPEC.md` — design tokens

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: In-File Search** — Cmd+F find, Cmd+H find/replace in current CodeMirror editor (1/1 plans)
- [x] **Phase 2: Global Search** — Cmd+Shift+F workspace-wide search with results panel (2 plans)
- [ ] **Phase 3: Quick Navigation** — Cmd+P file picker, breadcrumbs, Cmd+G go-to-line (2 plans)
- [x] **Phase 4: File Tree Mutations** — Create/rename/delete files from Explorer with status indicators (2 plans)
- [x] **Phase 5: Tab & Terminal Polish** — Tab overflow scrolling, context menu additions, terminal splits (2 plans)
- [x] **Phase 6: Detection Engineering Inline** — Gutter test buttons, coverage gap indicators, guard reorder (2 plans)
- [ ] **Phase 7: Detection Editor Integration** — Surface 50K LOC of orphaned detection engineering features as proper IDE panels
- [x] **Phase 8: File-First Editor** — Files are pane tabs, FileEditorShell wraps per-file chrome, kill PolicyTabBar (4 plans)
- [x] **Phase 9: Default Workspace Bootstrap** — Auto-scaffold ~/.clawdstrike/workspace/, multi-root explorer, example content (2 plans)
- [ ] **Phase 10: Live CodeMirror Editor** — Replace FileEditorShell pre tag with real CodeMirror, wired to policy-edit-store (2 plans)
- [ ] **Phase 11: Visual Polish** — Fix duplicate Home tabs, relative breadcrumbs, tree refresh, status bar updates
- [ ] **Phase 12: Session Restore** — Persist pane layout + open files to localStorage, restore on launch

## Phase Details

### Phase 1: In-File Search
**Goal**: User can find and replace text within the current editor using standard Cmd+F / Cmd+H shortcuts
**Depends on**: Nothing
**Requirements**: SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. Cmd+F opens a search bar overlay in the active CodeMirror editor with match highlighting and prev/next navigation
  2. Cmd+H opens find-and-replace with replace-one and replace-all buttons
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Add search() extension to CodeMirror and register find/replace commands

### Phase 2: Global Search
**Goal**: User can search across all workspace files with results displayed in a dedicated panel
**Depends on**: Phase 1
**Requirements**: SRCH-03, SRCH-04, SRCH-05
**Success Criteria** (what must be TRUE):
  1. Cmd+Shift+F opens a search panel (sidebar or bottom) with input field and results list
  2. Results show file path, line number, and matching context with highlighted match text
  3. Clicking a result opens the file in an editor tab at the matching line
  4. Toggle buttons for case-sensitive, whole-word, and regex search modes
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Rust search_in_project command, TS wrapper, and Zustand search store
- [ ] 02-02-PLAN.md — Search sidebar panel UI, activity bar integration, Cmd+Shift+F command

### Phase 3: Quick Navigation
**Goal**: User can navigate files and lines with keyboard shortcuts and breadcrumbs
**Depends on**: Nothing
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. Cmd+P opens a Quick Open dialog with fuzzy file name matching across the detection project
  2. Recent files appear at the top when the input is empty; selecting opens the file in active pane
  3. Breadcrumb bar renders above the editor showing Project > Folder > File with click navigation
  4. Cmd+G opens a go-to-line input that jumps to the specified line number
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Quick Open dialog (Cmd+P) with fuzzy file matching, recent files, and Go-to-Line (Cmd+G)
- [ ] 03-02-PLAN.md — Breadcrumb bar above editor with clickable path segments

### Phase 4: File Tree Mutations
**Goal**: User can create, rename, and delete detection files from the Explorer panel
**Depends on**: Nothing
**Requirements**: TREE-01, TREE-02, TREE-03, TREE-04
**Success Criteria** (what must be TRUE):
  1. Explorer toolbar has a "New File" button; right-click context menu offers "New File" with inline name input
  2. Right-click > Rename (or F2) enables inline editing of the file name
  3. Right-click > Delete shows a confirmation dialog and removes the file via Tauri fs API
  4. Explorer file entries show modified-dot and error-badge status decorations
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Tauri fs bridge wrappers, project store mutations, context menu, New File with inline input
- [x] 04-02-PLAN.md — Inline rename (F2 + context menu), delete confirmation dialog, file status indicators

### Phase 5: Tab & Terminal Polish
**Goal**: Tab system handles overflow gracefully and terminal supports splits and naming
**Depends on**: Nothing
**Requirements**: TAB-01, TAB-02, TAB-03, TERM-01, TERM-02
**Success Criteria** (what must be TRUE):
  1. When tabs exceed the tab bar width, left/right navigation arrows appear for scrolling
  2. Mouse scroll wheel on the tab bar scrolls tabs horizontally
  3. Tab context menu includes "Close to the Right" and "Close Saved" options
  4. Terminal panel can be split horizontally to show two sessions side by side
  5. Terminal session tabs can be renamed by double-clicking the tab title
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Tab overflow arrows, wheel scroll, and context menu with Close to the Right / Close Saved
- [x] 05-02-PLAN.md — Terminal split view and session tab rename via double-click

### Phase 6: Detection Engineering Inline
**Goal**: Detection engineers get inline feedback in the editor — test buttons, coverage gaps, guard reorder
**Depends on**: Phase 1
**Requirements**: DET-01, DET-02, DET-03
**Success Criteria** (what must be TRUE):
  1. Hovering over a guard config section in the YAML editor shows a "Run Test" gutter icon that executes the guard
  2. Gutter shows colored indicators for uncovered MITRE ATT&CK techniques based on the active policy
  3. Guard configuration panel displays execution order with drag-to-reorder capability
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — CodeMirror gutter extensions for Run Test buttons and MITRE coverage gap indicators
- [x] 06-02-PLAN.md — Execution order badges on guard cards, wire gutter test button to simulation engine

### Phase 7: Detection Editor Integration
**Goal**: Surface the 50K+ LOC of orphaned detection engineering features as proper IDE panels and pane-openable views
**Depends on**: Phase 3 (needs breadcrumbs for navigation context)
**Requirements**: DINT-01, DINT-02, DINT-03, DINT-04, DINT-05, DINT-06, DINT-07, DINT-08
**Success Criteria** (what must be TRUE):
  1. Guards browser opens as a pane tab (not full-page overlay) — side-by-side with policy editor
  2. Compare/diff view opens as a pane tab (not overlay) — supports split-pane comparison
  3. Visual builders (Sigma, YARA, OCSF) accessible from Explorer file click or command palette — open as editor tabs
  4. Evidence Pack, Explainability, Version History render as resizable right-sidebar panels (not squeezed 280px sidebar)
  5. Live Agent Tab and SDK Integration Tab promoted to standalone pane-openable views
  6. Hunt findings can draft policies (hunt → policy pipeline connected)
  7. Coverage gap analysis accessible as a pane tab with MITRE heatmap
  8. TrustPrint suite (pattern explorer, provider wizard, threshold tuner) accessible from command palette
**Plans**: 4 plans

Plans:
- [x] 07-01-PLAN.md — Promote Guards, Compare, Live Agent, SDK, Coverage to standalone pane routes with navigate commands
- [x] 07-02-PLAN.md — Expand right sidebar with Evidence Pack, Explainability, Version History panels
- [x] 07-03-PLAN.md — Add visual builder and TrustPrint tool routes with command palette commands
- [x] 07-04-PLAN.md — Wire Hunt draft-detection pipeline to navigate to editor pane tab

### Phase 8: File-First Editor (Option C Flatten)
**Goal**: Files are first-class pane tabs — no more "Editor" container with internal tab bar. Opening a file creates a pane tab directly. The editor becomes a wrapper component (FileEditorShell) that provides file-type-specific chrome.
**Depends on**: Phase 5 (tab system), Phase 7 (detection editor routes)
**Requirements**: FLAT-01, FLAT-02, FLAT-03, FLAT-04, FLAT-05, FLAT-06, FLAT-07, FLAT-08
**Success Criteria** (what must be TRUE):
  1. Opening a file from Explorer creates a pane tab with the file name — no "Editor" intermediate tab
  2. FileEditorShell renders contextual toolbar (validate/format/test/deploy for policies, visual builder for Sigma/YARA/OCSF)
  3. Visual/YAML toggle works per-file within the FileEditorShell wrapper
  4. PolicyTabBar is removed — PaneTabBar is the only tab bar
  5. Multi-policy-store state keyed by file path, bridged to pane view IDs
  6. Pane splitting opens two files side-by-side (replaces Editor's internal split mode)
  7. Dirty indicator (gold dot) shows on pane tabs for unsaved files
  8. All existing editor functionality (guard config, test runner, deploy, publish) accessible from FileEditorShell toolbar or command palette
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — FileEditorShell component, /file/* route, PaneView dirty/fileType extension, pane-store openFile bridge
- [x] 08-02-PLAN.md — PaneTab dirty dot + file-type color indicators, PaneTabBar new-file button
- [x] 08-03-PLAN.md — FileEditorToolbar extraction from PolicyEditor, FileEditorShell toolbar + content integration
- [x] 08-04-PLAN.md — Rewire Explorer/QuickOpen/Search/Hunt to /file/ routes, redirect /editor, remove nav.editor, update BreadcrumbBar

### Phase 9: Default Workspace Bootstrap
**Goal**: First launch shows a populated Explorer with editable example content, not an empty "No project open" state. Multi-root support lets users add additional folders.
**Depends on**: Phase 4 (file tree mutations), Phase 8 (file-first editor)
**Requirements**: BOOT-01, BOOT-02, BOOT-03, BOOT-04, BOOT-05
**Success Criteria** (what must be TRUE):
  1. On first launch (no prior project), `~/.clawdstrike/workspace/` is scaffolded with policies/, sigma/, yara/, scenarios/ and example files
  2. Explorer auto-mounts the default workspace — user sees a populated file tree immediately
  3. Built-in rulesets (permissive, default, strict, ai-agent, cicd) written as editable copies in policies/
  4. "Add Folder" button at bottom of Explorer lets users mount additional directories as multi-root workspace entries
  5. Mounted folders persist across restarts via localStorage
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md — Workspace bootstrap module, Tauri fs capabilities, multi-root project store with localStorage persistence
- [ ] 09-02-PLAN.md — Multi-root Explorer UI, Add Folder button with native dialog, app-level bootstrap hook

### Phase 10: Live CodeMirror Editor
**Goal**: FileEditorShell renders the real CodeMirror editor with full editing, undo/redo, validation, and dirty tracking — replacing the read-only pre tag
**Depends on**: Phase 8 (file-first editor)
**Requirements**: LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05
**Success Criteria** (what must be TRUE):
  1. FileEditorShell renders YamlEditor (CodeMirror) instead of a pre tag for all file types
  2. Typing in the editor updates policy-edit-store and marks the pane tab as dirty
  3. Cmd+Z/Cmd+Shift+Z undo/redo work per-file through the edit store's undo stack
  4. Validation errors appear in the Problems panel for the active file
  5. Cmd+S saves the file to disk via Tauri fs and clears the dirty indicator
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — Replace pre tag with YamlEditor (CodeMirror), wire onChange to policy-edit-store, update ProblemsPanel
- [ ] 10-02-PLAN.md — Wire Cmd+S save to saveDetectionFile, update file.save/file.saveAs commands for file-first tabs

### Phase 11: Visual Polish
**Goal**: Fix visual inconsistencies that make the IDE feel like a prototype
**Depends on**: Phase 10
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05
**Success Criteria** (what must be TRUE):
  1. Only one Home tab opens on launch (no duplicates)
  2. Breadcrumbs show relative path from project root (not full absolute path)
  3. Explorer tree refreshes after file create/rename/delete (no stale "No detection files found")
  4. Status bar shows active file name, line/column, file type, and dirty state
  5. Pane tab deduplication prevents opening the same file twice
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

### Phase 12: Session Restore
**Goal**: Workbench remembers open files and layout across restarts
**Depends on**: Phase 10
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. On quit, pane tree (layout + open views) is serialized to localStorage
  2. On launch, pane tree is restored from localStorage — files reopen in their previous positions
  3. Dirty files that weren't saved show a recovery banner (existing crash recovery behavior)
  4. A "Restored N files" toast appears on successful session restore
**Plans**: 1 plan

Plans:
- [ ] 12-01-PLAN.md — Pane session serialize/restore, beforeunload save, launch restore with toast

## Progress

**Execution Order:**
Phase 10 depends on 8. Phase 11 depends on 10. Phase 12 depends on 10. Phases 11 and 12 are independent of each other.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. In-File Search | 1/1 | Complete | 2026-03-18 |
| 2. Global Search | 2/2 | Complete | 2026-03-18 |
| 3. Quick Navigation | 2/2 | Complete | 2026-03-18 |
| 4. File Tree Mutations | 2/2 | Complete | 2026-03-18 |
| 5. Tab & Terminal Polish | 2/2 | Complete | 2026-03-18 |
| 6. Detection Engineering Inline | 2/2 | Complete | 2026-03-18 |
| 7. Detection Editor Integration | 4/4 | Complete | 2026-03-18 |
| 8. File-First Editor | 4/4 | Complete | 2026-03-18 |
| 9. Default Workspace Bootstrap | 2/2 | Complete | 2026-03-18 |
| 10. Live CodeMirror Editor | 1/2 | In progress | - |
| 11. Visual Polish | 0/2 | Not started | - |
| 12. Session Restore | 0/1 | Not started | - |
