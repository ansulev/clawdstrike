# Phase 8: File-First Editor (Option C Flatten) - Research

**Researched:** 2026-03-18
**Domain:** React component decomposition, Zustand store bridging, IDE pane architecture
**Confidence:** HIGH

## Summary

Phase 8 flattens the two-layer tab system (PaneTabBar outer + PolicyTabBar inner) into a single layer where files ARE pane tabs. Currently, opening a file navigates to `/editor` which renders a 1071-line `PolicyEditor` component containing its own internal tab bar (`PolicyTabBar`), split editor, toolbar, and side panels. This phase promotes files to first-class pane views, wraps each in a thin `FileEditorShell`, and removes the `/editor` container entirely.

The critical insight from code analysis: the `PolicyEditor` is doing three jobs simultaneously -- (1) routing/panel switching via `useState` booleans (`showGuards`, `showCompare`, `showCoverage`, etc.), (2) providing a toolbar with 15+ contextual action buttons, and (3) orchestrating the `SplitEditor`/`EditorPane` content area. Phase 7 already promoted Guards, Compare, Live Agent, SDK, Coverage, and Visual Builders to standalone pane routes -- so job (1) is largely redundant. What remains is (2) the contextual toolbar and (3) the editor content, which become `FileEditorShell`.

The multi-policy store system is already well-decomposed into 3 Zustand stores (policy-tabs-store, policy-edit-store, workbench-ui-store) with a bridge layer. Tabs are keyed by internal `tabId` (UUID) with `filePath` as a lookup field on `TabMeta`. The `openTabOrSwitch` method already deduplicates by `filePath`, making the bridge to pane views straightforward.

**Primary recommendation:** Create a `FileEditorShell` component that receives a file path (from pane route params), bridges to the policy-tabs-store via `filePath` lookup, and renders the appropriate editor + contextual toolbar. Register `/file/*` as a pane route. Modify Explorer `onOpenFile` to call `paneStore.openApp("/file/path/to/file.yaml", "filename.yaml")`. Remove PolicyTabBar. Wire dirty state from `TabMeta.dirty` into `PaneView` metadata for gold dot display.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLAT-01 | Opening a file from Explorer creates a pane tab directly (no "Editor" container tab) | Explorer `onOpenFile` currently calls `paneStore.openApp("/editor")` -- change to `openApp("/file/...")` with dynamic route. PaneRouteRenderer already uses `useRoutes` which supports wildcard paths. |
| FLAT-02 | FileEditorShell component wraps each file tab with file-type-specific chrome | Extract toolbar from PolicyEditor lines 682-919, visual/yaml toggle from SplitEditor/EditorPane, wrap in thin shell keyed by filePath |
| FLAT-03 | Policy files show contextual toolbar (validate, format, test, deploy, publish) | Toolbar buttons currently in PolicyEditor lines 703-919 -- move to FileEditorShell, conditionally rendered based on `isPolicyFileType(fileType)` |
| FLAT-04 | PolicyTabBar removed -- PaneTabBar is the sole tab bar | PolicyTabBar (608 lines) has features PaneTabBar lacks: dirty dots, file-type color dots, drag reorder, new-tab split button, rename, close-confirmation for dirty tabs. PaneTab needs enhancement. |
| FLAT-05 | Multi-policy-store state keyed by file path, bridged to pane view IDs | TabMeta already has `filePath` field. `openTabOrSwitch` already deduplicates by filePath. Bridge: when pane opens `/file/X`, ensure policy-tabs-store has a tab for path X. |
| FLAT-06 | Pane splitting replaces Editor's internal split mode | SplitEditor currently uses PolicyTabBar's `splitMode`/`splitTabId` from policy-tabs-store for secondary read-only YAML preview. Pane system already supports `splitPane(paneId, direction)` which creates independent editable panes. |
| FLAT-07 | Dirty indicator (gold dot) on pane tabs for unsaved changes | PaneView type has `{ id, route, label }` -- needs `dirty?: boolean` or a reactive derivation. PolicyTabBar already renders dirty dot from `tab.dirty`. |
| FLAT-08 | `/editor` route removed or redirects to home; `/file/:path` route renders FileEditorShell | WORKBENCH_ROUTE_OBJECTS in workbench-routes.tsx needs new `/file/*` route and redirect for `/editor`. |
</phase_requirements>

