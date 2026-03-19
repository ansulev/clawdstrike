# Detection Adapter Plugins for ClawdStrike Workbench

**Researched:** 2026-03-18
**Overall confidence:** HIGH (architecture analysis from source code) / MEDIUM (detection format details from training data)

---

## 1. Existing Detection Adapter Architecture

### 1.1 Core Interface: `DetectionWorkflowAdapter`

The adapter system lives in `apps/workbench/src/lib/workbench/detection-workflow/adapters.ts` and defines a clean, six-method interface:

```typescript
export interface DetectionWorkflowAdapter {
  fileType: FileType;
  canDraftFrom(seed: DraftSeed): boolean;
  buildDraft(seed: DraftSeed): DraftBuildResult;
  buildStarterEvidence(seed: DraftSeed, document: DetectionDocumentRef): EvidencePack;
  runLab(request: DetectionExecutionRequest): Promise<DetectionExecutionResult>;
  buildExplainability(run: LabRun): ExplainabilityTrace[];
  buildPublication(request: PublicationRequest): Promise<PublicationBuildResult>;
}
```

**Registry:** Simple `Map<FileType, DetectionWorkflowAdapter>` with `registerAdapter()`, `getAdapter()`, `hasAdapter()`, `getRegisteredFileTypes()`. Each adapter self-registers at module load via `registerAdapter(adapterInstance)` at the bottom of its file.

**Key observations:**
- The registry is a flat map -- no priority, no ordering, no lifecycle hooks.
- Adapters are singletons -- one per FileType, registered once.
- No unregister mechanism (unlike `registerFileType()` which returns a dispose function).
- No async initialization -- adapters must be synchronously constructible.

### 1.2 Currently Registered Adapters

| Adapter | FileType | File | Lines | Complexity |
|---------|----------|------|-------|------------|
| Sigma | `sigma_rule` | `sigma-adapter.ts` | 639 | High -- full client-side matching, native backend fallback, MITRE ATT&CK extraction, publication to SPL/KQL/ESQL/JSON |
| YARA | `yara_rule` | `yara-adapter.ts` | 658 | High -- byte-level pattern matching, YARA rule parsing, hex/base64 evidence handling |
| OCSF | `ocsf_event` | `ocsf-adapter.ts` | 571 | Medium -- JSON validation, OCSF schema checking, class UID routing |
| Policy | `clawdstrike_policy` | `policy-adapter.ts` | ~400+ | High -- guard evaluation via Tauri backend, test scenario execution |

**Important:** There is NO policy adapter implementation visible in the files read, but `policy-adapter.ts` is referenced in tests. Policy is the "reference implementation" per the doc comment at the top of `adapters.ts`.

### 1.3 File Type Registry Integration

`file-type-registry.ts` is the parallel system that associates file types with UI metadata:

```typescript
export interface FileTypeDescriptor {
  id: FileType;
  label: string;
  shortLabel: string;
  extensions: string[];
  iconColor: string;
  defaultContent: string;
  testable: boolean;
  convertibleTo: FileType[];
}
```

**Critical integration point:** `registerFileType()` already supports plugin file types -- it returns a dispose function and accepts an optional `detect` callback for content-based file type detection. The `detectFileType()` function already checks plugin detectors at step 3.5.

This means the file type registry is plugin-ready. Detection adapters need to register both:
1. A `FileTypeDescriptor` via `registerFileType()` (UI metadata)
2. A `DetectionWorkflowAdapter` via `registerAdapter()` (workflow behavior)

### 1.4 Editor Visual Panel Integration

Each format has a dedicated visual panel component:

| Format | Component | Approach | Editable Fields |
|--------|-----------|----------|-----------------|
| Policy | `editor-visual-panel.tsx` | Guard cards with drag-and-drop, settings panel, deploy panel | All guards, settings, origin enforcement |
| Sigma | `sigma-visual-panel.tsx` | YAML round-trip editing, detection logic tree visualization | Title, status, level, description, author, date, logsource |
| YARA | `yara-visual-panel.tsx` | Regex-based parsing (NOT YAML), meta field round-trip editing | Rule name, author, description, date, reference |
| OCSF | `ocsf-visual-panel.tsx` | JSON deep get/set, progressive disclosure by class_uid | All OCSF fields, validation checklist |

