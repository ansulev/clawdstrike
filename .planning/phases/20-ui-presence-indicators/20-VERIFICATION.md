---
phase: 20-ui-presence-indicators
verified: 2026-03-23T00:00:00Z
status: gaps_found
score: 10/12 must-haves verified
re_verification: false
gaps:
  - truth: "Pane tabs for files viewed by other analysts show colored dots on the right side of the tab label"
    status: failed
    reason: "PresenceTabDots calls usePresenceStore and useCallback hooks AFTER a conditional early return on line 19, violating React Rules of Hooks. React will throw an invariant error in development whenever a non-file tab is rendered after a file tab (hook call order changes). This is a runtime blocker."
    artifacts:
      - path: "apps/workbench/src/features/presence/components/presence-tab-dots.tsx"
        issue: "Early return `if (!route.startsWith('/file/')) return null;` on line 19 precedes hook calls on lines 23-25 (usePresenceStore x3, useCallback). Hooks must be called unconditionally before any return."
    missing:
      - "Move the conditional early return AFTER all hook calls. Extract the file path derivation before hooks (it can be computed unconditionally), then call all hooks, then guard with `if (!route.startsWith('/file/') || remoteViewers.length === 0) return null;` after the filter computation."
  - truth: "REQUIREMENTS.md accurately reflects implementation status for all phase 20 requirements"
    status: failed
    reason: "UI-05 is implemented in speakeasy-panel.tsx (lines 437-443) but REQUIREMENTS.md line 31 still shows `[ ]` (unchecked) and the tracking table at line 93 shows 'Pending'. The code is done but the tracker was not updated."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "Line 31: `- [ ] **UI-05**` should be `- [x] **UI-05**`. Line 93: `| UI-05 | Phase 20 | Pending |` should show `Complete`."
    missing:
      - "Update REQUIREMENTS.md: change `- [ ] **UI-05**` to `- [x] **UI-05**` and update the tracking table row from `Pending` to `Complete`."
human_verification:
  - test: "Visual render of all 5 presence indicator types"
    expected: "Status bar shows green/amber/red dot with 'N online' text. Activity bar shows colored pills below icon group. Pane tabs for shared files show colored dots. People sidebar panel lists analysts. Speakeasy shows 'N analysts viewing this file' above compose input."
    why_human: "Real-time WebSocket behavior, color rendering, layout positioning, and multi-client interaction cannot be verified statically."
---

# Phase 20: UI Presence Indicators — Verification Report

**Phase Goal:** Analysts can see at a glance who is online, which files colleagues are viewing, and how many people are looking at their current file
**Verified:** 2026-03-23
**Status:** gaps_found — 2 gaps, 1 blocker (React hooks violation), 1 documentation gap
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Status bar shows a colored dot: green when connected, amber when reconnecting, red when disconnected | VERIFIED | `dotColor()` in presence-status-indicator.tsx maps all 5 connection states to `#3dbf84` / `#d4a84b` / `#c45c5c` |
| 2 | Status bar shows online analyst count next to the dot in format 'N online' | VERIFIED | `statusLabel()` returns `${count} online` when connected; component reads `analysts.size` |
| 3 | Clicking the status bar presence indicator toggles the People sidebar panel | VERIFIED | `onClick` calls `useActivityBarStore.getState().actions.toggleItem("people")` — no `as any` cast |
| 4 | People sidebar panel lists each online analyst with name, colored sigil dot, current file, and online badge | VERIFIED | AnalystRosterPanel renders sigil dot (`analyst.color`), displayName, activeFile, "online" badge per row |
| 5 | Clicking an analyst row in the roster navigates to that analyst's current file | VERIFIED | `handleAnalystClick` calls `usePaneStore.getState().openFile(analyst.activeFile, label)`; no-op when null |
| 6 | When solo, roster shows 'No other analysts connected' empty state | VERIFIED | Empty state renders when `remoteAnalysts.length === 0` |
| 7 | Pane tabs for files viewed by other analysts show colored dots on the right side of the tab label | FAILED | PresenceTabDots has a React Rules of Hooks violation — early return before hook calls (blocker) |
| 8 | Max 3 dots shown per tab, with '+N' overflow text when more than 3 analysts are viewing | VERIFIED | `MAX_VISIBLE_DOTS = 3`, overflow computed as `remoteViewers.length - MAX_VISIBLE_DOTS` |
| 9 | Clicking a presence dot navigates to that analyst's current file | VERIFIED | `handleDotClick` calls `usePaneStore.getState().openFile` with `stopPropagation` |
| 10 | Activity bar shows colored analyst pills stacked vertically below the icon group | VERIFIED | PresenceActivityPills rendered in activity-bar.tsx below icon group with gradient divider |
| 11 | Max 5 pills visible in activity bar, with '+N' text below when more than 5 analysts are online | VERIFIED | `MAX_VISIBLE_PILLS = 5`, overflow computed correctly |
| 12 | Speakeasy chat panel shows 'N analysts viewing this file' above the message input | VERIFIED | Lines 437-443 of speakeasy-panel.tsx render presence context when `fileViewerCount > 0` |

