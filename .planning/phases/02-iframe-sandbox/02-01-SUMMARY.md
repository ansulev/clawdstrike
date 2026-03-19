---
phase: 02-iframe-sandbox
plan: 01
subsystem: ui
tags: [iframe, sandbox, csp, postmessage, react, srcdoc, security]

# Dependency graph
requires:
  - phase: 01-postmessage-rpc-bridge
    provides: PluginBridgeHost and PluginBridgeClient for postMessage RPC
provides:
  - PLUGIN_CSP constant with strict Content-Security-Policy directives
  - buildPluginSrcdoc() function producing locked-down HTML with inlined bridge client
  - PluginSandbox React component managing iframe lifecycle and bridge wiring
  - sandbox/ barrel export with complete public API
affects: [02-02 capability permissions, 03 plugin-loader, 04 sdk]

# Tech tracking
tech-stack:
  added: []
  patterns: [srcdoc iframe isolation, inlined bridge client for module-less context, null-origin sandbox, defense-in-depth CSP]

key-files:
  created:
    - apps/workbench/src/lib/plugins/sandbox/srcdoc-builder.ts
    - apps/workbench/src/lib/plugins/sandbox/plugin-sandbox.tsx
    - apps/workbench/src/lib/plugins/sandbox/index.ts
    - apps/workbench/src/lib/plugins/sandbox/__tests__/srcdoc-builder.test.ts
    - apps/workbench/src/lib/plugins/sandbox/__tests__/plugin-sandbox.test.tsx
  modified: []

key-decisions:
  - "Inlined PluginBridgeClient in srcdoc as self-contained ES5-style class (no module imports possible in srcdoc iframe)"
  - "React srcDoc prop maps to HTML srcdoc attribute -- used camelCase JSX convention"
  - "Bridge host created in useEffect with pluginId and pluginCode as dependencies for proper lifecycle"

patterns-established:
  - "Srcdoc builder pattern: template literal HTML document with embedded CSP, styles, bridge, and plugin code"
  - "Sandbox component pattern: wrapper div + iframe with sandbox='allow-scripts', bridge wired via useEffect"

requirements-completed: [SANDBOX-01, SANDBOX-02, SANDBOX-03, SANDBOX-05, SANDBOX-06]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 2 Plan 1: Iframe Sandbox Summary

**Null-origin sandboxed iframe with strict CSP, inlined bridge client bootstrap, and React component managing iframe lifecycle and PluginBridgeHost wiring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T04:58:17Z
- **Completed:** 2026-03-19T05:03:33Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- PLUGIN_CSP constant blocks connect-src, frame-src, worker-src, form-action, object-src, eval -- defense-in-depth behind sandbox attribute
- buildPluginSrcdoc() produces valid HTML with CSP meta tag, inlined PluginBridgeClient (call/subscribe/destroy with 30s timeout), optional CSS injection, plugin-root div
- PluginSandbox React component renders iframe with sandbox="allow-scripts" only (no allow-same-origin, no allow-popups, no allow-top-navigation), wires PluginBridgeHost on mount, cleans up on unmount
- 32 tests pass across both test files (20 srcdoc-builder + 12 plugin-sandbox)

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Build srcdoc builder with CSP and bridge bootstrap**
   - `a5f5cf0` (test) - Failing tests for PLUGIN_CSP directives and buildPluginSrcdoc HTML structure
   - `c7411f5` (feat) - srcdoc-builder.ts with strict CSP, inlined bridge client, HTML template
2. **Task 2: Build PluginSandbox React component with iframe lifecycle and bridge wiring**
   - `9428fa8` (test) - Failing tests for iframe attributes, bridge wiring, cleanup
   - `3f94b72` (feat) - plugin-sandbox.tsx component + index.ts barrel export

## Files Created/Modified
- `apps/workbench/src/lib/plugins/sandbox/srcdoc-builder.ts` - PLUGIN_CSP constant and buildPluginSrcdoc() function producing locked-down iframe HTML
- `apps/workbench/src/lib/plugins/sandbox/plugin-sandbox.tsx` - PluginSandbox React component with sandbox="allow-scripts" iframe, bridge host lifecycle
- `apps/workbench/src/lib/plugins/sandbox/index.ts` - Barrel export re-exporting PluginSandbox, buildPluginSrcdoc, PLUGIN_CSP
- `apps/workbench/src/lib/plugins/sandbox/__tests__/srcdoc-builder.test.ts` - 20 tests for CSP directives and HTML structure
- `apps/workbench/src/lib/plugins/sandbox/__tests__/plugin-sandbox.test.tsx` - 12 tests for iframe attributes, bridge wiring, cleanup

## Decisions Made
- **Inlined bridge client as ES5-style class:** The srcdoc iframe has no module system, so the PluginBridgeClient is inlined as a self-contained class using var/function syntax. It mirrors bridge-client.ts logic (30s timeout, same message format, pending map, subscriptions) but requires no imports.
- **React srcDoc prop:** Used camelCase `srcDoc` JSX attribute (React convention) which maps to the HTML `srcdoc` attribute in the DOM.
- **useEffect dependency array:** Bridge host is created with `[pluginId, pluginCode]` dependencies, ensuring re-creation when plugin identity or code changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test file extension and mock pattern**
- **Found during:** Task 2 (PluginSandbox tests)
- **Issue:** Test file used .ts extension but contained JSX. Also vi.fn().mockImplementation() is not new-able in vitest 4.x -- needed class-based mock.
- **Fix:** Renamed to .tsx, used vi.hoisted() with a real class for the mock constructor
- **Files modified:** plugin-sandbox.test.tsx
- **Verification:** All 12 tests pass
- **Committed in:** 3f94b72 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test infrastructure fix necessary for correct test execution. No scope creep.

## Issues Encountered
None beyond the test file extension/mock constructor issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sandbox module is complete and tested, ready for Plan 02-02 (capability-based permissions)
- PluginSandbox can be composed into the plugin loader (Phase 3) to render community plugins
- Bridge from Phase 1 is connected to the sandbox -- plugins can call host methods via postMessage RPC

## Self-Check: PASSED

All 5 created files verified on disk. All 4 task commits verified in git log.

---
*Phase: 02-iframe-sandbox*
*Completed: 2026-03-19*
