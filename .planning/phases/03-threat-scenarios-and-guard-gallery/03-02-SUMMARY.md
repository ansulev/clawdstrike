---
phase: 03-threat-scenarios-and-guard-gallery
plan: 02
subsystem: content-pipeline
tags: [source-extraction, academy, guards, rust, markers]

requires:
  - phase: 02-shared-components-and-content-infrastructure
    provides: Source extraction pipeline (extract.ts, manifest.ts, prebuild script)
provides:
  - 24 tagged source regions across 15 Rust files for guard gallery pages
  - Populated extraction manifest with 16 entries
  - Working prebuild extraction producing JSON for all 24 tags
affects: [03-threat-scenarios-and-guard-gallery, guard-gallery-pages, annotated-source]

tech-stack:
  added: []
  patterns:
    - "@academy:start/@academy:end comment markers for source extraction"
    - "Tiered manifest organization (green/yellow/orange/red) matching guard threat levels"

key-files:
  created: []
  modified:
    - apps/academy/src/lib/source-extraction/manifest.ts
    - crates/libs/clawdstrike/src/guards/forbidden_path.rs
    - crates/libs/clawdstrike/src/guards/path_allowlist.rs
    - crates/libs/clawdstrike/src/guards/egress_allowlist.rs
    - crates/libs/clawdstrike/src/guards/secret_leak.rs
    - crates/libs/clawdstrike/src/guards/shell_command.rs
    - crates/libs/clawdstrike/src/guards/patch_integrity.rs
    - crates/libs/clawdstrike/src/guards/mcp_tool.rs
    - crates/libs/clawdstrike/src/guards/prompt_injection.rs
    - crates/libs/clawdstrike/src/guards/jailbreak.rs
    - crates/libs/clawdstrike/src/guards/computer_use.rs
    - crates/libs/clawdstrike/src/spider_sense.rs
    - crates/libs/clawdstrike/src/guards/remote_desktop_side_channel.rs
    - crates/libs/clawdstrike/src/guards/input_injection_capability.rs
    - crates/libs/clawdstrike/tests/security_regressions.rs
    - crates/libs/clawdstrike/src/irm/net.rs

key-decisions:
  - "Placed markers around key methods (check, is_forbidden, scan, search, etc.) rather than entire files for focused gallery display"
  - "secret-leak-patterns tag wraps first 5 patterns instead of all 18 to show structure without excessive length"
  - "Fixed latent REPO_ROOT bug (6 levels up instead of 5) that was masked by empty manifest"

patterns-established:
  - "Academy marker placement: start marker on line before function signature, end marker on line after closing brace"
  - "Manifest organized by guard threat tier (green/yellow/orange/red) for visual consistency with gallery"

requirements-completed: [GARD-02, INTX-04]

duration: 10min
completed: 2026-03-20
---

# Phase 3 Plan 2: Source Extraction Markers Summary

**24 @academy tagged regions across 15 Rust guard files with fully populated extraction manifest producing JSON for guard gallery AnnotatedSource display**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-20T21:37:16Z
- **Completed:** 2026-03-20T21:47:40Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Added 24 @academy:start/@academy:end marker pairs across 15 Rust source files (13 guards + security_regressions.rs + irm/net.rs)
- Populated extraction manifest with 16 entries organized by guard threat tier
- Prebuild script successfully extracts all 24 tagged regions into JSON files for AnnotatedSource component consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Add @academy markers to all guard Rust source files** - `68119fb0d` (feat)
2. **Task 2: Populate extraction manifest with all 16 entries** - `eb684f373` (feat)

## Files Created/Modified
- `apps/academy/src/lib/source-extraction/manifest.ts` - 16 entries covering all tagged files, fixed REPO_ROOT path depth
- `crates/libs/clawdstrike/src/guards/forbidden_path.rs` - Tags: forbidden-path-check, forbidden-path-defaults
- `crates/libs/clawdstrike/src/guards/path_allowlist.rs` - Tags: path-allowlist-check, path-allowlist-match
- `crates/libs/clawdstrike/src/guards/egress_allowlist.rs` - Tags: egress-allowlist-check, egress-domain-eval
- `crates/libs/clawdstrike/src/guards/secret_leak.rs` - Tags: secret-leak-scan, secret-leak-patterns
- `crates/libs/clawdstrike/src/guards/shell_command.rs` - Tags: shell-command-check, shell-command-extract
- `crates/libs/clawdstrike/src/guards/patch_integrity.rs` - Tags: patch-integrity-analyze, patch-integrity-check
- `crates/libs/clawdstrike/src/guards/mcp_tool.rs` - Tags: mcp-tool-decision, mcp-tool-check
- `crates/libs/clawdstrike/src/guards/prompt_injection.rs` - Tag: prompt-injection-check
- `crates/libs/clawdstrike/src/guards/jailbreak.rs` - Tag: jailbreak-check
- `crates/libs/clawdstrike/src/guards/computer_use.rs` - Tag: computer-use-check
- `crates/libs/clawdstrike/src/spider_sense.rs` - Tags: spider-sense-search, spider-sense-cosine
- `crates/libs/clawdstrike/src/guards/remote_desktop_side_channel.rs` - Tags: remote-desktop-check, remote-desktop-candidate
- `crates/libs/clawdstrike/src/guards/input_injection_capability.rs` - Tag: input-injection-check
- `crates/libs/clawdstrike/tests/security_regressions.rs` - Tag: security-regression-url-spoof
- `crates/libs/clawdstrike/src/irm/net.rs` - Tag: net-irm-extract-host

## Decisions Made
- Placed markers around key methods (check, is_forbidden, scan, search, etc.) rather than entire files for focused gallery display
- For secret_leak.rs, tagged only the first 5 default patterns to show structure without excessive length (18 patterns total)
- Fixed latent REPO_ROOT bug in manifest.ts (6 levels up instead of correct 5) that was masked by empty manifest

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed REPO_ROOT path depth in manifest.ts**
- **Found during:** Task 2 (Populate extraction manifest)
- **Issue:** REPO_ROOT resolved 6 levels up from source-extraction dir, landing at `standalone/` instead of `clawdstrike/`. Prebuild failed with ENOENT.
- **Fix:** Changed from `'../../../../../..'` (6 levels) to `'../../../../..'` (5 levels)
- **Files modified:** apps/academy/src/lib/source-extraction/manifest.ts
- **Verification:** `npm run prebuild` completes successfully, all 24 tags extracted
- **Committed in:** eb684f373 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix was necessary for the extraction pipeline to function. No scope creep.

## Issues Encountered
None beyond the REPO_ROOT fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 24 tagged source regions ready for AnnotatedSource component consumption in guard gallery pages
- Prebuild pipeline fully operational: `npm run prebuild` extracts 24 JSON files
- Guard gallery page authoring (Phase 3 Plans 3-5) can now reference extracted source via tag names

---
*Phase: 03-threat-scenarios-and-guard-gallery*
*Completed: 2026-03-20*
