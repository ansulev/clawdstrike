# Requirements: ClawdStrike Plugin Ecosystem

## Overview

Enable third-party and internal extension of the ClawdStrike workbench through a plugin system with manifest-driven contribution points, trust-verified distribution, and typed SDK. Security teams can add custom guards, detection adapters, UI panels, and commands without forking the workbench.

## Scope

**v1 (this milestone):** Open closed seams, plugin manifest/registry/loader, SDK package, guard-as-plugin proof-of-concept, marketplace UI in Library panel.

**v2 (deferred):** iframe sandbox for community plugins, MCP plugin multiplexer, cross-device key sync, plugin dependency resolution, plugin-provided context providers.

## Requirements

### SEAM: Open Closed Seams

- **SEAM-01**: `GuardId` type in `types.ts` accepts arbitrary string values so plugin guards can register without modifying the union
- **SEAM-02**: `GUARD_REGISTRY` array in `guard-registry.ts` is a mutable registry with `registerGuard()` and `unregisterGuard()` methods, and built-in guards are registered at startup
- **SEAM-03**: `FileType` type in `file-type-registry.ts` accepts arbitrary string values so plugin file types can register without modifying the union
- **SEAM-04**: `FILE_TYPE_REGISTRY` record in `file-type-registry.ts` is a mutable registry with `registerFileType()` and `unregisterFileType()` methods, and built-in types are registered at startup
- **SEAM-05**: `AppId` and `PluginIcon` types in `plugins/types.ts` (desktop app) accept arbitrary string values
- **SEAM-06**: `CapsuleKind` and `ShelfMode` types in `dock/types.ts` (desktop app) accept arbitrary string values, and capsule content renderers use a registry instead of a switch statement
- **SEAM-07**: `ExplainabilityTrace` union in `shared-types.ts` has a generic `"plugin_trace"` variant with `kind: string` and `data: Record<string, unknown>`
- **SEAM-08**: `ConfigFieldType` union in `types.ts` has a `"json"` fallback type so plugin guards can declare arbitrary config schemas
- **SEAM-09**: `GuardCategory` in `types.ts` accepts arbitrary string values so plugin guards can define custom categories
- **SEAM-10**: Status bar in `status-bar.tsx` renders from a `StatusBarRegistry` with `registerItem()` / `unregisterItem()` instead of hardcoded JSX segments

### MFST: Plugin Manifest

- **MFST-01**: `PluginManifest` TypeScript type declares plugin identity (id, name, version, publisher, description, categories), contribution points (commands, guards, fileTypes, detectionAdapters, sidebarItems, statusBarItems, editorTabs, bottomPanelTabs), activation events, trust tier, and entry point
- **MFST-02**: Contribution point declarations in the manifest are typed: each guard contribution includes id, name, category, configFields; each command contribution includes id, title, keybinding; each sidebarItem includes section, label, icon, href
- **MFST-03**: Manifest includes an `installation` field with downloadUrl, size, checksum (SHA-256), signature (Ed25519), and compatibility version range

### REG: Plugin Registry

- **REG-01**: `PluginRegistry` is a singleton class with `Map<string, RegisteredPlugin>` storage providing `register()`, `unregister()`, `get()`, `getAll()`, and `getByContributionType()` methods
- **REG-02**: Plugin lifecycle states are tracked: `not-installed`, `installing`, `installed`, `activating`, `activated`, `deactivated`, `error`
- **REG-03**: Registration validates the manifest schema and rejects malformed manifests with descriptive errors
- **REG-04**: Registry emits events on state changes (registered, activated, deactivated, unregistered) that other systems can subscribe to

### LOAD: Plugin Loader

- **LOAD-01**: `PluginLoader` loads a registered plugin by resolving its entry point, executing its `activate()` export, and routing its contributions to the appropriate registries (command registry, guard registry, file type registry, status bar registry, sidebar store)
- **LOAD-02**: Internal (first-party) plugins load in-process with full React component and API access
- **LOAD-03**: Plugin loading uses `Promise.allSettled()` so one failing plugin does not block others
- **LOAD-04**: Plugin activation runs only when at least one of the plugin's declared `activationEvents` matches (e.g., `"onStartup"`, `"onFileType:sigma_rule"`, `"onCommand:my-plugin:scan"`)
- **LOAD-05**: Trust verification runs before loading: the manifest Ed25519 signature is checked against the publisher's public key, and unsigned plugins are rejected unless the operator has explicitly allowed unsigned loading

