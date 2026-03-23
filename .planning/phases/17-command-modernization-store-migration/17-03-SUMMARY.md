---
phase: 17-command-modernization-store-migration
plan: 03
subsystem: ui
tags: [zustand, react-hooks, store-migration, bridge-deletion]

# Dependency graph
requires:
  - phase: 17-command-modernization-store-migration (plan 01, 02)
    provides: Zustand store decomposition and initial consumer migration
provides:
  - Bootstrap hook (usePolicyBootstrap) for store initialization
  - Direct-store composition hooks (usePolicyTabs, useWorkbenchState) replacing bridge
  - PolicyTab/MultiPolicyAction/BulkGuardUpdate types in standalone module
  - Complete deletion of multi-policy-store.tsx (975 lines removed)
affects: [workbench-ui, policy-stores, test-infrastructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "usePolicyTabs() composes 3 Zustand stores for tab-aware consumers"
    - "useWorkbenchState() provides WorkbenchState + callback helpers without bridge"
    - "policyDispatch() singleton for action routing outside React components"
    - "PolicyBootstrapProvider replaces MultiPolicyProvider for test wrappers"

key-files:
  created:
    - apps/workbench/src/features/policy/hooks/use-policy-bootstrap.ts
    - apps/workbench/src/features/policy/hooks/use-policy-actions.ts
    - apps/workbench/src/features/policy/types/policy-tab.ts
  modified:
    - apps/workbench/src/App.tsx
    - apps/workbench/src/test/test-helpers.tsx
    - 18 production component files (status-bar, workbench-topbar, home-page, etc.)
    - 12 test files (updated mocks and imports)

key-decisions:
  - "Created usePolicyTabs/useWorkbenchState as named replacements rather than inline-migrating each consumer to raw store calls"
  - "Moved PolicyTab type + reconstructPolicyTab to policy-tab.ts so consumers can still use the composite type"
  - "Kept policyDispatch() singleton pattern for components that need MultiPolicyAction routing"
  - "Renamed multi-policy-store.test.tsx to policy-stores-integration.test.tsx"

patterns-established:
  - "usePolicyTabs() for tab-aware components (replaces useMultiPolicy)"
  - "useWorkbenchState() for active-tab state + file ops (replaces useWorkbench)"
  - "PolicyBootstrapProvider for test wrappers (replaces MultiPolicyProvider)"
  - "Import types from @/features/policy/types/policy-tab"

requirements-completed: [STORE-04, STORE-05]

# Metrics
duration: 11min
completed: 2026-03-23
---

# Phase 17 Plan 03: Bridge Deletion Summary

**Deleted 975-line multi-policy-store.tsx bridge layer, migrated 18 production consumers + 12 test files to direct Zustand store hooks**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-23T00:36:23Z
- **Completed:** 2026-03-23T00:47:40Z
- **Tasks:** 2
- **Files modified:** 39

## Accomplishments
- Extracted bootstrap logic from multi-policy-store.tsx into standalone usePolicyBootstrap hook
- Created usePolicyTabs() and useWorkbenchState() as direct-store composition hooks replacing the deprecated bridge
- Migrated 18 production component files from useMultiPolicy/useWorkbench to new hooks
- Updated 12 test files (mocks, imports, providers) to use new hook locations
- Deleted multi-policy-store.tsx (975 lines) and lib/workbench re-export barrel
- Zero TypeScript errors, zero references to deleted module remain

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract bootstrap hook + migrate production consumers + delete bridge** - `27b35965c` (feat)
2. **Task 2: Update all test files to use direct store hooks** - `826e89482` (test)
3. **Task 2 fix: Update App.test.tsx mock target** - `7f5faf72b` (fix)

## Files Created/Modified

### Created
- `apps/workbench/src/features/policy/hooks/use-policy-bootstrap.ts` - Bootstrap hook + PolicyBootstrapProvider
- `apps/workbench/src/features/policy/hooks/use-policy-actions.ts` - usePolicyTabs, useWorkbenchState, policyDispatch
- `apps/workbench/src/features/policy/types/policy-tab.ts` - PolicyTab, MultiPolicyAction, BulkGuardUpdate types

### Deleted
- `apps/workbench/src/features/policy/stores/multi-policy-store.tsx` - 975-line bridge layer
- `apps/workbench/src/lib/workbench/multi-policy-store.tsx` - Re-export barrel

### Modified (production)
- `apps/workbench/src/App.tsx` - usePolicyBootstrap replaces useMultiPolicyBootstrap
- `apps/workbench/src/components/desktop/status-bar.tsx` - useWorkbenchState + usePolicyTabs
- `apps/workbench/src/components/workbench/home/home-page.tsx` - useWorkbenchState + usePolicyTabs
- `apps/workbench/src/components/workbench/workbench-topbar.tsx` - useWorkbenchState
- `apps/workbench/src/components/workbench/hunt/hunt-layout.tsx` - usePolicyTabs
- `apps/workbench/src/components/workbench/library/catalog-browser.tsx` - useWorkbenchState
- `apps/workbench/src/components/workbench/library/import-export.tsx` - useWorkbenchState
- `apps/workbench/src/components/workbench/library/library-gallery.tsx` - useWorkbenchState
- `apps/workbench/src/components/workbench/simulator/simulator-layout.tsx` - useWorkbenchState + usePolicyTabs
- `apps/workbench/src/components/workbench/sentinel-swarm-pages.tsx` - usePolicyTabs
- `apps/workbench/src/components/workbench/editor/bulk-operations-dialog.tsx` - usePolicyTabs + types
- `apps/workbench/src/components/workbench/editor/policy-command-center.tsx` - usePolicyTabs + types
- `apps/workbench/src/components/workbench/editor/policy-tab-bar.tsx` - usePolicyTabs + types
- `apps/workbench/src/components/workbench/editor/sdk-integration-tab.tsx` - useWorkbenchState + usePolicyTabs
- `apps/workbench/src/components/workbench/editor/deploy-panel.tsx` - useWorkbenchState + usePolicyTabs
- `apps/workbench/src/components/workbench/editor/test-runner-panel.tsx` - useWorkbenchState + usePolicyTabs
- `apps/workbench/src/lib/workbench/cross-reference.ts` - PolicyTab type import
- `apps/workbench/src/lib/workbench/detection-workflow/coverage-projection.ts` - PolicyTab type import
- `apps/workbench/src/lib/workbench/detection-workflow/use-draft-detection.ts` - MultiPolicyAction type import
- `apps/workbench/src/components/workbench/coverage/mitre-heatmap.tsx` - PolicyTab type import

### Modified (tests)
- `apps/workbench/src/test/test-helpers.tsx` - PolicyBootstrapProvider
- `apps/workbench/src/features/policy/__tests__/policy-stores-integration.test.tsx` - (renamed from multi-policy-store.test.tsx)
- `apps/workbench/src/__tests__/App.test.tsx` - Updated mock target
- 9 additional test files with updated imports and mocks

## Decisions Made
- Created drop-in replacement hooks (usePolicyTabs/useWorkbenchState) rather than rewriting each of 18 consumers to raw store calls -- preserves identical behavior with minimal risk
- Kept PolicyTab reconstructed type and policyDispatch singleton for consumers that need the full composite object
- Renamed multi-policy-store.test.tsx to policy-stores-integration.test.tsx to reflect its new purpose

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated 18 remaining production consumers before deletion**
- **Found during:** Task 1 (pre-deletion grep)
- **Issue:** Plan assumed plan 02 migrated all production consumers, but 18 production files still imported from multi-policy-store.tsx
- **Fix:** Created usePolicyTabs/useWorkbenchState hooks in use-policy-actions.ts that compose Zustand stores with the same interface, then updated all 18 files to import from new locations
- **Files modified:** 18 production component files + 3 new hook/type files
- **Verification:** grep returns zero import references; tsc --noEmit passes
- **Committed in:** 27b35965c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed stale vi.mock target in App.test.tsx**
- **Found during:** Task 2 verification sweep
- **Issue:** App.test.tsx mocked multi-policy-store for useMultiPolicyBootstrap but App.tsx now imports from use-policy-bootstrap
- **Fix:** Updated mock target to @/features/policy/hooks/use-policy-bootstrap
- **Files modified:** apps/workbench/src/__tests__/App.test.tsx
- **Committed in:** 7f5faf72b

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Deviation 1 was necessary -- the plan underestimated remaining consumers. No scope creep; all changes are mechanical import rewrites.

## Issues Encountered
None - execution was straightforward once the remaining consumer scope was identified.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 17 is complete: all 3 plans executed
- multi-policy-store.tsx bridge layer fully removed (STORE-04)
- MultiPolicyProvider eliminated from codebase (STORE-05)
- All consumers use direct Zustand store hooks
- TypeScript compiles cleanly; ready for test suite verification

---
*Phase: 17-command-modernization-store-migration*
*Completed: 2026-03-23*
