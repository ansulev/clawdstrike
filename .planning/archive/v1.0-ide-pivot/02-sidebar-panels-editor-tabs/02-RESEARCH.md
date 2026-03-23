# Phase 02: Sidebar Panels + Editor Tabs - Research

**Researched:** 2026-03-18
**Domain:** React/Zustand sidebar panel UI + pane/tab system enhancement
**Confidence:** HIGH

## Summary

Phase 2 builds on the Phase 1 activity bar shell by (a) replacing the six `PlaceholderPanel` stubs with real sidebar panels that read from existing Zustand stores, and (b) enhancing the pane system to support multi-tab editor tabs with `openApp`/`closeView`/`setActiveView` actions. The codebase is well-structured for this work: all data stores exist with `createSelectors` patterns, the pane tree already supports `PaneGroup.views[]` arrays with `activeViewId`, and the `ExplorerPanel` provides a battle-tested pattern for sidebar panel structure (header, filter, scroll area, footer).

The primary technical risk is in the pane store enhancement: the current `syncRoute` method replaces the active view's route in-place rather than adding new views. The new `openApp` action must search across ALL pane groups for an existing matching route before adding a tab, requiring a tree traversal. The `closeView` action must handle edge cases: closing the last view in a pane, selecting an adjacent tab, and the fallback to Home when all tabs are exhausted.

**Primary recommendation:** Implement in three plans: (1) pane store enhancements + PaneTabBar, (2) sidebar panels 1-4 (Heartbeat, Sentinel, Findings, Explorer wiring), (3) sidebar panels 5-7 (Library, Fleet, Compliance) + integration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIDE-01 | Sidebar renders panel for active activity bar item | SidebarPanel switch statement replacement; PANEL_TITLES already exists |
| SIDE-02 | Sidebar resizable with drag handle and collapse threshold | SidebarResizeHandle already exists from Phase 1; no new work unless UI-SPEC adds constraints |
| SIDE-03 | HeartbeatPanel: posture ring, counts, quick links | `derivePosture` + `POSTURE_CONFIG` extractable from home-page.tsx; stores: sentinelStore, findingStore, fleetConnectionStore, multiPolicy |
| SIDE-04 | SentinelPanel: filterable sentinel list with status dots | `useSentinelStore.use.sentinels()` provides Sentinel[] with `.status` (active/paused/retired) |
| SIDE-05 | FindingsPanel: findings with severity badges + intel section | `useFindingStore.use.findings()` for findings; `useIntelStore.use.localIntel()` + `.swarmIntel` for intel |
| SIDE-06 | ExplorerPanel integrated as sidebar panel | Already done in Phase 1; enhancement: wire `onOpenFile` to `paneStore.openApp()` |
| SIDE-07 | LibraryPanel: policy catalog browser | `POLICY_CATALOG` from policy-catalog.ts; `CatalogEntry` type with id, name, category, tags |
| SIDE-08 | FleetPanel: connection status, agent list, topology link | `useFleetConnectionStore`: `.connection` (connected, hushdHealth, agentCount), `.agents` (AgentInfo[]) |
| SIDE-09 | CompliancePanel: framework selector + score summary | `COMPLIANCE_FRAMEWORKS` from compliance-requirements.ts; `scoreFramework()` + `MiniScoreRing` from framework-selector.tsx |
| SIDE-10 | Panel items open detail views as editor tabs | All panels call `paneStore.openApp(route, label)` on item click |
| PANE-01 | paneStore.openApp(route, label) opens/focuses tabs | New action: search all groups, focus existing or add new; uses normalizeWorkbenchRoute + getWorkbenchRouteLabel |
| PANE-02 | All 19 routes render as pane tabs | WORKBENCH_ROUTE_OBJECTS has 19 primary routes; PaneRouteRenderer already renders any route |
| PANE-03 | PaneTabBar with close buttons | New component replacing PaneContainer header; renders PaneGroup.views[] as horizontal tabs |
| PANE-04 | Default Home tab on launch | Already exists: createInitialRoot() creates PaneGroup with /home view |
| PANE-05 | Pane splitting works for all app types | Already works: splitPane creates sibling with same view; no changes needed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Already in use, project standard |
| Zustand | 5.x | State management | All 11+ stores use this; `create` + `immer` + `createSelectors` pattern |
| motion/react | 12.x | Animation | Already used for pane content transitions, posture ring; imported as `motion/react` |
| @tabler/icons-react | 3.x | Utility icons | Used throughout (IconSearch, IconRefresh, IconPlus, IconX, etc.) |
| react-router-dom | 6.x | Route rendering | `useRoutes` in PaneRouteRenderer; `WORKBENCH_ROUTE_OBJECTS` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority (cva) | 0.7.x | Component variants | When creating button/badge variants (severity badges, status pills) |
| @/lib/utils (cn) | internal | className merging | All conditional class composition |
| @/components/ui/scroll-area | internal | ScrollArea component | All sidebar panel list content |
| zustand/middleware/immer | bundled | Immutable state updates | All store mutations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tab bar | react-tabs / headless-ui tabs | Custom is correct here -- need deep integration with pane store tree |
| Panel filtering in component | Separate filter store | Overkill -- local useState for filter text within each panel |