**Key pattern:** Each panel is a self-contained React component that:
1. Receives source text + onChange callback
2. Parses the source internally (no shared parsing layer)
3. Provides format-specific visualization (logic trees for Sigma, hex grids for YARA, etc.)
4. Uses `shared-form-fields.tsx` for common UI primitives (`Section`, `FieldLabel`, `TextInput`, `TextArea`, `SelectInput`)

**Visual builder routing is currently hardcoded** -- the editor component switches on `fileType` to pick the right panel. This needs to become dynamic for plugins.

### 1.5 Explainability Trace System

The `ExplainabilityTrace` discriminated union already has a `plugin_trace` variant:

```typescript
| {
    id: string;
    kind: "plugin_trace";
    caseId: string;
    traceType: string;
    data: Record<string, unknown>;
    sourceLineHints?: number[];
  }
```

This is forward-looking -- the system was designed with plugin extensibility in mind. Plugin adapters can emit `plugin_trace` traces with arbitrary `traceType` and `data` payloads.

### 1.6 Publication Target System

`PublishTarget` is currently a string union: `"native_policy" | "spl" | "kql" | "esql" | "json_export" | "fleet_deploy"`.

The Sigma adapter already converts to SPL, KQL, and ESQL via `convertSigmaToQuery()` in `sigma-conversion.ts`. This function handles field-level translation with modifier support (contains, startswith, endswith, re) and generates platform-specific syntax.

**Key finding:** SPL, KQL, and ESQL are already output targets from Sigma rules. The proposed plugin adapters would make these first-class input formats that can also be drafted, tested, and converted -- not just publication outputs.

---

## 2. Detection Format Landscape

### 2.1 Splunk SPL (Search Processing Language)

**Syntax structure:**
```
index=main sourcetype=WinEventLog:Security EventCode=4688
| where CommandLine LIKE "%powershell%"
| stats count by ComputerName, CommandLine
```

**Key characteristics:**
- Pipe-chained command language (search | filter | transform | aggregate)
- Field extraction via `field=value`, `field="glob*"`, `match(field, regex)`
- Time-windowed searches via `earliest=` / `latest=`
- Subsearch support with `[search ...]`
- Notable framework for scheduled detections: `| sendalert` / Saved Searches
- Rich data model mapping via CIM (Common Information Model)

**Translation challenges from Sigma:**
- Field name mapping (Sigma uses Windows event field names; Splunk uses CIM or raw field names)
- Sigma's `|contains` maps to `LIKE "%value%"`, `|startswith` to `LIKE "value%"`
- Sigma `detection.condition` logic (AND/OR/NOT across selections) maps to pipe chains or `where` clauses
- Splunk macros and lookups have no Sigma equivalent

**File format for detection rules:**
- Saved searches stored as `.conf` stanzas in `savedsearches.conf`
- Can also be JSON via REST API or YAML via Splunk Enterprise Security content packs
- For the workbench, use plain SPL text with metadata comments

**Confidence:** MEDIUM (SPL syntax well-known from training data, but specific CIM field mappings may need validation)

### 2.2 KQL (Kusto Query Language) -- Microsoft Sentinel

**Syntax structure:**
```
SecurityEvent
| where EventID == 4688
| where CommandLine contains "powershell"
| project TimeGenerated, Computer, CommandLine
```

**Key characteristics:**
- Tabular expression language -- starts with a table name, pipes through operators
- Operators: `where`, `project`, `extend`, `summarize`, `join`, `union`
- String operators: `contains`, `startswith`, `endswith`, `matches regex`
- Time operators: `ago()`, `between()`, `datetime()`
- Analytics Rules format wraps KQL in a JSON/ARM template with scheduling, severity, tactics

**Translation challenges from Sigma:**
- Table name mapping (Sigma logsource category -> Sentinel table: `process_creation` -> `SecurityEvent` or `DeviceProcessEvents`)
- Field name differences between Sysmon schema and Sentinel schema
- KQL has no direct equivalent of Sigma's `1 of selection*` -- must expand to explicit OR chains
- Analytics Rule metadata (severity, tactics, entity mapping) has no direct Sigma equivalent

