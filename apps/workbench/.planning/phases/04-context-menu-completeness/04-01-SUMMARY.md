---
phase: 04-context-menu-completeness
plan: 01
subsystem: ui
tags: [tauri, context-menu, explorer, tauri-plugin-opener, viewport-clamping, react]

# Dependency graph
requires:
  - phase: 03-right-sidebar-bottom-panel-commands
    provides: "ExplorerPanel with multi-root support, inline file creation/rename/delete"
provides:
  - "Three contextual right-click menus (root, file, folder) for the explorer file tree"
  - "revealInFinder and createDirectory bridge helpers in tauri-bridge.ts"
  - "tauri-plugin-opener Rust/JS integration for OS file manager access"
  - "Viewport clamping for context menus (never overflow offscreen)"
  - "ContextMenuTarget discriminated union type for reuse"
affects: [explorer, sidebar-panel, tauri-bridge]

# Tech tracking
tech-stack:
  added: [tauri-plugin-opener, "@tauri-apps/plugin-opener"]
  patterns: [discriminated-union-context-menu, viewport-clamping-useLayoutEffect, lazy-tauri-imports]

key-files:
  created: []
  modified:
    - apps/workbench/src/components/workbench/explorer/explorer-context-menu.tsx
    - apps/workbench/src/components/workbench/explorer/explorer-panel.tsx
    - apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx
    - apps/workbench/src/lib/tauri-bridge.ts
    - apps/workbench/src-tauri/Cargo.toml
    - apps/workbench/src-tauri/src/main.rs
    - apps/workbench/src-tauri/capabilities/default.json
    - apps/workbench/package.json

key-decisions:
  - "Used discriminated union (ContextMenuTarget) with targetType field for type-safe context menu variant switching"
  - "Viewport clamping via useLayoutEffect to measure menu dimensions after initial render then adjust position"
  - "Folder creation uses a centered modal dialog rather than inline tree input to avoid tree position calculation complexity"
  - "Copy Path writes absolute path (rootPath + / + file.path), Copy Relative Path writes file.path"

patterns-established:
  - "ContextMenuTarget discriminated union: targetType root|file|folder with variant-specific fields"
  - "Viewport clamping pattern: useLayoutEffect + getBoundingClientRect + Math.min for edge clamping"
  - "Builder function pattern: separate buildRootItems/buildFileItems/buildFolderItems for clean menu construction"

requirements-completed: [CTX-01, CTX-02, CTX-03, CTX-04]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 04 Plan 01: Context Menu Completeness Summary

**Three-variant explorer context menu (root/file/folder) with native Finder integration via tauri-plugin-opener and viewport clamping**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T12:29:57Z
- **Completed:** 2026-03-19T12:35:40Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed tauri-plugin-opener on Rust and JS sides with proper capability permissions
- Added revealInFinder and createDirectory bridge helpers following existing lazy-import pattern
- Rewrote ExplorerContextMenu with ContextMenuTarget discriminated union supporting root, file, and folder variants
- Root menu: New File, Open in Finder, Refresh, Remove from Workspace
- File menu: Open, Copy Path, Copy Relative Path, Rename (F2 hint), Delete, Reveal in Finder
- Folder menu: New File, New Folder, Collapse All Children, Reveal in Finder
- Implemented viewport clamping via useLayoutEffect to prevent menus from overflowing offscreen
- Wired all new callbacks (onRevealInFinder, onCreateFolder, onCollapseChildren, onRefreshRoot) in sidebar-panel.tsx
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tauri-plugin-opener and add bridge helpers** - `28646118c` (feat)
2. **Task 2: Rewrite context menu with root/file/folder variants and viewport clamping** - `4c7817d09` (feat)

## Files Created/Modified
- `apps/workbench/src/components/workbench/explorer/explorer-context-menu.tsx` - Complete rewrite with ContextMenuTarget union, three menu builders, viewport clamping
- `apps/workbench/src/components/workbench/explorer/explorer-panel.tsx` - Updated context menu state type, added root header onContextMenu, file/folder discrimination, creatingFolderInDir state
- `apps/workbench/src/features/activity-bar/components/sidebar-panel.tsx` - Wired onRevealInFinder, onCreateFolder, onCollapseChildren, onRefreshRoot callbacks
- `apps/workbench/src/lib/tauri-bridge.ts` - Added revealInFinder() and createDirectory() exports
- `apps/workbench/src-tauri/Cargo.toml` - Added tauri-plugin-opener = "2" dependency
- `apps/workbench/src-tauri/src/main.rs` - Registered tauri_plugin_opener::init() in builder chain
- `apps/workbench/src-tauri/capabilities/default.json` - Added opener:default and opener:allow-reveal-item-in-dir permissions
- `apps/workbench/package.json` - Added @tauri-apps/plugin-opener dependency

## Decisions Made
- Used discriminated union with targetType field rather than conditional props for type-safe menu variant selection
- Viewport clamping uses useLayoutEffect (synchronous before paint) for flicker-free positioning
- Folder creation uses a centered modal input dialog rather than inline tree input
- Copy Path computes absolute path as rootPath + "/" + file.path; Copy Relative Path uses file.path directly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Context menu system is complete with all three variants fully functional
- Native Finder integration ready for macOS, adaptable to other platforms
- Viewport clamping ensures usability at all screen sizes and cursor positions

## Self-Check: PASSED

All files verified present on disk. Both task commits (28646118c, 4c7817d09) verified in git history.

---
*Phase: 04-context-menu-completeness*
*Completed: 2026-03-19*