**Score:** 10/12 truths verified (1 blocker gap, 1 documentation gap)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workbench/src/features/presence/components/presence-status-indicator.tsx` | PresenceStatusIndicator with colored dot + count | VERIFIED | 88 lines, exports `PresenceStatusIndicator`, reads `connectionState` and `analysts.size` via granular selectors |
| `apps/workbench/src/features/presence/components/analyst-roster-panel.tsx` | AnalystRosterPanel sidebar with clickable analyst rows | VERIFIED | 100 lines, exports `AnalystRosterPanel`, filters local analyst, sorts alphabetically |
| `apps/workbench/src/features/presence/components/presence-tab-dots.tsx` | PresenceTabDots with clickable dots | STUB/BROKEN | 70 lines, component logic correct but has React Rules of Hooks violation (early return before hooks) |
| `apps/workbench/src/features/presence/components/presence-activity-pills.tsx` | PresenceActivityPills with stacked pills | VERIFIED | 43 lines, exports `PresenceActivityPills`, max 5 pills with overflow |
| `apps/workbench/src/features/activity-bar/types.ts` | ActivityBarItemId union includes "people" | VERIFIED | "people" added to union type; IconUsers imported; entry added to ACTIVITY_BAR_ITEMS array |
| `apps/workbench/src/components/workbench/speakeasy/speakeasy-panel.tsx` | Presence context line above compose area | VERIFIED | Lines 224-242 compute `fileViewerCount`; lines 437-443 render context when count > 0 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| presence-status-indicator.tsx | presence-store | `usePresenceStore((s) => s.connectionState)` and `usePresenceStore((s) => s.analysts.size)` | WIRED | Granular scalar selectors, no full Map subscription |
| presence-status-indicator.tsx | activity-bar-store | `useActivityBarStore.getState().actions.toggleItem("people")` on click | WIRED | No `as any` cast — "people" is a valid ActivityBarItemId |
| analyst-roster-panel.tsx | presence-store | `usePresenceStore((s) => s.analysts)` and `usePresenceStore((s) => s.localAnalystId)` | WIRED | Full Map read justified — roster needs all analysts |
| analyst-roster-panel.tsx | pane-store | `usePaneStore.getState().openFile(analyst.activeFile, label)` on row click | WIRED | Imperative call in `handleAnalystClick` callback |
| sidebar-panel.tsx | analyst-roster-panel.tsx | `case "people": return <AnalystRosterPanel />` | WIRED | Case present at line 243; import at line 14 |
| status-bar.tsx | presence-status-indicator.tsx | `<PresenceStatusIndicator />` between Fleet and MCP indicators | WIRED | Import at line 11; rendered at line 143 |
| presence-tab-dots.tsx | presence-store | `usePresenceStore((s) => s.viewersByFile.get(filePath))` | WIRED (but hook-order broken) | Link is correct but called after early return — see blocker gap |
| presence-tab-dots.tsx | pane-store | `usePaneStore.getState().openFile(analyst.activeFile, label)` | WIRED | Called in `handleDotClick` |
| pane-tab.tsx | presence-tab-dots.tsx | `<PresenceTabDots route={view.route} />` | WIRED | Import at line 4; rendered at line 58 between label and close button |
| presence-activity-pills.tsx | presence-store | `usePresenceStore((s) => s.analysts)` | WIRED | Line 10 |
| activity-bar.tsx | presence-activity-pills.tsx | `<PresenceActivityPills />` | WIRED | Import at line 13; rendered at line 112 |
| speakeasy-panel.tsx | presence-store | `usePresenceStore((s) => { ... viewersByFile.get(activeFileRoute) ... })` | WIRED | Lines 233-242 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONN-03 | 20-01, 20-03 | Connection status indicator in status bar (green/amber/red dot) | SATISFIED | PresenceStatusIndicator in status-bar.tsx; dotColor() maps all 5 states |
| UI-01 | 20-01 | Online analyst count displayed in status bar | SATISFIED | `${count} online` text in statusLabel(); reads analysts.size |
| UI-02 | 20-02 | Colored dots on pane tabs showing which files other analysts are viewing | PARTIALLY SATISFIED | Implementation exists and logic is correct, but React hooks violation is a runtime blocker |
| UI-03 | 20-02 | Activity bar analyst pills (colored sigil dots for online analysts) | SATISFIED | PresenceActivityPills in activity-bar.tsx; 8px circles with analyst.color |
| UI-04 | 20-01 | Analyst roster panel in sidebar showing name, sigil, current file, and connection status | SATISFIED | AnalystRosterPanel with sigil dot, displayName, activeFile path, "online" badge |
| UI-05 | 20-03 | Speakeasy chat panel shows presence context ("N analysts viewing this file") | SATISFIED (code) / NOT UPDATED (docs) | Implementation complete in speakeasy-panel.tsx; REQUIREMENTS.md checkbox and tracking table still show Pending |

**Orphaned requirements:** None — all 6 requirement IDs from plan frontmatter map to implemented artifacts.

**REQUIREMENTS.md staleness:** UI-05 shows `[ ]` on line 31 and "Pending" on line 93 despite the implementation being complete and committed.

---

## Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `apps/workbench/src/features/presence/components/presence-tab-dots.tsx` | 19 (return null) before 23-25 (hook calls) | React Rules of Hooks violation: conditional early return before `usePresenceStore` (x3) and `useCallback` hook calls | Blocker | React will throw `Invalid hook call` invariant in development when `route` changes from a `/file/` route to a non-file route (hook call count changes between renders). In strict mode this will crash the pane tab. |

**No other anti-patterns found.** The `return null` guards in `presence-activity-pills.tsx` (line 21) and the second guard in `presence-tab-dots.tsx` (line 37, after hooks) are correct — they come after all hook calls.

---

## Human Verification Required

### 1. Full presence suite visual inspection

**Test:** Run `moon run clawdstrike-web:dev` (or `cd apps/workbench && npm run dev`), open the workbench, and inspect all 5 presence indicator locations.
**Expected:**
- Bottom status bar: presence dot (red when offline) and "Offline" text between Fleet and MCP status indicators
- Left activity bar: "People" (IconUsers) appears in the icon list; clicking it opens the People sidebar
- People sidebar: shows "No other analysts connected" when solo
- With hushd running and multiple clients: green dot + count, colored pills in activity bar, roster listing analysts
- Speakeasy panel: "N analysts viewing this file" dot + text above compose input when sharing a file
**Why human:** Real-time WebSocket behavior, visual color rendering, multi-client scenarios, and layout positioning cannot be verified statically.

---

## Gaps Summary

**Gap 1 — React Hooks Violation in PresenceTabDots (Blocker)**

`presence-tab-dots.tsx` has an early `return null` on line 19 (`if (!route.startsWith("/file/")) return null;`) that occurs before three `usePresenceStore` hook calls on lines 23–25 and a `useCallback` on line 41. This violates React's Rules of Hooks, which require hooks to be called unconditionally and in the same order on every render.

When a tab switches from a `/file/` route to a non-file route (or vice versa), the hook call count changes between renders, causing React to throw: "Rendered fewer hooks than expected." This is a runtime crash in development mode and silently corrupts state in production.

**Fix:** Move all hook calls above the early return. The route check must come after hooks:

```tsx
export function PresenceTabDots({ route }: PresenceTabDotsProps) {
  const filePath = route.startsWith("/file/") ? route.slice("/file/".length) : null;

  const viewerSet = usePresenceStore((s) =>
    filePath ? s.viewersByFile.get(filePath) : undefined
  );
  const localAnalystId = usePresenceStore((s) => s.localAnalystId);
  const analysts = usePresenceStore((s) => s.analysts);

  const handleDotClick = useCallback(
    (e: React.MouseEvent, analyst: AnalystPresence) => {
      e.stopPropagation();
      if (!analyst.activeFile) return;
      const label = analyst.activeFile.split("/").pop() ?? analyst.activeFile;
      usePaneStore.getState().openFile(analyst.activeFile, label);
    },
    [],
  );

  // Guard after hooks — safe to return null here
  if (!filePath) return null;

  const remoteViewers: AnalystPresence[] = [];
  // ... rest of logic unchanged
```

**Gap 2 — REQUIREMENTS.md Not Updated for UI-05**

UI-05 is implemented (speakeasy-panel.tsx lines 437–443, commit `20fc3b670`) but the requirements tracker was not updated. Change:
- Line 31: `- [ ] **UI-05**` → `- [x] **UI-05**`
- Line 93: `| UI-05 | Phase 20 | Pending |` → `| UI-05 | Phase 20 | Complete |`

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