**File format:**
- Raw KQL text for queries
- ARM template JSON for Analytics Rules (includes scheduling, entity mapping, severity)
- For the workbench, use KQL text with optional JSON metadata wrapper

**Confidence:** MEDIUM (KQL syntax well-known, Sentinel table mappings would need current validation)

### 2.3 Chronicle YARA-L (Google SecOps)

**Syntax structure:**
```
rule suspicious_powershell {
  meta:
    author = "Detection Lab"
    severity = "HIGH"
  events:
    $e.metadata.event_type = "PROCESS_LAUNCH"
    $e.target.process.command_line = /powershell/ nocase
  condition:
    $e
}
```

**Key characteristics:**
- YARA-inspired syntax but fundamentally different -- operates on UDM (Unified Data Model) events, not byte streams
- Three main sections: `meta`, `events` (match conditions on UDM fields), `condition` (temporal/correlation logic)
- Supports multi-event correlation: `$e1` and `$e2` can reference different events
- Time windows via `$e1.metadata.event_timestamp.seconds - $e2.metadata.event_timestamp.seconds < 300`
- `match` section for grouping/aggregation
- `outcome` section for severity/risk scoring

**Relationship to standard YARA:**
- Surface syntax similarity (rule name, meta section, condition section)
- Completely different semantics: YARA matches bytes in files; YARA-L matches structured events in time
- YARA strings section becomes YARA-L events section
- No hex patterns, no byte offsets -- purely field-based event matching

**Translation challenges:**
- UDM field paths (`$e.metadata.event_type`, `$e.target.process.command_line`) are Chronicle-specific
- Multi-event correlation has no Sigma equivalent
- `outcome` scoring is unique to YARA-L
- Regular expressions use RE2 syntax (no backreferences, lookahead/behind)

**File format:** `.yaral` text files

**Confidence:** MEDIUM (YARA-L syntax is well-documented but UDM field taxonomy is extensive and evolving)

### 2.4 Elastic EQL (Event Query Language)

**Syntax structure:**
```
process where process.name == "powershell.exe"
  and process.command_line : "*-encodedcommand*"
```

**Key characteristics:**
- Event-centric query language with event category prefixes (`process`, `file`, `network`, `registry`)
- Sequence queries for ordered multi-event correlation: `sequence by host.id [process where ...] [file where ...]`
- Wildcard support: `field : "*pattern*"` (case-insensitive by default)
- `maxspan` for time windows in sequences
- `until` clause for terminating conditions
- ECS (Elastic Common Schema) field naming

**Translation challenges:**
- Event category prefix maps from Sigma logsource category
- ECS field names differ from Sigma field names (e.g., `process.command_line` vs `CommandLine`)
- Sequence queries have no Sigma equivalent (Sigma is single-event)
- `until` and `maxspan` are EQL-specific
- Case sensitivity: EQL `:` operator is case-insensitive; `==` is case-sensitive

**File format:**
- Raw EQL text for queries
- NDJSON for Elastic Security detection rules (includes metadata, risk score, MITRE mapping)
- Note: Sigma already outputs `esql` (ES|QL, Elasticsearch's SQL-like query language) -- EQL is a different language

**Important distinction:** The existing `sigma-conversion.ts` outputs ES|QL (`from logs | where ...`) not EQL (`process where ...`). EQL is a separate, event-correlation-focused language. Both live in the Elastic ecosystem but serve different purposes. The plugin should support EQL specifically, which adds sequence/correlation capabilities.

**Confidence:** MEDIUM (EQL syntax well-known, ECS field mapping needs validation for current schema version)

### 2.5 Sumo Logic Query Syntax

**Syntax structure:**
```
_sourceCategory=windows/security
| where EventCode = "4688"
| where CommandLine matches "*powershell*"
| count by _sourceHost, CommandLine
```

**Key characteristics:**
- Pipe-chained like SPL but different syntax
- Uses `where` for filtering, `parse` for field extraction
- Regex with `parse regex` or `where field matches`
- `_sourceCategory`, `_sourceHost`, `_collector` are Sumo-specific metadata fields
- Scheduled Searches and Monitors for detection rules
- Cloud SIEM rules use a different, JSON-based schema

**Translation challenges:**
- Sumo's `matches` uses `*` wildcards (similar to Sigma's default modifier behavior)
- Source category mapping has no Sigma equivalent
- Field names depend on the log parser configuration
- Cloud SIEM rules have their own entity, signal, and insight model

