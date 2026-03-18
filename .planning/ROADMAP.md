# Roadmap: ClawdStrike Plugin Ecosystem

## Overview

Transform the ClawdStrike workbench from a closed application into an extensible platform. The journey starts by opening hardcoded seams (closed unions, static arrays) into dynamic registries, then builds plugin infrastructure (manifest, registry, loader), creates a typed SDK for plugin authors, proves the system works by extracting a real guard into plugin format, and finishes with marketplace UI for plugin discovery and installation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Open Closed Seams** - Convert static unions and const arrays into dynamic registries with register/unregister APIs
- [ ] **Phase 2: Plugin Manifest and Registry** - Define the PluginManifest type and PluginRegistry singleton adapted from Athas patterns
- [ ] **Phase 3: Plugin Loader and Trust** - Build lifecycle management with activation events, trust verification, and contribution routing
- [ ] **Phase 4: Plugin SDK Package** - Create @clawdstrike/plugin-sdk with typed API surface for plugin authors
- [ ] **Phase 5: Guard-as-Plugin Proof of Concept** - Extract EgressAllowlistGuard into plugin format to validate the full pipeline
- [ ] **Phase 6: Marketplace UI** - Add Plugins tab to Library panel with browsing, install, and registry client

## Phase Details

### Phase 1: Open Closed Seams
**Goal**: Every contribution point that a plugin needs to extend is backed by a dynamic registry instead of a hardcoded union or const array
**Depends on**: Nothing (first phase)
**Requirements**: SEAM-01, SEAM-02, SEAM-03, SEAM-04, SEAM-05, SEAM-06, SEAM-07, SEAM-08, SEAM-09, SEAM-10
**Success Criteria** (what must be TRUE):
  1. A test can call `registerGuard()` with a custom guard ID not in the original 13 built-ins, and the guard appears in the guard registry and config UI
  2. A test can call `registerFileType()` with a custom file type (e.g., `"snort_rule"`), and it appears in file type detection, command palette new-file options, and tab bar
  3. A test can call `statusBarRegistry.register()` with a custom segment, and it renders in the status bar alongside built-in segments
  4. All existing workbench functionality works identically after the seam changes -- built-in guards, file types, sidebar items, and status bar render as before
**Plans**: 3 plans

Plans:
- [x] 01-01: Open guard pipeline seams (GuardId, GUARD_REGISTRY, GuardCategory, ConfigFieldType)
- [ ] 01-02: Open file type and detection seams (FileType, FILE_TYPE_REGISTRY, ExplainabilityTrace)
- [x] 01-03: Open UI seams (StatusBarRegistry, AppId, PluginIcon, CapsuleKind, ShelfMode)

### Phase 2: Plugin Manifest and Registry
**Goal**: A plugin's capabilities are fully described by a manifest, and the registry tracks all known plugins with lifecycle states
**Depends on**: Phase 1
**Requirements**: MFST-01, MFST-02, MFST-03, REG-01, REG-02, REG-03, REG-04
**Success Criteria** (what must be TRUE):
  1. A `PluginManifest` JSON object can be parsed and validated, with type errors caught at compile time for contribution point declarations
  2. The `PluginRegistry` singleton accepts a valid manifest via `register()`, rejects a malformed manifest with a descriptive error, and returns the plugin via `get()` and `getAll()`
  3. Registry state transitions (registered -> activating -> activated -> deactivated) fire events that a subscriber receives
  4. `getByContributionType("guards")` returns only plugins that declare guard contributions
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- PluginManifest type with security-domain contribution points and manifest validation
- [ ] 02-02-PLAN.md -- PluginRegistry singleton with lifecycle state machine and event emission

