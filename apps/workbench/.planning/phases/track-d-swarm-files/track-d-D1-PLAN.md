---
phase: track-d-swarm-files
plan: D1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/workbench/file-type-registry.ts
  - src/lib/workbench/file-type-icons.tsx
  - src/lib/workbench/swarm-bundle.ts
  - src/features/project/stores/project-store.tsx
  - src/components/workbench/explorer/explorer-panel.tsx
  - src/features/activity-bar/components/sidebar-panel.tsx
  - src/components/desktop/workbench-routes.tsx
  - src/lib/tauri-bridge.ts
autonomous: true
requirements:
  - SBUNDLE-01
  - SBUNDLE-02
  - SBUNDLE-06

must_haves:
  truths:
    - ".swarm directories appear as single leaf entries in the Explorer tree with a purple swarm icon"
    - "Clicking a .swarm entry opens the SwarmBoardPage in a pane tab, not FileEditorShell"
    - "swarm_bundle is a recognized FileType with icon, color, filter toggle, and registry entry"
    - "Internal files inside .swarm directories are not visible in the Explorer tree"
  artifacts:
    - path: "src/lib/workbench/file-type-registry.ts"
      provides: "swarm_bundle added to FileType union and FILE_TYPE_REGISTRY"
      contains: "swarm_bundle"
    - path: "src/lib/workbench/file-type-icons.tsx"
      provides: "IconHexagons icon for swarm_bundle type"
      contains: "swarm_bundle"
    - path: "src/lib/workbench/swarm-bundle.ts"
      provides: "SwarmBundleManifest and SwarmBoardPersisted type definitions"
      exports: ["SwarmBundleManifest", "SwarmBoardPersisted"]
    - path: "src/features/project/stores/project-store.tsx"
      provides: "scanDir intercepts .swarm dirs as leaf files"
      contains: "endsWith(\".swarm\")"
    - path: "src/components/desktop/workbench-routes.tsx"
      provides: "swarm-board/* wildcard route"
      contains: "swarm-board/*"
    - path: "src/features/activity-bar/components/sidebar-panel.tsx"
      provides: "swarm_bundle dispatch to openApp instead of openFile"
      contains: "swarm_bundle"
  key_links:
    - from: "src/features/project/stores/project-store.tsx"
      to: "src/lib/workbench/file-type-registry.ts"
      via: "inferFileTypeFromPath returns swarm_bundle for .swarm names"
      pattern: "swarm_bundle"
    - from: "src/features/activity-bar/components/sidebar-panel.tsx"
      to: "src/components/desktop/workbench-routes.tsx"
      via: "openApp(/swarm-board/...) matches swarm-board/* route"
      pattern: "swarm-board"
---

<objective>
Add `swarm_bundle` as a first-class FileType and make .swarm/ directories appear as single leaf entries in the Explorer that open SwarmBoardPage when clicked.

Purpose: This is the foundational type system and routing layer that D2 (board serialization) builds on. Without this, .swarm directories are just regular folders in the tree.

