---
phase: track-c-intel
plan: C2-01
type: execute
wave: 2
depends_on: [C1-01]
files_modified:
  - src/lib/workbench/detection-workflow/shared-types.ts
  - src/lib/workbench/detection-workflow/draft-mappers.ts
  - src/lib/workbench/detection-workflow/use-draft-detection.ts
  - src/lib/workbench/__tests__/draft-mappers-finding.test.ts
  - src/components/workbench/findings/finding-detail.tsx
autonomous: true
requirements: [INTEL-06, INTEL-07, INTEL-08]

must_haves:
  truths:
    - "A confirmed finding can be used to draft a detection rule (Sigma, YARA, OCSF, or ClawdStrike Policy)"
    - "The finding-to-draft mapper extracts technique hints from MITRE enrichments, data source hints from signal action types, and IOCs from ioc_extraction enrichments"
    - "The useDraftDetection hook exposes a draftFromFinding method"
    - "The FindingDetail page shows a 'Draft Detection' button for confirmed findings"
    - "Clicking 'Draft Detection' opens a new editor tab with the generated detection rule"
  artifacts:
    - path: "src/lib/workbench/detection-workflow/shared-types.ts"
      provides: "Extended DraftSeedKind with 'finding' variant"
      contains: "finding"
    - path: "src/lib/workbench/detection-workflow/draft-mappers.ts"
      provides: "mapFindingToDraftSeed function"
      exports: ["mapFindingToDraftSeed"]
    - path: "src/lib/workbench/detection-workflow/use-draft-detection.ts"
      provides: "draftFromFinding method in useDraftDetection hook"
      contains: "draftFromFinding"
    - path: "src/lib/workbench/__tests__/draft-mappers-finding.test.ts"
      provides: "Unit tests for mapFindingToDraftSeed"
      contains: "mapFindingToDraftSeed"
    - path: "src/components/workbench/findings/finding-detail.tsx"
      provides: "Draft Detection button for confirmed findings"
      contains: "Draft Detection"
  key_links:
    - from: "src/lib/workbench/detection-workflow/draft-mappers.ts"
      to: "src/lib/workbench/finding-engine.ts"
      via: "Finding and Enrichment type imports"
      pattern: "Finding|Enrichment"
    - from: "src/lib/workbench/detection-workflow/use-draft-detection.ts"
      to: "src/lib/workbench/detection-workflow/draft-mappers.ts"
      via: "mapFindingToDraftSeed import"
      pattern: "mapFindingToDraftSeed"
    - from: "src/components/workbench/findings/finding-detail.tsx"
      to: "src/lib/workbench/detection-workflow/use-draft-detection.ts"
      via: "useDraftDetection hook with draftFromFinding"
      pattern: "draftFromFinding"
---

<objective>
Complete the finding-to-detection-rule pipeline by adding a finding mapper, extending the draft hook, and wiring a "Draft Detection" button into FindingDetail.

Purpose: Confirmed findings contain rich evidence (correlated signals, MITRE mappings, IOCs) that should flow directly into detection rule authoring. The existing detection-workflow pipeline handles events, investigations, and patterns -- this plan adds findings as a fourth source, completing the threat intel cycle.

Output: Operators can click "Draft Detection" on a confirmed finding and get a pre-populated detection rule in the editor.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/track-c-intel/RESEARCH.md

@src/lib/workbench/detection-workflow/shared-types.ts
@src/lib/workbench/detection-workflow/draft-mappers.ts
@src/lib/workbench/detection-workflow/use-draft-detection.ts
@src/lib/workbench/detection-workflow/draft-generator.ts
@src/lib/workbench/finding-engine.ts
@src/lib/workbench/signal-pipeline.ts
@src/components/workbench/findings/finding-detail.tsx

<interfaces>
From src/lib/workbench/detection-workflow/shared-types.ts:
```typescript
export type DraftSeedKind = "hunt_event" | "investigation" | "hunt_pattern" | "manual";
export interface DraftSeed {
  id: string;
  kind: DraftSeedKind;
  sourceEventIds: string[];
  investigationId?: string;
  patternId?: string;
  preferredFormats: FileType[];
  techniqueHints: string[];
  dataSourceHints: string[];
  extractedFields: Record<string, unknown>;
  createdAt: string;
  confidence: number;
}
```