**File format:**
- Raw query text for searches
- JSON for Cloud SIEM rules (includes entity mapping, severity, MITRE tactics)

**Confidence:** LOW (Sumo Logic query syntax is less standardized than others; cloud SIEM schema may have changed)

### 2.6 Cross-Format Common Patterns

All detection query languages share these concepts:

| Concept | Sigma | SPL | KQL | YARA-L | EQL | Sumo Logic |
|---------|-------|-----|-----|--------|-----|------------|
| Field equality | `field: value` | `field=value` | `field == "value"` | `$e.field = "value"` | `field == "value"` | `where field = "value"` |
| Contains | `field\|contains` | `LIKE "%val%"` | `contains "val"` | `= /val/` | `field : "*val*"` | `matches "*val*"` |
| Starts with | `field\|startswith` | `LIKE "val%"` | `startswith "val"` | `= /^val/` | `field : "val*"` | `matches "val*"` |
| Ends with | `field\|endswith` | `LIKE "%val"` | `endswith "val"` | `= /val$/` | `field : "*val"` | `matches "*val"` |
| Regex | `field\|re` | `match(field, regex)` | `matches regex` | `= /regex/` | `field~ "regex"` | `parse regex` |
| AND | `selection1 and selection2` | `field1=x field2=y` | `and` | multiple event predicates | `and` | `and` |
| OR | `selection1 or selection2` | `OR` | `or` | N/A (use multiple rules) | `or` | `or` |
| NOT | `not selection` | `NOT field=x` | `!= "val"` | `not` | `field != "val"` | `!= "val"` |

**Format-specific features with NO cross-format equivalent:**

| Feature | Only In | Why It Matters |
|---------|---------|---------------|
| Multi-event sequence | EQL, YARA-L | Temporal correlation rules cannot be expressed in single-event formats |
| Data model acceleration | SPL (tstats) | Performance optimization technique |
| Entity mapping | KQL (Sentinel), Sumo (SIEM) | Maps alert fields to identifiable entities |
| Outcome scoring | YARA-L | Rule-level risk score calculation |
| Subsearch | SPL | Dynamic lookups during query execution |

---

## 3. Adapter Plugin Interface Design

### 3.1 Recommended `DetectionAdapterContribution`

The plugin manifest should declare a detection adapter contribution that separates metadata from behavior:

```typescript
export interface DetectionAdapterContribution {
  /** Unique file type identifier (e.g., "splunk_spl", "kql_rule", "yaral_rule"). */
  fileType: string;

  /** File type descriptor for registry integration. */
  fileTypeDescriptor: Omit<FileTypeRegistrationOptions, "id"> & {
    detect?: (filename: string, content: string) => boolean;
  };

  /** The adapter implementation. */
  adapter: DetectionWorkflowAdapter;

  /** Optional visual panel component for the editor sidebar. */
  visualPanel?: React.ComponentType<DetectionVisualPanelProps>;

  /** Translation capabilities this adapter declares. */
  translations?: TranslationDeclaration[];
}
```

### 3.2 Visual Panel Props Contract

All visual panels should implement a common props interface:

```typescript
export interface DetectionVisualPanelProps {
  /** The raw source text of the detection document. */
  source: string;
  /** Callback when the user edits the source via the visual panel. */
  onSourceChange: (source: string) => void;
  /** Whether the panel is in read-only mode. */
  readOnly?: boolean;
  /** The accent color for this format (from FileTypeDescriptor.iconColor). */
  accentColor: string;
}
```

This is exactly the pattern already used by `SigmaVisualPanelProps`, `YaraVisualPanelProps`, and `OcsfVisualPanelProps` -- they just use different prop names (`yaml`/`json`/`source` for the text prop). Standardizing to `source`/`onSourceChange` enables the editor to dynamically render any plugin panel.

### 3.3 Parse / Generate / Validate Structure

Each adapter's methods should be structured for maximum reusability:

