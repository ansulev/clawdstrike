# Roadmap: Detection Adapter Plugins (v4.0)

## Overview

Make SIEM-native detection formats first-class citizens in the ClawdStrike workbench. The journey starts by building the core detection plugin infrastructure (registries for visual panels, translation providers, and field mappings), then delivers four adapter plugins in demand order (SPL, KQL, EQL, YARA-L). Each adapter registers a file type, detection workflow adapter, visual panel, and bidirectional Sigma translation -- enabling hub-and-spoke cross-format translation as an emergent property of the adapter ecosystem.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Detection Plugin Infrastructure** - Dynamic registries for visual panels, translations, and field mappings that all detection adapter plugins depend on
- [x] **Phase 2: SPL Adapter Plugin** - Splunk SPL as a first-class detection format with visual pipe-chain builder and bidirectional Sigma translation (completed 2026-03-21)
- [x] **Phase 3: KQL Adapter Plugin** - Microsoft Sentinel KQL as a first-class detection format with tabular expression editor and bidirectional Sigma translation (completed 2026-03-21)
- [x] **Phase 4: EQL Adapter Plugin** - Elastic EQL as a first-class detection format with multi-event sequence builder and bidirectional Sigma translation (completed 2026-03-21)
- [x] **Phase 5: YARA-L Adapter Plugin** - Google Chronicle YARA-L as a first-class detection format with multi-event correlation panel and bidirectional Sigma translation (completed 2026-03-21)

## Phase Details

### Phase 1: Core Detection Plugin Infrastructure
**Goal**: Any plugin can register a detection adapter with visual panel, translation capabilities, and field mappings through dynamic registries -- without modifying core workbench code
**Depends on**: Nothing (first phase; assumes v1.0 plugin SDK and file type seams already exist)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, CORE-08, CORE-09
**Success Criteria** (what must be TRUE):
  1. A test can call `registerVisualPanel("test_format", TestPanel)` and the editor dynamically renders `TestPanel` when a file of that type is opened, without any hardcoded switch case for `"test_format"`
  2. A test can call `registerTranslationProvider(provider)` where the provider declares `canTranslate("sigma_rule", "test_format")`, and `getTranslationPath("sigma_rule", "test_format")` returns that provider
  3. The field mapping registry contains 50+ entries mapping common Sigma field names (CommandLine, SourceIp, TargetFilename, etc.) to their Splunk CIM, Sentinel, ECS, and UDM equivalents, and a plugin can extend the table with `registerFieldMappings()`
  4. Existing built-in visual panels (Sigma, YARA, OCSF) render identically after being migrated to the standardized `DetectionVisualPanelProps` contract and registered through the visual panel registry
  5. A plugin can provide a single `DetectionAdapterContribution` object that bundles file type, adapter, visual panel, and translations, and all four registrations happen atomically
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md -- Registries, types, and DetectionAdapterContribution contracts
- [x] 01-02-PLAN.md -- Field mapping table (50+ entries) and DetectionVisualPanelKit
- [x] 01-03-PLAN.md -- Panel migration, editor wiring, and plugin loader routing

### Phase 2: SPL Adapter Plugin
**Goal**: Security teams using Splunk can draft, test, and translate SPL detection rules natively in the workbench, and Sigma rules can be translated to/from SPL
**Depends on**: Phase 1
**Requirements**: SPL-01, SPL-02, SPL-03, SPL-04, SPL-05, SPL-06
**Success Criteria** (what must be TRUE):
  1. User can create a new SPL file from the command palette, and the editor opens with a valid SPL starter template, syntax-appropriate icon color, and the SPL visual panel in the sidebar
  2. User can open the Lab with an SPL rule and evidence items, click Run, and see per-field match results in the explainability trace showing which SPL conditions matched which evidence fields
  3. User can translate a Sigma rule to SPL and get syntactically valid SPL output with correct CIM field name mappings, and user can translate an SPL rule back to Sigma and get a valid Sigma YAML with detection blocks derived from the SPL field conditions
  4. The SPL visual panel displays the pipe chain as a vertical sequence of command cards, and editing a field value in a card updates the SPL source text in real time
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md -- SPL parser utilities and detection workflow adapter (file type, draft, lab, publication)
- [x] 02-02-PLAN.md -- SPL visual panel (pipe-chain builder) and bidirectional Sigma translation provider