## Architecture Patterns

### Recommended Project Structure
```
src/features/
  activity-bar/
    panels/
      heartbeat-panel.tsx       # NEW (SIDE-03)
      sentinel-panel.tsx        # NEW (SIDE-04)
      findings-panel.tsx        # NEW (SIDE-05)
      library-panel.tsx         # NEW (SIDE-07)
      fleet-panel.tsx           # NEW (SIDE-08)
      compliance-panel.tsx      # NEW (SIDE-09)
    components/
      sidebar-panel.tsx         # MODIFY: replace PlaceholderPanel with real panels
      activity-bar.tsx          # UNCHANGED
      activity-bar-item.tsx     # UNCHANGED
      sidebar-resize-handle.tsx # UNCHANGED
    stores/
      activity-bar-store.ts     # UNCHANGED
    types.ts                    # UNCHANGED
  panes/
    pane-store.ts               # MODIFY: add openApp, closeView, setActiveView
    pane-tree.ts                # MODIFY: add addViewToGroup, removeViewFromGroup helpers
    pane-container.tsx          # MODIFY: replace header with PaneTabBar
    pane-tab-bar.tsx            # NEW (PANE-03)
    pane-tab.tsx                # NEW (PANE-03)
    pane-types.ts               # UNCHANGED (views[] + activeViewId already exist)
    pane-root.tsx               # UNCHANGED
    pane-route-renderer.tsx     # UNCHANGED
    __tests__/
      pane-store.test.ts        # MODIFY: add tests for openApp, closeView, setActiveView
  shared/
    posture-utils.ts            # NEW: extract derivePosture + POSTURE_CONFIG from home-page.tsx
```

### Pattern 1: Sidebar Panel Data Wiring
**What:** Each sidebar panel component reads directly from existing Zustand stores using `createSelectors` `.use` pattern. No new stores needed.
**When to use:** All seven sidebar panels.
**Example:**
```typescript
// Source: existing sentinel-store.tsx createSelectors pattern
function SentinelPanel() {
  const sentinels = useSentinelStore.use.sentinels();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return sentinels;
    const lower = filter.toLowerCase();
    return sentinels.filter(s => s.name.toLowerCase().includes(lower));
  }, [sentinels, filter]);

  const grouped = useMemo(() => groupByStatus(filtered), [filtered]);
  // ... render
}
```

### Pattern 2: Panel-to-Tab Navigation via openApp
**What:** All sidebar panel items call `usePaneStore.getState().openApp(route, label)` to open detail views. This is a fire-and-forget action -- panels never manage tab state.
**When to use:** Every clickable item in every sidebar panel.
**Example:**
```typescript
// Source: UI-SPEC interaction table
<button onClick={() => usePaneStore.getState().openApp(`/sentinels/${sentinel.id}`, sentinel.name)}>
  {sentinel.name}
</button>
```