### SDK: Plugin SDK Package

- **SDK-01**: `@clawdstrike/plugin-sdk` is a TypeScript package in `packages/sdk/plugin-sdk/` that plugin authors import to get typed APIs
- **SDK-02**: SDK exports a `PluginContext` object providing namespaced API access: `context.commands.register()`, `context.guards.register()`, `context.fileTypes.register()`, `context.statusBar.register()`, `context.sidebar.register()`, `context.storage.get()`/`set()`
- **SDK-03**: SDK exports TypeScript types for all contribution point interfaces (CommandContribution, GuardContribution, FileTypeContribution, StatusBarContribution, SidebarContribution)
- **SDK-04**: SDK exports the `activate` and `deactivate` lifecycle function signatures that plugin entry points must implement
- **SDK-05**: SDK includes a `createPlugin()` helper that wraps manifest + activate/deactivate into a loadable plugin object

### GAP: Guard-as-Plugin

- **GAP-01**: One built-in guard (EgressAllowlistGuard) is extracted into a standalone plugin that registers itself via the plugin SDK, demonstrating the guard contribution point end-to-end
- **GAP-02**: The extracted guard plugin provides a `GuardMeta` with configFields that the workbench guard config UI renders identically to how the built-in guard rendered before extraction
- **GAP-03**: The extracted guard plugin is loadable both as an in-process internal plugin and (in Rust) as a WASM guard via the existing `CustomGuardRegistry`, proving both paths work

### MKT: Marketplace UI

- **MKT-01**: Library gallery has a "Plugins" tab alongside existing My Policies / Catalog / SigmaHQ tabs
- **MKT-02**: Plugins tab displays a browsable grid of plugin cards showing name, publisher, version, trust level badge, download count, and short description
- **MKT-03**: Plugin cards have Install / Uninstall / Update actions that trigger the plugin loader lifecycle
- **MKT-04**: An "Installed Plugins" section shows all locally installed plugins with their lifecycle state, version, and trust level
- **MKT-05**: A registry client module provides TypeScript functions to query the `clawdstrike-registry` API (search, popular, package info, download, attestation verification)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEAM-01 | Phase 1 | Complete |
| SEAM-02 | Phase 1 | Complete |
| SEAM-03 | Phase 1 | Complete |
| SEAM-04 | Phase 1 | Complete |
| SEAM-05 | Phase 1 | Complete |
| SEAM-06 | Phase 1 | Complete |
| SEAM-07 | Phase 1 | Complete |
| SEAM-08 | Phase 1 | Complete |
| SEAM-09 | Phase 1 | Complete |
| SEAM-10 | Phase 1 | Complete |
| MFST-01 | Phase 2 | Complete |
| MFST-02 | Phase 2 | Complete |
| MFST-03 | Phase 2 | Complete |
| REG-01 | Phase 2 | Complete |
| REG-02 | Phase 2 | Complete |
| REG-03 | Phase 2 | Complete |
| REG-04 | Phase 2 | Complete |
| LOAD-01 | Phase 3 | Complete |
| LOAD-02 | Phase 3 | Complete |
| LOAD-03 | Phase 3 | Complete |
| LOAD-04 | Phase 3 | Complete |
| LOAD-05 | Phase 3 | Complete |
| SDK-01 | Phase 4 | Complete |
| SDK-02 | Phase 4 | Complete |
| SDK-03 | Phase 4 | Complete |
| SDK-04 | Phase 4 | Complete |
| SDK-05 | Phase 4 | Complete |
| GAP-01 | Phase 5 | Complete |
| GAP-02 | Phase 5 | Complete |
| GAP-03 | Phase 5 | Complete |
| MKT-01 | Phase 6 | Complete |
| MKT-02 | Phase 6 | Complete |
| MKT-03 | Phase 6 | Complete |
| MKT-04 | Phase 6 | Complete |
| MKT-05 | Phase 6 | Complete |
