---
phase: track-c-intel
plan: C1-02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/workbench/findings/confidence-breakdown.tsx
  - src/components/workbench/findings/finding-detail.tsx
autonomous: true
requirements: [INTEL-05]

must_haves:
  truths:
    - "Finding detail page shows a confidence score breakdown with all 5 contributing factors"
    - "Each factor displays its weight, raw value, and weighted contribution"
    - "The breakdown visually distinguishes high-contributing factors from low ones"
  artifacts:
    - path: "src/components/workbench/findings/confidence-breakdown.tsx"
      provides: "ConfidenceBreakdown component showing 5-factor score decomposition"
      exports: ["ConfidenceBreakdown"]
    - path: "src/components/workbench/findings/finding-detail.tsx"
      provides: "FindingDetail with ConfidenceBreakdown integrated"
      contains: "ConfidenceBreakdown"
  key_links:
    - from: "src/components/workbench/findings/confidence-breakdown.tsx"
      to: "src/lib/workbench/signal-pipeline.ts"
      via: "ConfidenceInputs type import for factor display"
      pattern: "ConfidenceInputs"
    - from: "src/components/workbench/findings/finding-detail.tsx"
      to: "src/components/workbench/findings/confidence-breakdown.tsx"
      via: "ConfidenceBreakdown component import"
      pattern: "ConfidenceBreakdown"
---

<objective>
Add confidence score decomposition UI to finding detail.

Purpose: The confidence scoring uses a 5-factor weighted formula (source 0.35, anomaly 0.25, pattern 0.20, correlation 0.15, reputation 0.05) but this breakdown is invisible to operators. Making it visible adds transparency and helps operators understand why a finding has its current confidence level.

Output: A ConfidenceBreakdown component embedded in FindingDetail showing the factor-by-factor score composition.
</objective>

<execution_context>
@/Users/connor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/connor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/track-c-intel/RESEARCH.md

@src/components/workbench/findings/finding-detail.tsx
@src/lib/workbench/signal-pipeline.ts
@src/lib/workbench/finding-constants.ts

<interfaces>
From src/lib/workbench/signal-pipeline.ts:
```typescript
export interface ConfidenceInputs {
  sourceConfidence: number;   // 0-1
  anomalyScore: number;       // 0-1
  patternMatchScore: number;  // 0-1
  correlationBoost: number;   // 0-1
  reputationFactor: number;   // 0-1
}

// Weights (not exported as constants, but documented):
// W_SOURCE = 0.35, W_ANOMALY = 0.25, W_PATTERN = 0.20, W_CORR = 0.15, W_REP = 0.05

export function computeSignalConfidence(inputs: ConfidenceInputs): number;
```

From src/lib/workbench/finding-constants.ts:
```typescript
export const SEVERITY_COLORS: Record<Severity, string>;
// critical: "#c45c5c", high: "#d4784b", medium: "#d4a84b", low: "#6b9b8b", info: "#6f7f9a"
```

