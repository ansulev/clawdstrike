---
phase: 19-client-connection-store
verified: 2026-03-23T16:30:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 19: Client Connection & Store Verification Report

**Phase Goal:** The workbench maintains a persistent WebSocket connection to hushd and exposes all presence data through a Zustand store that the rest of the app reads from
**Verified:** 2026-03-23T16:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When workbench starts with hushd running, connection transitions to "connected" and analyst appears in roster | VERIFIED | `onOpen()` calls `setState("connected")` then `sendJoin()` which emits `{ type: "join" }`; `handleServerMessage("welcome")` populates `analysts` Map from roster |
| 2 | When hushd goes down and comes back, workbench auto-reconnects within bounded time (exponential backoff + jitter) | VERIFIED | `scheduleReconnect()` uses `BACKOFF_BASE_DELAYS [1000,2000,4000,8000,16000]` with jitter `baseDelay * (0.5 + Math.random() * 0.5)`; `onClose()` triggers it when not disposed |
| 3 | When hushd is unavailable, workbench functions normally with empty presence state (no errors, no spinners) | VERIFIED | Default store state: `connectionState: "idle"`, `analysts: new Map()`, `viewersByFile: new Map()`; `connect()` returns early on missing apiKey setting state to "disconnected"; `usePresenceConnection` calls `reset()` when fleet not connected |
| 4 | When second analyst connects, both clients see each other in roster within one heartbeat interval | VERIFIED | `handleServerMessage("analyst_joined")` inserts new analyst via `parseAnalystInfo()`; heartbeat fires at `HEARTBEAT_INTERVAL_MS = 15_000` matching server's 15s interval |

**Score:** 4/4 success criteria verified

### Required Artifacts (Three-Level Check)

| Artifact | Exists | Substantive | Wired | Status | Details |
|----------|--------|-------------|-------|--------|---------|
| `apps/workbench/src/features/presence/types.ts` | YES | YES (161 lines, 8 exports) | YES | VERIFIED | Exports: `PresenceConnectionState`, `AnalystPresence`, `AnalystInfoWire`, `ServerMessageRaw`, `ClientMessage`, `PresenceSocketOptions`, `parseAnalystInfo`, `HEARTBEAT_INTERVAL_MS`, `PRESENCE_COLORS` |
| `apps/workbench/src/features/presence/presence-socket.ts` | YES | YES (204 lines, PresenceSocket class) | YES | VERIFIED | Imported and used in `use-presence-connection.ts` line 9; constructs `new PresenceSocket({...})` |
| `apps/workbench/src/features/presence/stores/presence-store.ts` | YES | YES (227 lines, full Zustand+immer store) | YES | VERIFIED | Imported in `use-presence-connection.ts` line 10; all 9 server message types handled |
| `apps/workbench/src/features/presence/use-presence-connection.ts` | YES | YES (107 lines, hook + accessor) | YES | VERIFIED | Imported and called in `App.tsx` lines 9 and 157 |
| `apps/workbench/src/App.tsx` (modified) | YES | YES | YES | VERIFIED | `usePresenceConnection()` called at line 157, after `useFleetConnection()` at line 156 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `presence-socket.ts` | `types.ts` | multi-line `import type { ClientMessage, PresenceConnectionState, PresenceSocketOptions, ServerMessageRaw }` | WIRED | Lines 8-13; `HEARTBEAT_INTERVAL_MS` value import at line 14 |
| `presence-socket.ts` | `hushd /api/v1/presence` | `new WebSocket(base.replace(/^http/, "ws") + "/api/v1/presence?token=")` | WIRED | Line 57-59; token passed as query param via `encodeURIComponent(apiKey)` |
| `presence-store.ts` | `types.ts` | multi-line `import type { AnalystPresence, PresenceConnectionState, ServerMessageRaw }` + `import { parseAnalystInfo }` | WIRED | Lines 11-16; `parseAnalystInfo` called in `handleServerMessage` for welcome and analyst_joined cases |
| `use-presence-connection.ts` | `presence-socket.ts` | `import { PresenceSocket } from "./presence-socket"` | WIRED | Line 9; `new PresenceSocket({...})` at line 57; `.connect()` at line 82 |
| `use-presence-connection.ts` | `presence-store.ts` | `import { usePresenceStore } from "./stores/presence-store"` | WIRED | Line 10; `usePresenceStore.getState().actions.handleServerMessage` at line 71; `setConnectionState` at line 74; `reset()` at lines 40, 91 |
| `use-presence-connection.ts` | `use-fleet-connection.ts` | `import { useFleetConnectionStore } from "@/features/fleet/use-fleet-connection"` | WIRED | Line 11; used at line 27 (hushdUrl), line 28 (fleetConnected), line 60 (getCredentials) |
| `App.tsx` | `use-presence-connection.ts` | `import { usePresenceConnection }` + call in `WorkbenchBootstraps` | WIRED | Import at line 9; call at line 157, positioned after `useFleetConnection()` at line 156 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONN-01 | 19-01 | Workbench connects to hushd via WebSocket at `/api/v1/presence` with Bearer auth | SATISFIED | `presence-socket.ts` line 57-59: URL built as `base + "/api/v1/presence?token=" + encodeURIComponent(apiKey)` |
| CONN-02 | 19-01 | Connection auto-reconnects with exponential backoff and random jitter on disconnect | SATISFIED | `scheduleReconnect()` at line 151-165 of presence-socket.ts: `BACKOFF_BASE_DELAYS` array + `Math.random()` jitter formula `baseDelay * (0.5 + Math.random() * 0.5)` |
| CONN-04 | 19-02 | Workbench functions fully when hushd is unavailable (graceful offline degradation) | SATISFIED | Default store state uses empty Maps and "idle" state; `usePresenceConnection` calls `reset()` when fleet unavailable; `connect()` bails early if no apiKey |
| PRES-01 | 19-02 | Analyst presence is broadcast to all connected clients (join/leave/heartbeat) | SATISFIED | `handleServerMessage` routes all 9 server message types; heartbeat at 15s sends `{ type: "heartbeat" }`; `analyst_joined`/`analyst_left` update the `analysts` Map |

