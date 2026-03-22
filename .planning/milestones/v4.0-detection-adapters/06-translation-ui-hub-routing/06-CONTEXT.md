# Phase 6: Translation UI & Hub-and-Spoke Routing - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire translation providers to a user-facing "Translate to..." command and build multi-hop cross-format routing through Sigma. Closes integration gaps from v4.0 audit: TRANSLATION_UI, HUB_AND_SPOKE_ROUTING, Flows C and E.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure/gap closure phase. Key guidance from audit:
- Create `useTranslation` hook that calls `getTranslationPath()` + `provider.translate()`
- Create `chainTranslation()` function that resolves multi-hop paths through Sigma as hub
- Register "Translate to..." command in command palette
- Show translation results with field mapping diagnostics and untranslatable features
- Export `parseYaralRule` from yaral-adapter.ts to eliminate duplication in yaral-translation.ts

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `translations.ts` — `getTranslationPath(from, to)`, `getTranslatableTargets(fileType)`, `registerTranslationProvider()`
- `use-publication.ts` — already calls `getTranslatableTargets()` for publish target dropdown (line 94)
- `command-registry.ts` — singleton command registry for palette commands
- `detection-panel-kit.tsx` — `FieldMappingTable` component for displaying field mappings
- All 4 translation providers: splTranslationProvider, kqlTranslationProvider, eqlTranslationProvider, yaralTranslationProvider

### Integration Points
- Command palette — register "Translate to..." command
- Editor toolbar / context menu — translation action trigger
- Detection workflow barrel (index.ts) — export new hook and chainTranslation function
- split-editor.tsx — may need translation results panel

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/v4.0-MILESTONE-AUDIT.md` tech debt section
</specifics>

<deferred>
## Deferred Ideas
- Direct pairwise translations for quality (SPL<->KQL without Sigma hub) — v2
- Translation quality scoring / confidence metrics
</deferred>
