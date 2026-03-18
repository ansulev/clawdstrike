# Contribution Point Seams for Plugin Ecosystem

**Analysis Date:** 2026-03-18

This document maps every place in the ClawdStrike workbench and desktop apps where a plugin could register new capabilities, documenting the exact code seams, current implementation, plugin integration difficulty, required changes, and ideal plugin API surface.

**Two apps are in scope:**
- **Workbench** (`apps/workbench/`) -- the original policy-authoring IDE (Tauri desktop app)
- **Desktop** (`apps/desktop/`) -- the newer "Huntronomer" SOC shell (Tauri desktop app)

Both share the same monorepo but have **separate plugin architectures** at different maturity levels. The Desktop app already has a `PluginRegistry` pattern; the Workbench does not.

---

## 1. Command Registry

### 1A. Desktop App Command System

The Desktop app has **no centralized command registry**. Commands are assembled ad-hoc in two places:

**Command Palette (Desktop Shell)**
- File: `apps/desktop/src/shell/components/CommandPalette.tsx`
- Interface: `PaletteCommand` (lines 18-25):
  ```typescript
  export interface PaletteCommand {
    id: string;
    group?: string;
    title: string;
    description?: string;
    shortcut?: string;
    action: () => void;
  }
  ```
- Commands are built dynamically at render time:
  - **Plugin-derived commands** (line 51-62): Each `AppPlugin` from the registry is mapped to a navigation command
  - **Extra commands** (line 63): Passed via `extraCommands` prop from `ShellLayout`
  - Extra commands are currently only `cyberNexusCommands` (19 commands defined inline in `apps/desktop/src/shell/ShellLayout.tsx` lines 129-277)

**Hot Commands (Dock System)**
- File: `apps/desktop/src/shell/dock/hotCommands.ts`
- Interface: `HotCommand` (lines 3-13):
  ```typescript
  export interface HotCommand {
    id: string;
    title: string;
    description?: string;
    command: string;        // Route path or "palette" keyword
    scope: HotCommandScope; // "global" | "nexus" | "operations"
    pinned: boolean;
    createdAt: number;
    updatedAt: number;
    lastUsedAt?: number;
  }
  ```
- Hot commands are stored in `localStorage` (key: `sdr:hot-commands:v1`)
- Resolution: `resolveHotCommandAction()` (line 215) converts command strings to `navigate`, `palette`, or `event` actions
- Default commands are hardcoded in `DEFAULT_COMMANDS` (lines 28-69)

**Plugin Commands (on AppPlugin)**
- File: `apps/desktop/src/shell/plugins/types.ts`
- The `AppPlugin` interface (line 33) has an optional `commands?: PluginCommand[]` field:
  ```typescript
  export interface PluginCommand {
    id: string;
    title: string;
    shortcut?: string;
    handler: () => void | Promise<void>;
  }
  ```
- **This field is NEVER read** -- no code in the desktop app iterates `plugin.commands`. It is a dead field.

**Keyboard Shortcuts (Desktop Shell)**
- File: `apps/desktop/src/shell/keyboard/useShellShortcuts.ts`
- Hardcoded `VIEW_KEYS` map (lines 17-27) maps `Cmd+1` through `Cmd+9` to specific `AppId` values
- Handler registered via `useEffect` on `window.addEventListener("keydown", ...)` (line 112)
- Adding a new keybinding requires editing the `ShellShortcutHandlers` interface and `useShellShortcuts` function

**Current state:** STATIC -- all commands hardcoded or derived from plugin list at build time
**Plugin integration difficulty:** MEDIUM
**What needs to change:**
1. Create a `CommandRegistry` singleton that plugins can call `registry.register(command)` on
2. Wire `CommandPalette` to consume from the registry instead of building commands inline
3. Actually read `AppPlugin.commands` in the palette -- the field already exists but is unused
4. Make `HotCommandScope` extensible (currently a union of 3 values)
5. Make `VIEW_KEYS` in `useShellShortcuts.ts` dynamic (currently hardcoded to 9 AppIds)

**Ideal plugin API:**
```typescript
// Plugin registers commands at activation time
api.commands.register({
  id: "my-plugin:run-scan",
  title: "Run Security Scan",
  group: "Security",
  shortcut: "Cmd+Shift+S",
  when: "activeApp === 'my-plugin'",  // contextual visibility
  handler: async () => { /* ... */ },
});
```