### Pattern 3: Pane Store Tree Operations (Immutable)
**What:** All pane store mutations use the `replaceNode` tree traversal pattern from pane-tree.ts to produce new immutable tree nodes.
**When to use:** openApp (add view to group), closeView (remove view from group), setActiveView (change activeViewId).
**Example:**
```typescript
// Source: pane-tree.ts existing replaceNode pattern
export function addViewToGroup(root: PaneNode, paneId: string, view: PaneView): PaneNode {
  return replaceNode(root, paneId, (node) =>
    node.type === "group"
      ? { ...node, views: [...node.views, view], activeViewId: view.id }
      : node,
  );
}
```

### Pattern 4: Shared Panel Structure
**What:** All panels follow the ExplorerPanel layout: section header, optional filter input, ScrollArea content, footer status line.
**When to use:** All new panel components.
**Example:**
```typescript
// Source: explorer-panel.tsx structure
<div className="flex flex-col h-full">
  {/* Section header with label + toolbar */}
  <div className="shrink-0 px-3 py-2.5 border-b border-[#2d3240]">
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-[#6f7f9a]">LABEL</span>
      {/* toolbar icons */}
    </div>
    {/* filter input */}
  </div>

  {/* Scrollable content */}
  <ScrollArea className="flex-1">
    {/* list items */}
  </ScrollArea>

  {/* Footer */}
  <div className="shrink-0 px-3 py-1.5 border-t border-[#2d3240]">
    <span className="text-[9px] font-mono text-[#6f7f9a]/40">N items</span>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Accessing paneStore inside render:** Use `usePaneStore.getState().openApp()` in click handlers, not `usePaneStore((s) => s.openApp)` which would cause unnecessary re-renders.
- **Creating new Zustand stores for panel state:** Filter text is local component state (useState), not store state. Group collapse state is also local.
- **Duplicating posture derivation logic:** Extract `derivePosture` + `POSTURE_CONFIG` to a shared utility rather than copying from home-page.tsx.
- **Passing paneStore as prop:** All panels access `usePaneStore.getState()` directly for navigation -- there is no prop-drilling pattern in this codebase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll virtualization | Custom virtual list | ScrollArea (existing) | Sidebar lists are small (< 100 items typically); virtualization adds complexity for no benefit |
| Compliance scoring | Custom score calculator | `scoreFramework()` from compliance-requirements.ts | Already handles all framework/guard logic |
| Severity colors/labels | Hardcoded color values | `SEVERITY_COLORS`, `SEVERITY_LABELS_SHORT`, `STATUS_CONFIG` from finding-constants.ts | Single source of truth, already used everywhere |
| Score ring component | New SVG ring | `MiniScoreRing` from framework-selector.tsx | Already exists, sized for compact display |
| Route normalization | Custom route parsing | `normalizeWorkbenchRoute()` + `getWorkbenchRouteLabel()` from workbench-routes.tsx | Handles all 19 routes + aliases + query params |
| Posture derivation | Inline posture logic | Extract `derivePosture` + `POSTURE_CONFIG` from home-page.tsx | Already proven correct; needs extraction to shared utility |
| Policy catalog data | Custom catalog loading | `POLICY_CATALOG` from policy-catalog.ts + `CatalogEntry` type | Full catalog with metadata already exists |

**Key insight:** Phase 2 is a UI composition phase -- nearly all business logic already exists in stores and utilities. The work is in wiring stores to compact sidebar views and adding the tab management layer to the pane system.

## Common Pitfalls

### Pitfall 1: syncRoute vs openApp Confusion
**What goes wrong:** The existing `syncRoute` method REPLACES the current view's route. If implementers use `syncRoute` for "open as new tab" they will clobber the current tab instead of adding a new one.
**Why it happens:** `syncRoute` was designed for the single-view-per-pane model. It calls `setPaneActiveRoute` which finds the active view and overwrites its route.
**How to avoid:** `openApp` is a NEW action with different semantics: search-first, then add-if-not-found. Never reuse syncRoute logic for openApp.
**Warning signs:** If opening a finding from the sidebar replaces the Home tab instead of adding a new tab, syncRoute is being used instead of openApp.

### Pitfall 2: Tab Deduplication by Normalized Route
**What goes wrong:** Opening `/sentinels/abc` and `/sentinels/abc` creates two tabs instead of focusing the existing one.
**Why it happens:** Route comparison without normalization, or comparing un-normalized routes.
**How to avoid:** Always normalize routes with `normalizeWorkbenchRoute()` before comparing. The openApp action's search loop must compare normalized routes.
**Warning signs:** Duplicate tabs appearing for the same content.

### Pitfall 3: Closing Last View Fallback
**What goes wrong:** Closing the last tab in the only remaining pane leaves an empty/broken UI.
**Why it happens:** closeView removes the view, then sees zero views, calls closePane, but closePane on the root group returns null, which resets to a new Home group. The intermediate state can flash.
**How to avoid:** Per UI-SPEC: "If it's the only pane, open Home tab as fallback." Implement this as a special case: if views.length would become 0 AND this is the only pane group, replace the view array with `[homeView]` instead of removing and resetting.
**Warning signs:** Brief flash of empty UI when closing the last tab.

### Pitfall 4: Stale Panel Data After Store Update
**What goes wrong:** A sidebar panel shows stale data because it reads from a selector that doesn't update.
**Why it happens:** Using derived data in useMemo without including the right dependencies, or subscribing to the wrong store slice.
**How to avoid:** Use `useSentinelStore.use.sentinels()` (createSelectors pattern) which auto-subscribes to the `sentinels` key. Filter logic in useMemo should depend on `[sentinels, filter]`.
**Warning signs:** Panel list doesn't update when a sentinel is created/deleted in the detail view.

### Pitfall 5: PaneTabBar Re-renders on Every Store Change
**What goes wrong:** The PaneTabBar re-renders when ANY pane state changes (e.g., resizing a split).
**Why it happens:** Subscribing to `usePaneStore(state => state.root)` instead of scoping to the specific PaneGroup.
**How to avoid:** PaneContainer already receives its `pane: PaneGroup` as a prop. Pass `pane.views` and `pane.activeViewId` to PaneTabBar as props rather than having PaneTabBar subscribe to the store directly.
**Warning signs:** Lag when dragging pane resize handles.

### Pitfall 6: Approval Count Source
**What goes wrong:** The HeartbeatPanel needs an "Approvals" count, but there is no dedicated approval store.
**Why it happens:** Approvals are fetched from the fleet connection (hushd API) in the ApprovalQueue component, not from a persistent Zustand store.
**How to avoid:** For Phase 2, show a static "---" or derive from a simple fleet API call. Or make the approvals stat a link that opens the approval queue. The UI-SPEC shows stat counts: sentinels, findings, approvals, fleet. For approvals, consider showing "?" with a click-to-open pattern since there is no local store tracking pending approval count.
**Warning signs:** Approval count always showing 0 or causing an API fetch on every sidebar panel switch.

## Code Examples

### openApp Implementation Pattern
```typescript
// Source: derived from pane-store.ts architecture + UI-SPEC behavioral requirements
openApp: (route, label) => {
  const normalized = normalizeWorkbenchRoute(route);
  const resolvedLabel = label ?? getWorkbenchRouteLabel(normalized);
  const { root, activePaneId } = get();

  // 1. Search ALL pane groups for existing view with same route
  const allGroups = getAllPaneGroups(root);
  for (const group of allGroups) {
    const existing = group.views.find(v => normalizeWorkbenchRoute(v.route) === normalized);
    if (existing) {
      set({
        activePaneId: group.id,
        root: setActivePaneView(root, group.id, existing.id),
      });
      return;
    }
  }

  // 2. Not found: add new view to active pane
  const newView: PaneView = {
    id: crypto.randomUUID(),
    route: normalized,
    label: resolvedLabel,
  };
  set((state) => ({
    root: addViewToGroup(state.root, state.activePaneId, newView),
  }));
},
```

### closeView Implementation Pattern
```typescript
// Source: derived from pane-tree.ts replaceNode pattern + UI-SPEC close behavior
closeView: (paneId, viewId) => {
  const { root } = get();
  const group = findPaneGroup(root, paneId);
  if (!group) return;

  const nextViews = group.views.filter(v => v.id !== viewId);

  // If no views left: special handling
  if (nextViews.length === 0) {
    const allGroups = getAllPaneGroups(root);
    if (allGroups.length === 1) {
      // Only pane: reset to Home
      const homeView = createPaneView("/home");
      set((state) => ({
        root: replaceNode(state.root, paneId, () => ({
          ...group,
          views: [homeView],
          activeViewId: homeView.id,
        })),
      }));
    } else {
      // Multiple panes: close this pane entirely
      get().closePane(paneId);
    }
    return;
  }

  // Pick next active: prefer right neighbor, fall back to left
  let nextActiveId = group.activeViewId;
  if (viewId === group.activeViewId) {
    const closedIdx = group.views.findIndex(v => v.id === viewId);
    nextActiveId = nextViews[Math.min(closedIdx, nextViews.length - 1)]?.id ?? null;
  }

  set((state) => ({
    root: replaceNode(state.root, paneId, () => ({
      ...group,
      views: nextViews,
      activeViewId: nextActiveId,
    })),
  }));
},
```

### Sidebar Panel List Item Pattern
```typescript
// Source: explorer-panel.tsx list item + UI-SPEC sidebar list item spec
function SidebarListItem({
  label,
  secondaryText,
  statusDot,
  onClick,
  isActive,
}: {
  label: string;
  secondaryText?: string;
  statusDot?: { color: string };
  onClick: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full h-8 px-3 text-left transition-colors relative",
        isActive ? "bg-[#131721]/60" : "hover:bg-[#131721]/40",
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#d4a84b] rounded-r" />
      )}
      {statusDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: statusDot.color }}
          aria-hidden="true"
        />
      )}
      <span className="text-[11px] font-mono text-[#ece7dc]/70 truncate flex-1">
        {label}
      </span>
      {secondaryText && (
        <span className="text-[9px] font-mono text-[#6f7f9a] shrink-0">
          {secondaryText}
        </span>
      )}
    </button>
  );
}
```

### PaneTabBar Pattern
```typescript
// Source: UI-SPEC PaneTabBar section + pane-container.tsx header being replaced
function PaneTabBar({
  pane,
  active,
}: {
  pane: PaneGroup;
  active: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Open editors"
      aria-orientation="horizontal"
      className="flex items-center h-[36px] bg-[#0b0d13] border-b border-[#202531] overflow-x-auto scrollbar-hide"
    >
      <div className="flex items-center min-w-0 flex-1">
        {pane.views.map((view) => (
          <PaneTab
            key={view.id}
            view={view}
            isActive={view.id === pane.activeViewId}
            paneId={pane.id}
          />
        ))}
      </div>
      {/* Split buttons on right side */}
      <div className="flex items-center gap-1 px-2 shrink-0">
        {/* ... split vertical/horizontal buttons ... */}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single view per pane | Multi-tab views per pane | Phase 2 (now) | PaneGroup.views[] already supports arrays; store just needs new actions |
| PlaceholderPanel stubs | Real panel components | Phase 2 (now) | SidebarPanel switches from placeholder to live store-connected panels |
| syncRoute (replace) | openApp (search + add) | Phase 2 (now) | New navigation paradigm: tabs accumulate rather than replace |
| Link-based navigation | paneStore.openApp() | Phase 2 (now) | All sidebar clicks call store actions instead of `<Link to={}>` |

**Deprecated/outdated:**
- `syncRoute`: Should NOT be used for opening new tabs. It remains useful only for URL-bar sync (if any). All sidebar/command navigation should use `openApp`.
- `PlaceholderPanel`: Will be removed entirely in Phase 2.

## Data Source Map

### Store-to-Panel Mapping (HIGH confidence -- verified by reading source code)

| Panel | Store(s) | Key Selectors / Fields | Notes |
|-------|----------|------------------------|-------|
| HeartbeatPanel | `useSentinelStore`, `useFindingStore`, `useFleetConnectionStore`, `useMultiPolicy` (via `useWorkbench`) | `.sentinels.length`, `.findings.length`, `.connection.connected`, `.connection.agentCount`, `activePolicy.guards` | Posture derivation uses `derivePosture()` -- extract from home-page.tsx |
| SentinelPanel | `useSentinelStore` | `.sentinels` (Sentinel[]: id, name, status, mode) | Status: "active" / "paused" / "retired" |
| FindingsPanel | `useFindingStore`, `useIntelStore` | `.findings` (Finding[]: id, title, status, severity), `.localIntel` + `.swarmIntel` | Intel has type, title, shareability |
| ExplorerPanel | `useProjectStore` | `.project`, `.filter`, `.formatFilter`, `.actions` | Already wired in Phase 1 |
| LibraryPanel | Static data: `POLICY_CATALOG` + optional fleet-sourced catalog | CatalogEntry[]: id, name, category, tags | Consider importing from `@/features/policy/policy-catalog` |
| FleetPanel | `useFleetConnectionStore` | `.connection` (connected, hushdUrl, hushdHealth, agentCount), `.agents` (AgentInfo[]: endpoint_agent_id, online, posture, daemon_version, seconds_since_heartbeat) | AgentInfo has `online` boolean, `seconds_since_heartbeat` |
| CompliancePanel | `useMultiPolicy` (via `useWorkbench`), `COMPLIANCE_FRAMEWORKS`, `scoreFramework()` | `state.activePolicy.guards`, `state.activePolicy.settings` + framework scoring | `scoreFramework(fwId, guards, settings)` returns `{ score, met, gaps }` |

### Route Map (HIGH confidence -- verified from workbench-routes.tsx)

All 19 primary routes that must render as pane tabs:

| # | Route | Label | Component |
|---|-------|-------|-----------|
| 1 | /home | Home | HomePage |
| 2 | /editor | Editor | PolicyEditor |
| 3 | /compliance | Compliance | ComplianceDashboard |
| 4 | /receipts | Receipts | ReceiptInspector |
| 5 | /library | Library | LibraryGallery |
| 6 | /settings | Settings | SettingsPage |
| 7 | /approvals | Approvals | ApprovalQueue |
| 8 | /fleet | Fleet | FleetDashboard |
| 9 | /audit | Audit | AuditLog |
| 10 | /sentinels | Sentinels | SentinelsPage |
| 11 | /sentinels/create | New Sentinel | SentinelCreatePage |
| 12 | /sentinels/:id | Sentinel | SentinelDetailPage |
| 13 | /findings | Findings | FindingsPage |
| 14 | /findings/:id | Finding | FindingDetailPage |
| 15 | /intel/:id | Intel | IntelDetailPage |
| 16 | /missions | Mission Control | MissionControlPage |
| 17 | /swarms | Swarms | SwarmPage |
| 18 | /swarms/:id | Swarm | SwarmDetail |
| 19 | /lab | Lab | LabLayout |
| 20 | /topology | Topology | TopologyLayout |

Note: Routes 19-20 bring the total to 20+ when counting sub-routes (/lab?tab=hunt, /topology?tab=delegation etc.), but normalizeWorkbenchRoute maps aliases to canonical routes, so the distinct renderable routes are approximately 20.

## Existing Code to Extract/Reuse

### Must Extract to Shared Utility

| Code | Source File | Target | Reason |
|------|------------|--------|--------|
| `derivePosture()` function | `home-page.tsx` (lines 34-43) | `src/features/shared/posture-utils.ts` | Used by both HomePage and HeartbeatPanel |
| `POSTURE_CONFIG` constant | `home-page.tsx` (lines 46-81) | `src/features/shared/posture-utils.ts` | Color/label/glow config shared between views |
| `Posture` type | `home-page.tsx` (line 32) | `src/features/shared/posture-utils.ts` | Type export for consumers |

### Must Import Directly (No Extraction Needed)

| Code | Source | Used By |
|------|--------|---------|
| `SEVERITY_COLORS`, `SEVERITY_LABELS_SHORT`, `STATUS_CONFIG` | `finding-constants.ts` | FindingsPanel severity badges |
| `MiniScoreRing` | `framework-selector.tsx` | CompliancePanel (must export if not already) |
| `COMPLIANCE_FRAMEWORKS`, `scoreFramework()` | `compliance-requirements.ts` | CompliancePanel scoring |
| `POLICY_CATALOG` | `policy-catalog.ts` | LibraryPanel catalog list |
| `normalizeWorkbenchRoute`, `getWorkbenchRouteLabel` | `workbench-routes.tsx` | pane-store.ts openApp |
| `ScrollArea` | `@/components/ui/scroll-area` | All new panels |
| Tabler icons | `@tabler/icons-react` | Panel toolbars (IconSearch, IconRefresh, IconPlus, IconX, IconServer, etc.) |

### MiniScoreRing Export Check

The `MiniScoreRing` component in `framework-selector.tsx` is currently defined as a private function (not exported). It needs to be exported for CompliancePanel reuse, or the component needs to be extracted to a shared location.

## Open Questions

1. **Approval count data source**
   - What we know: There is no Zustand store for approvals. The ApprovalQueue component fetches from the fleet API.
   - What's unclear: Where to get a pending approval count for the HeartbeatPanel stat grid.
   - Recommendation: Show "---" or omit the approval count stat, replacing it with a different metric (e.g., "Editor tabs" like HomePage does). Or show a static link "Approvals" with a chevron that opens the queue. The UI-SPEC says "approval count from approval store" but no such store exists. Use a click-through pattern.

2. **LibraryPanel data: local vs remote catalog**
   - What we know: `POLICY_CATALOG` is a static array of built-in templates. The `catalog-browser.tsx` also supports fetching remote catalog templates from fleet API.
   - What's unclear: Whether LibraryPanel should show only local catalog or also remote.
   - Recommendation: Start with local `POLICY_CATALOG` only. Remote catalog can be added when fleet is connected. This keeps the panel fast and offline-capable.

3. **MiniScoreRing export status**
   - What we know: MiniScoreRing is defined inside framework-selector.tsx as a module-private function.
   - What's unclear: Whether to export it from there or extract to a shared location.
   - Recommendation: Export from framework-selector.tsx (minimal change). If more consumers emerge later, extract then.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + jsdom |
| Config file | `apps/workbench/vitest.config.ts` |
| Quick run command | `cd apps/workbench && npx vitest run src/features/panes/__tests__/pane-store.test.ts` |
| Full suite command | `cd apps/workbench && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANE-01 | openApp finds existing tab or adds new | unit | `cd apps/workbench && npx vitest run src/features/panes/__tests__/pane-store.test.ts -x` | Exists but needs new tests |
| PANE-01 | openApp deduplicates by normalized route | unit | same as above | Needs new test |
| PANE-01 | openApp uses label fallback | unit | same as above | Needs new test |
| PANE-03 | closeView removes tab, selects adjacent | unit | same as above | Needs new test |
| PANE-03 | closeView on last tab in only pane -> Home | unit | same as above | Needs new test |
| PANE-04 | Default state has Home tab | unit | same as above | Already covered (createInitialRoot test) |
| PANE-05 | splitPane works with multi-view groups | unit | same as above | Existing test covers single-view; extend |
| SIDE-01 | SidebarPanel renders correct panel for each activeItem | unit/integration | `cd apps/workbench && npx vitest run src/features/activity-bar/__tests__/ -x` | Does not exist |
| SIDE-03-09 | Panel components render without crash | smoke | Manual verification -- panels read from stores that may have empty arrays | Manual |
| SIDE-10 | Panel click calls paneStore.openApp | unit | Mock paneStore, verify openApp called with correct route | Does not exist |

### Sampling Rate
- **Per task commit:** `cd apps/workbench && npx vitest run src/features/panes/__tests__/pane-store.test.ts`
- **Per wave merge:** `cd apps/workbench && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extend `pane-store.test.ts` with openApp/closeView/setActiveView tests (covers PANE-01, PANE-03)
- [ ] No panel component tests needed for Phase 2 (they are UI composition, not logic) -- manual visual verification is appropriate
- [ ] Framework install: already installed (vitest in devDependencies)

## Sources

### Primary (HIGH confidence)
- `apps/workbench/src/features/panes/pane-store.ts` -- current PaneStore interface and implementation
- `apps/workbench/src/features/panes/pane-tree.ts` -- tree manipulation utilities (replaceNode, getAllPaneGroups, etc.)
- `apps/workbench/src/features/panes/pane-types.ts` -- PaneView, PaneGroup, PaneSplit types
- `apps/workbench/src/features/panes/pane-container.tsx` -- current header being replaced by PaneTabBar
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` -- current PlaceholderPanel pattern
- `apps/workbench/src/features/activity-bar/types.ts` -- ActivityBarItemId type, ACTIVITY_BAR_ITEMS config
- `apps/workbench/src/features/activity-bar/stores/activity-bar-store.ts` -- ActivityBarState with actions
- `apps/workbench/src/components/desktop/workbench-routes.tsx` -- all 19+ routes, normalizeWorkbenchRoute, getWorkbenchRouteLabel
- `apps/workbench/src/features/sentinels/stores/sentinel-store.tsx` -- SentinelState with sentinels[], createSelectors
- `apps/workbench/src/features/findings/stores/finding-store.tsx` -- FindingState with findings[], createSelectors
- `apps/workbench/src/features/findings/stores/intel-store.tsx` -- IntelState with localIntel[], swarmIntel[], createSelectors
- `apps/workbench/src/features/fleet/use-fleet-connection.ts` -- FleetConnectionState with connection, agents[], createSelectors
- `apps/workbench/src/lib/workbench/compliance-requirements.ts` -- COMPLIANCE_FRAMEWORKS, scoreFramework()
- `apps/workbench/src/lib/workbench/finding-constants.ts` -- SEVERITY_COLORS, SEVERITY_LABELS_SHORT, STATUS_CONFIG
- `apps/workbench/src/components/workbench/compliance/framework-selector.tsx` -- MiniScoreRing, FrameworkPill
- `apps/workbench/src/components/workbench/home/home-page.tsx` -- derivePosture, POSTURE_CONFIG, PostureCore
- `apps/workbench/src/components/workbench/explorer/explorer-panel.tsx` -- panel layout/pattern reference
- `apps/workbench/src/features/policy/policy-catalog.ts` -- POLICY_CATALOG, CatalogEntry type
- `apps/workbench/src/features/fleet/fleet-client.ts` -- AgentInfo, FleetConnection types
- `.planning/phases/02-sidebar-panels-editor-tabs/02-UI-SPEC.md` -- visual/interaction contract

### Secondary (MEDIUM confidence)
- `apps/workbench/src/lib/workbench/sentinel-types.ts` -- Sentinel interface, SentinelStatus type, Intel interface
- `apps/workbench/src/lib/workbench/finding-engine.ts` -- Finding interface, FindingStatus type

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified all libraries and patterns from source code
- Architecture: HIGH - all store APIs, types, and existing component patterns verified by reading source
- Pitfalls: HIGH - identified from careful analysis of syncRoute vs openApp semantics and pane-tree mutation patterns
- Data sources: HIGH - every store selector verified against actual store interface

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable internal codebase, no external dependency risk)
