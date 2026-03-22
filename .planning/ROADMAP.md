# Roadmap: ClawdStrike Workbench v1.4 — Cleanup & Store Migration

## Overview

Eliminate tech debt accumulated during v1.0-v1.3 rapid development. Fix broken tests, resolve input/terminal bugs, modernize legacy command wiring, and complete the multi-policy-store decomposition by migrating all consumers to direct Zustand store calls and deleting the 975-line bridge layer.

**Prior milestones:**
- v1.0: IDE shell (activity bar, panes, sidebar panels, commands)
- v1.1: IDE completeness (search, nav, file tree, editor, session restore, detection integration)
- v1.2: Explorer polish (icons, filters, indent guides, context menus)
- v1.3: Live features (fleet SSE, swarm board, intel pipeline, gap closure)

## Phases

- [ ] **Phase 15: Test Fixes** - Fix 3 broken test suites (App, desktop-layout, shortcut-provider)
- [ ] **Phase 16: Search, Terminal & Keybinding Fixes** - AbortController for search, dynamic terminal sizing, Meta+W conflict resolution
- [ ] **Phase 17: Command Modernization & Store Migration** - Modernize file.new, migrate ~20 components off bridge hooks, delete multi-policy-store

## Phase Details

### Phase 15: Test Fixes
**Goal**: All existing test suites pass without manual intervention
**Depends on**: Nothing (independent cleanup)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. `npm test` (or equivalent test runner) passes with zero failures across App.test, desktop-layout.test, and shortcut-provider.test
  2. App.test.tsx renders without "ActivityBar is not defined" or similar mock errors
  3. desktop-layout.test.tsx assertions match the current component tree (ActivityBar + SidebarPanel, not stale DesktopSidebar)
**Plans**: TBD

### Phase 16: Search, Terminal & Keybinding Fixes
**Goal**: Search, terminal, and keyboard shortcuts behave correctly under real usage conditions
**Depends on**: Nothing (independent of Phase 15)
**Requirements**: SRCH-06, SRCH-07, TERM-03, KEY-01
**Success Criteria** (what must be TRUE):
  1. Typing rapidly in global search shows only the results for the final query (no stale results flash or persist)
  2. Terminal panel resizes to fill its container when the bottom panel is dragged taller or the window is resized (no hardcoded dimensions)
  3. Pressing Meta+W closes the active editor tab (or active pane if no tabs) with a single, predictable behavior -- no conflict dialog or double-close
  4. Cancelling a search mid-flight (by clearing the query or typing a new one) does not leave a pending spinner
**Plans**: TBD

### Phase 17: Command Modernization & Store Migration
**Goal**: All components use direct Zustand store calls and the multi-policy-store bridge layer is deleted
**Depends on**: Phase 15 (tests must pass before large refactor to catch regressions)
**Requirements**: CMD-01, CMD-02, STORE-01, STORE-02, STORE-03, STORE-04, STORE-05
**Success Criteria** (what must be TRUE):
  1. Cmd+N (file.new) creates a new tab via usePolicyTabsStore.newTab() -- no newPolicy callback in the command registration
  2. FileCommandDeps interface has no newPolicy field
  3. split-editor.tsx and editor-home-tab.tsx import from policy-tabs-store/policy-edit-store directly (no useMultiPolicy)
  4. Searching the codebase for "useMultiPolicy" and "useWorkbench" returns zero consumer call sites (only the deleted file itself)
  5. multi-policy-store.tsx and MultiPolicyProvider are deleted from the source tree
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Test Fixes | 0/TBD | Not started | - |
| 16. Search, Terminal & Keybinding Fixes | 0/TBD | Not started | - |
| 17. Command Modernization & Store Migration | 0/TBD | Not started | - |