## Standard Stack

### Core (Already In Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.x | State management | Already used for 13+ stores |
| react-router-dom | 6.x | Routing | Already used with HashRouter |
| @tabler/icons-react | latest | Icons | Already used throughout |
| motion/react | latest | Animations | Already used in PaneContainer |

No new libraries needed. This phase is purely decomposition and rewiring of existing code.

## Architecture Patterns

### Current Architecture (Before Phase 8)

```
PaneContainer
  PaneTabBar (outer tab bar -- routes like /editor, /guards, /home)
    PaneTab: "Editor"
    PaneTab: "Guards"
    PaneTab: "Home"
  PaneRouteRenderer
    /editor -> PolicyEditor (1071 LOC)
      PolicyTabBar (inner tab bar -- file tabs)
        TabItem: "my-policy.yaml" (dirty dot, file-type color)
        TabItem: "sigma-rule.yml"
      Toolbar (15+ buttons: Run, Split, Explorer, Problems, etc.)
      SplitEditor -> EditorPane (visual+yaml panels)
```

### Target Architecture (After Phase 8)

```
PaneContainer
  PaneTabBar (unified tab bar -- files AND app routes)
    PaneTab: "my-policy.yaml" (dirty dot, file-type icon)
    PaneTab: "sigma-rule.yml" (dirty dot, file-type icon)
    PaneTab: "Guards"
    PaneTab: "Home"
  PaneRouteRenderer
    /file/* -> FileEditorShell
      Contextual Toolbar (per file type)
      EditorPane (visual+yaml panels)
    /guards -> GuardsPage
    /home -> HomePage
```

### Key Component: FileEditorShell

```typescript
// Responsibility: bridge pane route -> policy-tabs-store -> editor
// Receives file path from route, finds or creates tab, renders editor + toolbar

interface FileEditorShellProps {
  // From route params: /file/policies/my-policy.yaml -> "policies/my-policy.yaml"
  filePath: string;
}

function FileEditorShell() {
  const { "*": filePath } = useParams(); // wildcard route param

  // Bridge to policy-tabs-store: find tab by filePath
  const tabMeta = usePolicyTabsStore(s => s.tabs.find(t => t.filePath === filePath));
  const editState = usePolicyEditStore(s => s.editStates.get(tabMeta?.id ?? ""));

  // Ensure policy-tabs-store is synced with active tab
  // (When pane becomes active, switch policy-tabs-store to match)

  return (
    <div className="h-full flex flex-col">
      {/* Contextual Toolbar -- extracted from PolicyEditor */}
      <FileEditorToolbar tabMeta={tabMeta} editState={editState} />
      {/* Editor Content */}
      <EditorPane tabId={tabMeta?.id} />
    </div>
  );
}
```

### Recommended File Structure for New/Modified Files

```
src/features/panes/
  pane-types.ts          # Add dirty? to PaneView
  pane-tab.tsx           # Add dirty dot, file-type indicator
  pane-store.ts          # openFile() method, dirty sync
  pane-route-renderer.tsx # (unchanged)
  pane-container.tsx     # (unchanged)
  pane-tab-bar.tsx       # Absorb new-tab button from PolicyTabBar

src/features/editor/
  file-editor-shell.tsx  # NEW -- wrapper component per FLAT-02
  file-editor-toolbar.tsx # NEW -- extracted toolbar per FLAT-03
  editor-pane.tsx        # MOVED from split-editor.tsx EditorPane

src/components/desktop/
  workbench-routes.tsx   # Add /file/* route, redirect /editor

src/features/activity-bar/components/
  sidebar-panel.tsx      # Change onOpenFile to use /file/ route
```

### Anti-Patterns to Avoid