---

### 1B. Workbench App Command System

The Workbench has **two separate command palette implementations** and a shortcut system:

**Desktop-Level Command Palette**
- File: `apps/workbench/src/components/desktop/command-palette.tsx`
- Interface: `CommandItem` (lines 11-16):
  ```typescript
  interface CommandItem {
    id: string;
    label: string;
    section: string;
    href?: string;
    shortcut?: string;
  }
  ```
- Commands are a **hardcoded const array** `COMMANDS` (lines 18-38) with 17 items
- Triggered by `Cmd+K` (lines 49-55)
- This palette only supports **navigation** (href-based), not arbitrary actions

**Editor-Level Command Palette**
- File: `apps/workbench/src/components/workbench/editor/command-palette.tsx`
- Interface: `Command` (lines 19-27):
  ```typescript
  interface Command {
    id: string;
    label: string;
    category: "File" | "Navigate" | "Format" | "Hunt";
    shortcut?: string;
    dotColor?: string;
    action: () => void;
  }
  ```
- Commands built by `buildCommands()` function (lines 33-158), called per render
- Categories are a hardcoded tuple: `["File", "Navigate", "Hunt", "Format"]` (line 31)

**Keyboard Shortcuts**
- File: `apps/workbench/src/lib/keyboard-shortcuts.ts`
- Interface: `ShortcutAction` (lines 3-9):
  ```typescript
  export interface ShortcutAction {
    key: string;
    meta: boolean;
    shift?: boolean;
    description: string;
    action: () => void;
  }
  ```
- Hook: `useKeyboardShortcuts(shortcuts: ShortcutAction[])` (line 17)
- All shortcuts registered in `apps/workbench/src/components/desktop/shortcut-provider.tsx` (lines 109-153)
- Shortcut definitions for the help dialog: `SHORTCUT_DEFINITIONS` (lines 11-37)
- Navigation routes hardcoded: `NAV_ROUTES` (lines 39-46)

**Current state:** STATIC -- all commands hardcoded
**Plugin integration difficulty:** HARD (two separate palettes need unification)
**What needs to change:**
1. Merge the two command palettes into one
2. Create a shared `CommandRegistry` (could be Zustand store or singleton)
3. Replace the `COMMANDS` const array with a dynamic registry
4. Make `Command.category` extensible (currently a 4-value union)
5. Allow plugins to add shortcuts via `useKeyboardShortcuts`

---

## 2. Activity Bar / Sidebar Navigation

### 2A. Desktop App NavRail

The Desktop app's NavRail is **session-focused**, not an activity bar in the VS Code sense.

**NavRail Component**
- File: `apps/desktop/src/shell/components/NavRail.tsx`
- It does NOT render the plugin list. It renders:
  1. The CyberNexus orb logo
  2. A list of "strikecell sessions" (from the session store)
  3. An Operations button at the bottom
- Plugins appear as **routes**, not as rail items. Navigation between plugins uses the router.

**Where plugins actually appear in navigation:**
- Not in the NavRail. The plugin list is used only to generate **routes** in `ShellApp.tsx` (line 38) and **command palette entries**.
- There is NO visual plugin switcher in the Desktop app beyond the command palette.

**Current state:** N/A -- Desktop uses route-based navigation, not an activity bar
**Plugin integration difficulty:** MEDIUM
**What needs to change:**
1. Add an app-switcher rail or tabs showing registered plugins
2. Or extend `NavRail` to show plugin icons alongside sessions

---

### 2B. Workbench App Sidebar

The Workbench has a traditional sidebar with grouped navigation.

**DesktopSidebar Component**
- File: `apps/workbench/src/components/desktop/desktop-sidebar.tsx`
- Interface: `NavItem` (lines 38-43):
  ```typescript
  interface NavItem {
    readonly label: string;
    readonly icon: React.ComponentType<SigilProps>;
    readonly href: string;
    readonly badge?: boolean;
  }
  ```
- Interface: `NavSection` (lines 45-49):
  ```typescript
  interface NavSection {
    readonly title: string;
    readonly accent: string;
    readonly items: readonly NavItem[];
  }
  ```
