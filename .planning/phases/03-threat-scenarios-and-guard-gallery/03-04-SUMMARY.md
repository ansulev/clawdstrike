---
phase: 03-threat-scenarios-and-guard-gallery
plan: 04
subsystem: ui
tags: [mdx, guard-gallery, bypass-challenges, annotated-source, playgrounds]

# Dependency graph
requires:
  - phase: 03-threat-scenarios-and-guard-gallery
    provides: "Guard gallery index page (03-01), source extraction markers and manifest (03-02), interactive components (03-03)"
provides:
  - "7 guard gallery MDX pages (01-07) with full template: threat, how-it-works, config, annotated source, playground, bypass challenges"
  - "14 unique bypass challenges across green and yellow tier guards"
affects: [03-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard gallery MDX page template: frontmatter -> threat -> how-it-works -> config -> annotated-source -> playground -> bypass-challenges -> lesson-complete"
    - "ActionType mapping per guard: file_access (path guards), network_egress (egress), file_write (secret-leak), shell_command (shell), patch (patch-integrity), mcp_tool (mcp)"

key-files:
  created:
    - "apps/academy/src/app/tracks/guard-gallery/01-forbidden-path/page.mdx"
    - "apps/academy/src/app/tracks/guard-gallery/02-path-allowlist/page.mdx"
    - "apps/academy/src/app/tracks/guard-gallery/03-egress-allowlist/page.mdx"
    - "apps/academy/src/app/tracks/guard-gallery/04-secret-leak/page.mdx"
    - "apps/academy/src/app/tracks/guard-gallery/05-shell-command/page.mdx"
    - "apps/academy/src/app/tracks/guard-gallery/06-patch-integrity/page.mdx"
    - "apps/academy/src/app/tracks/guard-gallery/07-mcp-tool/page.mdx"
  modified: []

key-decisions:
  - "LessonCompleteButton uses lessonSlug prop (not lessonId) matching component interface"
  - "Shell command guard page includes two AnnotatedSource components (check + extract_candidate_paths) for its two-phase design"

patterns-established:
  - "Guard gallery page structure: consistent 8-section template across all guards"
  - "Bypass challenge difficulty progression: easy (find allowed input) -> hard (exploit edge case or regex boundary)"

requirements-completed: [GARD-01, GARD-04]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 3 Plan 04: Guard Gallery Pages Summary

**7 guard gallery MDX pages (green + yellow tier) with annotated Rust source, interactive playgrounds, and 14 bypass challenges using correct actionType mappings**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T21:50:44Z
- **Completed:** 2026-03-20T21:56:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created 3 green tier guard pages (ForbiddenPath, PathAllowlist, EgressAllowlist) covering pattern-matching fundamentals
- Created 4 yellow tier guard pages (SecretLeak, ShellCommand, PatchIntegrity, McpTool) covering regex and structural analysis
- All 7 pages follow the locked template exactly: Threat, How It Works, Configuration, Annotated Source, Playground, Bypass Challenges
- 14 unique bypass challenges with correct actionType per guard and difficulty progression (easy/hard)

## Task Commits

Each task was committed atomically:

1. **Task 1: Green tier guard pages (ForbiddenPath, PathAllowlist, EgressAllowlist)** - `89fbc7610` (feat)
2. **Task 2: Yellow tier guard pages (SecretLeak, ShellCommand, PatchIntegrity, McpTool)** - `2c88ab75d` (feat)

## Files Created/Modified
- `apps/academy/src/app/tracks/guard-gallery/01-forbidden-path/page.mdx` - ForbiddenPath guard: glob-based sensitive path blocking
- `apps/academy/src/app/tracks/guard-gallery/02-path-allowlist/page.mdx` - PathAllowlist guard: deny-by-default with allowlist fallback
- `apps/academy/src/app/tracks/guard-gallery/03-egress-allowlist/page.mdx` - EgressAllowlist guard: domain-based network egress control
- `apps/academy/src/app/tracks/guard-gallery/04-secret-leak/page.mdx` - SecretLeak guard: regex pattern detection with severity thresholds
- `apps/academy/src/app/tracks/guard-gallery/05-shell-command/page.mdx` - ShellCommand guard: two-phase command + path analysis
- `apps/academy/src/app/tracks/guard-gallery/06-patch-integrity/page.mdx` - PatchIntegrity guard: diff analysis with forbidden patterns
- `apps/academy/src/app/tracks/guard-gallery/07-mcp-tool/page.mdx` - McpTool guard: block/confirm/allow cascade

## Decisions Made
- Used `lessonSlug` prop (not `lessonId`) for `LessonCompleteButton` to match the actual component interface
- Shell command guard page includes two `AnnotatedSource` components to show both the check method and path extraction logic, reflecting the two-phase design

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 7 of 13 guard gallery pages complete (green + yellow tiers)
- Ready for Plan 05 to add orange/red tier pages (prompt-injection, jailbreak, computer-use, spider-sense, remote-desktop, input-injection)
- Existing 01-prompt-injection page needs renaming to 08-prompt-injection (Plan 05 scope)

## Self-Check: PASSED

All 7 guard page files exist. SUMMARY.md created. Both task commits verified (89fbc7610, 2c88ab75d).

---
*Phase: 03-threat-scenarios-and-guard-gallery*
*Completed: 2026-03-20*
