---
phase: track-d-swarm-files
plan: D2
type: execute
wave: 2
depends_on: ["D1"]
files_modified:
  - src/lib/tauri-bridge.ts
  - src/features/swarm/swarm-board-types.ts
  - src/features/swarm/stores/swarm-board-store.tsx
  - src/components/workbench/swarm-board/swarm-board-page.tsx
  - src/lib/commands/navigate-commands.ts
autonomous: true
requirements:
  - SBUNDLE-03
  - SBUNDLE-04
  - SBUNDLE-05
  - SBUNDLE-07

must_haves:
  truths:
    - "SwarmBoardPage loads board state from board.json when opened via /swarm-board/{bundlePath}"
    - "Board changes auto-save to board.json with debouncing when opened from a .swarm bundle"
    - "New Swarm Board command creates a .swarm/ directory with manifest.json and empty board.json"
    - "manifest.json stores name, created timestamp, version, and optional policy ref / agent list / status"
    - "Scratch boards (no bundlePath) still use localStorage persistence as before"
  artifacts:
    - path: "src/lib/tauri-bridge.ts"
      provides: "readSwarmBundle, writeSwarmBoardJson, createSwarmBundle helper functions"
      contains: "readSwarmBundle"
    - path: "src/features/swarm/swarm-board-types.ts"
      provides: "bundlePath field on SwarmBoardState"
      contains: "bundlePath"
    - path: "src/features/swarm/stores/swarm-board-store.tsx"
      provides: "loadFromBundle and file-backed persistBoard logic"
      contains: "loadFromBundle"
    - path: "src/components/workbench/swarm-board/swarm-board-page.tsx"
      provides: "useParams-based bundle path extraction and provider prop passing"
      contains: "bundlePath"
    - path: "src/lib/commands/navigate-commands.ts"
      provides: "nav.newSwarm command registered"
      contains: "nav.newSwarm"
  key_links:
    - from: "src/components/workbench/swarm-board/swarm-board-page.tsx"
      to: "src/features/swarm/stores/swarm-board-store.tsx"
      via: "bundlePath prop passed to SwarmBoardProvider triggers loadFromBundle"
      pattern: "bundlePath"
    - from: "src/features/swarm/stores/swarm-board-store.tsx"
      to: "src/lib/tauri-bridge.ts"
      via: "persistBoard calls writeSwarmBoardJson when bundlePath is set"
      pattern: "writeSwarmBoardJson"
    - from: "src/lib/commands/navigate-commands.ts"
      to: "src/lib/tauri-bridge.ts"
      via: "nav.newSwarm command calls createSwarmBundle"
      pattern: "createSwarmBundle"
---

<objective>
Wire file-backed persistence for .swarm bundles: load board.json on mount, auto-save on changes, and add a "New Swarm Board" command that creates the .swarm/ directory structure.

Purpose: Without this, .swarm entries open SwarmBoardPage but can't load/save state from the bundle. This plan completes the full round-trip: create bundle -> open bundle -> edit board -> auto-save to disk.

Output: File-backed board persistence, manifest.json metadata, "New Swarm Board" command in palette.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/track-d-swarm-files/RESEARCH.md
@.planning/phases/track-d-swarm-files/track-d-D1-SUMMARY.md

<interfaces>
<!-- Types created by D1 that this plan depends on -->

From src/lib/workbench/swarm-bundle.ts (created in D1):
```typescript
export interface SwarmBundleManifest {
  version: "1.0.0";
  name: string;
  description?: string;
  created: string;
  modified: string;
  policyRef?: string;
  agents?: string[];
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

From src/features/swarm/swarm-board-types.ts:
```typescript
export interface SwarmBoardState {
  boardId: string;
  repoRoot: string;
  nodes: Node<SwarmBoardNodeData>[];
  edges: SwarmBoardEdge[];
  selectedNodeId: string | null;
  inspectorOpen: boolean;
  // D2 ADDS: bundlePath?: string;
}
```

From src/features/swarm/stores/swarm-board-store.tsx:
```typescript
// persistBoard (line 73-85) — writes to localStorage
// loadPersistedBoard (line 87-148) — reads from localStorage
// schedulePersist (line 507-513) — 500ms debounce, calls persistBoard
// SwarmBoardProvider (line 978+) — calls reinitializeFromStorage on mount
// actions.loadState (line 700-712) — merges partial state + triggers schedulePersist
// reinitializeFromStorage (line 785-792) — resets store from localStorage
```

From src/lib/tauri-bridge.ts:
```typescript
export function isDesktop(): boolean;
export async function createDirectory(dirPath: string): Promise<boolean>;
// Tauri FS pattern: lazy import("@tauri-apps/plugin-fs") for readTextFile, writeTextFile, exists, mkdir
```

From src/lib/commands/navigate-commands.ts:
```typescript
// Pattern: { id: "nav.xxx", title: "...", category: "Navigate", execute: () => usePaneStore.getState().openApp(...) }
// Registration via commandRegistry.registerAll(commands)
```

From src/features/panes/pane-store.ts:
```typescript
openApp(route: string, label: string): void;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Tauri FS bundle helpers and extend board store with file-backed persistence</name>
  <read_first>
    - src/lib/tauri-bridge.ts
    - src/features/swarm/swarm-board-types.ts
    - src/features/swarm/stores/swarm-board-store.tsx (lines 60-180 for persistence, lines 500-550 for schedulePersist, lines 700-712 for loadState, lines 978-1000 for Provider)
    - src/lib/workbench/swarm-bundle.ts
  </read_first>
  <files>
    src/lib/tauri-bridge.ts
    src/features/swarm/swarm-board-types.ts
    src/features/swarm/stores/swarm-board-store.tsx
  </files>
  <action>