From src/components/workbench/findings/finding-detail.tsx:
```typescript
// Uses split layout: main content (left) + EnrichmentSidebar (right, 320px)
// Shows confidence as a bar + percentage already
// Renders action buttons, timeline, annotations
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ConfidenceBreakdown component</name>
  <files>src/components/workbench/findings/confidence-breakdown.tsx</files>
  <read_first>
    - src/lib/workbench/signal-pipeline.ts (ConfidenceInputs, computeSignalConfidence, W_* constants at lines 168-173)
    - src/lib/workbench/finding-engine.ts (Finding type, Signal type usage)
    - src/components/workbench/findings/finding-detail.tsx (current confidence display pattern)
    - src/lib/workbench/finding-constants.ts (SEVERITY_COLORS for consistent styling)
  </read_first>
  <action>
    Create `src/components/workbench/findings/confidence-breakdown.tsx`:

    ```typescript
    export interface ConfidenceBreakdownProps {
      finding: Finding;
      signals: Signal[];  // the finding's signals for factor extraction
    }
    export function ConfidenceBreakdown({ finding, signals }: ConfidenceBreakdownProps): JSX.Element;
    ```

    The component:
    1. Computes aggregate factor values from the finding's signals:
       - sourceConfidence: average of signal.confidence across all signals
       - anomalyScore: max anomaly score from signals with type "anomaly" (signal.data.anomaly?.score)
       - patternMatchScore: 1.0 if any signal has data.patternId, else 0
       - correlationBoost: scale by signal count (2 signals = 0.3, 5+ = 0.8, capped at 1.0)
       - reputationFactor: 1.0 for local signals, attenuated if any swarm signals present

    2. Renders a compact card with:
       - Header: "Confidence Breakdown" with the final score as a percentage badge
       - 5 rows, one per factor:
         - Factor name (e.g., "Source Reliability")
         - Weight label (e.g., "35%")
         - A horizontal bar showing the raw factor value (0-1), colored by contribution level
         - Weighted contribution value (weight * rawValue, formatted as percentage)
       - Color coding: factor contribution >= 0.15 uses "#3dbf84" (green/good signal), 0.05-0.15 uses "#d4a84b" (amber), < 0.05 uses "#6f7f9a" (muted)

    3. Factor display names:
       - sourceConfidence -> "Source Reliability"
       - anomalyScore -> "Anomaly Score"
       - patternMatchScore -> "Pattern Match"
       - correlationBoost -> "Correlation Boost"
       - reputationFactor -> "Reputation Factor"

    Style with inline styles or Tailwind matching the existing finding-detail dark theme (bg: transparent or very subtle, text: #c8d0db, borders: #2a3441 pattern from finding-constants).

    Keep the component compact -- it should fit in the enrichment sidebar or as a section in the main detail area without taking excessive vertical space.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit src/components/workbench/findings/confidence-breakdown.tsx 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "export function ConfidenceBreakdown" src/components/workbench/findings/confidence-breakdown.tsx
    - grep -q "Source Reliability" src/components/workbench/findings/confidence-breakdown.tsx
    - grep -q "Anomaly Score" src/components/workbench/findings/confidence-breakdown.tsx
    - grep -q "Pattern Match" src/components/workbench/findings/confidence-breakdown.tsx
    - grep -q "Correlation Boost" src/components/workbench/findings/confidence-breakdown.tsx
    - grep -q "Reputation Factor" src/components/workbench/findings/confidence-breakdown.tsx
    - grep -q "ConfidenceBreakdownProps" src/components/workbench/findings/confidence-breakdown.tsx
  </acceptance_criteria>
  <done>ConfidenceBreakdown component renders 5-factor decomposition with named factors, weights, bars, and colored contribution values.</done>
</task>

<task type="auto">
  <name>Task 2: Integrate ConfidenceBreakdown into FindingDetail</name>
  <files>src/components/workbench/findings/finding-detail.tsx</files>
  <read_first>
    - src/components/workbench/findings/finding-detail.tsx (full file -- find where confidence is currently displayed)
    - src/components/workbench/findings/confidence-breakdown.tsx (just created in Task 1)
    - src/features/findings/stores/signal-store.tsx (useSignalStore for getting signals)
  </read_first>
  <action>
    Modify `src/components/workbench/findings/finding-detail.tsx` to:

    1. Import `ConfidenceBreakdown` from `./confidence-breakdown`
    2. Import `useSignalStore` from the signal store (if not already imported)
    3. Get the finding's signals: `const allSignals = useSignalStore.use.signals()` then filter to `finding.signalIds`
    4. Add the `<ConfidenceBreakdown finding={finding} signals={findingSignals} />` component

    Placement: Insert it directly below the existing confidence display (the bar + percentage). It should be collapsible -- wrap in a `<details>` element or a clickable header that toggles visibility, defaulting to collapsed. This keeps the detail view clean while making the breakdown accessible.

    Do NOT modify any existing functionality. This is purely additive.
  </action>
  <verify>
    <automated>cd /Users/connor/Medica/backbay/standalone/clawdstrike-workbranch/apps/workbench && npx tsc --noEmit src/components/workbench/findings/finding-detail.tsx 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "ConfidenceBreakdown" src/components/workbench/findings/finding-detail.tsx
    - grep -q "confidence-breakdown" src/components/workbench/findings/finding-detail.tsx
    - grep -q "useSignalStore" src/components/workbench/findings/finding-detail.tsx
  </acceptance_criteria>
  <done>FindingDetail shows a collapsible ConfidenceBreakdown below the confidence meter. Existing functionality unchanged.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` on both files -- no type errors
2. ConfidenceBreakdown shows all 5 factors with correct names and weight percentages
3. FindingDetail renders ConfidenceBreakdown in collapsible section
</verification>

<success_criteria>
- Operators can see the 5-factor confidence breakdown for any finding
- Breakdown shows factor names, weights, raw values, and weighted contributions
- Visual color coding distinguishes high vs low contributing factors
- Component is collapsible to avoid cluttering the default view
</success_criteria>

<output>
After completion, create `.planning/phases/track-c-intel/C1-02-SUMMARY.md`
</output>