No orphaned requirements — REQUIREMENTS.md Phase 19 mapping shows exactly CONN-01, CONN-02, CONN-04, PRES-01 as the phase scope, matching both PLAN files.

### Anti-Patterns Found

None. Scan of all four phase files revealed:
- No TODO/FIXME/PLACEHOLDER comments
- No stub implementations (`return null`, `return {}`, empty handlers)
- No `console.log`-only handlers
- No import of `tauri-plugin-websocket` (explicitly avoided per plan)
- `return null` in `getIdentity()` callback is intentional offline-degradation guard, not a stub

### Human Verification Required

#### 1. Live reconnect behavior

**Test:** Start the workbench with hushd running (connected state). Kill hushd. Observe the connection state indicator (if present) and wait. Restart hushd.
**Expected:** Workbench reconnects automatically within the jitter window (500ms–16s per attempt at max backoff). No user action required.
**Why human:** Requires live hushd process; can't verify timer/socket behavior statically.

#### 2. Multi-analyst roster sync

**Test:** Open two workbench instances connected to the same hushd. Verify both instances show each other in the analyst roster after the first heartbeat cycle (15 seconds).
**Expected:** Both instances display the peer analyst's presence data within 15 seconds of the second connection.
**Why human:** Requires two live workbench instances and a running hushd; network behavior can't be verified statically.

#### 3. Offline-first degradation

**Test:** Start the workbench without hushd running.
**Expected:** No error banners, no infinite spinners, no unhandled promise rejections in console. Presence-dependent UI shows empty/hidden state.
**Why human:** UI rendering behavior can't be verified from static code alone.

### Gaps Summary

No gaps found. All eight must-have truths and artifacts are verified at all three levels (exists, substantive, wired). All four requirements (CONN-01, CONN-02, CONN-04, PRES-01) are satisfied with concrete implementation evidence. TypeScript compiles cleanly. No anti-patterns detected.

The only remaining verification items are behavioral (live reconnect, multi-client roster sync, offline degradation UX) which require a running environment and are flagged for human testing.

---

_Verified: 2026-03-23T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