Output: swarm_bundle type in registry, .swarm dirs collapsed in Explorer, click-to-open routing to /swarm-board/* route.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/track-d-swarm-files/RESEARCH.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src/lib/workbench/file-type-registry.ts:
```typescript
export type FileType = "clawdstrike_policy" | "sigma_rule" | "yara_rule" | "ocsf_event";
// MUST add: | "swarm_bundle"

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

export const FILE_TYPE_REGISTRY: Record<FileType, FileTypeDescriptor> = { ... };
// MUST add swarm_bundle entry

export function getFileTypeByExtension(filename: string): FileType | null;
// MUST handle .swarm suffix
```

From src/lib/workbench/file-type-icons.tsx:
```typescript
// Switch on fileType — MUST add "swarm_bundle" case with IconHexagons
export function FileTypeIcon({ fileType, size, stroke, className }: FileTypeIconProps);
```

From src/features/project/stores/project-store.tsx:
```typescript
export interface ProjectFile {
  path: string;
  name: string;
  fileType: FileType;
  isDirectory: boolean;
  children?: ProjectFile[];
  depth: number;
}

// scanDir (line 89-105) — MUST add .swarm guard before recursion
// inferFileTypeFromPath (line 284-298) — MUST add .swarm check
// buildFileTree (line 137-213) — no change needed if scanDir handles it
```

From src/features/activity-bar/components/sidebar-panel.tsx:
```typescript
// ExplorerPanelConnected.onOpenFile (line 95-108)
// Currently: usePaneStore.getState().openFile(absPath, file.name)
// MUST dispatch swarm_bundle to openApp("/swarm-board/...")
```

From src/features/panes/pane-store.ts:
```typescript
openFile(filePath: string, label: string): void;
openApp(route: string, label: string): void;
```

From src/components/desktop/workbench-routes.tsx:
```typescript
// WORKBENCH_ROUTE_OBJECTS (line 308-375)
// Existing: { path: "swarm-board", element: <SwarmBoardPage /> } at line 329
// Existing: { path: "file/*", element: <FileEditorShell /> } at line 373
// MUST add: { path: "swarm-board/*", element: <SwarmBoardPage /> } BEFORE the plain swarm-board route
```

From src/components/workbench/explorer/explorer-panel.tsx:
```typescript
const ALL_FILE_TYPES: FileType[] = ["clawdstrike_policy", "sigma_rule", "yara_rule", "ocsf_event"];
// MUST add "swarm_bundle"

function countFilesByType(projects: DetectionProject[]): Record<FileType, number> {
  const counts: Record<FileType, number> = { clawdstrike_policy: 0, sigma_rule: 0, yara_rule: 0, ocsf_event: 0 };
  // MUST add swarm_bundle: 0
}
```

From src/lib/tauri-bridge.ts:
```typescript
const FILE_TYPE_FILTERS: Record<FileType, { name: string; extensions: string[] }> = { ... };
// MUST add swarm_bundle entry to satisfy Record<FileType, ...>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add swarm_bundle to FileType union, registry, icons, and exhaustive records</name>
  <read_first>
    - src/lib/workbench/file-type-registry.ts
    - src/lib/workbench/file-type-icons.tsx
    - src/components/workbench/explorer/explorer-panel.tsx
    - src/lib/tauri-bridge.ts
  </read_first>
  <files>
    src/lib/workbench/file-type-registry.ts
    src/lib/workbench/file-type-icons.tsx
    src/lib/workbench/swarm-bundle.ts
    src/components/workbench/explorer/explorer-panel.tsx
    src/lib/tauri-bridge.ts
  </files>
  <action>
1. **src/lib/workbench/swarm-bundle.ts** (NEW FILE): Create bundle type definitions.
   ```typescript
   export interface SwarmBundleManifest {
     version: "1.0.0";
     name: string;
     description?: string;
     created: string;        // ISO 8601
     modified: string;       // ISO 8601
     policyRef?: string;     // path or name of associated policy
     agents?: string[];      // agent model names
     status?: "draft" | "active" | "archived";
   }

   export interface SwarmBoardPersisted {
     boardId: string;
     repoRoot: string;
     nodes: Array<{
       id: string;
       type: string;
       position: { x: number; y: number };
       data: Record<string, unknown>;
       width?: number;
       height?: number;
     }>;
     edges: Array<{
       id: string;
       source: string;
       target: string;
       label?: string;
       type?: string;
     }>;
     viewport?: { x: number; y: number; zoom: number };
   }
   ```

2. **src/lib/workbench/file-type-registry.ts**:
   - Add `"swarm_bundle"` to the `FileType` union (line 6): `| "swarm_bundle"`
   - Add entry to `FILE_TYPE_REGISTRY` (after ocsf_event, before closing brace):
     ```typescript
     swarm_bundle: {
       id: "swarm_bundle",
       label: "Swarm Bundle",
       shortLabel: "Swarm",
       extensions: [".swarm"],
       iconColor: "#8b5cf6",
       defaultContent: "",
       testable: false,
       convertibleTo: [],
     },
     ```
   - In `getFileTypeByExtension` (line 183), add before the `return null`:
     ```typescript
     if (lower.endsWith(".swarm")) {
       return "swarm_bundle";
     }
     ```

3. **src/lib/workbench/file-type-icons.tsx**:
   - Add `IconHexagons` to the import from `@tabler/icons-react` (line 1).
   - Add a case before the `default` in the switch (line 111):
     ```typescript
     case "swarm_bundle":
       return (
         <IconHexagons
           size={size}
           stroke={stroke}
           style={{ color: getIconColor(fileType) }}
           aria-label={getLabel(fileType)}
           className={className}
         />
       );
     ```

4. **src/components/workbench/explorer/explorer-panel.tsx**:
   - Add `"swarm_bundle"` to `ALL_FILE_TYPES` array (line 54-59).
   - Add `swarm_bundle: 0` to the `counts` record in `countFilesByType` (line 786-790).

5. **src/lib/tauri-bridge.ts**:
   - Add `swarm_bundle` entry to `FILE_TYPE_FILTERS` (line 135-140):
     ```typescript
     swarm_bundle: { name: "Swarm Bundle", extensions: ["swarm"] },
     ```
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "swarm_bundle" src/lib/workbench/file-type-registry.ts
    - grep -q "swarm_bundle" src/lib/workbench/file-type-icons.tsx
    - grep -q "IconHexagons" src/lib/workbench/file-type-icons.tsx
    - grep -q "swarm_bundle" src/components/workbench/explorer/explorer-panel.tsx
    - grep -q "swarm_bundle" src/lib/tauri-bridge.ts
    - test -f src/lib/workbench/swarm-bundle.ts
    - grep -q "SwarmBundleManifest" src/lib/workbench/swarm-bundle.ts
    - grep -q "SwarmBoardPersisted" src/lib/workbench/swarm-bundle.ts
    - TypeScript compiles without errors related to FileType exhaustiveness
  </acceptance_criteria>
  <done>
    swarm_bundle is a recognized FileType throughout the codebase. All Record<FileType, ...> objects include it. The icon renders as purple IconHexagons. The filter toggle pill appears in the Explorer toolbar. The swarm-bundle.ts types file exists with manifest and board persistence schemas.
  </done>
</task>

<task type="auto">
  <name>Task 2: Intercept .swarm dirs in scanDir, route clicks to SwarmBoardPage</name>
  <read_first>
    - src/features/project/stores/project-store.tsx
    - src/features/activity-bar/components/sidebar-panel.tsx
    - src/components/desktop/workbench-routes.tsx
  </read_first>
  <files>
    src/features/project/stores/project-store.tsx
    src/features/activity-bar/components/sidebar-panel.tsx
    src/components/desktop/workbench-routes.tsx
  </files>
  <action>
1. **src/features/project/stores/project-store.tsx**:
   - In `scanDir` (line 89-105), add a guard clause inside the `for` loop, right after `if (entry.isDirectory)` on line 96, BEFORE the existing `paths.push(relPath + "/")` on line 97:
     ```typescript
     if (entry.isDirectory) {
       // .swarm bundle detection — emit as leaf file, skip recursion
       if (entry.name.endsWith(".swarm")) {
         paths.push(relPath);  // No trailing slash = file convention
         continue;
       }
       paths.push(relPath + "/");
       const subPaths = await scanDir(fullPath, basePath);
       paths.push(...subPaths);
     }
     ```
   - In `inferFileTypeFromPath` (line 284-298), add as the FIRST check before the existing `getFileTypeByExtension` call:
     ```typescript
     if (name.endsWith(".swarm")) return "swarm_bundle";
     ```

2. **src/features/activity-bar/components/sidebar-panel.tsx**:
   - In the `onOpenFile` callback (line 95-108), after resolving `absPath` (line 104-106), add a type dispatch before the existing `usePaneStore.getState().openFile(absPath, file.name)` call:
     ```typescript
     if (file.fileType === "swarm_bundle") {
       usePaneStore.getState().openApp(
         `/swarm-board/${encodeURIComponent(absPath)}`,
         file.name.replace(/\.swarm$/, ""),
       );
     } else {
       usePaneStore.getState().openFile(absPath, file.name);
     }
     ```
   - This replaces the single `usePaneStore.getState().openFile(absPath, file.name)` line on line 107.

3. **src/components/desktop/workbench-routes.tsx**:
   - Add a wildcard `swarm-board/*` route BEFORE the existing `swarm-board` route (line 329). Insert at approximately line 329:
     ```typescript
     { path: "swarm-board/*", element: <Suspense fallback={<div className="flex-1" />}><SwarmBoardPage /></Suspense> },
     ```
     The existing plain `{ path: "swarm-board", ... }` route on line 329 stays as-is (for backward compat with scratch boards).
   - In `getWorkbenchRouteLabel` (line 254-306), add BEFORE the existing `if (url.pathname === "/swarm-board")` check on line 263:
     ```typescript
     if (url.pathname.startsWith("/swarm-board/")) {
       const segments = url.pathname.split("/").filter(Boolean);
       const last = segments[segments.length - 1];
       try {
         const decoded = decodeURIComponent(last);
         return decoded.replace(/\.swarm$/, "").split("/").pop() || "Swarm Board";
       } catch {
         return "Swarm Board";
       }
     }
     ```
   - In `normalizeWorkbenchRoute` (line 212-252), add a pass-through for swarm-board routes after the file route check (line 216-218):
     ```typescript
     if (url.pathname.startsWith("/swarm-board/")) {
       return `${url.pathname}${url.search}` || "/swarm-board";
     }
     ```
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - grep -q 'endsWith(".swarm")' src/features/project/stores/project-store.tsx
    - grep -q "swarm_bundle" src/features/project/stores/project-store.tsx
    - grep -q "swarm_bundle" src/features/activity-bar/components/sidebar-panel.tsx
    - grep -q "swarm-board/\*" src/components/desktop/workbench-routes.tsx
    - grep -q "swarm-board/" src/components/desktop/workbench-routes.tsx
    - The scanDir function has the .swarm guard BEFORE the recursive call
    - The onOpenFile callback dispatches to openApp for swarm_bundle, openFile for others
    - TypeScript compiles without errors
  </acceptance_criteria>
  <done>
    .swarm directories in the workspace tree appear as leaf files (not expandable folders) with swarm_bundle type. Clicking them routes to /swarm-board/{encodedPath} which matches the wildcard route and renders SwarmBoardPage. Internal bundle contents are invisible in the Explorer. The route label shows the bundle name without the .swarm suffix.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles cleanly: `npx tsc --noEmit`
2. The FileType union includes "swarm_bundle" and all Record<FileType, ...> objects are exhaustive
3. scanDir skips recursion into .swarm directories
4. inferFileTypeFromPath returns "swarm_bundle" for names ending in .swarm
5. Explorer shows .swarm entries as purple-icon leaf files, not folders
6. Clicking a .swarm entry creates a pane tab routed to /swarm-board/*
7. The swarm-board/* route resolves to SwarmBoardPage
</verification>

<success_criteria>
- swarm_bundle is a fully integrated FileType (registry, icon, filter toggle, file-type-filters record)
- .swarm directories are collapsed to leaf entries in the Explorer tree
- Clicking a .swarm entry opens SwarmBoardPage via pane routing (not FileEditorShell)
- No TypeScript compilation errors
- SwarmBundleManifest and SwarmBoardPersisted types are defined for D2 consumption
</success_criteria>

<output>
After completion, create `.planning/phases/track-d-swarm-files/track-d-D1-SUMMARY.md`
</output>