1. **src/lib/tauri-bridge.ts** -- Add three new exported functions at the end of the file:

   ```typescript
   /**
    * Read a .swarm bundle's board.json file.
    * Returns the parsed SwarmBoardPersisted data, or null if not found / not desktop.
    */
   export async function readSwarmBundle(bundlePath: string): Promise<{
     manifest: Record<string, unknown> | null;
     board: Record<string, unknown> | null;
   } | null> {
     if (!isDesktop()) return null;
     try {
       const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
       const manifestPath = `${bundlePath}/manifest.json`;
       const manifest = (await exists(manifestPath))
         ? JSON.parse(await readTextFile(manifestPath))
         : null;
       const boardPath = `${bundlePath}/board.json`;
       const board = (await exists(boardPath))
         ? JSON.parse(await readTextFile(boardPath))
         : null;
       return { manifest, board };
     } catch (err) {
       console.error("[tauri-bridge] readSwarmBundle failed:", bundlePath, err);
       return null;
     }
   }

   /**
    * Write board.json inside a .swarm bundle directory.
    * Creates the file if it doesn't exist. Returns true on success.
    */
   export async function writeSwarmBoardJson(
     bundlePath: string,
     board: Record<string, unknown>,
   ): Promise<boolean> {
     if (!isDesktop()) return false;
     try {
       const { writeTextFile } = await import("@tauri-apps/plugin-fs");
       await writeTextFile(
         `${bundlePath}/board.json`,
         JSON.stringify(board, null, 2),
       );
       return true;
     } catch (err) {
       console.error("[tauri-bridge] writeSwarmBoardJson failed:", bundlePath, err);
       return false;
     }
   }

   /**
    * Create a new .swarm bundle directory with manifest.json and empty board.json.
    * Returns the absolute bundle path on success, or null on failure.
    */
   export async function createSwarmBundle(
     parentDir: string,
     name: string,
   ): Promise<string | null> {
     if (!isDesktop()) return null;
     try {
       const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
       const safeName = name.replace(/[<>:"/\\|?*]/g, "_").replace(/\.swarm$/, "");
       const bundlePath = `${parentDir}/${safeName}.swarm`;
       await mkdir(bundlePath, { recursive: true });

       const now = new Date().toISOString();
       const manifest = {
         version: "1.0.0",
         name: safeName,
         created: now,
         modified: now,
       };
       await writeTextFile(
         `${bundlePath}/manifest.json`,
         JSON.stringify(manifest, null, 2),
       );

       const board = {
         boardId: `board-${Date.now().toString(36)}`,
         repoRoot: "",
         nodes: [],
         edges: [],
         viewport: { x: 0, y: 0, zoom: 1 },
       };
       await writeTextFile(
         `${bundlePath}/board.json`,
         JSON.stringify(board, null, 2),
       );

       return bundlePath;
     } catch (err) {
       console.error("[tauri-bridge] createSwarmBundle failed:", err);
       return null;
     }
   }
   ```

2. **src/features/swarm/swarm-board-types.ts** -- Add `bundlePath` to `SwarmBoardState`:
   ```typescript
   export interface SwarmBoardState {
     boardId: string;
     repoRoot: string;
     nodes: Node<SwarmBoardNodeData>[];
     edges: SwarmBoardEdge[];
     selectedNodeId: string | null;
     inspectorOpen: boolean;
     /** Absolute path to the .swarm bundle directory, or empty string for scratch boards. */
     bundlePath: string;
   }
   ```