### Phase 3: Plugin Loader and Trust
**Goal**: Plugins can be loaded into the running workbench with their contributions routed to the correct registries, and only trusted plugins are allowed to load
**Depends on**: Phase 2
**Requirements**: LOAD-01, LOAD-02, LOAD-03, LOAD-04, LOAD-05
**Success Criteria** (what must be TRUE):
  1. An internal plugin with a valid manifest and `activate()` export can be loaded, and its contributed commands appear in the command palette and its contributed guard appears in the guard registry
  2. A plugin with an invalid or missing Ed25519 signature is rejected at load time with a clear error message
  3. When two plugins are loaded simultaneously and one throws during activation, the other still activates successfully
  4. A plugin with `activationEvents: ["onFileType:sigma_rule"]` does not activate until a Sigma file is opened
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Trust verification module with Ed25519 signature checking via operator-crypto
- [ ] 03-02-PLAN.md -- PluginLoader with activation events, contribution routing, and trust gating

### Phase 4: Plugin SDK Package
**Goal**: Plugin authors can import `@clawdstrike/plugin-sdk` and write a type-safe plugin with IDE autocompletion for all contribution points
**Depends on**: Phase 3
**Requirements**: SDK-01, SDK-02, SDK-03, SDK-04, SDK-05
**Success Criteria** (what must be TRUE):
  1. `import { createPlugin, PluginContext } from "@clawdstrike/plugin-sdk"` resolves and provides full TypeScript types
  2. A plugin authored with `createPlugin()` that registers a command, a guard, and a status bar item compiles without errors and loads successfully in the workbench
  3. The SDK enforces the `activate(context: PluginContext)` / `deactivate()` contract at the type level
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md -- @clawdstrike/plugin-sdk package with PluginContext, contribution types, and createPlugin helper

### Phase 5: Guard-as-Plugin Proof of Concept
**Goal**: A real built-in guard works identically when loaded as a plugin, proving the end-to-end pipeline from manifest to guard evaluation to config UI
**Depends on**: Phase 4
**Requirements**: GAP-01, GAP-02, GAP-03
**Success Criteria** (what must be TRUE):
  1. The EgressAllowlistGuard plugin registers via the SDK, appears in the workbench guard list with the same name/description/category/icon as the original built-in, and its config fields render identically
  2. Policy evaluation with the plugin guard produces the same allow/deny verdicts as the built-in guard for the same policy and actions
  3. The plugin is loadable both as an in-process TypeScript plugin (workbench) and as a WASM guard via `CustomGuardRegistry` (Rust engine)
**Plans**: TBD

Plans:
- [ ] 05-01: Extract EgressAllowlistGuard into standalone plugin with manifest and SDK usage
- [ ] 05-02: Verify parity between plugin guard and built-in guard (TS workbench + Rust WASM paths)

### Phase 6: Marketplace UI
**Goal**: Operators can discover, install, and manage plugins from within the workbench Library panel
**Depends on**: Phase 3
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05
**Success Criteria** (what must be TRUE):
  1. The Library page shows a "Plugins" tab that displays plugin cards from the registry with name, publisher, version, trust badge, and description
  2. Clicking "Install" on a plugin card downloads it from the registry, verifies its signature, and activates it -- the plugin's contributions appear in the workbench without a restart
  3. The "Installed Plugins" section shows all installed plugins with their current state, and "Uninstall" removes the plugin and its contributions
  4. Search in the Plugins tab queries the `clawdstrike-registry` API and returns matching results
**Plans**: TBD

Plans:
- [ ] 06-01: Registry client module (TypeScript client for clawdstrike-registry API)
- [ ] 06-02: Plugin cards and Marketplace tab in Library gallery
- [ ] 06-03: Install/uninstall flow with trust verification and lifecycle management

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Open Closed Seams | 3/3 | Complete | 2026-03-18 |
| 2. Plugin Manifest and Registry | 0/2 | Not started | - |
| 3. Plugin Loader and Trust | 1/2 | In progress | - |
| 4. Plugin SDK Package | 0/1 | Not started | - |
| 5. Guard-as-Plugin Proof of Concept | 0/2 | Not started | - |
| 6. Marketplace UI | 0/3 | Not started | - |
