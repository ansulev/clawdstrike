---
phase: 11-integration-wiring-fixes
plan: 01
subsystem: ui
tags: [react, yaml-editor, test-runner, gutter, scenario-generation]

# Dependency graph
requires:
  - phase: 06-detection-engineering-inline
    provides: YamlEditor with onRunGuardTest prop and gutter play buttons
provides:
  - FileEditorShell gutter play button generates and imports guard test scenarios
  - GuardTestYamlEditor wrapper component with TestRunnerContext access
affects: [11-02, detection-engineering, test-runner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GuardTestYamlEditor wrapper: moves useTestRunnerOptional into child component inside TestRunnerProvider"

key-files:
  created: []
  modified:
    - apps/workbench/src/features/editor/file-editor-shell.tsx

key-decisions:
  - "Used GuardTestYamlEditor wrapper component instead of placing useTestRunnerOptional in FileEditorShell body, because FileEditorShell creates the TestRunnerProvider -- calling the hook at that level would always return null"

patterns-established:
  - "Context-aware wrapper: when a component creates a Context Provider, hooks that consume that context must be in child components rendered inside the provider"

requirements-completed: [DET-01, DET-03]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 11 Plan 01: Wire Gutter Play Button Summary

**GuardTestYamlEditor wrapper wires generateScenariosFromPolicy + IMPORT_SCENARIOS dispatch to FileEditorShell gutter play buttons via TestRunnerContext**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T12:50:06Z
- **Completed:** 2026-03-21T12:52:36Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Gutter play button in FileEditorShell now generates guard test scenarios and imports them into the test runner
- Created GuardTestYamlEditor wrapper component that correctly accesses TestRunnerContext from inside the TestRunnerProvider
- Both split-mode and single-mode YamlEditor instances receive the onRunGuardTest callback
- Toast notifications confirm scenario import count or warn when no scenarios generated

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire onRunGuardTest callback in FileEditorShell** - `3a27a9da3` (feat)

## Files Created/Modified
- `apps/workbench/src/features/editor/file-editor-shell.tsx` - Added imports (generateScenariosFromPolicy, useTestRunnerOptional, useToast, type imports), extractTarget/testScenarioToSuite helpers, GuardTestYamlEditor wrapper component with handleRunGuardTest callback, replaced both YamlEditor instances with GuardTestYamlEditor

## Decisions Made
- **GuardTestYamlEditor wrapper pattern:** The plan specified placing useTestRunnerOptional() directly in FileEditorShell's body, but FileEditorShell renders its own TestRunnerProvider, which means calling the hook at that level would always return null (the context is established by a child, not a parent). Created a GuardTestYamlEditor wrapper component that is rendered inside the TestRunnerProvider and correctly accesses the context. This mirrors how the reference implementation (yaml-preview-panel.tsx) works -- there, the component is rendered inside a parent TestRunnerProvider.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TestRunnerContext access pattern**
- **Found during:** Task 1 (Wire onRunGuardTest callback)
- **Issue:** Plan specified placing useTestRunnerOptional() in FileEditorShell's body, but FileEditorShell creates <TestRunnerProvider> in its JSX return. Calling useTestRunnerOptional() at the FileEditorShell level would look for a parent context that doesn't exist, always returning null -- making the feature non-functional.
- **Fix:** Created GuardTestYamlEditor wrapper component rendered inside the TestRunnerProvider. The wrapper calls useTestRunnerOptional() and useToast(), defines handleRunGuardTest, and delegates to YamlEditor with the onRunGuardTest prop.
- **Files modified:** apps/workbench/src/features/editor/file-editor-shell.tsx
- **Verification:** Both YamlEditor instances receive onRunGuardTest via the wrapper; grep confirms generateScenariosFromPolicy, IMPORT_SCENARIOS, and useTestRunnerOptional are all present.
- **Committed in:** 3a27a9da3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness -- without the wrapper, the feature would never dispatch to the test runner. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FileEditorShell gutter play buttons are now functional
- Plan 11-02 can proceed to fix navigate("/editor") calls, edit.newTab, and dead code cleanup

---
*Phase: 11-integration-wiring-fixes*
*Completed: 2026-03-21*
