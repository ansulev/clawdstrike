# ClawdStrike Workbench IDE Pivot

## What This Is

ClawdStrike Workbench is a Tauri 2 + React 19 desktop application for security operations — policy authoring, threat simulation, compliance scoring, fleet management, swarm orchestration, and receipt verification. This milestone transforms its UX from a sidebar-nav dashboard into a VS Code/Cursor-like security IDE with activity bar, splittable panes, file tree, and panel system.

## Core Value

Security operators can work across multiple views simultaneously — policy editor beside simulation results, swarm board beside audit log — with a folder-first navigation model and IDE-grade keyboard workflows.

## Requirements

### Validated

- Activity bar + sidebar shell (Phase A foundation work)
- Binary tree pane system with split/close/resize (Phase C foundation work)
- Bottom pane with Terminal, Problems, Output tabs
- 11 Zustand stores with createSelectors pattern
- Command registry with 50+ commands and Cmd+K palette
- Explorer panel with detection project file tree
- Speakeasy Ed25519-signed chat panel
- 19 routable page components (all existing features)
- Multi-policy store decomposition (3 Zustand stores + bridge)

### Active

- [ ] Activity bar (48px icon rail) controlling sidebar panel switching
- [ ] 7+1 sidebar panels (Heartbeat, Sentinels, Findings, Explorer, Library, Fleet, Compliance + Settings)
- [ ] Sidebar panels with click-to-open-as-editor-tab pattern
- [ ] Current routes rendered as "apps" in pane editor tabs
- [ ] Right sidebar zone for Speakeasy chat
- [ ] Lab decomposition into 3 independent apps (Swarm Board, Hunt, Simulator)
- [ ] Navigate commands rewritten to use openApp pattern
- [ ] Audit tail as 4th bottom panel tab

### Out of Scope

- Full VS Code extension API — overkill; MCP plugin is the right model
- Tree-sitter code editor — CodeMirror + schema-aware completions is correct for YAML/Sigma/YARA
- Vim emulation — not needed for security policy editing
- Full file system abstraction — workbench has its own DetectionProject tree
- Database viewer — irrelevant to security policy IDE
- AI chat side panel — ClawdStrike is the security layer, not an agent (Speakeasy is operator chat)

## Context

### Foundation Already Built
The workbench-dev branch (feat/workbench-dev) completed Phase A and C foundation work:
- Zustand migration (11 stores, createSelectors utility)
- Command registry (50+ commands, categories, keybindings, context awareness)
- Binary tree pane system (split/close/focus/resize)
- Bottom pane (Terminal/Problems/Output with Zustand store)
- Multi-policy store decomposition (1846-line monolith → 3 focused stores + bridge)

### Codebase Scale
- 504 total files (380 src + 124 tests)
- 213 workbench components across 27 directories
- 146 lib/workbench utility files
- 19 primary routes, 16+ lazy-loaded pages
- Largest components: Origins (2656 LOC), Hierarchy (2266 LOC), SigmaHQ (1558 LOC)

### Athas Reference
Athas (../athas) is a Tauri 2 + React 19 code editor with battle-tested IDE patterns:
- Activity bar + sidebar switching (sidebar-pane-selector.tsx)
- Binary tree pane system (pane-store.ts, 1036 LOC)
- Extension registry with manifests (extension-registry.ts, 565 LOC)
- Command palette with MRU and categories (command-palette.tsx, 342 LOC)
- Resizable panels with collapse thresholds
- Slice-based Zustand composition (ui-state-store.ts)

### Design System
- shadcn/ui primitives (16 components in components/ui/)
- Tailwind CSS
- Custom animated components (wobble-card, moving-border)
- Monospace typography throughout
- Dark theme (only theme supported)

## Constraints

- **Framework**: Tauri 2 + React 19 + TypeScript — existing stack, no changes
- **State**: Zustand + immer — already migrated, no going back to Context
- **Routing**: HashRouter required for Tauri file:// protocol
- **Terminal**: ghostty-web + PTY — existing integration
- **Graph**: @xyflow/react — existing swarm board integration
- **Editor**: CodeMirror — existing policy editor integration
- **Compatibility**: All 19 existing routes must remain reachable (no functionality loss)
- **Testing**: All existing tests must pass after each phase

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Activity bar + sidebar panels (not redesigned nav) | VS Code model proven; reuses existing sigil icons | — Pending |
| Current routes become "apps" (zero page component changes) | Minimizes risk; pages render in panes instead of full-page | — Pending |
| Sidebar panels are lightweight summaries, not full pages | Full dashboards open as editor tabs; sidebar for glance-and-navigate | — Pending |
| Right sidebar for Speakeasy only (Inspector is stretch) | Speakeasy already exists; Inspector needs context-resolution system | — Pending |
| Lab decomposed into 3 independent apps | Enables side-by-side policy editor + simulation (key use case) | — Pending |
| 2 new Zustand stores only (activity-bar, right-sidebar) | Everything else stays; minimal new state surface | — Pending |

---
*Last updated: 2026-03-17 after IDE pivot initialization*