3. **src/features/swarm/stores/swarm-board-store.tsx** -- Extend persistence for file-backed bundles:

   a. In `getInitialState()` (around line 519-542), add `bundlePath: ""` to the returned objects.

   b. In the Zustand store initial state spread (around line 590-593), ensure `bundlePath` propagates.

   c. Modify `persistBoard` (line 73-85) to ALSO write to file when `bundlePath` is set:
      ```typescript
      function persistBoard(state: SwarmBoardState): void {
        try {
          const persisted = {
            boardId: state.boardId,
            repoRoot: state.repoRoot,
            nodes: state.nodes,
            edges: state.edges,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

          // File-backed persistence for .swarm bundles
          if (state.bundlePath) {
            import("@/lib/tauri-bridge").then(({ writeSwarmBoardJson }) => {
              writeSwarmBoardJson(state.bundlePath, persisted).catch((err) => {
                console.error("[swarm-board-store] file persist failed:", err);
              });
            }).catch(() => {
              // Not in Tauri environment
            });
          }
        } catch (e) {
          console.error("[swarm-board-store] persistBoard failed:", e);
        }
      }
      ```

   d. Add a `loadFromBundle` action to the `actions` namespace (alongside `loadState`):
      ```typescript
      loadFromBundle: async (bundlePath: string): Promise<void> => {
        try {
          const { readSwarmBundle } = await import("@/lib/tauri-bridge");
          const data = await readSwarmBundle(bundlePath);
          if (!data?.board) {
            // Empty bundle — just set the path, keep empty board
            set({ bundlePath });
            return;
          }
          const board = data.board as Record<string, unknown>;
          const nodes = Array.isArray(board.nodes) ? board.nodes as Node<SwarmBoardNodeData>[] : [];
          const edges = Array.isArray(board.edges) ? board.edges as SwarmBoardEdge[] : [];
          const boardId = typeof board.boardId === "string" ? board.boardId : generateBoardId();
          const repoRoot = typeof board.repoRoot === "string" ? board.repoRoot : "";
          set({
            bundlePath,
            boardId,
            repoRoot,
            nodes,
            edges,
            selectedNodeId: null,
            inspectorOpen: false,
            selectedNode: undefined,
            rfEdges: toRfEdges(edges),
          });
        } catch (err) {
          console.error("[swarm-board-store] loadFromBundle failed:", err);
          set({ bundlePath });
        }
      },
      ```

   e. Add `loadFromBundle` to the `SwarmBoardStoreState` interface (around line 548-571):
      ```typescript
      loadFromBundle: (bundlePath: string) => Promise<void>;
      ```

   f. Modify `SwarmBoardProvider` (line 978+) to accept an optional `bundlePath` prop. When present, call `loadFromBundle` instead of `reinitializeFromStorage`:
      ```typescript
      export function SwarmBoardProvider({ children, bundlePath }: { children: ReactNode; bundlePath?: string }) {
        useEffect(() => {
          if (bundlePath) {
            useSwarmBoardStore.getState().actions.loadFromBundle(bundlePath);
          } else {
            useSwarmBoardStore.reinitializeFromStorage();
          }
        }, [bundlePath]);

        // ... rest of provider unchanged
      }
      ```

   g. In `loadState` action (line 700-712), also propagate `bundlePath` if present in the partial:
      After the existing `set({...})`, no change needed since `...partial` already spreads it. But ensure `bundlePath` is NOT reset to `""` — only set it if explicitly provided in partial.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "readSwarmBundle" src/lib/tauri-bridge.ts
    - grep -q "writeSwarmBoardJson" src/lib/tauri-bridge.ts
    - grep -q "createSwarmBundle" src/lib/tauri-bridge.ts
    - grep -q "bundlePath" src/features/swarm/swarm-board-types.ts
    - grep -q "loadFromBundle" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "bundlePath" src/features/swarm/stores/swarm-board-store.tsx
    - grep -q "writeSwarmBoardJson" src/features/swarm/stores/swarm-board-store.tsx
    - TypeScript compiles without errors
  </acceptance_criteria>
  <done>
    Board store has file-backed persistence: when bundlePath is set, persistBoard writes board.json via Tauri FS (debounced, alongside localStorage). loadFromBundle reads board.json and hydrates the store. SwarmBoardProvider accepts bundlePath prop to choose between file-backed and localStorage persistence modes. Three new Tauri bridge helpers exist for reading, writing, and creating .swarm bundles.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire SwarmBoardPage to read bundlePath from route and register "New Swarm Board" command</name>
  <read_first>
    - src/components/workbench/swarm-board/swarm-board-page.tsx (lines 791-802 for SwarmBoardPage wrapper)
    - src/lib/commands/navigate-commands.ts
    - src/features/project/stores/project-store.tsx (lines 550-558 for addRoot pattern)
  </read_first>
  <files>
    src/components/workbench/swarm-board/swarm-board-page.tsx
    src/lib/commands/navigate-commands.ts
  </files>
  <action>
