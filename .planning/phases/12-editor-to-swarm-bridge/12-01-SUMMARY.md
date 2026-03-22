---
phase: 12-editor-to-swarm-bridge
plan: 01
subsystem: ui
tags: [react, zustand, tauri, swarm, toolbar, pane-system]

# Dependency graph
requires:
  - phase: 11-integration-wiring-fixes
    provides: pane-store openApp pattern, navigate-to-editor wiring
provides:
  - createSwarmBundleFromPolicy bridge function in tauri-bridge.ts
  - swarm.launchFromEditor command in navigate-commands.ts
  - Launch Swarm toolbar button in FileEditorToolbar
affects: [swarm-board, editor, command-palette]

# Tech tracking
tech-stack:
  added: []
  patterns: [editor-to-swarm bridge via createSwarmBundleFromPolicy, policy-gated toolbar buttons]

key-files:
  created: []
  modified:
    - apps/workbench/src/lib/tauri-bridge.ts
    - apps/workbench/src/lib/commands/navigate-commands.ts
    - apps/workbench/src/features/editor/file-editor-toolbar.tsx

key-decisions:
  - "Bundle naming uses {policyFileName}-{date}.swarm pattern with sanitized stems"
  - "Sentinel nodes pre-seeded as agentSession type in 3-column grid layout"
  - "Launch Swarm button placed after RunButtonGroup, gated on isPolicyFileType"

patterns-established:
  - "Editor-to-swarm bridge: toolbar button creates .swarm bundle then opens pane via usePaneStore.openApp"
  - "Policy-aware bundle creation: manifest.policyRef + agentSession nodes from sentinel store"

requirements-completed: [SWARM-01, SWARM-02, SWARM-03]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 12 Plan 01: Editor-to-Swarm Bridge Summary

**Launch Swarm button in editor toolbar creates policy-linked .swarm bundles with pre-seeded sentinel agent nodes and opens the swarm board pane**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T02:48:51Z
- **Completed:** 2026-03-22T02:51:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- createSwarmBundleFromPolicy function in tauri-bridge.ts creates .swarm bundles with policyRef in manifest and agentSession nodes for each active sentinel in board.json
- swarm.launchFromEditor command registered in navigate-commands.ts, gated on policy file type, available from command palette
- Launch Swarm button (IconTopologyRing) added to FileEditorToolbar after RunButtonGroup, visible only for policy files, with toast notifications for error states

## Task Commits

Each task was committed atomically:

1. **Task 1: Add createSwarmBundleFromPolicy to tauri-bridge and register swarm.launchFromEditor command** - `0d28ddf17` (feat)
2. **Task 2: Add Launch Swarm button to FileEditorToolbar** - `243d7336f` (feat)

## Files Created/Modified
- `apps/workbench/src/lib/tauri-bridge.ts` - Added CreateSwarmFromPolicyOptions interface and createSwarmBundleFromPolicy function that creates .swarm bundles with policyRef manifest and sentinel agentSession nodes
- `apps/workbench/src/lib/commands/navigate-commands.ts` - Added swarm.launchFromEditor command that bridges active policy tab to swarm bundle creation and pane opening
- `apps/workbench/src/features/editor/file-editor-toolbar.tsx` - Added Launch Swarm button with IconTopologyRing icon, handleLaunchSwarm callback, usePaneStore and useSentinelStore imports

## Decisions Made
- Bundle naming uses {policyFileName}-{date}.swarm pattern with sanitized stems (matching user decision)
- Sentinel nodes pre-seeded as agentSession type with 3-column grid layout (80px start, 420px horizontal gap, 320px vertical gap)
- Launch Swarm button placed after RunButtonGroup in the isPolicy block (matching user decision)
- Dynamic imports used for useProjectStore and tauri-bridge to keep bundle size small; static imports for usePaneStore and useSentinelStore since they are lightweight

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Editor-to-swarm bridge complete, button functional for policy files
- Swarm board pane opens via /swarm-board/{encodedPath} route
- Ready for any downstream swarm board enhancements or additional editor integrations

## Self-Check: PASSED

All files exist. All commits verified (0d28ddf17, 243d7336f).

---
*Phase: 12-editor-to-swarm-bridge*
*Completed: 2026-03-22*