**`canDraftFrom(seed)`** -- Check if the adapter's format is appropriate for the given seed. Base on `seed.dataSourceHints` and `seed.preferredFormats`. Example: an SPL adapter would return true when hints include "process", "file", "network" (broad applicability), while YARA-L would be most appropriate for multi-event correlation seeds.

**`buildDraft(seed)`** -- Generate a syntactically valid detection rule from seed data. The pattern across all existing adapters is:
1. Map `seed.dataSourceHints` to format-specific source/table/category
2. Map `seed.extractedFields` to format-specific field names
3. Map `seed.techniqueHints` to format-specific tag/tactic annotations
4. Map `seed.confidence` to format-specific severity/priority

**`runLab(request)`** -- Execute the detection against evidence. Two execution strategies:
1. **Native backend** -- Call Tauri command for full execution (Sigma uses `testSigmaRuleNative`, OCSF uses `normalizeOcsfEventNative`). Plugin adapters should attempt this first.
2. **Client-side fallback** -- Approximate matching in the browser. Sigma does client-side field matching; YARA does client-side byte scanning. Plugin adapters should provide a client-side fallback using the `plugin_trace` explainability variant.

**`buildPublication(request)`** -- Convert to output format. The critical insight: for SIEM query formats, the source IS the output -- publication may just be identity + metadata wrapping. The interesting case is cross-format translation (Sigma -> SPL, SPL -> KQL, etc.), which should be handled by the translation pipeline (Section 5).

### 3.4 Recommended File Type Identifiers

| Format | FileType ID | Extensions | Icon Color (hex) |
|--------|-------------|------------|-----------------|
| Splunk SPL | `splunk_spl` | `.spl` | `#65a637` (Splunk green) |
| KQL (Sentinel) | `kql_rule` | `.kql` | `#0078d4` (Microsoft blue) |
| Chronicle YARA-L | `yaral_rule` | `.yaral` | `#4285f4` (Google blue) |
| Elastic EQL | `eql_rule` | `.eql` | `#f04e98` (Elastic pink) |
| Sumo Logic | `sumo_query` | `.sumo` | `#000099` (Sumo blue) |

---

## 4. Visual Builder Integration

### 4.1 Current State: Hardcoded Panel Switching

The editor currently switches visual panels based on `fileType` with hardcoded imports. For the plugin ecosystem, this needs to become a dynamic lookup.

### 4.2 Recommendation: Registry-Based Panel Resolution

Add a visual panel registry alongside the adapter registry:

```typescript
// In detection-workflow/visual-panels.ts
const visualPanels = new Map<FileType, React.ComponentType<DetectionVisualPanelProps>>();

export function registerVisualPanel(
  fileType: FileType,
  component: React.ComponentType<DetectionVisualPanelProps>,
): () => void { ... }

export function getVisualPanel(
  fileType: FileType,
): React.ComponentType<DetectionVisualPanelProps> | null { ... }
```

The editor component would then do:

```typescript
const Panel = getVisualPanel(activeFileType);
if (Panel) {
  return <Panel source={source} onSourceChange={onChange} readOnly={readOnly} accentColor={color} />;
}
// Fallback: raw text editor only
```

### 4.3 Schema-Driven vs Custom Components

**Verdict: Hybrid approach.** Some formats can use a schema-driven builder; others need custom components.

**Schema-driven works for:**
- Rule metadata sections (title, author, severity, tags) -- these are structurally identical across formats
- Simple field-value detection conditions
- Common MITRE ATT&CK tag mapping

**Custom components required for:**
- Sigma's detection logic tree (the `ConditionBar` + `LogicTree` visualization)
- YARA's hex pattern grid and regex tokenizer
- EQL's sequence builder (multi-event temporal correlation)
- YARA-L's multi-event correlation visualization
- SPL's pipe chain builder

**Recommendation:** Provide a `DetectionVisualPanelKit` of reusable primitives from `shared-form-fields.tsx` (already exists: `Section`, `FieldLabel`, `TextInput`, `TextArea`, `SelectInput`) plus detection-specific shared components:

```typescript
// New shared components for detection panels:
export { Section, FieldLabel, TextInput, TextArea, SelectInput } from "./shared-form-fields";

// Detection-specific shared components:
export { SeverityBadge } from "./severity-badge";      // severity indicators
export { AttackTagBadge } from "./attack-tag-badge";    // MITRE ATT&CK tag badges
export { ConditionTokenizer } from "./condition-tokenizer";  // generic condition syntax highlighting
export { FieldMappingTable } from "./field-mapping-table";   // field name reference
```

Plugin authors compose panels from these primitives plus format-specific custom visualization.

### 4.4 Syntax Highlighting

Each format needs CodeMirror/Monaco language support for the text editor pane. Options:
1. **Lezer grammars** (CodeMirror 6) -- best for the workbench since it likely already uses CodeMirror
2. **TextMate grammars** -- if using Monaco
3. **Monarch tokenizer** -- Monaco's built-in tokenizer

Plugin adapters should optionally provide a language extension for the code editor. If none is provided, fall back to plain text or YAML highlighting (reasonable for most detection formats which are YAML-adjacent or pipe-chain syntax).

---

## 5. Cross-Format Translation Pipeline

### 5.1 Current State

`sigma-conversion.ts` already implements:
- Sigma -> ClawdStrike Policy (full guard config mapping)
- Sigma -> SPL (field-level query generation)
- Sigma -> KQL (field-level query generation)
- Sigma -> ES|QL (field-level query generation)
- Sigma -> JSON export (structured rule export)

This is a one-to-many fan-out from Sigma. The existing implementation is ~685 lines and handles:
- Logsource -> guard/table mapping
- Sigma modifiers -> query syntax
- Selection block extraction and query building
- Diagnostics with severity levels

### 5.2 Recommended Translation Architecture

**Do NOT use a common intermediate representation (IR).** Here is why:

1. **Lossy translations are the norm.** Every format has unique features (EQL sequences, YARA-L outcomes, SPL subsearches) that cannot be represented in a universal IR without making it as complex as the union of all formats.
2. **Sigma already IS the de facto IR.** The security community uses Sigma as the interchange format. The `sigma-cli` tool (pySigma) and SigmaHQ project explicitly position Sigma as the format-agnostic detection description language.
3. **Direct pairwise translation is more honest.** Each translation pair can clearly document what is and is not preserved, rather than hiding lossy conversions behind an IR.

**Recommended API:**

```typescript
export interface TranslationDeclaration {
  /** Source format this adapter can translate FROM. */
  from: FileType;
  /** Target format this adapter can translate TO. */
  to: FileType;
  /** Whether the translation is lossless (preserves all semantics). */
  lossless: boolean;
  /** Human-readable description of what gets lost in translation. */
  lossDescription?: string;
}

export interface TranslationRequest {
  source: string;
  sourceFileType: FileType;
  targetFileType: FileType;
}

export interface TranslationResult {
  success: boolean;
  output: string | null;
  diagnostics: TranslationDiagnostic[];
  fieldMappings: FieldMapping[];
  /** Features in the source that could not be translated. */
  untranslatableFeatures: string[];
}

export interface TranslationDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  sourceLine?: number;
}
```

**Translation registration:**

```typescript
export interface TranslationProvider {
  canTranslate(from: FileType, to: FileType): boolean;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

// Registry
export function registerTranslationProvider(provider: TranslationProvider): () => void;
export function getTranslationPath(from: FileType, to: FileType): TranslationProvider | null;
```

### 5.3 Translation Graph

With the proposed adapters, the translation graph looks like:

```
                    ClawdStrike Policy
                         ^
                         | (Sigma -> Policy already exists)
                         |
  SPL <--- Sigma Rule ---+---> KQL
   |          ^  |             ^
   |          |  v             |
   |     YARA-L  EQL          |
   |                          |
   +--- Sumo Logic -----------+
```

**Hub-and-spoke through Sigma** is the recommended pattern:
- To translate SPL -> KQL: SPL -> Sigma -> KQL
- To translate EQL -> SPL: EQL -> Sigma -> SPL

This leverages the massive SigmaHQ ecosystem and the existing Sigma conversion code. Each plugin adapter declares:
1. `from: "<format>", to: "sigma_rule"` -- parse format, emit Sigma
2. `from: "sigma_rule", to: "<format>"` -- receive Sigma, emit format

