# Deferred Items - Phase 15 Test Fixes

## Pre-existing: @base-ui/react getAnimations() in jsdom

**Discovered during:** Task 3 (full test suite validation)
**Severity:** Low (cosmetic -- does not cause test failures)
**Description:** `@base-ui/react` ScrollAreaViewport calls `viewport.getAnimations()` which jsdom does not implement. This causes 7 "Uncaught Exception" errors and makes vitest exit with code 1 even though all 136 test files and 2370 tests pass.
**Affected file:** `src/components/workbench/editor/__tests__/explainability-panel.test.tsx` (and 6 other test files using ScrollArea components)
**Fix:** Either polyfill `Element.prototype.getAnimations` in test/setup.ts or upgrade jsdom to a version that supports Web Animations API.
**Not fixed because:** Pre-existing issue, out of scope per deviation rules.
