---
phase: track-b-swarm
plan: 01
subsystem: ui
tags: [zustand, react, state-management, createSelectors, swarm-board]

# Dependency graph
requires: []
provides:
  - "Zustand-based SwarmBoard store (useSwarmBoardStore) accessible outside provider tree"
  - "Backward-compatible useSwarmBoard() hook composing store + session context"
  - "SwarmBoardProvider thin wrapper for session lifecycle only"
  - "setNodes/setEdges/addNodeDirect store actions for React Flow integration"
  - "reinitializeFromStorage for Zustand singleton test isolation"
affects: [track-b-swarm-02, track-b-swarm-03]

# Tech tracking
tech-stack:
  added: [zustand/react/shallow (useShallow)]
  patterns: [zustand-singleton-with-provider-reinitialize, dispatch-shim-for-backward-compat, session-context-separation]

key-files:
  created:
    - "src/features/swarm/stores/__tests__/swarm-board-store.test.ts"
  modified:
    - "src/features/swarm/stores/swarm-board-store.tsx"
    - "src/components/workbench/swarm-board/swarm-board-page.tsx"
    - "src/lib/workbench/__tests__/swarm-board-store.test.tsx"

key-decisions:
  - "Separate SwarmBoardSessionContext for session lifecycle (PTY refs cannot live in Zustand)"
  - "reinitializeFromStorage on SwarmBoardProvider mount for test parity with old Context pattern"
  - "useShallow from zustand/react/shallow to prevent infinite re-render with inline object selectors"
  - "Dispatch shim routes legacy SwarmBoardAction to store actions for gradual migration"

patterns-established:
  - "Zustand singleton + provider reinitialize: call reinitializeFromStorage() on provider mount for stores that need fresh-from-localStorage behavior like old Context"
  - "Session context separation: mutable refs and async Tauri callbacks in a React Context, pure state in Zustand"
  - "Dispatch shim: createDispatchShim() routes old action union to new Zustand actions for zero-breakage migration"

requirements-completed: [SWARM-01]

# Metrics
duration: 10min
completed: 2026-03-19
---

# Track B Swarm Plan 01: SwarmBoard Store Zustand Migration Summary

**Zustand board store with createSelectors, 14 action types, localStorage persistence, useSwarmBoardStore for cross-tree access, backward-compatible useSwarmBoard() hook**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-19T13:52:36Z
- **Completed:** 2026-03-19T14:03:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migrated SwarmBoard from Context+useReducer to Zustand with createSelectors, matching established project pattern
- Exported useSwarmBoardStore for cross-tree access (key unlock for SWARM-02 editor integration and SWARM-03 coordinator wiring)
- All 230 swarm-board tests pass (169 existing component + 38 old store + 23 new unit tests)
- TypeScript compiles cleanly with no errors
- Replaced all raw dispatch() calls in SwarmBoardPage with direct store action calls

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing Zustand store tests** - `3d5e528d2` (test)
2. **Task 1 GREEN: Migrate board store to Zustand** - `82274722b` (feat)
3. **Task 2: Update SwarmBoardPage consumers** - `2cc00f763` (feat)

## Files Created/Modified
- `src/features/swarm/stores/swarm-board-store.tsx` - Zustand store with createSelectors, actions namespace, derived state (selectedNode, rfEdges), dispatch shim, SwarmBoardSessionContext, reinitializeFromStorage
- `src/features/swarm/stores/__tests__/swarm-board-store.test.ts` - 23 unit tests covering all 14 action types, derived state, persistence, factory functions
- `src/components/workbench/swarm-board/swarm-board-page.tsx` - Replaced dispatch() with storeActions.*, imported useSwarmBoardStore
- `src/lib/workbench/__tests__/swarm-board-store.test.tsx` - Updated outside-provider test (hook now works globally, session methods reject)

## Decisions Made
- **Session context separation:** PTY refs (exitListenersRef, worktreeMapRef, closedSessionsRef) and async Tauri callbacks cannot live in Zustand (not serializable, hold mutable closures). Kept as SwarmBoardSessionContext in SwarmBoardProvider.
- **reinitializeFromStorage on mount:** Zustand stores are singletons initialized once. To maintain parity with old Context (fresh state each render), SwarmBoardProvider calls reinitializeFromStorage() on mount. This ensures tests and HMR see correct state.
- **useShallow for object selectors:** The useSwarmBoard() hook selects multiple state fields as an object. Without useShallow, this creates new references every render, causing infinite loops. Used zustand/react/shallow.
- **Dispatch shim:** Rather than requiring all consumers to change simultaneously, exported a createDispatchShim() that routes legacy SwarmBoardAction discriminated union to Zustand action methods. This enables gradual migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zustand singleton infinite re-render loop**
- **Found during:** Task 1 (GREEN phase, running page tests)
- **Issue:** useSwarmBoard() hook used inline object selector `(s) => ({ boardId, repoRoot, ... })` which creates new reference every render, causing React to infinite-loop
- **Fix:** Added `useShallow` from `zustand/react/shallow` to wrap the object selector
- **Files modified:** src/features/swarm/stores/swarm-board-store.tsx
- **Verification:** All 17 page tests pass, no infinite render errors
- **Committed in:** 82274722b (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed Zustand singleton test isolation with reinitializeFromStorage**
- **Found during:** Task 1 (GREEN phase, running existing component tests)
- **Issue:** Zustand stores are singletons -- old Context tests expected fresh state per mount. Tests that set localStorage then rendered the provider got stale singleton state instead of fresh-from-localStorage state.
- **Fix:** Added reinitializeFromStorage() method and called it on SwarmBoardProvider mount
- **Files modified:** src/features/swarm/stores/swarm-board-store.tsx
- **Verification:** All 169 existing component tests pass, all 38 old store tests pass
- **Committed in:** 82274722b (Task 1 GREEN commit)

**3. [Rule 1 - Bug] Updated outside-provider test expectation**
- **Found during:** Task 1 (GREEN phase, running old store tests)
- **Issue:** Old test expected useSwarmBoard() to throw when used outside provider. With Zustand, store data is globally accessible (this is the feature). Session methods reject, but the hook itself works.
- **Fix:** Updated test to verify hook works globally and session methods reject with appropriate error
- **Files modified:** src/lib/workbench/__tests__/swarm-board-store.test.tsx
- **Verification:** All 38 old store tests pass
- **Committed in:** 82274722b (Task 1 GREEN commit)

---

**Total deviations:** 3 auto-fixed (3 bugs related to Zustand singleton behavior)
**Impact on plan:** All auto-fixes necessary for correctness -- inherent to migrating from Context (per-mount isolation) to Zustand (global singleton). No scope creep.

## Issues Encountered
None beyond the deviation fixes documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useSwarmBoardStore is exported and globally accessible -- SWARM-02 (editor integration) can import and subscribe to board state from outside the SwarmBoardProvider tree
- SwarmBoardProvider still wraps the page for session lifecycle -- no changes needed to app router
- All existing consumers continue to work via useSwarmBoard() backward-compatible hook
- Dispatch shim available for any consumers that haven't migrated yet

## Self-Check: PASSED

- FOUND: src/features/swarm/stores/__tests__/swarm-board-store.test.ts
- FOUND: .planning/phases/track-b-swarm/track-b-swarm-01-SUMMARY.md
- FOUND: 3d5e528d2 (RED phase commit)
- FOUND: 82274722b (GREEN phase commit)
- FOUND: 2cc00f763 (Task 2 commit)

---
*Phase: track-b-swarm*
*Completed: 2026-03-19*
