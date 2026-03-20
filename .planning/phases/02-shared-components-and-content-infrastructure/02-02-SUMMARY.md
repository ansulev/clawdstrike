---
phase: 02-shared-components-and-content-infrastructure
plan: 02
subsystem: ui
tags: [shiki, source-extraction, mdx, react, build-pipeline]

requires:
  - phase: 01-foundation-and-wasm-integration
    provides: CodeBlock component with Shiki dual-theme pattern, MDX component registration

provides:
  - Build-time source extraction pipeline reading @academy:start/@academy:end markers
  - AnnotatedSource MDX component with Shiki highlighting and interactive callout badges
  - Manifest-driven extraction with fail-on-missing validation

affects: [03-guard-deep-dives, content-authoring]

tech-stack:
  added: []
  patterns: [build-time-extraction, marker-based-source-inclusion, annotated-code-viewer]

key-files:
  created:
    - apps/academy/src/lib/source-extraction/extract.ts
    - apps/academy/src/lib/source-extraction/manifest.ts
    - apps/academy/src/lib/source-extraction/__tests__/extract.test.ts
    - apps/academy/src/components/mdx/annotated-source.tsx
    - apps/academy/src/data/extracted-sources/.gitkeep
    - apps/academy/vitest.config.ts
  modified:
    - apps/academy/package.json
    - apps/academy/mdx-components.tsx
    - apps/academy/src/app/globals.css
    - .gitignore

key-decisions:
  - "Extraction runs at prebuild, chained before both build and dev scripts"
  - "Shiki line transformer adds data-line attributes for annotation targeting"
  - "Manifest starts empty; tags added to source files as lessons are authored in Phase 3"

patterns-established:
  - "Marker format: // @academy:start <tag> ... // @academy:end <tag> (or # prefix for Python/YAML)"
  - "Extracted JSON emitted per-tag to src/data/extracted-sources/, gitignored as build artifacts"
  - "AnnotatedSource component: dynamic import by tag name, badges + expandable explanation panels"

requirements-completed: [INTX-01, INTX-02]

duration: 4min
completed: 2026-03-20
---

# Phase 2 Plan 2: Source Extraction Pipeline and Annotated Source Viewer Summary

**Build-time extraction pipeline with @academy markers pulls real Rust/TS source into JSON; AnnotatedSource component renders with Shiki dual-theme highlighting and interactive numbered callout badges**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T20:22:42Z
- **Completed:** 2026-03-20T20:27:28Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Source extraction script parses @academy:start/@academy:end markers from Rust, TypeScript, Python, and YAML files
- Build fails with exit code 1 if expected tags from the manifest are missing from source files
- AnnotatedSource component loads extracted JSON by tag, renders with Shiki highlighting, shows numbered callout badges that expand inline explanations on click
- 10 passing tests covering extraction, language detection, unclosed tags, multi-region, and missing-tag errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Build-time source extraction script with manifest and tests**
   - `b21dc9fe7` (test: RED -- failing tests for extraction pipeline)
   - `5bd86b8c1` (feat: GREEN -- extraction implementation, manifest, package.json scripts)
2. **Task 2: AnnotatedSource component with Shiki highlighting and callout badges**
   - `89d3ae487` (feat: component, CSS, MDX registration)

## Files Created/Modified

- `apps/academy/src/lib/source-extraction/extract.ts` - Build-time extraction script: extractFromFile + runExtraction
- `apps/academy/src/lib/source-extraction/manifest.ts` - Manifest config with REPO_ROOT, OUT_DIR, and EXTRACTION_MANIFEST
- `apps/academy/src/lib/source-extraction/__tests__/extract.test.ts` - 10 tests for extraction logic
- `apps/academy/src/components/mdx/annotated-source.tsx` - Client component with Shiki highlighting, callout badges, expandable explanations
- `apps/academy/src/data/extracted-sources/.gitkeep` - Placeholder for generated JSON directory
- `apps/academy/vitest.config.ts` - Test runner config with happy-dom and path aliases
- `apps/academy/package.json` - Added prebuild script chained before build and dev
- `apps/academy/mdx-components.tsx` - Registered AnnotatedSource component
- `apps/academy/src/app/globals.css` - Added annotated-source line highlighting CSS
- `.gitignore` - Added extracted-sources/*.json exclusion

## Decisions Made

- Extraction runs at prebuild time, chained before both build and dev scripts via `npm run prebuild &&`
- Manifest starts empty (commented-out entries as examples); content authors add entries as lessons are written in Phase 3
- Shiki line transformer adds `data-line` attributes (1-indexed) for annotation badge positioning
- AnnotatedSource uses dynamic import for JSON loading (`import(@/data/extracted-sources/${tag}.json)`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in guard test/type files from plan 02-01 (modules not yet implemented). Not related to this plan's changes -- verified all 02-02 files compile cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Source extraction pipeline ready for content authors to add @academy markers to real source files
- AnnotatedSource component available in MDX for interactive code walkthroughs
- Guard simulation modules (plan 02-01) need implementation before guard-specific content can be written

## Self-Check: PASSED

All 7 created files verified on disk. All 3 task commits (b21dc9fe7, 5bd86b8c1, 89d3ae487) verified in git log.

---
*Phase: 02-shared-components-and-content-infrastructure*
*Completed: 2026-03-20*