- Navigation sections are a **hardcoded const array** `navSections` (lines 51-83) with 3 sections and 13 items total:
  - "Detect & Respond" (5 items: Sentinels, Mission Control, Findings, Lab, Swarms)
  - "Author & Test" (2 items: Editor, Library)
  - "Platform" (6 items: Compliance, Approvals, Audit, Receipts, Fleet, Topology)
- Settings is rendered separately outside the sections (line 580)
- Icons are custom SVG components from `apps/workbench/src/components/desktop/sidebar-icons.tsx`
- Badge counts are computed per-item using `getBadgeCount()` (line 428) with hardcoded href checks

**Sidebar collapse state:**
- Stored in `state.ui.sidebarCollapsed` from the multi-policy-store
- Toggled via `dispatch({ type: "SET_SIDEBAR_COLLAPSED", collapsed: !collapsed })`
- Keyboard shortcut: `Cmd+B` (in `shortcut-provider.tsx` line 123)

**Current state:** STATIC -- `navSections` is a frozen `as const` array
**Plugin integration difficulty:** MEDIUM
**What needs to change:**
1. Make `navSections` a reactive data structure (Zustand store or signal)
2. Provide a `registerSidebarItem(section: string, item: NavItem)` API
3. Make `NavItem.icon` accept a `ReactNode` or string icon name (currently requires a specific `SigilProps` component)
4. Make `getBadgeCount()` extensible (currently switches on href strings)
5. Allow custom badge providers per nav item

**Ideal plugin API:**
```typescript
api.sidebar.registerItem({
  section: "Detect & Respond",  // existing or new section
  label: "My Scanner",
  icon: MyIcon,                 // or "IconScan" string reference
  href: "/my-scanner",
  badge: () => scanCount,       // reactive badge provider
});
```

---

## 3. Pane System / Route Registry

### 3A. Desktop App Plugin Routes

The Desktop app uses a **plugin-based route system** -- the closest thing to a pane system.

**Plugin Registry**
- File: `apps/desktop/src/shell/plugins/registry.tsx`
- Type: `AppPlugin` from `apps/desktop/src/shell/plugins/types.ts` (lines 33-42):
  ```typescript
  export interface AppPlugin {
    id: AppId;
    name: string;
    icon: PluginIcon;
    description: string;
    order: number;
    routes: PluginRoute[];
    commands?: PluginCommand[];
    hidden?: boolean;
  }
  ```
- `PluginRoute` (lines 20-24):
  ```typescript
  export interface PluginRoute {
    path: string;
    element: ReactNode;
    index?: boolean;
  }
  ```
- `AppId` is a **closed union** of 12 string literals (lines 6-18):
  ```typescript
  export type AppId =
    | "nexus" | "operations" | "events" | "policies"
    | "policy-tester" | "swarm" | "marketplace"
    | "workflows" | "threat-radar" | "attack-graph"
    | "network-map" | "security-overview";
  ```
- `PluginIcon` is a **closed union** of 13 string literals (lines 44-57)
- Plugins array defined inline (lines 50-150), sorted by `order` field
- All view components are `React.lazy()` loaded (lines 8-47)

**Route generation:**
- File: `apps/desktop/src/shell/ShellApp.tsx`
- Routes generated from plugins at line 38:
  ```typescript
  ...plugins.map((plugin) => ({
    path: plugin.id,
    children: plugin.routes.map((route, idx) => ({
      id: `${plugin.id}-${idx}`,
      index: route.index,
      path: route.index ? undefined : route.path,
      element: <Suspense fallback={loadingFallback}>{route.element}</Suspense>,
    })),
  })),
  ```
- Router is created with `createHashRouter` (line 29) and **only created once** (`useMemo([], [])` -- empty deps)