### Phase 3: KQL Adapter Plugin
**Goal**: Security teams using Microsoft Sentinel can draft, test, and translate KQL detection rules natively in the workbench, and Sigma rules can be translated to/from KQL
**Depends on**: Phase 1
**Requirements**: KQL-01, KQL-02, KQL-03, KQL-04, KQL-05, KQL-06
**Success Criteria** (what must be TRUE):
  1. User can create a new KQL file from the command palette, and the editor opens with a valid KQL starter template, Microsoft blue icon color, and the KQL visual panel in the sidebar
  2. User can open the Lab with a KQL rule and evidence items, click Run, and see per-condition match results in the explainability trace showing which KQL where-clauses matched which evidence fields
  3. User can translate a Sigma rule to KQL and get syntactically valid KQL output with correct Sentinel table and field names, and user can translate a KQL rule back to Sigma and get a valid Sigma YAML
  4. User can translate an SPL rule to KQL (hub-and-spoke via SPL -> Sigma -> KQL) and the output contains correct Sentinel field names, demonstrating cross-format translation working end-to-end
**Plans:** 2/2 plans complete
Plans:
- [x] 03-01-PLAN.md -- KQL adapter core (file type, adapter, translation provider)
- [x] 03-02-PLAN.md -- KQL visual panel and plugin manifest example

### Phase 4: EQL Adapter Plugin
**Goal**: Security teams using Elastic can draft, test, and translate EQL detection rules -- including multi-event sequence rules -- natively in the workbench
**Depends on**: Phase 1
**Requirements**: EQL-01, EQL-02, EQL-03, EQL-04, EQL-05, EQL-06
**Success Criteria** (what must be TRUE):
  1. User can create a new EQL file from the command palette, and the editor opens with a valid EQL starter template with event category prefix, Elastic pink icon, and the EQL visual panel
  2. User can build a multi-event sequence rule using the visual sequence builder (adding/removing/reordering event steps, setting maxspan), and the generated EQL text is syntactically valid with `sequence by` syntax
  3. User can open the Lab with an EQL sequence rule and multi-event evidence, click Run, and see per-step matching in the explainability trace showing which events matched which sequence steps
  4. Translating a multi-event EQL rule to Sigma produces a valid Sigma rule with the first event's conditions, plus an `untranslatableFeatures` list clearly stating "sequence correlation with N events not preserved"
**Plans:** 3 plans
Plans:
- [x] 04-01-PLAN.md -- EQL parser/generator and adapter with file type registration and publication
- [x] 04-02-PLAN.md -- EQL visual panel with sequence builder and condition editor
- [x] 04-03-PLAN.md -- Bidirectional Sigma-EQL translation provider and full lab execution

### Phase 5: YARA-L Adapter Plugin
**Goal**: Security teams using Google Chronicle/SecOps can draft, test, and translate YARA-L detection rules natively in the workbench, completing the adapter ecosystem
**Depends on**: Phase 1
**Requirements**: YARAL-01, YARAL-02, YARAL-03, YARAL-04, YARAL-05, YARAL-06
**Success Criteria** (what must be TRUE):
  1. User can create a new YARA-L file from the command palette, and the editor opens with a valid YARA-L starter template with `rule {}` structure, Google blue icon, and the YARA-L visual panel
  2. User can build a multi-event YARA-L rule using the visual panel with event variable cards (`$e1`, `$e2`), each showing UDM field predicates, and the generated YARA-L text is syntactically valid
  3. User can open the Lab with a YARA-L rule and evidence items, click Run, and see per-event-variable matching in the explainability trace
  4. All four adapter plugins are installed and operational: user can translate between any pair of {Sigma, SPL, KQL, EQL, YARA-L} via hub-and-spoke routing, with translation diagnostics showing field mapping details and any untranslatable features
**Plans:** 3 plans
Plans:
- [x] 05-01-PLAN.md -- YARA-L adapter with file type registration, drafting, lab execution, and publication
- [x] 05-02-PLAN.md -- YARA-L visual panel with meta editor, event variable cards, and condition editor
- [x] 05-03-PLAN.md -- Bidirectional Sigma<->YARA-L translation provider

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5
Note: Phases 2-5 each depend only on Phase 1, so adapter plugins can be developed in parallel after Phase 1 completes. The listed order reflects demand priority (SPL > KQL > EQL > YARA-L).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Detection Plugin Infrastructure | 3/3 | Complete | 2026-03-21 |
| 2. SPL Adapter Plugin | 2/2 | Complete | 2026-03-21 |
| 3. KQL Adapter Plugin | 2/2 | Complete | 2026-03-21 |
| 4. EQL Adapter Plugin | 3/3 | Complete | 2026-03-21 |
| 5. YARA-L Adapter Plugin | 3/3 | Complete | 2026-03-21 |