From src/lib/workbench/detection-workflow/draft-mappers.ts:
```typescript
export function mapEventsToDraftSeed(events: AgentEvent[], options?: MapEventsOptions): DraftSeed;
export function mapInvestigationToDraftSeed(investigation: Investigation, scopeEvents?: AgentEvent[], selectedGap?: CoverageGapCandidate): DraftSeed;
export function mapPatternToDraftSeed(pattern: HuntPattern, selectedGap?: CoverageGapCandidate): DraftSeed;
export function recommendFormats(seed: DraftSeed): FileType[];
export function inferTechniqueHints(events: AgentEvent[]): string[];
// Also exported: inferDataSourceHints, inferTechniqueHintsFromText (private but pattern to follow)
// ACTION_TO_DATA_SOURCE mapping: shell_command->process/command, file_access->file, etc.
```

From src/lib/workbench/detection-workflow/use-draft-detection.ts:
```typescript
export interface UseDraftDetectionResult {
  draftFromEvents: (events: AgentEvent[], selectedGap?: CoverageGapCandidate) => Promise<void>;
  draftFromInvestigation: (investigation: Investigation, scopeEvents?: AgentEvent[], selectedGap?: CoverageGapCandidate) => Promise<void>;
  draftFromPattern: (pattern: HuntPattern, selectedGap?: CoverageGapCandidate) => Promise<void>;
  loading: boolean;
  statusMessage: string | null;
}
export function useDraftDetection(options: UseDraftDetectionOptions): UseDraftDetectionResult;
```

From src/lib/workbench/finding-engine.ts:
```typescript
export interface Finding { id: string; title: string; status: FindingStatus; severity: Severity; confidence: number; signalIds: string[]; signalCount: number; scope: FindingScope; enrichments: Enrichment[]; /* ... */ }
export interface Enrichment { id: string; type: "mitre_attack"|"ioc_extraction"|"spider_sense"|...; data: Record<string, unknown>; /* ... */ }
```

