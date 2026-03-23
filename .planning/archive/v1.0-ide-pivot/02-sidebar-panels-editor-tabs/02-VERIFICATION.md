---
phase: 02-sidebar-panels-editor-tabs
verified: 2026-03-18T16:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 02: Sidebar Panels + Editor Tabs Verification Report

**Phase Goal:** Each activity bar item reveals a useful sidebar panel, and clicking items in panels opens detail views as editor tabs in the pane system
**Verified:** 2026-03-18
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `paneStore.openApp(route, label)` opens a new tab or focuses existing tab across all panes | ✓ VERIFIED | `pane-store.ts:135-163` — searches all groups, deduplicates, adds to active pane |
| 2   | `paneStore.closeView(paneId, viewId)` removes tab, selects adjacent, falls back to Home if last in only pane | ✓ VERIFIED | `pane-store.ts:166-191` — correct fallback paths: Home reset, closePane, or nextRoot |
| 3   | `paneStore.setActiveView(paneId, viewId)` switches active tab within a pane group | ✓ VERIFIED | `pane-store.ts:194-198` — sets both `activePaneId` and `activeViewId` |
| 4   | PaneTabBar renders all views in a pane group as horizontal tabs with close buttons | ✓ VERIFIED | `pane-tab-bar.tsx:27-34` — maps `pane.views` to `<PaneTab>`, each with close button |
| 5   | Active tab has a 2px gold underline indicator | ✓ VERIFIED | `pane-tab.tsx:58` — `bg-[#d4a84b]` absolute div at bottom of active tab |
| 6   | Default layout opens with a single Home tab | ✓ VERIFIED | `pane-store.ts:33-35,65` — `createInitialRoot()` creates a Home view on init |
| 7   | Pane splitting continues to work with multi-view pane groups | ✓ VERIFIED | `pane-store.ts:83-95` — `splitPane` still works; tests confirm 3 original tests still pass |
| 8   | HeartbeatPanel shows posture ring, stat counts, quick links calling openApp | ✓ VERIFIED | `heartbeat-panel.tsx:151-243` — PostureRing SVG, StatGrid 2x2, 4 QuickLink buttons calling `openApp` |
| 9   | SentinelPanel shows filterable sentinel list grouped by status with status dots, create button, clickable items | ✓ VERIFIED | `sentinel-panel.tsx:52-227` — filter, grouped STATUS_ORDER, dots, `openApp(/sentinels/${id})` |
| 10  | FindingsPanel shows filterable findings list with severity badges and collapsible intel section, clickable items | ✓ VERIFIED | `findings-panel.tsx:42-284` — SEVERITY_COLORS/LABELS_SHORT badges, collapsible INTEL section, `openApp` |
| 11  | Posture derivation logic shared between HomePage and HeartbeatPanel via posture-utils.ts | ✓ VERIFIED | `posture-utils.ts` exports `Posture`, `derivePosture`, `POSTURE_CONFIG`; both `home-page.tsx:26` and `heartbeat-panel.tsx:9` import from it; no inline definitions remain in home-page.tsx |
| 12  | LibraryPanel, FleetPanel, CompliancePanel created with openApp navigation | ✓ VERIFIED | All three files exist and export named components; all call `openApp` |
| 13  | SidebarPanel renders all 7 real panels — no PlaceholderPanel remains | ✓ VERIFIED | `sidebar-panel.tsx:49-66` — switch covers all 7 `ActivityBarItemId` cases; zero `PlaceholderPanel` occurrences in codebase |
| 14  | ExplorerPanel onOpenFile calls openApp (SIDE-06) | ✓ VERIFIED | `sidebar-panel.tsx:33` — `onOpenFile={(file) => { usePaneStore.getState().openApp("/editor", file.name); }}` |
| 15  | Cmd+W closes the active tab in the active pane | ✓ VERIFIED | `view-commands.ts:150-156` — `tab.close` command with `keybinding: "Meta+W"`; `init-commands.tsx:129-136` — `closeActiveTab` wired using `getAllPaneGroups` + `closeView` |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Provided | Status | Details |
| -------- | -------- | ------ | ------- |
| `apps/workbench/src/features/panes/pane-store.ts` | openApp, closeView, setActiveView actions | ✓ VERIFIED | All 3 actions in interface + implementation, imported and used |
| `apps/workbench/src/features/panes/pane-tree.ts` | addViewToGroup, removeViewFromGroup helpers | ✓ VERIFIED | Both exported, used by pane-store.ts at lines 162 and 168 |
| `apps/workbench/src/features/panes/pane-tab-bar.tsx` | PaneTabBar component | ✓ VERIFIED | Exports `PaneTabBar`, `role="tablist"`, renders all views |
| `apps/workbench/src/features/panes/pane-tab.tsx` | PaneTab component with close button | ✓ VERIFIED | Exports `PaneTab`, `role="tab"`, gold underline, close button |
| `apps/workbench/src/features/panes/pane-container.tsx` | Updated container using PaneTabBar | ✓ VERIFIED | Imports and renders `<PaneTabBar>`, has `role="tabpanel"` |
| `apps/workbench/src/features/panes/__tests__/pane-store.test.ts` | Tests for all 3 actions | ✓ VERIFIED | 4 describes (pane-store + openApp + closeView + setActiveView), 13 total tests |
| `apps/workbench/src/features/shared/posture-utils.ts` | Posture type, derivePosture, POSTURE_CONFIG | ✓ VERIFIED | All 3 exported, used by both home-page.tsx and heartbeat-panel.tsx |
| `apps/workbench/src/features/activity-bar/panels/heartbeat-panel.tsx` | HeartbeatPanel component | ✓ VERIFIED | Exports `HeartbeatPanel`, full implementation with stores + posture ring |
| `apps/workbench/src/features/activity-bar/panels/sentinel-panel.tsx` | SentinelPanel component | ✓ VERIFIED | Exports `SentinelPanel`, store-connected, openApp navigation |
| `apps/workbench/src/features/activity-bar/panels/findings-panel.tsx` | FindingsPanel component | ✓ VERIFIED | Exports `FindingsPanel`, store-connected, openApp navigation |
| `apps/workbench/src/features/activity-bar/panels/library-panel.tsx` | LibraryPanel component | ✓ VERIFIED | Exports `LibraryPanel`, POLICY_CATALOG wired, openApp navigation |
| `apps/workbench/src/features/activity-bar/panels/fleet-panel.tsx` | FleetPanel component | ✓ VERIFIED | Exports `FleetPanel`, fleet store wired, Not Connected state |
| `apps/workbench/src/features/activity-bar/panels/compliance-panel.tsx` | CompliancePanel component | ✓ VERIFIED | Exports `CompliancePanel`, MiniScoreRing + scoreFramework wired |
| `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` | SidebarPanel with all real panels | ✓ VERIFIED | Zero PlaceholderPanel, 7-case switch, ExplorerPanel onOpenFile wired |
| `apps/workbench/src/lib/commands/view-commands.ts` | tab.close command | ✓ VERIFIED | `closeActiveTab` dep in interface + registered command |
| `apps/workbench/src/lib/commands/init-commands.tsx` | closeActiveTab wired | ✓ VERIFIED | Lines 129-136 implement closeActiveTab using getAllPaneGroups + closeView |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `pane-store.ts openApp` | `pane-tree.ts addViewToGroup` | tree mutation | ✓ WIRED | `pane-store.ts:162` calls `addViewToGroup(state.root, state.activePaneId, view)` |
| `pane-store.ts closeView` | `pane-tree.ts removeViewFromGroup` | tree mutation | ✓ WIRED | `pane-store.ts:168` calls `removeViewFromGroup(root, paneId, viewId)` |
| `pane-container.tsx` | `pane-tab-bar.tsx PaneTabBar` | component composition | ✓ WIRED | `pane-container.tsx:36` renders `<PaneTabBar pane={pane} active={active} />` |
| `pane-tab-bar.tsx` | `pane-tab.tsx PaneTab` | renders each view | ✓ WIRED | `pane-tab-bar.tsx:28-34` maps views to `<PaneTab>` |
| `heartbeat-panel.tsx` | `posture-utils.ts` | import derivePosture, POSTURE_CONFIG | ✓ WIRED | `heartbeat-panel.tsx:9` imports both, called at line 170 |
| `home-page.tsx` | `posture-utils.ts` | import replaces inline | ✓ WIRED | `home-page.tsx:26` imports from posture-utils; no inline definitions remain |
| `heartbeat-panel.tsx` | `usePaneStore.getState().openApp` | quick link click handlers | ✓ WIRED | `heartbeat-panel.tsx:138` — `QuickLink` calls `openApp(route, label)` on click |
| `sentinel-panel.tsx` | `useSentinelStore.use.sentinels` | store subscription | ✓ WIRED | `sentinel-panel.tsx:53` — `useSentinelStore.use.sentinels()` |
| `findings-panel.tsx` | `useFindingStore.use.findings` | store subscription | ✓ WIRED | `findings-panel.tsx:43` — `useFindingStore.use.findings()` |
| `sidebar-panel.tsx` | All 7 panel components | switch on activeItem | ✓ WIRED | Lines 51-65 — all 7 cases present, zero PlaceholderPanel |
| `sidebar-panel.tsx ExplorerPanelConnected` | `usePaneStore.getState().openApp` | onOpenFile callback | ✓ WIRED | `sidebar-panel.tsx:33` — `openApp("/editor", file.name)` |
| `library-panel.tsx` | `POLICY_CATALOG` | static data import | ✓ WIRED | `library-panel.tsx:11` imports `POLICY_CATALOG`, used for filtering and rendering |
| `fleet-panel.tsx` | `useFleetConnectionStore.use` | store subscription | ✓ WIRED | Lines 42-44 — connection, agents, error all subscribed |
| `compliance-panel.tsx` | `MiniScoreRing, scoreFramework` | component and function imports | ✓ WIRED | Lines 6,8 — both imported; MiniScoreRing used at line 123, scoreFramework at line 42 |
| `view-commands.ts` | `usePaneStore.getState().closeView` | tab.close command | ✓ WIRED | `init-commands.tsx:134` — `usePaneStore.getState().closeView(activePaneId, activePane.activeViewId)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SIDE-01 | 02-03 | Sidebar renders panel for active activity bar item | ✓ SATISFIED | `sidebar-panel.tsx:49-66` — 7-case switch on `ActivityBarItemId` |
| SIDE-02 | 02-03 | Sidebar is resizable with drag handle and collapse threshold | ✓ SATISFIED | `sidebar-panel.tsx:82-84` — `width: sidebarVisible ? sidebarWidth : 0` using activity-bar-store (implemented Phase 1, verified still present) |
| SIDE-03 | 02-02 | HeartbeatPanel shows system status (posture ring, counts, quick links) | ✓ SATISFIED | `heartbeat-panel.tsx` — PostureRing SVG + StatGrid 2x2 + 4 QuickLinks |
| SIDE-04 | 02-02 | SentinelPanel shows filterable sentinel list with status dots and create button | ✓ SATISFIED | `sentinel-panel.tsx` — filter input, STATUS_ORDER grouping, status dots, `[+]` create button |
| SIDE-05 | 02-02 | FindingsPanel shows findings list with severity badges and intel section | ✓ SATISFIED | `findings-panel.tsx` — SEVERITY_COLORS/LABELS_SHORT badges, dashed divider, INTEL collapsible |
| SIDE-06 | 02-03 | ExplorerPanel onOpenFile opens files as editor tabs | ✓ SATISFIED | `sidebar-panel.tsx:33` — `openApp("/editor", file.name)` |
| SIDE-07 | 02-03 | LibraryPanel shows policy catalog browser | ✓ SATISFIED | `library-panel.tsx` — POLICY_CATALOG grouped by category, shield icons, filter |
| SIDE-08 | 02-03 | FleetPanel shows connection status, agent summary list, topology link | ✓ SATISFIED | `fleet-panel.tsx` — connection dot, agent list with health dots, topology link |
| SIDE-09 | 02-03 | CompliancePanel shows framework selector and compliance score summary | ✓ SATISFIED | `compliance-panel.tsx` — MiniScoreRing pills, score bars, overall footer |
| SIDE-10 | 02-03 | Clicking items in sidebar panels opens detail views via openApp | ✓ SATISFIED | All 6 real panels call `usePaneStore.getState().openApp(...)` on item click; 11 total openApp usages found in activity-bar/ |
| PANE-01 | 02-01, 02-03 | paneStore gains openApp(route, label) | ✓ SATISFIED | `pane-store.ts:57,135-163` — interface declaration + full implementation |
| PANE-02 | 02-01, 02-03 | All routes render correctly as pane tabs | ✓ SATISFIED | `pane-route-renderer.tsx` handles route rendering; 7 sidebar panels cover all app navigation paths via openApp; original `syncRoute` still works |
| PANE-03 | 02-01 | PaneTabBar shows view tabs with close button per tab | ✓ SATISFIED | `pane-tab-bar.tsx` + `pane-tab.tsx` — full tab strip with per-tab close button (IconX) |
| PANE-04 | 02-01 | Default layout opens Home tab on app launch | ✓ SATISFIED | `pane-store.ts:65` — `const initialRoot = createInitialRoot()` creates Home view at module level |
| PANE-05 | 02-01 | Pane splitting continues to work for all app types | ✓ SATISFIED | `pane-store.ts:83-95` — `splitPane` unchanged; PaneTabBar has split buttons; 3 original tests pass |

**All 15 Phase 2 requirements (SIDE-01 through SIDE-10, PANE-01 through PANE-05) are accounted for and satisfied.**

No orphaned requirements detected — all Phase 2 IDs from REQUIREMENTS.md traceability table appear in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `heartbeat-panel.tsx` | 40 | `return null` in PostureRing inner component | ℹ️ Info | Legitimate guard: returns null only when POSTURE_CONFIG lookup fails (impossible with valid enum values) |
| `pane-container.tsx` | 19 | `return null` | ℹ️ Info | Legitimate guard: only when `activeView` is null (empty pane group, transient state) |
| `sentinel-panel.tsx` | 125,127 | `placeholder=` in input | ℹ️ Info | HTML input attribute, not a code stub |
| `findings-panel.tsx` | 125,127 | `placeholder=` in input | ℹ️ Info | HTML input attribute, not a code stub |
| `library-panel.tsx` | 112,114 | `placeholder=` in input | ℹ️ Info | HTML input attribute, not a code stub |

No blockers or warnings found. All flagged occurrences are legitimate implementation patterns.

### Human Verification Required

#### 1. Sidebar Panel Switching

**Test:** Click each of the 7 activity bar icons (Heartbeat, Sentinels, Findings, Explorer, Library, Fleet, Compliance)
**Expected:** Each click shows the correct panel content in the sidebar; no blank panels or error states
**Why human:** Visual panel switching behavior cannot be verified without running the app

#### 2. Tab Open From Sidebar Panel Click

**Test:** With sentinels in store, click a sentinel name in SentinelPanel
**Expected:** An editor tab opens in the pane area with the correct route label; PaneTabBar shows the new tab
**Why human:** End-to-end interaction (click → openApp → tab render) requires live app

#### 3. Cmd+W Tab Close

**Test:** Open a second tab, make it active, press Cmd+W
**Expected:** Active tab closes, focus moves to adjacent tab; if last tab, resets to Home
**Why human:** Keyboard shortcut registration and event handling requires live app

#### 4. Active Tab Gold Underline

**Test:** Open multiple tabs and click between them
**Expected:** The active tab has a 2px gold (#d4a84b) line at its bottom edge; inactive tabs do not
**Why human:** Visual CSS rendering requires live app

#### 5. Pane Split With Multiple Tabs

**Test:** Open 2 tabs, then split the pane vertically
**Expected:** Split creates a new pane with a clone of the current active view; both panes show tab bars
**Why human:** Complex visual layout interaction requires live app

### Gaps Summary

No gaps. All phase 2 must-haves are verified as present, substantive, and wired.

---

**Commit verification:** All 7 task commits from summaries confirmed present in git log:
- `f3a264193` — test(02-01): failing tests RED phase
- `fd1723e0b` — feat(02-01): openApp, closeView, setActiveView + tree helpers
- `f50740947` — feat(02-01): PaneTabBar, PaneTab, PaneContainer update
- `0acc6cfe6` — feat(02-02): posture-utils + HeartbeatPanel
- `b1b61ec3f` — feat(02-02): SentinelPanel + FindingsPanel
- `2b258f0d1` — feat(02-03): LibraryPanel, FleetPanel, CompliancePanel, MiniScoreRing export
- `584c201c6` — feat(02-03): SidebarPanel integration, onOpenFile wiring, tab.close command

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