**Current state:** STATIC -- plugins are a compile-time array; `AppId` is a closed union
**Plugin integration difficulty:** MEDIUM (architecture supports it, types don't)
**What needs to change:**
1. Change `AppId` from a closed union to `string` (or `string & Brand<"AppId">`)
2. Change `PluginIcon` to `string` and support custom icon registration
3. Make `plugins` array mutable or use a registration function
4. Re-create the router when plugins change (currently memoized with `[]` deps)
5. Support dynamic `React.lazy()` loading from plugin bundles

**Ideal plugin API:**
```typescript
api.apps.register({
  id: "my-scanner",
  name: "Vulnerability Scanner",
  icon: "scan",  // or custom SVG path
  description: "SAST/DAST scanning",
  order: 20,
  routes: [
    { path: "", element: <ScannerView />, index: true },
    { path: ":scanId", element: <ScanDetailView /> },
  ],
  commands: [
    { id: "scan:start", title: "Start Scan", handler: startScan },
  ],
});
```

---

### 3B. Workbench App Route System

The Workbench uses **static React Router routes** defined in `App.tsx`.

**Route definitions:**
- File: `apps/workbench/src/App.tsx`
- Routes are a flat list of `<Route>` elements (lines 342-438)
- Each route maps to a lazy-loaded component
- 15 primary routes + 9 redirect routes
- All wrapped in `<DesktopLayout>` which provides sidebar + status bar

**Current state:** FULLY STATIC -- routes are JSX in `App.tsx`
**Plugin integration difficulty:** HARD
**What needs to change:**
1. Extract route definitions into a registry (similar to desktop's `AppPlugin.routes`)
2. Use `createHashRouter` or `createRoutesFromElements` to support dynamic route injection
3. Allow plugins to register routes that appear under `<DesktopLayout>`

---

## 4. Bottom Panel / Dock System

### 4A. Desktop App Dock System

The Desktop app has a sophisticated capsule/dock system.

**Dock System**
- File: `apps/desktop/src/shell/dock/DockSystem.tsx`
- The dock renders:
  1. **Floating capsules** (line 1084) -- positioned windows for output, events, artifacts, etc.
  2. **Shelf panel** (line 1093) -- a draggable/resizable panel with three modes
  3. **Session rail** (line 1097) -- bottom bar

**Capsule Kinds:**
- File: `apps/desktop/src/shell/dock/types.ts`
- `CapsuleKind` is a **closed union** of 10 values (lines 8-18):
  ```typescript
  export type CapsuleKind =
    | "output" | "events" | "artifact" | "inspector"
    | "terminal" | "action" | "chat" | "social"
    | "season_pass" | "kernel_agent";
  ```
- Each kind has a dedicated content renderer via `getCapsuleContent()` switch (lines 939-964)

**Shelf Modes:**
- `ShelfMode = "events" | "output" | "artifacts"` (line 101 in types.ts)
- Shelf content rendering delegated via `renderShelfContent` prop (line 1009)
- Default shelf content provided by `getDemoShelfContent()` switch (lines 632-643)

**Current state:** STATIC -- `CapsuleKind` and `ShelfMode` are closed unions; content renderers are switch statements
**Plugin integration difficulty:** MEDIUM
**What needs to change:**
1. Change `CapsuleKind` to `string` and use a content renderer registry instead of switch
2. Change `ShelfMode` to `string` and use a mode registry
3. Add `registerCapsuleRenderer(kind: string, renderer: ComponentType<CapsuleContentProps>)` API
4. Add `registerShelfMode(mode: string, config: { title: string, renderer: ComponentType })` API

**Ideal plugin API:**
```typescript
api.dock.registerCapsuleKind("my-scanner:results", {
  renderer: ScanResultsCapsule,
  defaultTitle: "Scan Results",
});

api.dock.registerShelfMode("scanner", {
  title: "Scanner Output",
  renderer: ScannerShelfPanel,
});
```

---

### 4B. Workbench App -- No Bottom Panel

The Workbench app has **no bottom panel**. The layout in `apps/workbench/src/components/desktop/desktop-layout.tsx` is:
1. Titlebar (top)
2. Sidebar + main content (middle)
3. StatusBar (bottom)

There is no tab-based bottom panel or terminal panel. This is a gap in the workbench architecture.

---

## 5. Right Sidebar

Neither the Desktop nor the Workbench app has a VS Code-style right sidebar panel.

The Workbench editor (`apps/workbench/src/components/workbench/editor/policy-editor.tsx`) has inline side panels (like the explainability panel, evidence pack panel, etc.), but these are hardcoded into the editor component, not a generic right sidebar contribution point.

**Current state:** DOES NOT EXIST
**Plugin integration difficulty:** N/A -- would need to be built from scratch

---

## 6. Status Bar

### 6A. Desktop App -- No Status Bar

The Desktop app does not have a traditional status bar. The `SessionRail` at the bottom of the dock system serves a similar role but is focused on session management, not extensible status segments.

---

### 6B. Workbench App Status Bar

**StatusBar Component**
- File: `apps/workbench/src/components/desktop/status-bar.tsx`
- Renders two sections (left and right):

**Left section items (hardcoded):**
1. Validation status (errors/warnings/valid) -- lines 77-82
2. Guard count (`{enabledGuards}/{totalGuards} guards`) -- lines 86-95
3. Policy version -- line 93
4. Fleet connection status (dot + agent count or "Local") -- lines 106-126
5. MCP sidecar status (desktop only) -- lines 129-134

**Right section items (hardcoded):**
1. Evaluation count -- lines 140-143
2. Tab count -- lines 149-154
3. Active policy name + dirty indicator -- lines 159-164
4. File path -- lines 168-174

**Current state:** FULLY STATIC -- all segments hardcoded as JSX
**Plugin integration difficulty:** EASY (just needs a registry pattern)
**What needs to change:**
1. Create a `StatusBarRegistry` with left/right sections
2. Define a `StatusBarItem` interface:
   ```typescript
   interface StatusBarItem {
     id: string;
     side: "left" | "right";
     priority: number;  // sort order
     render: () => ReactNode;
   }
   ```
3. Plugin calls `registry.register(item)` at activation
4. StatusBar renders from registry instead of inline JSX

**Ideal plugin API:**
```typescript
api.statusBar.register({
  id: "my-plugin:scan-status",
  side: "left",
  priority: 50,
  render: () => <ScanStatusSegment />,
});
```

---

## 7. File Type Registry

**File Type Registry**
- File: `apps/workbench/src/lib/workbench/file-type-registry.ts`
- Type: `FileType` is a **closed union** (line 6):
  ```typescript
  export type FileType = "clawdstrike_policy" | "sigma_rule" | "yara_rule" | "ocsf_event";
  ```
- Interface: `FileTypeDescriptor` (lines 9-25):
  ```typescript
  export interface FileTypeDescriptor {
    id: FileType;
    label: string;
    shortLabel: string;
    extensions: string[];
    iconColor: string;
    defaultContent: string;
    testable: boolean;
    convertibleTo: FileType[];
  }
  ```
- Registry: `FILE_TYPE_REGISTRY` is a `Record<FileType, FileTypeDescriptor>` const (lines 113-154)
- Detection: `detectFileType(filename, content)` uses a waterfall of extension checks then content heuristics (lines 240-268)
- Helper functions: `isPolicyFileType()`, `getPrimaryExtension()`, `getDescriptor()`, `coerceFileType()`, etc.

**Where FileType is used:**
- `apps/workbench/src/components/desktop/status-bar.tsx` (line 26): status bar shows file type label
- `apps/workbench/src/components/workbench/editor/command-palette.tsx` (line 43): new-file commands iterate registry
- `apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx`: tab dots colored by file type
- `apps/workbench/src/lib/workbench/multi-policy-store.ts`: tabs store `fileType` per tab

**Current state:** STATIC -- `FileType` is a closed 4-value union; `FILE_TYPE_REGISTRY` is a const object
**Plugin integration difficulty:** MEDIUM
**What needs to change:**
1. Change `FileType` from a union to `string` (or `string & Brand<"FileType">`)
2. Change `FILE_TYPE_REGISTRY` from a const `Record` to a `Map<string, FileTypeDescriptor>` with `register()` / `unregister()` methods
3. Update `detectFileType()` to check plugin-registered types in addition to built-in types
4. Allow plugin-provided validators per file type (currently only ClawdStrike policy and Sigma have validators)

**Ideal plugin API:**
```typescript
api.fileTypes.register({
  id: "snort_rule",
  label: "Snort Rule",
  shortLabel: "Snort",
  extensions: [".rules", ".snort"],
  iconColor: "#e05050",
  defaultContent: 'alert tcp any any -> any any (msg:""; sid:1000001; rev:1;)',
  testable: false,
  convertibleTo: [],
  detect: (filename, content) => content.includes("alert ") && content.includes("sid:"),
  validate: (content) => snortValidator(content),
});
```

---

## 8. Guard Registry

**Guard Registry**
- File: `apps/workbench/src/lib/workbench/guard-registry.ts`
- Type: `GuardMeta` from `apps/workbench/src/lib/workbench/types.ts` (lines 534-543):
  ```typescript
  export interface GuardMeta {
    id: GuardId;
    name: string;
    technicalName: string;
    description: string;
    category: GuardCategory;
    defaultVerdict: Verdict;
    icon: string;
    configFields: ConfigFieldDef[];
  }
  ```
- `GuardId` is a closed union of 13 guard IDs (types.ts lines 10-23)
- Registry: `GUARD_REGISTRY: GuardMeta[]` (guard-registry.ts lines 3-217) -- a hardcoded const array
- Derived: `ALL_GUARD_IDS`, `GUARD_DISPLAY_NAMES`, `GUARD_CATEGORIES` (lines 224-238)
- Test: `apps/workbench/src/lib/workbench/__tests__/guard-registry.test.ts`

**Where GuardRegistry is used:**
- Status bar: guard count display
- Editor: guard card list, guard config fields, guard order management
- Coverage: MITRE ATT&CK mapping uses guard categories
- Red team: `GUARD_TO_PLUGINS` mapping in `apps/workbench/src/lib/workbench/redteam/plugin-registry.ts`

**Current state:** STATIC -- const array with closed `GuardId` union
**Plugin integration difficulty:** MEDIUM
**What needs to change:**
1. Change `GuardId` to `string`
2. Make `GUARD_REGISTRY` a mutable list with `registerGuard()` API
3. Make `GUARD_CATEGORIES` extensible (currently a hardcoded 6-item array)
4. Allow plugins to contribute custom config field types beyond the built-in `ConfigFieldType`

---

## 9. Shell Events (Custom DOM Events)

The Desktop app uses **custom DOM events** for cross-component communication.

**Shell Events**
- File: `apps/desktop/src/shell/events.ts`
- Three event types defined:
  ```typescript
  SHELL_OPEN_COMMAND_PALETTE_EVENT = "shell:open-command-palette"
  SHELL_EXECUTE_HOT_COMMAND_EVENT = "shell:execute-hot-command"
  SHELL_FOCUS_AGENT_SESSION_EVENT = "shell:focus-agent-session"
  ```
- Dispatch functions: `dispatchShellOpenCommandPalette()`, `dispatchShellExecuteHotCommand()`, `dispatchShellFocusAgentSession()`

**CyberNexus Events**
- File: `apps/desktop/src/features/cyber-nexus/events.ts` (referenced in ShellLayout)
- Used for nexus-specific commands (camera reset, layout changes, view modes, etc.)
- The `dispatchCyberNexusCommand()` function dispatches CustomEvents

This is already a pluggable seam -- any code can listen for or dispatch these events. A plugin system could formalize this with a typed event bus.

**Current state:** PARTIALLY DYNAMIC -- uses DOM CustomEvents, but event types are not documented or registered
**Plugin integration difficulty:** EASY
**What needs to change:**
1. Create an `EventBus` abstraction that plugins can subscribe to
2. Document event types in a schema
3. Allow plugins to register custom event types

---

## 10. Provider Stack (Context Providers)

### Workbench App Providers
- File: `apps/workbench/src/App.tsx`, `AppProviders` function (lines 288-319)
- **15 nested providers** in a deep tree:
  ```
  OperatorProvider > ReputationProvider > ToastProvider > GeneralSettingsProvider
  > HintSettingsProvider > ProjectProvider > MultiPolicyProvider > SentinelProvider
  > FindingProvider > SignalProvider > IntelProvider > MissionProvider
  > SwarmFeedProvider > SwarmProvider > FleetConnectionProvider
  ```

### Desktop App Providers
- File: `apps/desktop/src/shell/ShellApp.tsx` (lines 53-64)
- **5 nested providers**: `ConnectionProvider > OpenClawProvider > PolicyProvider > SwarmProvider`
- Plus `DockProvider` in `ShellLayout.tsx` (line 347)

**Impact for plugins:** Plugins that need access to workbench state must be rendered inside the provider tree. This is a hard constraint that affects where plugin components can mount.

**What needs to change:**
1. Expose key stores (e.g., fleet connection, operator identity) via a plugin API object rather than requiring context access
2. Allow plugins to register their own providers that mount within the provider tree

---

## Summary: Contribution Point Readiness

| Seam | Desktop App | Workbench App | Difficulty |
|------|-------------|---------------|------------|
| Command Registry | `PaletteCommand` interface exists but no registry | Two separate palettes, both static | Medium / Hard |
| Activity Bar / Sidebar | No sidebar; route-only nav | Static `navSections` const | Medium |
| Pane / Route System | `AppPlugin` + `PluginRoute` exist, `AppId` is closed union | Static `<Route>` elements in JSX | Medium / Hard |
| Bottom Panel / Dock | Capsule system with closed `CapsuleKind` union | Does not exist | Medium / N/A |
| Right Sidebar | Does not exist | Does not exist | N/A |
| Status Bar | Does not exist | Static JSX segments | Easy |
| File Type Registry | N/A (workbench only) | Closed `FileType` union + const record | Medium |
| Guard Registry | N/A (workbench only) | Closed `GuardId` union + const array | Medium |
| Shell Events | DOM CustomEvents (partially dynamic) | N/A | Easy |
| Provider Stack | 5 providers | 15 providers | Hard |

### Priority Recommendation

1. **EASY wins (do first):**
   - Status bar registry (workbench)
   - Event bus formalization (desktop)
   - Wire the existing `AppPlugin.commands` field in the desktop command palette

2. **MEDIUM wins (core plugin infra):**
   - Open `AppId` and `PluginIcon` unions to `string` (desktop)
   - Create `CommandRegistry` singleton (both apps)
   - Make `FILE_TYPE_REGISTRY` and `GUARD_REGISTRY` mutable with register/unregister
   - Make sidebar `navSections` dynamic (workbench)

3. **HARD wins (architecture changes):**
   - Unify the two workbench command palettes
   - Dynamic route injection (both apps -- requires router re-creation)
   - Plugin provider system (context injection without deep nesting)

---

## Key Files Reference

**Desktop App:**
- `apps/desktop/src/shell/plugins/types.ts` -- `AppPlugin`, `PluginRoute`, `PluginCommand`, `AppId`, `PluginIcon`
- `apps/desktop/src/shell/plugins/registry.tsx` -- `getPlugins()`, `getVisiblePlugins()`, `getPlugin()`
- `apps/desktop/src/shell/ShellApp.tsx` -- Route generation from plugins
- `apps/desktop/src/shell/ShellLayout.tsx` -- Shell layout, command palette wiring, keyboard shortcuts
- `apps/desktop/src/shell/components/CommandPalette.tsx` -- `PaletteCommand` interface
- `apps/desktop/src/shell/components/NavRail.tsx` -- Session-focused navigation rail
- `apps/desktop/src/shell/keyboard/useShellShortcuts.ts` -- Keyboard shortcut handler
- `apps/desktop/src/shell/dock/types.ts` -- `CapsuleKind`, `ShelfMode`, dock system types
- `apps/desktop/src/shell/dock/DockSystem.tsx` -- Dock system with capsule content renderers
- `apps/desktop/src/shell/dock/hotCommands.ts` -- Hot command CRUD + resolution
- `apps/desktop/src/shell/events.ts` -- Shell custom DOM events

**Workbench App:**
- `apps/workbench/src/App.tsx` -- Route definitions, provider tree
- `apps/workbench/src/components/desktop/command-palette.tsx` -- Desktop-level command palette
- `apps/workbench/src/components/desktop/desktop-sidebar.tsx` -- Sidebar with `navSections`
- `apps/workbench/src/components/desktop/desktop-layout.tsx` -- Layout (sidebar + outlet + status bar)
- `apps/workbench/src/components/desktop/status-bar.tsx` -- Status bar segments
- `apps/workbench/src/components/desktop/shortcut-provider.tsx` -- Keyboard shortcut registration
- `apps/workbench/src/components/workbench/editor/command-palette.tsx` -- Editor-level command palette
- `apps/workbench/src/lib/keyboard-shortcuts.ts` -- `ShortcutAction` interface + `useKeyboardShortcuts` hook
- `apps/workbench/src/lib/workbench/file-type-registry.ts` -- `FileType`, `FileTypeDescriptor`, `FILE_TYPE_REGISTRY`
- `apps/workbench/src/lib/workbench/guard-registry.ts` -- `GUARD_REGISTRY`, `GuardMeta`, `GUARD_CATEGORIES`
- `apps/workbench/src/lib/workbench/types.ts` -- `GuardId` (closed union), `GuardMeta` interface
