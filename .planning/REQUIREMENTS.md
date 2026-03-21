# Requirements: Detection Adapter Plugins (v4.0)

## Overview

Enable SIEM-native detection formats (SPL, KQL, EQL, YARA-L) as first-class workbench citizens through the plugin adapter system. Security teams can draft, test, translate, and publish detection rules in their platform's native query language without leaving the workbench. Cross-format translation routes through Sigma as a hub, leveraging the existing SigmaHQ ecosystem.

## Scope

**v1 (this milestone):** Core detection plugin infrastructure (registries, field mappings, shared panel kit), four adapter plugins (SPL, KQL, EQL, YARA-L), cross-format translation pipeline with hub-and-spoke routing through Sigma.

**v2 (deferred):** Sumo Logic adapter (lower market share, LOW confidence in research), connected SIEM execution mode (requires API credentials), user-editable field mapping overrides, version-specific syntax variants, direct pairwise translations for quality (SPL<->KQL, EQL->YARA-L).

## Requirements

### CORE: Core Detection Plugin Infrastructure

- **CORE-01**: `adapters.ts` has an `unregisterAdapter()` function that removes a detection adapter by FileType and returns void, matching the dispose pattern already used by `registerFileType()`
- **CORE-02**: A visual panel registry (`detection-workflow/visual-panels.ts`) provides `registerVisualPanel(fileType, component)` returning a dispose function, and `getVisualPanel(fileType)` returning the component or null; the editor resolves panels dynamically instead of switching on hardcoded file types
- **CORE-03**: A translation provider registry (`detection-workflow/translations.ts`) provides `registerTranslationProvider(provider)` returning a dispose function, and `getTranslationPath(from, to)` returning a matching provider or null
- **CORE-04**: `TranslationProvider` interface declares `canTranslate(from, to): boolean` and `translate(request): Promise<TranslationResult>`, where `TranslationResult` includes `output`, `diagnostics`, `fieldMappings`, and `untranslatableFeatures`
- **CORE-05**: A field mapping registry (`detection-workflow/field-mappings.ts`) provides a shared `FieldMappingEntry[]` table (50+ entries) mapping Sigma field names to Splunk CIM, Sentinel, ECS, and UDM equivalents, with `registerFieldMappings()` for plugin extensions
- **CORE-06**: `PublishTarget` type is changed from a fixed string union to `string`, with valid targets registered dynamically via a target registry
- **CORE-07**: `DetectionVisualPanelProps` interface standardizes visual panel props to `source`, `onSourceChange`, `readOnly`, and `accentColor`; existing panels (Sigma, YARA, OCSF) are updated to accept this contract
- **CORE-08**: A `DetectionVisualPanelKit` re-exports shared form primitives (`Section`, `FieldLabel`, `TextInput`, `TextArea`, `SelectInput`) plus new detection-specific components (`SeverityBadge`, `AttackTagBadge`, `FieldMappingTable`) for plugin panel authors
- **CORE-09**: `DetectionAdapterContribution` interface bundles `fileType`, `fileTypeDescriptor`, `adapter`, optional `visualPanel`, and optional `translations[]` into a single registration unit that plugins provide via the SDK

### SPL: Splunk SPL Adapter Plugin

- **SPL-01**: `splunk_spl` file type is registered with extensions `[".spl"]`, icon color `#65a637`, content-based detection for SPL syntax (pipe chains, `index=`, `sourcetype=`), and a default starter template
- **SPL-02**: SPL adapter implements `canDraftFrom()` returning true for process, file, network, and registry data source hints; `buildDraft()` generates syntactically valid SPL from seed data with CIM field names and logsource-to-index/sourcetype mapping
- **SPL-03**: SPL adapter implements `runLab()` in simulated mode: parses SPL field conditions and matches them against evidence items client-side, emitting `plugin_trace` explainability traces with matched/unmatched field details
- **SPL-04**: SPL adapter implements `buildPublication()` supporting `"spl"` and `"json_export"` publish targets, where `"spl"` outputs the raw query and `"json_export"` wraps it with metadata (title, description, severity, MITRE tactics)
- **SPL-05**: SPL visual panel provides a pipe-chain visualization showing each SPL command as a card in a vertical pipeline, with editable field-value pairs in each command card, round-tripping changes back to SPL text
- **SPL-06**: SPL translation provider declares `from: "sigma_rule", to: "splunk_spl"` (extending existing `convertSigmaToQuery()` SPL output) and `from: "splunk_spl", to: "sigma_rule"` (parsing SPL field conditions into Sigma detection blocks)

### KQL: KQL Adapter Plugin

- **KQL-01**: `kql_rule` file type is registered with extensions `[".kql"]`, icon color `#0078d4`, content-based detection for KQL syntax (table name prefix, pipe operators, `where`/`project`/`extend`), and a default starter template
- **KQL-02**: KQL adapter implements `canDraftFrom()` returning true for process, file, network, and authentication data source hints; `buildDraft()` generates syntactically valid KQL from seed data with Sentinel table names and field mappings
- **KQL-03**: KQL adapter implements `runLab()` in simulated mode: parses KQL where-clause conditions and matches them against evidence items client-side, emitting `plugin_trace` explainability traces
- **KQL-04**: KQL adapter implements `buildPublication()` supporting `"kql"` and `"json_export"` publish targets, where `"kql"` outputs the raw query and `"json_export"` wraps it in an Analytics Rule JSON structure with scheduling, severity, tactics, and entity mapping
- **KQL-05**: KQL visual panel provides a tabular expression visualization showing the source table, filter chain, and projection columns, with editable where-clause conditions and table selector
- **KQL-06**: KQL translation provider declares `from: "sigma_rule", to: "kql_rule"` (extending existing `convertSigmaToQuery()` KQL output) and `from: "kql_rule", to: "sigma_rule"` (parsing KQL where-clauses into Sigma detection blocks)