- **Re-creating the dual tab bar:** FileEditorShell MUST NOT have its own tab bar. The PaneTabBar is the only tab bar.
- **Copying PolicyEditor wholesale:** Extract only what's needed (toolbar, editor pane). Don't wrap the old component.
- **Breaking the bridge hooks:** `useMultiPolicy()` and `useWorkbench()` are used by 79 files. Don't remove them yet -- they can be deprecated later.
- **Two-way sync loops:** When pane active view changes, update policy-tabs-store's activeTabId. But don't let policy-tabs-store changes trigger pane changes back.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File path in route | Custom path encoder | URL-safe base64 or wildcard route `file/*` | File paths contain `/` which conflicts with route segments. Use `*` splat route. |
| Dirty state sync | Custom observer | Zustand `subscribe` with selector | Policy-tabs-store already tracks dirty per tab. Subscribe to broadcast to pane. |
| Tab deduplication | Custom file-open logic | Existing `openTabOrSwitch` in policy-tabs-store | Already handles same-file dedup, content-changed-on-disk reload. |

**Key insight:** 90% of the store logic already exists. The gap is purely in the UI layer (which component renders where) and the routing layer (how does a file path become a pane tab).

## Common Pitfalls

### Pitfall 1: PolicyEditor's 16 useState Booleans

**What goes wrong:** PolicyEditor manages `showCommandCenter`, `showHome`, `showGuards`, `showCompare`, `showCoverage`, `showExplorer`, `showProblems`, `historyOpen`, `testRunnerOpen`, `evidenceOpen`, `explainOpen`, `publishOpen`, `commandPaletteOpen`, `diffDialogOpen` as local state. These panels are NOW either (a) standalone pane routes (Guards, Compare, Coverage -- Phase 7) or (b) right sidebar panels (Evidence, Explain, Version History -- Phase 7).
**How to avoid:** Don't migrate these booleans to FileEditorShell. Most are dead code post-Phase 7. Only keep what's truly per-file: `testRunnerOpen`, `showProblems`. Everything else uses pane routes or right sidebar.

### Pitfall 2: EditorPane Couples to useMultiPolicy

**What goes wrong:** `EditorPane` (inside split-editor.tsx) calls `useMultiPolicy()` to get `activeTab` and renders visual panels based on `activeTab.fileType`. If FileEditorShell is rendered for a non-active policy tab (in a split pane), `useMultiPolicy().activeTab` returns the wrong tab.
**How to avoid:** EditorPane must accept `tabId` as a prop and read from the edit store directly, not from the bridge's "active tab" concept.

### Pitfall 3: SplitMode Removal Creates Regression

**What goes wrong:** The internal `SplitEditor` uses `splitMode`/`splitTabId` from policy-tabs-store for a "secondary read-only YAML preview" pane. Users who relied on this lose functionality.
**How to avoid:** Pane splitting (FLAT-06) provides a better version of this -- two independent, fully editable panes side by side. Document that split pane replaces internal split mode. Remove `SplitModeToggle` from toolbar.

### Pitfall 4: File Path Encoding in Routes

**What goes wrong:** File paths contain forward slashes, special characters. Route `/file/policies/my-policy.yaml` works but `/file/C:\Users\...` does not.
**How to avoid:** Use React Router's `*` splat parameter (`path: "file/*"`). This captures everything after `/file/` including slashes. Access via `useParams()["*"]`.

### Pitfall 5: New-Tab Creation Without File

**What goes wrong:** Users expect to create a new untitled file from the tab bar. PolicyTabBar has a "new tab" split button. PaneTabBar doesn't.
**How to avoid:** Add a "new file" button to PaneTabBar or provide it through the command palette. When creating a new untitled tab, generate a temporary route like `/file/__new__/untitled-1.yaml`.

### Pitfall 6: Breadcrumb Bar Route Awareness

**What goes wrong:** BreadcrumbBar (in pane-container.tsx) receives `activeView.route` and renders path segments. For `/file/policies/my-policy.yaml` it would show "file > policies > my-policy.yaml" instead of "Project > policies > my-policy.yaml".
**How to avoid:** Update BreadcrumbBar to detect `/file/` prefix routes and render the file path portion as breadcrumb segments.

## Code Examples

### Example 1: FileEditorShell Skeleton

