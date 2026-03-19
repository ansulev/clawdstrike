---
phase: 02-iframe-sandbox
plan: 02
subsystem: ui
tags: [plugin-loader, trust-tier, iframe, sandbox, postmessage, bridge, community-plugins]

# Dependency graph
requires:
  - phase: 02-iframe-sandbox
    plan: 01
    provides: PluginSandbox component, buildPluginSrcdoc, PLUGIN_CSP, bridge infrastructure
  - phase: 01-postmessage-rpc-bridge
    provides: PluginBridgeHost for postMessage RPC between iframe and host
provides:
  - Trust-tier-forked PluginLoader: internal=in-process, community=iframe+bridge
  - Community plugin lifecycle: load via sandboxed iframe, activate, deactivate with full cleanup
  - iframeContainer and resolvePluginCode options on PluginLoaderOptions
  - Integration tests proving full community plugin lifecycle
affects: [03 permission-system, 04 audit-trail, 05 revocation]

# Tech tracking
tech-stack:
  added: []
  patterns: [trust-tier fork in plugin loader, setAttribute for sandbox attribute (jsdom compat), synchronous contentWindow access after appendChild]

key-files:
  created:
    - apps/workbench/src/lib/plugins/sandbox/__tests__/sandbox-integration.test.ts
  modified:
    - apps/workbench/src/lib/plugins/plugin-loader.ts
    - apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts

key-decisions:
  - "Use setAttribute('sandbox', 'allow-scripts') instead of DOMTokenList sandbox.add() for jsdom compatibility"
  - "No iframe.onload wait needed -- contentWindow is available immediately after appendChild in both browsers and jsdom"
  - "Community plugins store module: null in LoadedPlugin since their code runs in the iframe, not in-process"
  - "resolvePluginCode defaults to empty string if not provided -- allows declarative-only community plugins"

patterns-established:
  - "Trust-tier fork pattern: check manifest.trust before loading, route to loadCommunityPlugin() or in-process path"
  - "Community plugin cleanup pattern: destroy bridge host, remove message listener, remove iframe element from DOM"

requirements-completed: [SANDBOX-04]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 2 Plan 2: PluginLoader Trust-Tier Fork Summary

**PluginLoader forks by trust tier: internal plugins load in-process via dynamic import, community plugins load in sandboxed iframes with PluginBridgeHost for postMessage RPC**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T05:06:16Z
- **Completed:** 2026-03-19T05:13:30Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- PluginLoader.loadPlugin() checks manifest.trust and forks: "internal" uses existing dynamic import path, "community" creates sandboxed iframe with PluginBridgeHost
- Community plugin iframes use sandbox="allow-scripts" only (no allow-same-origin) with srcdoc containing strict CSP (connect-src 'none')
- deactivatePlugin() fully cleans up community plugins: destroys bridge host, removes message listener, removes iframe from DOM
- 26 tests pass (18 unit tests + 8 integration tests) with zero regression across 109 total tests

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Fork PluginLoader.loadPlugin() by trust tier**
   - `040ad82` (test) - Failing tests for community plugin trust-tier fork
   - `570528c` (feat) - Implementation of trust-tier fork with iframe sandbox loading

2. **Task 2: Integration tests proving community plugin lifecycle**
   - `ea0ccfa` (test) - 8 integration tests for full community plugin lifecycle

## Files Created/Modified
- `apps/workbench/src/lib/plugins/plugin-loader.ts` - Trust-tier fork: community plugins load via sandboxed iframe + PluginBridgeHost, internal plugins unchanged
- `apps/workbench/src/lib/plugins/__tests__/plugin-loader.test.ts` - 9 new community plugin unit tests alongside 9 existing internal tests
- `apps/workbench/src/lib/plugins/sandbox/__tests__/sandbox-integration.test.ts` - 8 integration tests proving full community plugin lifecycle through iframe sandbox

## Decisions Made
- **setAttribute over DOMTokenList:** Used `iframe.setAttribute("sandbox", "allow-scripts")` instead of `iframe.sandbox.add("allow-scripts")` because jsdom does not implement the DOMTokenList API on iframe.sandbox. The setAttribute approach works identically in real browsers.
- **No onload wait:** Removed `iframe.onload` wait since `contentWindow` is available immediately after `appendChild()`. This simplifies the code and avoids async timing issues in test environments.
- **Null module for community plugins:** Community plugins store `module: null` in the `LoadedPlugin` state since their code executes inside the iframe, not in the host process. The `deactivatePlugin()` method uses optional chaining (`loaded.module?.deactivate`) to handle both paths.
- **Default empty plugin code:** When no `resolvePluginCode` function is provided, the loader defaults to empty string, allowing declarative-only community plugins (those that only declare manifest contributions without runtime code).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed iframe.sandbox DOMTokenList incompatibility with jsdom**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `iframe.sandbox.add("allow-scripts")` throws `TypeError: Cannot read properties of undefined` in jsdom because `iframe.sandbox` is undefined
- **Fix:** Changed to `iframe.setAttribute("sandbox", "allow-scripts")` which works in both browsers and jsdom
- **Files modified:** apps/workbench/src/lib/plugins/plugin-loader.ts
- **Verification:** All 18 plugin-loader tests pass
- **Committed in:** 570528c (Task 1 feat commit)

**2. [Rule 3 - Blocking] Removed iframe.onload wait that hung in jsdom**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `await new Promise(resolve => { iframe.onload = resolve })` caused test timeout because jsdom fires onload asynchronously after a microtask, but the promise setup timing varied
- **Fix:** Removed the onload wait entirely since contentWindow is available immediately after appendChild. This matches the approach used by the PluginSandbox React component.
- **Files modified:** apps/workbench/src/lib/plugins/plugin-loader.ts
- **Verification:** All 18 plugin-loader tests pass, no timeout
- **Committed in:** 570528c (Task 1 feat commit)

---

**Total deviations:** 2 auto-fixed (2 blocking -- jsdom compatibility)
**Impact on plan:** Both fixes were necessary for test environment compatibility. The resulting implementation is simpler and more robust. No scope creep.

## Issues Encountered
None beyond the jsdom compatibility issues documented as deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 is complete: community plugins are fully isolated in sandboxed iframes with bridge RPC
- PluginLoader correctly routes by trust tier, ready for Phase 3 (Permission System)
- The bridge middleware can be extended in Phase 3 to enforce capability-based permissions
- All 109 tests pass (Phase 1 bridge + Phase 2 sandbox + plugin-loader) with zero regression

## Self-Check: PASSED

All 3 files verified on disk. All 3 task commits verified in git log (040ad82, 570528c, ea0ccfa).

---
*Phase: 02-iframe-sandbox*
*Completed: 2026-03-19*
