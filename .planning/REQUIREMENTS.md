# Requirements: ClawdStrike Workbench v1.4 — Cleanup & Store Migration

**Defined:** 2026-03-22
**Core Value:** Eliminate tech debt and complete store decomposition for a clean, maintainable codebase

## v1.4 Requirements

### Test Fixes

- [ ] **TEST-01**: App.test.tsx passes — ActivityBar properly mocked or test updated for current component tree
- [ ] **TEST-02**: desktop-layout.test.tsx passes — stale DesktopSidebar mock replaced with current ActivityBar/SidebarPanel mocks
- [ ] **TEST-03**: shortcut-provider.test.tsx passes — transitive dependencies properly handled

### Search & Input

- [x] **SRCH-06**: Search store uses AbortController to cancel in-flight searches when query changes
- [x] **SRCH-07**: Stale search results are discarded (query-at-dispatch compared to query-at-resolve)

### Terminal

- [x] **TERM-03**: Terminal dimensions derived from container size via ResizeObserver (not hardcoded 800x240)

### Keybindings

- [x] **KEY-01**: Meta+W conflict resolved — single unambiguous close behavior across editor and pane contexts

### Command Modernization

- [ ] **CMD-01**: file.new uses direct usePolicyTabsStore.newTab() call (no legacy newPolicy injection)
- [ ] **CMD-02**: FileCommandDeps interface no longer requires newPolicy callback

### Store Migration

- [ ] **STORE-01**: split-editor.tsx migrated from useMultiPolicy() to direct store calls
- [ ] **STORE-02**: editor-home-tab.tsx migrated from useMultiPolicy() to direct store calls
- [ ] **STORE-03**: All remaining ~18 components migrated off useMultiPolicy()/useWorkbench() bridge hooks
- [ ] **STORE-04**: multi-policy-store.tsx bridge layer deleted (975 lines removed)
- [ ] **STORE-05**: MultiPolicyProvider removed from component tree (currently empty fragment)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features or UI changes | This is purely cleanup — no new user-facing capabilities |
| Test coverage expansion | Only fix broken tests, don't add new test suites |
| Performance optimization | Separate concern, not part of debt cleanup |
| Explorer v1.2 checkbox updates | Already implemented, just needs REQUIREMENTS.md update (trivial) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 15 | Pending |
| TEST-02 | Phase 15 | Pending |
| TEST-03 | Phase 15 | Pending |
| SRCH-06 | Phase 16 | Complete |
| SRCH-07 | Phase 16 | Complete |
| TERM-03 | Phase 16 | Complete |
| KEY-01 | Phase 16 | Complete |
| CMD-01 | Phase 17 | Pending |
| CMD-02 | Phase 17 | Pending |
| STORE-01 | Phase 17 | Pending |
| STORE-02 | Phase 17 | Pending |
| STORE-03 | Phase 17 | Pending |
| STORE-04 | Phase 17 | Pending |
| STORE-05 | Phase 17 | Pending |

**Coverage:**
- v1.4 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0