Some direct translations are worth implementing for quality:
- SPL <-> KQL (similar table-expression semantics)
- EQL -> YARA-L (both support multi-event correlation)

### 5.4 Field Mapping Registry

The biggest challenge in cross-format translation is field name mapping. Each SIEM has its own field naming convention:

| Concept | Sigma | Splunk CIM | Sentinel | ECS (Elastic) | UDM (Chronicle) | Sumo |
|---------|-------|------------|----------|---------------|-----------------|------|
| Command line | `CommandLine` | `process` | `CommandLine` | `process.command_line` | `target.process.command_line` | varies |
| Source IP | `SourceIp` | `src_ip` | `SourceIP` | `source.ip` | `principal.ip` | `src_ip` |
| Target filename | `TargetFilename` | `file_path` | `TargetFilename` | `file.path` | `target.file.full_path` | varies |
| Destination host | `DestinationHostname` | `dest` | `DestinationHostname` | `destination.domain` | `target.hostname` | `dstHost` |

**Recommendation:** Build a field mapping registry as a shared resource:

```typescript
export interface FieldMappingEntry {
  sigmaField: string;
  splunkCIM?: string;
  sentinelField?: string;
  ecsField?: string;
  udmPath?: string;
  sumoField?: string;
}

export const FIELD_MAPPINGS: FieldMappingEntry[] = [
  { sigmaField: "CommandLine", splunkCIM: "process", sentinelField: "CommandLine", ecsField: "process.command_line", udmPath: "target.process.command_line" },
  // ... 50+ entries
];
```

Plugin adapters consume this registry rather than implementing their own mappings.

---

## 6. Architecture Recommendations

### 6.1 Plugin Adapter Lifecycle

```
1. Plugin loads
2. Plugin calls registerFileType() -> returns dispose function
3. Plugin calls registerAdapter() -> adapter available for workflow
4. Plugin calls registerVisualPanel() -> panel available in editor
5. Plugin calls registerTranslationProvider() -> translations available
6. On plugin unload: call all dispose functions
```

### 6.2 Component Boundaries

| Component | Responsibility | Owned By |
|-----------|---------------|----------|
| `file-type-registry.ts` | File type metadata, detection, extensions | Core (already plugin-ready) |
| `detection-workflow/adapters.ts` | Adapter registration and lookup | Core (needs unregister) |
| `detection-workflow/visual-panels.ts` | Visual panel registration and lookup | Core (new) |
| `detection-workflow/translations.ts` | Translation provider registration | Core (new) |
| `detection-workflow/field-mappings.ts` | Cross-format field name registry | Core (new, shared resource) |
| `plugins/splunk-spl/` | SPL adapter, visual panel, Sigma<->SPL translation | Plugin |
| `plugins/kql/` | KQL adapter, visual panel, Sigma<->KQL translation | Plugin |
| `plugins/yaral/` | YARA-L adapter, visual panel, Sigma<->YARAL translation | Plugin |
| `plugins/eql/` | EQL adapter, visual panel, Sigma<->EQL translation | Plugin |
| `plugins/sumo-logic/` | Sumo Logic adapter, visual panel, Sigma<->Sumo translation | Plugin |

### 6.3 Testing Strategy

Each plugin adapter should provide:
1. **Unit tests** for parse/generate/validate of the detection format
2. **Round-trip tests**: generate -> parse -> generate should produce equivalent output
3. **Translation tests**: for each declared translation, test against known good conversions from SigmaHQ
4. **Visual panel tests**: Storybook stories or render tests for the panel component
5. **Evidence pack tests**: ensure buildStarterEvidence produces valid evidence items

### 6.4 Incremental Delivery Order

1. **SPL adapter** -- highest demand (Splunk dominance in enterprise SIEM). The existing `sigma-to-spl` conversion provides a starting point; invert it for SPL-to-Sigma parsing.
2. **KQL adapter** -- second highest demand (Microsoft Sentinel growing rapidly). Same inversion of existing `sigma-to-kql`.
3. **EQL adapter** -- third, adds sequence/correlation capability that no current format supports.
4. **YARA-L adapter** -- fourth, growing Chronicle/Google SecOps adoption.
5. **Sumo Logic adapter** -- fifth, lower priority, smaller market share.

