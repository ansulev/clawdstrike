---
phase: 03-threat-scenarios-and-guard-gallery
plan: 03
subsystem: content
tags: [mdx, threat-scenarios, guard-playground, annotated-source, bypass-challenge, fail-closed]

# Dependency graph
requires:
  - phase: 03-01
    provides: "GuardPlayground, AnnotatedSource, BypassChallenge, LessonCompleteButton MDX components"
  - phase: 03-02
    provides: "Source extraction markers and manifest (security-regression-url-spoof, net-irm-extract-host)"
provides:
  - "5 complete MDX lessons for the Threat Scenarios track (Track 1)"
  - "Visceral unprotected-agent danger walkthrough with 5 attack scenarios"
  - "Guarded-agent lesson with 4 interactive guard playgrounds"
  - "Fail-closed design principle lesson with three-level explanation"
  - "Enforcement tiers architecture comparison (in-process, sidecar, centralized)"
  - "URL spoofing regression lesson with annotated real source and bypass challenge"
affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lesson narrative arc: danger -> defense -> principles -> architecture -> regression"
    - "Every lesson embeds at least one GuardPlayground for interactivity"
    - "AnnotatedSource references extracted JSON for real codebase source display"

key-files:
  created:
    - "apps/academy/src/app/tracks/threat-scenarios/03-fail-closed/page.mdx"
    - "apps/academy/src/app/tracks/threat-scenarios/04-enforcement-tiers/page.mdx"
    - "apps/academy/src/app/tracks/threat-scenarios/05-url-spoofing/page.mdx"
  modified:
    - "apps/academy/src/app/tracks/threat-scenarios/01-unprotected-agent/page.mdx"
    - "apps/academy/src/app/tracks/threat-scenarios/02-guarded-agent/page.mdx"

key-decisions:
  - "Annotation line numbers derived from extracted JSON snippets (1-indexed within snippet)"
  - "Lesson 1 playground framed as preview of guard defense rather than unprotected mode"
  - "Lesson 3 uses inline code blocks for fail-closed pattern (not AnnotatedSource) since no tagged region exists"
  - "Lesson 4 uses ASCII-art diagrams for enforcement tier architectures"

patterns-established:
  - "Track narrative structure: 5 lessons from motivation through real regression"
  - "Playground-per-lesson minimum for interactivity"
  - "BypassChallenge used for advanced lessons where user discovers allowed inputs"

requirements-completed: [THR-01, THR-02, THR-03, THR-04, THR-05, INTX-04]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 3 Plan 3: Threat Scenarios Track Lessons Summary

**5 MDX lessons with 8 interactive playgrounds, annotated real source, and bypass challenge covering unprotected-agent dangers through URL spoofing regression**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T21:50:42Z
- **Completed:** 2026-03-20T21:55:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Expanded lesson 1 from 27 lines to visceral 5-scenario walkthrough of unprotected agent dangers
- Expanded lesson 2 from 28 lines to 4-playground guarded agent lesson mirroring all 5 attacks
- Created lesson 3 explaining fail-closed design at three levels (evaluation, parsing, configuration)
- Created lesson 4 comparing in-process, sidecar, and centralized enforcement tiers
- Created lesson 5 with real URL spoofing regression using AnnotatedSource from actual test suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Lessons 1-3 (Unprotected Agent, Guarded Agent, Fail-Closed)** - `c27b47a6e` (feat)
2. **Task 2: Lessons 4-5 (Enforcement Tiers, URL Spoofing Regression)** - `6ff5ed7d7` (feat)

## Files Created/Modified

- `apps/academy/src/app/tracks/threat-scenarios/01-unprotected-agent/page.mdx` - Expanded to 5 danger scenarios with shell command playground
- `apps/academy/src/app/tracks/threat-scenarios/02-guarded-agent/page.mdx` - Expanded to 4 guard playgrounds (forbidden_path, egress_allowlist, shell_command, secret_leak) plus receipt explanation
- `apps/academy/src/app/tracks/threat-scenarios/03-fail-closed/page.mdx` - New: fail-closed design with 3 levels, #[must_use] pattern, prompt injection playground
- `apps/academy/src/app/tracks/threat-scenarios/04-enforcement-tiers/page.mdx` - New: in-process/sidecar/centralized comparison with ASCII diagrams and decision guide
- `apps/academy/src/app/tracks/threat-scenarios/05-url-spoofing/page.mdx` - New: RFC 3986 userinfo attack with 2 AnnotatedSource tags, bypass challenge, and egress playground

## Decisions Made

- Annotation line numbers derived from extracted JSON snippets (1-indexed within snippet, not file line numbers)
- Lesson 1 playground framed as preview of guard defense rather than simulated unprotected mode (guard is always active in playground)
- Lesson 3 uses inline code blocks for fail-closed Rust pattern since there is no specific tagged region in source
- Lesson 4 uses ASCII-art diagrams for enforcement tier architectures (lightweight, renders in MDX without custom components)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 Track 1 lessons complete with interactive playgrounds
- Ready for 03-04 (Guard Gallery pages) which references the same components and patterns
- AnnotatedSource tags validated against extracted-sources JSON files

## Self-Check: PASSED

All 6 files found. Both task commits verified (c27b47a6e, 6ff5ed7d7).

---
*Phase: 03-threat-scenarios-and-guard-gallery*
*Completed: 2026-03-20*