```typescript
// Source: derived from PolicyEditor analysis
import { useParams } from "react-router-dom";
import { usePolicyTabsStore } from "@/features/policy/stores/policy-tabs-store";
import { usePolicyEditStore } from "@/features/policy/stores/policy-edit-store";

export function FileEditorShell() {
  const params = useParams();
  const filePath = params["*"] ?? null;

  // Find tab by file path
  const tabMeta = usePolicyTabsStore(
    (s) => s.tabs.find((t) => t.filePath === filePath) ?? null
  );

  const editState = usePolicyEditStore(
    (s) => tabMeta ? s.editStates.get(tabMeta.id) : undefined
  );

  // Ensure this tab is the active tab in policy-tabs-store
  // (for hooks like useNativeValidation that read activeTabId)
  useEffect(() => {
    if (tabMeta && usePolicyTabsStore.getState().activeTabId !== tabMeta.id) {
      usePolicyTabsStore.getState().switchTab(tabMeta.id);
    }
  }, [tabMeta]);

  if (!tabMeta || !editState) {
    return <FileNotFoundPlaceholder filePath={filePath} />;
  }

  return (
    <div className="h-full flex flex-col">
      <FileEditorToolbar tabMeta={tabMeta} editState={editState} />
      <div className="flex-1 min-h-0">
        <EditorPane tabId={tabMeta.id} />
      </div>
    </div>
  );
}
```

### Example 2: Enhanced PaneView with Dirty State

```typescript
// Source: derived from pane-types.ts analysis
export interface PaneView {
  id: string;
  route: string;
  label: string;
  // NEW: dirty indicator for file tabs
  dirty?: boolean;
  // NEW: file type for icon coloring
  fileType?: FileType;
}
```

### Example 3: Explorer File Open -> Pane Tab

```typescript
// Source: derived from sidebar-panel.tsx line 34
// Before (Phase 7):
onOpenFile={(file) => {
  usePaneStore.getState().openApp("/editor", file.name);
}}

// After (Phase 8):
onOpenFile={(file) => {
  // Opens file as first-class pane tab
  usePaneStore.getState().openApp(`/file/${file.path}`, file.name);
  // Also ensure policy-tabs-store has this file loaded
  // (openTabOrSwitch handles dedup)
}}
```

### Example 4: Wildcard Route Registration

```typescript
// Source: derived from workbench-routes.tsx
const FileEditorShell = lazy(() =>
  import("@/features/editor/file-editor-shell").then((m) => ({
    default: m.FileEditorShell,
  })),
);

export const WORKBENCH_ROUTE_OBJECTS: RouteObject[] = [
  // ... existing routes ...
  { path: "file/*", element: <FileEditorShell /> },
  // Redirect /editor to /home (FLAT-08)
  { path: "editor", element: <Navigate to="/home" replace /> },
];
```

## Store API Inventory

### policy-tabs-store (Tab Lifecycle)

| Method | Signature | Used By Phase 8 |
|--------|-----------|-----------------|
| `openTabOrSwitch` | `(filePath, fileType, yaml, name?) => void` | YES - called when pane opens a file route |
| `switchTab` | `(tabId) => void` | YES - called when pane view becomes active |
| `closeTab` | `(tabId) => void` | YES - called when pane view is closed |
| `newTab` | `(options?) => string | null` | YES - for new untitled file creation |
| `getActiveTab` | `() => TabMeta | undefined` | YES - for toolbar context |
| `setDirty` | `(tabId, dirty) => void` | NO - internal to bridge dispatch |
| `tabs` (state) | `TabMeta[]` | YES - for filePath lookup |
| `activeTabId` (state) | `string` | YES - for sync with pane active view |

### policy-edit-store (Per-Tab Editing)

| Method | Signature | Used By Phase 8 |
|--------|-----------|-----------------|
| `editStates` (state) | `Map<string, TabEditState>` | YES - for rendering editor content |
| `updatePolicy` | `(tabId, policy, fileType) => void` | YES - via bridge dispatch |
| `setYaml` | `(tabId, yaml, ...) => void` | YES - via bridge dispatch |
| `isDirty` | `(tabId) => boolean` | YES - for dirty dot display |

### pane-store (Pane System)