---

## 7. Pitfalls

### 7.1 Critical: Field Name Explosion

Every SIEM has hundreds of field names. Maintaining a comprehensive field mapping table is an ongoing maintenance burden. Without it, cross-format translations produce syntactically correct but semantically wrong queries.

**Mitigation:** Start with a small (50-entry) curated mapping table covering the most common detection scenarios (process creation, file events, network connections, DNS). Let plugins extend the table but not override core mappings. Flag unmapped fields as warnings in translation diagnostics.

### 7.2 Critical: Multi-Event Correlation Impedance Mismatch

EQL sequences and YARA-L multi-event rules cannot be represented in Sigma, SPL (without subsearch), KQL (without adjacent table joins), or Sumo Logic. Attempting to translate these will silently lose the correlation semantics.

**Mitigation:** The `TranslationResult.untranslatableFeatures` field must be populated. The UI should clearly warn users: "This rule uses multi-event correlation which cannot be preserved in the target format. Only the first event condition was translated."

### 7.3 Moderate: Parser Complexity

Building reliable parsers for SPL, KQL, EQL, YARA-L, and Sumo Logic is a significant engineering effort. Each has edge cases, undocumented syntax, and version-specific features.

**Mitigation:** Start with generator-only adapters (Sigma -> format) before building full parsers (format -> Sigma). The existing `sigma-conversion.ts` demonstrates this approach -- it generates SPL/KQL/ESQL from Sigma without parsing those formats.

### 7.4 Moderate: Native Backend Availability

The existing adapters fall back to client-side matching when the Tauri native backend is unavailable. Plugin adapters for SIEM query languages cannot execute real queries without connecting to the actual SIEM.

**Mitigation:** Plugin lab execution should support three modes:
1. **Connected mode** -- send query to actual SIEM via API (requires credentials)
2. **Simulated mode** -- match evidence items against parsed query conditions client-side
3. **Dry-run mode** -- validate syntax only, skip execution

### 7.5 Minor: PublishTarget Union Expansion

`PublishTarget` is currently a fixed string union. Adding plugin targets means changing it to `string` (like `FileType` already is) or providing an extensible mechanism.

**Mitigation:** Change `PublishTarget` to `string` and register valid targets dynamically, mirroring how `FileType` already works as `string` with a built-in subset.

---

## 8. Open Questions

1. **Should SPL/KQL/EQL be first-class built-in adapters or plugins?** The Sigma adapter already generates these formats. Making them plugins is architecturally cleaner but adds indirection. Given the Sigma conversion code already exists in core, consider keeping generation in core and making the reverse parsers (format -> Sigma) the plugin responsibility.

2. **What level of query execution should plugins support?** Full SIEM API integration is a large scope. The minimal viable approach is parse + generate + translate, with execution as an optional future capability.

3. **Should the field mapping table be editable by users?** Enterprise environments often have custom field names. A user-configurable mapping layer would increase adoption but adds complexity.

4. **How should version differences be handled?** SPL syntax differs between Splunk versions. KQL has evolved across Sentinel updates. The adapter should declare which version(s) it supports.

---

## 9. Summary

The existing adapter architecture is well-designed and nearly plugin-ready. The core changes needed are:

1. **Add `unregisterAdapter()`** to `adapters.ts` (matching `unregisterFileType()`)
2. **Create visual panel registry** for dynamic panel resolution
3. **Create translation provider registry** for cross-format conversion
4. **Create shared field mapping table** for cross-format field name translation
5. **Change `PublishTarget`** from fixed union to extensible string
6. **Standardize visual panel props** to `DetectionVisualPanelProps`

The detection format adapters themselves follow a clear pattern established by the Sigma, YARA, and OCSF implementations. Plugin authors have concrete reference implementations (639 lines for Sigma, 658 for YARA) showing exactly how to implement each adapter method.

The hub-and-spoke translation model through Sigma is the pragmatic approach -- it leverages the existing SigmaHQ ecosystem and avoids the complexity of a universal IR. Direct pairwise translations can be added later for format pairs where quality demands it.