From src/lib/workbench/signal-pipeline.ts:
```typescript
export interface Signal { id: string; type: SignalType; data: SignalData; context: SignalContext; /* ... */ }
// SignalData.actionType?: TestActionType -- maps to data source hints via ACTION_TO_DATA_SOURCE
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend DraftSeedKind and create mapFindingToDraftSeed with tests</name>
  <files>src/lib/workbench/detection-workflow/shared-types.ts, src/lib/workbench/detection-workflow/draft-mappers.ts, src/lib/workbench/__tests__/draft-mappers-finding.test.ts</files>
  <read_first>
    - src/lib/workbench/detection-workflow/shared-types.ts (DraftSeedKind, DraftSeed)
    - src/lib/workbench/detection-workflow/draft-mappers.ts (full file -- understand mapInvestigationToDraftSeed pattern, ACTION_TO_DATA_SOURCE, TECHNIQUE_PATTERNS, inferDataSourceHints, recommendFormats)
    - src/lib/workbench/finding-engine.ts (Finding, Enrichment types, enrichment type discriminants)
    - src/lib/workbench/signal-pipeline.ts (Signal type, SignalData.actionType)
  </read_first>
  <action>
    **Step 1: Extend DraftSeedKind in shared-types.ts**

    Change line 18 from:
    ```typescript
    export type DraftSeedKind = "hunt_event" | "investigation" | "hunt_pattern" | "manual";
    ```
    to:
    ```typescript
    export type DraftSeedKind = "hunt_event" | "investigation" | "hunt_pattern" | "finding" | "manual";
    ```

    Add an optional `findingId` field to the DraftSeed interface (after `patternId`):
    ```typescript
    findingId?: string;
    ```

    **Step 2: Create mapFindingToDraftSeed in draft-mappers.ts**

    Add import for Finding, Enrichment from finding-engine and Signal from signal-pipeline. Add the new mapper at the end of the public API section (after mapPatternToDraftSeed, before the helpers section).

    ```typescript
    export function mapFindingToDraftSeed(
      finding: Finding,
      signals: Signal[],
      selectedGap?: CoverageGapCandidate,
    ): DraftSeed;
    ```

    Implementation logic (follow the mapInvestigationToDraftSeed pattern):

    1. **Extract technique hints from MITRE enrichments:**
       ```typescript
       const mitreEnrichments = finding.enrichments.filter(e => e.type === "mitre_attack");
       const enrichmentTechniques: string[] = [];
       for (const e of mitreEnrichments) {
         const techniques = (e.data.techniques ?? []) as Array<{ id: string }>;
         for (const t of techniques) {
           enrichmentTechniques.push(t.id);
         }
       }
       ```

    2. **Extract data source hints from signal action types:**
       Use the existing `ACTION_TO_DATA_SOURCE` mapping. For each signal in `signals` that belongs to the finding (filter by finding.signalIds), extract `signal.data.actionType` and map to data source hints.

    3. **Extract IOC indicators from ioc_extraction enrichments:**
       ```typescript
       const iocEnrichments = finding.enrichments.filter(e => e.type === "ioc_extraction");
       const iocIndicators: Array<{ indicator: string; iocType: string }> = [];
       for (const e of iocEnrichments) {
         const indicators = (e.data.indicators ?? []) as Array<{ indicator: string; iocType: string }>;
         iocIndicators.push(...indicators);
       }
       ```

    4. **Extract technique hints from signal data flags** (signals may have `{ type: "tag", label: "T1059" }` flags):
       Call the existing `inferTechniqueHintsFromText` helper (it's a private function -- either make it internal/exported, or replicate the regex logic for T\d{4} pattern matching on signal flag labels).

       Better approach: Since `inferTechniqueHintsFromText` is private, create a `findingTechniqueHints` helper that:
       - Scans signal.context.flags for `{ type: "tag", label: /T\d{4}/ }` patterns
       - Scans signal.data.summary for technique IDs
       - Merges with enrichmentTechniques

    5. **Build DraftSeed:**
       ```typescript
       const seed: DraftSeed = {
         id: crypto.randomUUID(),
         kind: "finding",
         sourceEventIds: signals.filter(s => finding.signalIds.includes(s.id)).map(s => s.data.sourceEventId).filter(Boolean) as string[],
         findingId: finding.id,
         preferredFormats: selectedGap?.suggestedFormats ?? [],
         techniqueHints: uniqueStrings([...enrichmentTechniques, ...signalTechniqueHints, ...(selectedGap?.techniqueHints ?? [])]),
         dataSourceHints: uniqueStrings([...dataSourceHints, ...(selectedGap?.dataSourceHints ?? [])]),
         extractedFields: {
           title: finding.title,
           severity: finding.severity,
           status: finding.status,
           confidence: finding.confidence,
           signalCount: finding.signalCount,
           agentIds: finding.scope.agentIds,
           sessionIds: finding.scope.sessionIds,
           timeRange: finding.scope.timeRange,
           verdict: finding.verdict,
           ...(iocIndicators.length > 0 ? { iocIndicators } : {}),
         },
         createdAt: new Date().toISOString(),
         confidence: finding.confidence,
       };
       ```

    6. **Infer preferred formats** if none from gap:
       Add a `"finding"` case to `recommendFormats`:
       ```typescript
       // In recommendFormats function, before the default case:
       if (seed.kind === "finding") {
         return ["ocsf_event", "sigma_rule"];
       }
       ```

    **Step 3: Create test file**

    Create `src/lib/workbench/__tests__/draft-mappers-finding.test.ts` with:
    - Test 1: mapFindingToDraftSeed returns seed with kind "finding" and correct findingId
    - Test 2: extracts MITRE technique hints from mitre_attack enrichments
    - Test 3: extracts data source hints from signal action types (shell_command -> process, file_access -> file)
    - Test 4: extracts IOC indicators from ioc_extraction enrichments into extractedFields
    - Test 5: confidence in seed matches finding.confidence
    - Test 6: recommendFormats returns ["ocsf_event", "sigma_rule"] for finding seeds
    - Test 7: selectedGap.techniqueHints are merged into seed.techniqueHints

    Build mock findings and signals using the type shapes from finding-engine.ts and signal-pipeline.ts. Use minimal but valid shapes (id, type, required nested fields).
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx vitest run src/lib/workbench/__tests__/draft-mappers-finding.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - grep -q '"finding"' src/lib/workbench/detection-workflow/shared-types.ts
    - grep -q "findingId" src/lib/workbench/detection-workflow/shared-types.ts
    - grep -q "export function mapFindingToDraftSeed" src/lib/workbench/detection-workflow/draft-mappers.ts
    - grep -q "mitre_attack" src/lib/workbench/detection-workflow/draft-mappers.ts
    - grep -q "ioc_extraction" src/lib/workbench/detection-workflow/draft-mappers.ts
    - grep -q 'kind === "finding"' src/lib/workbench/detection-workflow/draft-mappers.ts
    - grep -c "test\|it(" src/lib/workbench/__tests__/draft-mappers-finding.test.ts returns >= 5
  </acceptance_criteria>
  <done>DraftSeedKind includes "finding", mapFindingToDraftSeed extracts MITRE techniques, data sources, and IOCs from a finding's enrichments and signals, recommendFormats handles "finding" seeds, and all 7 tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Extend useDraftDetection hook with draftFromFinding method</name>
  <files>src/lib/workbench/detection-workflow/use-draft-detection.ts</files>
  <read_first>
    - src/lib/workbench/detection-workflow/use-draft-detection.ts (full file -- understand the draftFromEvents/draftFromInvestigation/draftFromPattern pattern)
    - src/lib/workbench/detection-workflow/draft-mappers.ts (mapFindingToDraftSeed, just created)
  </read_first>
  <action>
    Extend `use-draft-detection.ts` to add `draftFromFinding`:

    1. Import `mapFindingToDraftSeed` from `./draft-mappers`
    2. Import `Finding` from `../../finding-engine` and `Signal` from `../../signal-pipeline`

    3. Add `buildSeedFromFinding` export (matches the pattern of buildSeedFromEvents etc.):
       ```typescript
       export function buildSeedFromFinding(
         finding: Finding,
         signals: Signal[],
         selectedGap?: CoverageGapCandidate,
       ): DraftSeed {
         return mapFindingToDraftSeed(finding, signals, selectedGap);
       }
       ```

    4. Add `draftFromFinding` to the `UseDraftDetectionResult` interface:
       ```typescript
       draftFromFinding: (
         finding: Finding,
         signals: Signal[],
         selectedGap?: CoverageGapCandidate,
       ) => Promise<void>;
       ```

    5. Implement `draftFromFinding` in the hook body, following the exact same pattern as `draftFromInvestigation`:
       ```typescript
       const draftFromFinding = useCallback(
         async (
           finding: Finding,
           signals: Signal[],
           selectedGap?: CoverageGapCandidate,
         ) => {
           setLoading(true);
           setStatusMessage(null);
           try {
             const seed = buildSeedFromFinding(finding, signals, selectedGap);
             const { draft, starterEvidence } = await generateDraftWithEvidence(seed);
             openDraft(draft, starterEvidence.documentId);
             setStatusMessage(
               `Drafted "${draft.name}" as ${FILE_TYPE_REGISTRY[draft.fileType].shortLabel} with starter evidence`,
             );
           } catch (err) {
             const msg = err instanceof Error ? err.message : "Unknown error";
             setStatusMessage(`Draft failed: ${msg}`);
             console.error("[use-draft-detection] draftFromFinding failed:", err);
           } finally {
             setLoading(false);
           }
         },
         [generateDraftWithEvidence, openDraft],
       );
       ```

    6. Add `draftFromFinding` to the returned object.

    This is a purely additive change -- all existing methods remain identical.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit src/lib/workbench/detection-workflow/use-draft-detection.ts 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "draftFromFinding" src/lib/workbench/detection-workflow/use-draft-detection.ts
    - grep -q "buildSeedFromFinding" src/lib/workbench/detection-workflow/use-draft-detection.ts
    - grep -q "mapFindingToDraftSeed" src/lib/workbench/detection-workflow/use-draft-detection.ts
    - grep -q "Finding" src/lib/workbench/detection-workflow/use-draft-detection.ts
  </acceptance_criteria>
  <done>useDraftDetection hook returns draftFromFinding alongside the existing three draft methods. No existing functionality changed.</done>
</task>

<task type="auto">
  <name>Task 3: Add "Draft Detection" button to FindingDetail for confirmed findings</name>
  <files>src/components/workbench/findings/finding-detail.tsx</files>
  <read_first>
    - src/components/workbench/findings/finding-detail.tsx (full file -- find the action buttons section, understand how "Promote to Intel" button works)
    - src/lib/workbench/detection-workflow/use-draft-detection.ts (useDraftDetection hook interface)
    - src/features/findings/stores/signal-store.tsx (useSignalStore for getting signals)
  </read_first>
  <action>
    Modify `src/components/workbench/findings/finding-detail.tsx` to add a "Draft Detection" button:

    1. Import `useDraftDetection` from the detection-workflow (check if there's an existing import path pattern in the codebase -- likely `@/lib/workbench/detection-workflow/use-draft-detection`)
    2. The hook needs a `dispatch` prop -- check how the existing FindingsIntelPage passes dispatch. If finding-detail doesn't have access to the multi-policy dispatch, use the `buildSeedFromFinding` + `buildDraftFromSeed` standalone functions instead, and open the editor tab via the pane store (`usePaneStore.getState().openApp()`).

    Alternative approach (if dispatch is not available in FindingDetail):
    Import `buildSeedFromFinding` and `buildDraftFromSeed` from use-draft-detection as standalone functions (they're exported outside the hook). Then:
    ```typescript
    const handleDraftDetection = useCallback(() => {
      const seed = buildSeedFromFinding(finding, findingSignals);
      const draft = buildDraftFromSeed(seed);
      // Open in editor -- use whatever navigation pattern finding-detail already uses
      // Check how "Promote to Intel" navigates -- likely uses navigate() or openApp()
    }, [finding, findingSignals]);
    ```

    3. Place the button in the action buttons area, next to "Promote to Intel" / "Mark FP" buttons. The button should:
       - Only appear when `finding.status === "confirmed"` (same condition as Promote to Intel)
       - Label: "Draft Detection"
       - Icon: use a code/document icon if available (check what icon library the codebase uses)
       - On click: calls the draft handler
       - Shows a loading indicator while the draft is being generated

    4. Style consistently with existing action buttons (same padding, font, color scheme).

    This is additive -- do not modify any existing button behavior or layout structure.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit src/components/workbench/findings/finding-detail.tsx 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "Draft Detection" src/components/workbench/findings/finding-detail.tsx
    - grep -q "buildSeedFromFinding\|draftFromFinding" src/components/workbench/findings/finding-detail.tsx
    - grep -q 'status.*confirmed\|confirmed.*Draft' src/components/workbench/findings/finding-detail.tsx
  </acceptance_criteria>
  <done>Confirmed findings show a "Draft Detection" button that generates a detection rule from the finding's evidence and opens it in the editor. Button only visible for confirmed findings.</done>
</task>

</tasks>

<verification>
1. `npx vitest run src/lib/workbench/__tests__/draft-mappers-finding.test.ts` -- all finding mapper tests pass
2. `npx tsc --noEmit` on all modified files -- no type errors
3. DraftSeedKind in shared-types.ts includes "finding"
4. useDraftDetection hook exports draftFromFinding
5. FindingDetail shows "Draft Detection" button for confirmed findings
6. Existing draft-from-events/investigation/pattern functionality is unchanged
</verification>

<success_criteria>
- Complete finding-to-detection pipeline: Finding -> DraftSeed -> Draft -> Editor tab
- Mapper extracts MITRE techniques, data sources, IOCs from enrichments
- Hook exposes draftFromFinding alongside existing methods
- UI provides one-click "Draft Detection" for confirmed findings
- 7+ unit tests validate the mapper behavior
</success_criteria>

<output>
After completion, create `.planning/phases/track-c-intel/C2-01-SUMMARY.md`
</output>