### EQL: Elastic EQL Adapter Plugin

- **EQL-01**: `eql_rule` file type is registered with extensions `[".eql"]`, icon color `#f04e98`, content-based detection for EQL syntax (event category prefix like `process where`, `file where`, `sequence by`), and a default starter template
- **EQL-02**: EQL adapter implements `canDraftFrom()` returning true for process, file, network, and registry data source hints, plus multi-event correlation seeds; `buildDraft()` generates syntactically valid EQL from seed data with ECS field names and event category prefixes
- **EQL-03**: EQL adapter implements `runLab()` in simulated mode: parses EQL conditions (including sequence queries) and matches them against evidence items client-side, emitting `plugin_trace` explainability traces that show per-event-step matching for sequences
- **EQL-04**: EQL adapter implements `buildPublication()` supporting `"eql"` and `"json_export"` publish targets, where `"eql"` outputs the raw query and `"json_export"` wraps it in an NDJSON detection rule with risk score, MITRE mapping, and rule type
- **EQL-05**: EQL visual panel provides a sequence builder for multi-event correlation: each event step is a card showing event category and conditions, steps can be reordered, and `maxspan`/`until` clauses are editable; single-event queries show a simpler condition editor
- **EQL-06**: EQL translation provider declares `from: "sigma_rule", to: "eql_rule"` (single-event Sigma rules to EQL) and `from: "eql_rule", to: "sigma_rule"` (single-event EQL to Sigma, with `untranslatableFeatures` populated for sequence queries)

### YARAL: YARA-L Adapter Plugin

- **YARAL-01**: `yaral_rule` file type is registered with extensions `[".yaral"]`, icon color `#4285f4`, content-based detection for YARA-L syntax (`rule {`, `events:`, `condition:`, UDM field paths), and a default starter template
- **YARAL-02**: YARA-L adapter implements `canDraftFrom()` returning true for process, file, network, and authentication data source hints; `buildDraft()` generates syntactically valid YARA-L from seed data with UDM field paths, meta section, events section, and condition section
- **YARAL-03**: YARA-L adapter implements `runLab()` in simulated mode: parses YARA-L event predicates and matches them against evidence items client-side, emitting `plugin_trace` explainability traces that show per-event-variable matching
- **YARAL-04**: YARA-L adapter implements `buildPublication()` supporting `"yaral"` and `"json_export"` publish targets, where `"yaral"` outputs the raw rule text and `"json_export"` wraps it with Chronicle metadata (severity, risk score, MITRE mapping)
- **YARAL-05**: YARA-L visual panel provides a multi-event correlation visualization: meta fields in an editable header, each event variable (`$e1`, `$e2`) as a card with its predicates, condition section with temporal constraints, and optional outcome/match sections
- **YARAL-06**: YARA-L translation provider declares `from: "sigma_rule", to: "yaral_rule"` (Sigma to YARA-L with single-event mapping) and `from: "yaral_rule", to: "sigma_rule"` (single-event YARA-L to Sigma, with `untranslatableFeatures` populated for multi-event rules and outcome blocks)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | Phase 1 | Complete |
| CORE-04 | Phase 1 | Complete |
| CORE-05 | Phase 1 | Complete |
| CORE-06 | Phase 1 | Complete |
| CORE-07 | Phase 1 | Complete |
| CORE-08 | Phase 1 | Complete |
| CORE-09 | Phase 1 | Complete |
| SPL-01 | Phase 2 | Complete |
| SPL-02 | Phase 2 | Complete |
| SPL-03 | Phase 2 | Complete |
| SPL-04 | Phase 2 | Complete |
| SPL-05 | Phase 2 | Pending |
| SPL-06 | Phase 2 | Pending |
| KQL-01 | Phase 3 | Complete |
| KQL-02 | Phase 3 | Complete |
| KQL-03 | Phase 3 | Complete |
| KQL-04 | Phase 3 | Complete |
| KQL-05 | Phase 3 | Complete |
| KQL-06 | Phase 3 | Complete |
| EQL-01 | Phase 4 | Complete |
| EQL-02 | Phase 4 | Complete |
| EQL-03 | Phase 4 | Pending |
| EQL-04 | Phase 4 | Complete |
| EQL-05 | Phase 4 | Complete |
| EQL-06 | Phase 4 | Pending |
| YARAL-01 | Phase 5 | Complete |
| YARAL-02 | Phase 5 | Complete |
| YARAL-03 | Phase 5 | Complete |
| YARAL-04 | Phase 5 | Complete |
| YARAL-05 | Phase 5 | Complete |
| YARAL-06 | Phase 5 | Complete |