1. **src/components/workbench/swarm-board/swarm-board-page.tsx**:
   - Add `useLocation` import from `react-router-dom`.
   - Modify the `SwarmBoardPage` wrapper (line 791-798) to extract the bundle path from the route and pass it to `SwarmBoardProvider`:
     ```typescript
     export function SwarmBoardPage() {
       // Extract bundlePath from the wildcard route segment.
       // Route is "swarm-board/*" so location.pathname looks like "/swarm-board/encoded%2Fpath"
       // For the plain "/swarm-board" route (scratch board), bundlePath will be empty.
       const location = useLocation();
       const bundlePath = useMemo(() => {
         const prefix = "/swarm-board/";
         if (!location.pathname.startsWith(prefix)) return undefined;
         const encoded = location.pathname.slice(prefix.length);
         if (!encoded) return undefined;
         try {
           return decodeURIComponent(encoded);
         } catch {
           return undefined;
         }
       }, [location.pathname]);

       return (
         <SwarmBoardProvider bundlePath={bundlePath}>
           <ReactFlowProvider>
             <SwarmBoardCanvas />
           </ReactFlowProvider>
         </SwarmBoardProvider>
       );
     }
     ```
   - Also add `useMemo` to the existing imports if not already there (it IS already imported on line 12).
   - Add `useLocation` to the react-router-dom imports (there are none currently; add `import { useLocation } from "react-router-dom";`).

2. **src/lib/commands/navigate-commands.ts**:
   - Add a "New Swarm Board" command to the `commands` array, after the existing `app.swarmBoard` entry (around line 249):
     ```typescript
     {
       id: "nav.newSwarm",
       title: "New Swarm Board",
       category: "File",
       execute: async () => {
         const { isDesktop, createSwarmBundle } = await import("@/lib/tauri-bridge");
         if (!isDesktop()) return;

         // Use the first mounted workspace root as the parent directory
         const { useProjectStore } = await import("@/features/project/stores/project-store");
         const roots = useProjectStore.getState().projectRoots;
         if (roots.length === 0) return;
         const parentDir = roots[0];

         // Generate a default name with timestamp
         const timestamp = new Date().toISOString().slice(0, 10);
         const name = `investigation-${timestamp}`;

         const bundlePath = await createSwarmBundle(parentDir, name);
         if (!bundlePath) return;

         // Refresh the Explorer tree so the new .swarm entry appears
         await useProjectStore.getState().actions.loadRoot(parentDir);

         // Open the new board
         const label = name.replace(/\.swarm$/, "");
         usePaneStore.getState().openApp(
           `/swarm-board/${encodeURIComponent(bundlePath)}`,
           label,
         );
       },
     },
     ```
   - Ensure the command is added inside the existing `commands` array before `commandRegistry.registerAll(commands)`.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "useLocation" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "bundlePath" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "SwarmBoardProvider bundlePath" src/components/workbench/swarm-board/swarm-board-page.tsx
    - grep -q "nav.newSwarm" src/lib/commands/navigate-commands.ts
    - grep -q "createSwarmBundle" src/lib/commands/navigate-commands.ts
    - grep -q "New Swarm Board" src/lib/commands/navigate-commands.ts
    - TypeScript compiles without errors
  </acceptance_criteria>
  <done>
    SwarmBoardPage extracts bundlePath from the wildcard route and passes it to SwarmBoardProvider, which loads board.json from the bundle on mount. The "New Swarm Board" command (nav.newSwarm) creates a .swarm/ directory with manifest.json + empty board.json in the first workspace root, refreshes the Explorer, and opens the new board in a pane tab. The command appears in the command palette under "File" category.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles cleanly: `npx tsc --noEmit`
2. Creating a .swarm bundle via nav.newSwarm produces: parentDir/name.swarm/manifest.json + board.json
3. manifest.json contains version, name, created, modified fields
4. Opening a .swarm bundle from Explorer loads board.json into the store
5. Editing the board triggers debounced writes to board.json
6. Opening the scratch /swarm-board route (no path) still uses localStorage
7. The nav.newSwarm command is available in the command palette
</verification>

<success_criteria>
- Full round-trip works: create .swarm bundle -> see it in Explorer -> click to open -> edit board -> changes auto-saved to board.json
- manifest.json has SBUNDLE-07 metadata fields (name, created, version, optional policyRef/agents/status)
- Scratch boards (plain /swarm-board route) remain unaffected, using localStorage
- nav.newSwarm command creates bundle and opens it in one action
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/phases/track-d-swarm-files/track-d-D2-SUMMARY.md`
</output>