| Method | Signature | Needs Modification |
|--------|-----------|-------------------|
| `openApp` | `(route, label?) => void` | YES - needs to also trigger policy-tabs-store file loading |
| `closeView` | `(paneId, viewId) => void` | MAYBE - should close corresponding policy tab? |
| `setActiveView` | `(paneId, viewId) => void` | YES - needs to sync policy-tabs-store activeTabId |
| `splitPane` | `(paneId, direction) => void` | NO - works as-is for FLAT-06 |

### Bridge Points (What Needs Connecting)

1. **Pane opens file route** -> policy-tabs-store.openTabOrSwitch (load file content)
2. **Pane view becomes active** -> policy-tabs-store.switchTab (sync active tab)
3. **Policy tab dirty changes** -> PaneView.dirty update (gold dot sync)
4. **Pane view closed** -> policy-tabs-store.closeTab (cleanup)
5. **New file from pane** -> policy-tabs-store.newTab + pane route update

## Decomposition Map: PolicyEditor (1071 LOC)

### Lines 1-70: Imports + Constants
**Disposition:** Distribute to FileEditorShell and FileEditorToolbar

### Lines 71-326: RunButtonGroup Component
**Disposition:** Move to FileEditorToolbar (policy-only). Only shown for `isPolicyFileType`.

### Lines 329-360: PolicyEditor State Setup
**Disposition:** Most `useState` booleans are DEAD CODE post-Phase 7:
- `showGuards` -> now `/guards` pane route
- `showCompare` -> now `/compare` pane route
- `showCoverage` -> now `/coverage` pane route
- `historyOpen` -> now right sidebar panel
- `evidenceOpen` -> now right sidebar panel
- `explainOpen` -> now right sidebar panel
- `publishOpen` -> now right sidebar panel
- `showExplorer` -> sidebar activity bar already has this
- `showHome` -> now `/home` pane route
- `showCommandCenter` -> command palette handles this

**KEEP in FileEditorShell:**
- `testRunnerOpen` - per-file toggle for test runner panel below editor
- `showProblems` - per-file toggle for problems panel below editor
- `commandPaletteOpen` - already handled by desktop-level shortcut

### Lines 362-470: Coverage/Evidence/Version History Hooks
**Disposition:** These detection workflow hooks should remain per-file. Move to FileEditorShell or a custom `useFileEditorHooks(tabMeta)` hook.

### Lines 471-510: URL Panel Activation + isPolicyTab Cleanup
**Disposition:** DELETE. Phase 7 standalone routes made panel param switching unnecessary.

### Lines 512-617: Explorer/Problems Derived State
**Disposition:** Explorer syncing is dead code -- sidebar Explorer is independent. Problems derivation moves to FileEditorShell (needed for inline problems panel).

### Lines 618-660: Version History + Rollback
**Disposition:** Right sidebar already handles this. DELETE from FileEditorShell.

### Lines 680-1071: JSX Render
**Disposition:** Major decomposition:
- Lines 682-919 (toolbar) -> FileEditorToolbar
- Lines 922-989 (content area with showX conditions) -> simplify to just EditorPane + TestRunner + Problems
- Lines 992-1038 (history/evidence/explain/publish side panels) -> DELETE (Phase 7 right sidebar)
- Lines 1043-1067 (CommandPalette + VersionDiffDialog) -> DELETE (desktop-level command palette)

## Migration Strategy

### Wave 1: Foundation (Plans 08-01, 08-02)

1. **Add `/file/*` route** to workbench-routes.tsx pointing to a minimal FileEditorShell
2. **Create FileEditorShell** that bridges route params -> policy-tabs-store
3. **Extend PaneView** with `dirty?: boolean` and `fileType?: FileType`
4. **Enhance PaneTab** with dirty dot and file-type color indicator
5. **Wire Explorer -> /file/ route** in sidebar-panel.tsx

### Wave 2: Toolbar + Content (Plan 08-03)

1. **Extract FileEditorToolbar** from PolicyEditor lines 682-919
2. **Decouple EditorPane** from useMultiPolicy bridge (accept tabId prop)
3. **Add test runner + problems toggle** to FileEditorShell
4. **Remove SplitModeToggle** (pane splitting replaces it)

### Wave 3: Cleanup (Plan 08-04)

1. **Remove PolicyTabBar** (608 LOC)
2. **Redirect `/editor` to `/home`** in workbench-routes.tsx
3. **Simplify PolicyEditor** to a redirect or delete it
4. **Add new-file button** to PaneTabBar
5. **Update navigate-commands** to remove `nav.editor`
6. **Update Quick Open** to open files via `/file/` route instead of `/editor`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.x + jsdom |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLAT-01 | Explorer click creates pane tab at /file/* | unit | `npx vitest run src/features/panes/__tests__/pane-store.test.ts -x` | Wave 0 |
| FLAT-02 | FileEditorShell renders editor for file path | unit | `npx vitest run src/features/editor/__tests__/file-editor-shell.test.tsx -x` | Wave 0 |
| FLAT-03 | Policy toolbar shown for .yaml, hidden for .yar | unit | `npx vitest run src/features/editor/__tests__/file-editor-toolbar.test.tsx -x` | Wave 0 |
| FLAT-04 | PaneTabBar has no PolicyTabBar sibling | unit | `npx vitest run src/features/panes/__tests__/pane-store.test.ts -x` | Existing (needs update) |
| FLAT-05 | openApp("/file/x") triggers openTabOrSwitch | unit | `npx vitest run src/features/panes/__tests__/pane-store.test.ts -x` | Wave 0 |
| FLAT-07 | Dirty dot visible on PaneTab for dirty file | unit | `npx vitest run src/features/panes/__tests__/pane-tab.test.tsx -x` | Wave 0 |
| FLAT-08 | /editor route redirects to /home | unit | `npx vitest run src/__tests__/App.test.tsx -x` | Existing (needs update) |
| FLAT-06 | Pane split creates two independent editors | manual-only | N/A | N/A -- pane splitting already tested |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/editor/__tests__/file-editor-shell.test.tsx` -- covers FLAT-02, FLAT-03
- [ ] `src/features/panes/__tests__/pane-tab.test.tsx` -- covers FLAT-07 (dirty dot)
- [ ] Update `src/features/panes/__tests__/pane-store.test.ts` -- covers FLAT-01, FLAT-05

## Open Questions

1. **New untitled file route convention**
   - What we know: Opening a file uses `/file/<filePath>`. New untitled files have no filePath.
   - What's unclear: What route represents a new untitled file? Options: `/file/__new__/<uuid>`, `/file/__untitled__/<name>`, or a separate `/new-file` route.
   - Recommendation: Use `/file/__new__/<tabId>` as a synthetic route. FileEditorShell detects the `__new__` prefix and creates a new tab instead of loading from disk.

2. **policy-tabs-store activeTabId sync direction**
   - What we know: Multiple panes can show different files simultaneously. policy-tabs-store has a single `activeTabId`.
   - What's unclear: Which pane's active file should `activeTabId` track?
   - Recommendation: `activeTabId` follows the focused pane. When a pane gains focus, its file tab becomes the active policy tab. This matches VS Code behavior.

3. **PolicyCommandCenter and BulkGuardUpdate future**
   - What we know: PolicyCommandCenter (a cross-tab guard management grid) renders inside PolicyEditor.
   - What's unclear: Where does it live post-Phase 8? It operates across ALL tabs, not per-file.
   - Recommendation: Make it a standalone pane route `/command-center` (like Guards/Compare were promoted in Phase 7). Or accessible from command palette.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of all referenced source files in the workbench codebase
- `.planning/REQUIREMENTS.md` -- FLAT-01 through FLAT-08 definitions
- `.planning/ROADMAP.md` -- Phase 8 description and dependencies
- `.planning/STATE.md` -- current project state and accumulated decisions

### Secondary (MEDIUM confidence)
- React Router v6 `*` splat parameter documentation (from training data, well-established pattern)
- Zustand `subscribe` API for cross-store reactivity (from training data, core Zustand feature)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing code analyzed directly
- Architecture: HIGH - detailed line-by-line analysis of PolicyEditor, all 3 stores, pane system
- Pitfalls: HIGH - identified from real code dependencies and coupling patterns
- Store API inventory: HIGH - read every store file completely

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- internal codebase, no external API dependencies)
