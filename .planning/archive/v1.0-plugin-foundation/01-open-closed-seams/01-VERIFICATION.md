---
phase: 01-open-closed-seams
verified: 2026-03-18T22:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 1: Open Closed Seams — Verification Report

**Phase Goal:** Every contribution point that a plugin needs to extend is backed by a dynamic registry instead of a hardcoded union or const array
**Verified:** 2026-03-18T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                    | Status     | Evidence                                                                                    |
|----|------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| 1  | GuardId accepts arbitrary string values (not closed union)                               | VERIFIED   | `types.ts:11` — `export type GuardId = string`                                              |
| 2  | GUARD_REGISTRY is a mutable registry with registerGuard/unregisterGuard                  | VERIFIED   | `guard-registry.ts:249,282` — both functions exported, Map-backed                          |
| 3  | FileType accepts arbitrary string values (not closed union)                              | VERIFIED   | `file-type-registry.ts:7` — `export type FileType = string`                                 |
| 4  | FILE_TYPE_REGISTRY is a mutable registry with registerFileType/unregisterFileType        | VERIFIED   | `file-type-registry.ts:184,200` — both functions exported, Map + Proxy                     |
| 5  | AppId and PluginIcon accept arbitrary string values                                       | VERIFIED   | `plugins/types.ts:7,50` — both `= string`                                                  |
| 6  | CapsuleKind and ShelfMode accept arbitrary strings; capsule renderers use registry       | VERIFIED   | `dock/types.ts:9,107`; `DockSystem.tsx:949` dispatches via `getCapsuleRenderer`            |
| 7  | ExplainabilityTrace has a plugin_trace variant with kind string and data Record          | VERIFIED   | `shared-types.ts:231-241` — variant present with `traceType`, `data`, `sourceLineHints?`  |
| 8  | ConfigFieldType includes "json" fallback for arbitrary plugin config schemas             | VERIFIED   | `types.ts:516-520` — `BUILTIN_CONFIG_FIELD_TYPES` includes `"json"`; type is `string`     |
| 9  | GuardCategory accepts arbitrary string values for custom plugin categories               | VERIFIED   | `types.ts:506` — `export type GuardCategory = string`                                      |
| 10 | StatusBar renders from StatusBarRegistry with register/unregister instead of hardcoded  | VERIFIED   | `status-bar-registry.ts:46,59`; `status-bar.tsx:243-304` — 9 built-in items registered    |

**Score:** 10/10 truths verified

---

## Required Artifacts

### Plan 01-01 Artifacts (SEAM-01, SEAM-02, SEAM-08, SEAM-09)

| Artifact                                                              | Expected                                            | Status     | Details                                                                         |
|-----------------------------------------------------------------------|-----------------------------------------------------|------------|---------------------------------------------------------------------------------|
| `apps/workbench/src/lib/workbench/types.ts`                          | Open GuardId, GuardCategory, ConfigFieldType types  | VERIFIED   | All three are `= string`; BUILTIN_* const arrays present; `"json"` in BUILTIN_CONFIG_FIELD_TYPES |
| `apps/workbench/src/lib/workbench/guard-registry.ts`                 | Dynamic guard registry with register/unregister     | VERIFIED   | Map-backed registry; `registerGuard`, `unregisterGuard`, `getAllGuards`, `getGuardMeta`, `GUARD_REGISTRY` Proxy all present |
| `apps/workbench/src/lib/workbench/__tests__/guard-registry.test.ts`  | Tests including plugin guard registration           | VERIFIED   | 49 tests; describe blocks for GUARD_REGISTRY, BUILTIN_GUARDS, dynamic registration, categories, display names, proxy liveness |

### Plan 01-02 Artifacts (SEAM-03, SEAM-04, SEAM-07)

| Artifact                                                                          | Expected                                      | Status     | Details                                                                                           |
|-----------------------------------------------------------------------------------|-----------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| `apps/workbench/src/lib/workbench/file-type-registry.ts`                         | Open FileType + dynamic registry              | VERIFIED   | `FileType = string`; Map + Proxy; `registerFileType`, `unregisterFileType`, `getAllFileTypes`, `FILE_TYPE_REGISTRY` Proxy all present; custom detector pipeline present |
| `apps/workbench/src/lib/workbench/detection-workflow/shared-types.ts`            | ExplainabilityTrace with plugin_trace variant | VERIFIED   | Variant at lines 231-241 with `kind: "plugin_trace"`, `traceType: string`, `data: Record<string, unknown>`, `sourceLineHints?: number[]` |
| `apps/workbench/src/lib/workbench/__tests__/file-type-registry.test.ts`          | Tests for dynamic registration + plugin_trace | VERIFIED   | 17 tests across 4 describe blocks: detection, dynamic registration, FILE_TYPE_REGISTRY compat, plugin_trace |

### Plan 01-03 Artifacts (SEAM-05, SEAM-06, SEAM-10)

| Artifact                                                                              | Expected                                          | Status     | Details                                                                                         |
|---------------------------------------------------------------------------------------|---------------------------------------------------|------------|-------------------------------------------------------------------------------------------------|
| `apps/desktop/src/shell/plugins/types.ts`                                            | Open AppId and PluginIcon types                   | VERIFIED   | `AppId = string` (line 7), `PluginIcon = string` (line 50); BUILTIN_APP_IDS, BUILTIN_PLUGIN_ICONS present |
| `apps/desktop/src/shell/dock/types.ts`                                               | Open CapsuleKind and ShelfMode types              | VERIFIED   | `CapsuleKind = string` (line 9), `ShelfMode = string` (line 107); BUILTIN_CAPSULE_KINDS, BUILTIN_SHELF_MODES present |
| `apps/desktop/src/shell/dock/capsule-renderer-registry.ts`                           | CapsuleRendererRegistry with register/get APIs    | VERIFIED   | `registerCapsuleRenderer`, `unregisterCapsuleRenderer`, `getCapsuleRenderer`, `getRegisteredCapsuleKinds`, `capsuleRendererRegistry` object all exported |
| `apps/desktop/src/shell/dock/DockSystem.tsx`                                         | getCapsuleContent dispatching from registry       | VERIFIED   | Switch statement replaced; lines 937-945 register 9 built-ins; line 949 dispatches via `getCapsuleRenderer(capsule.kind)` |
| `apps/desktop/src/shell/dock/__tests__/capsule-renderer-registry.test.ts`           | Tests for capsule renderer registry               | VERIFIED   | 6 tests: register/retrieve, undefined for unregistered, dispose, duplicate throws, no-op unregister, getRegisteredCapsuleKinds |
| `apps/workbench/src/lib/workbench/status-bar-registry.ts`                           | StatusBarRegistry with register/unregister/getItems | VERIFIED | `registerStatusBarItem`, `unregisterStatusBarItem`, `getStatusBarItems`, `onStatusBarChange`, `statusBarRegistry` all present; snapshot cache for useSyncExternalStore stability |
| `apps/workbench/src/components/desktop/status-bar.tsx`                              | StatusBar rendering from registry                 | VERIFIED   | 9 built-in items registered at module scope (`builtin:validation`, `builtin:guard-count-or-file-type`, `builtin:policy-version`, `builtin:fleet-status`, `builtin:mcp-status`, `builtin:eval-count`, `builtin:tab-count`, `builtin:active-policy`, `builtin:file-path`); renders via `useSyncExternalStore` + `getStatusBarItems` |
| `apps/workbench/src/lib/workbench/__tests__/status-bar-registry.test.ts`           | Tests for status bar registry                     | VERIFIED   | 8 tests: side filtering, priority sort, dispose, duplicate throws, no-op unregister, listener notify on register, listener notify on unregister |

---

## Key Link Verification

| From                                    | To                                      | Via                                                     | Status  | Details                                                                                      |
|-----------------------------------------|-----------------------------------------|---------------------------------------------------------|---------|----------------------------------------------------------------------------------------------|
| `guard-registry.ts`                     | `types.ts`                              | imports `GuardMeta`, `GuardId`, `GuardCategory`         | WIRED   | Line 1: `import type { GuardMeta } from "./types"`                                           |
| `file-type-registry.ts`                 | (self-contained)                        | `FileType` used as descriptor id and detection return   | WIRED   | All internal; `fileTypeMap.get(fileType)`, `FileTypeDescriptor.id: FileType`                |
| `status-bar.tsx`                        | `status-bar-registry.ts`               | imports `statusBarRegistry`, `registerStatusBarItem`, `getStatusBarItems`, `onStatusBarChange` | WIRED | Lines 18-21 confirm imports; `useSyncExternalStore(onStatusBarChange, () => getStatusBarItems(side))` at lines 311-314 |
| `DockSystem.tsx`                        | `capsule-renderer-registry.ts`         | `getCapsuleContent()` looks up renderer via `getCapsuleRenderer` | WIRED | Line 25 imports; line 949 uses `getCapsuleRenderer(capsule.kind)`; 9 registrations at lines 937-945 |
| `dock/index.ts`                         | `capsule-renderer-registry.ts`         | exports `capsuleRendererRegistry`, `registerCapsuleRenderer`, `getCapsuleRenderer` | WIRED | Line 15 of `index.ts` re-exports all three                                                   |

---

## Requirements Coverage

All 10 SEAM requirements for Phase 1 are covered. No orphaned requirements detected.

| Requirement | Source Plan | Description                                                                        | Status    | Evidence                                                                                  |
|-------------|-------------|------------------------------------------------------------------------------------|-----------|-------------------------------------------------------------------------------------------|
| SEAM-01     | 01-01       | GuardId accepts arbitrary string values                                            | SATISFIED | `types.ts:11` — `export type GuardId = string`                                           |
| SEAM-02     | 01-01       | GUARD_REGISTRY is mutable with registerGuard/unregisterGuard; built-ins at startup | SATISFIED | `guard-registry.ts:249,282,239-241` — Map-backed, register/unregister, seeded at load   |
| SEAM-03     | 01-02       | FileType accepts arbitrary string values                                           | SATISFIED | `file-type-registry.ts:7` — `export type FileType = string`                              |
| SEAM-04     | 01-02       | FILE_TYPE_REGISTRY is mutable with registerFileType/unregisterFileType             | SATISFIED | `file-type-registry.ts:184,200,174-176` — Map + Proxy, register/unregister, seeded at load |
| SEAM-05     | 01-03       | AppId and PluginIcon accept arbitrary string values                                | SATISFIED | `plugins/types.ts:7,50` — both `= string`                                                |
| SEAM-06     | 01-03       | CapsuleKind and ShelfMode accept arbitrary strings; renderers use registry         | SATISFIED | `dock/types.ts:9,107`; `DockSystem.tsx:949` — switch replaced with registry dispatch    |
| SEAM-07     | 01-02       | ExplainabilityTrace has a generic plugin_trace variant                             | SATISFIED | `shared-types.ts:231-241` — `kind: "plugin_trace"`, `traceType: string`, `data: Record<string, unknown>` |
| SEAM-08     | 01-01       | ConfigFieldType has a "json" fallback type                                         | SATISFIED | `types.ts:514-520` — `ConfigFieldType = string`; `"json"` in BUILTIN_CONFIG_FIELD_TYPES |
| SEAM-09     | 01-01       | GuardCategory accepts arbitrary string values                                      | SATISFIED | `types.ts:506` — `export type GuardCategory = string`                                   |
| SEAM-10     | 01-03       | StatusBar renders from StatusBarRegistry with register/unregister                  | SATISFIED | `status-bar-registry.ts:46,59`; `status-bar.tsx:243-304` — 9 built-ins registered, renders via `useSyncExternalStore` |

---

## Anti-Patterns Found

No blockers or warnings detected in modified files.

**Notable (info):** `DockSystem.tsx` still contains a `switch (mode)` at line 634 inside `getDemoShelfContent()`. This is a demo helper function for shelf content, not the capsule content renderer. The capsule renderer switch has been fully replaced. This does not block goal achievement — `ShelfMode = string` is the seam, and `getDemoShelfContent` is display-only demo code that does not prevent plugin registration.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `DockSystem.tsx` | 634 | `switch (mode)` in demo-only `getDemoShelfContent()` | Info | None — separate from capsule renderer path; ShelfMode type is already `string` |

---

## Human Verification Required

No items require human verification. All critical behaviors are verifiable programmatically:
- Type widening is confirmed by source inspection
- Registry APIs are confirmed by reading exports
- Wiring is confirmed by import + usage grep
- Tests cover all dynamic registration behaviors including dispose, duplicate detection, custom detectors, and backward compat

---

## Gaps Summary

None. All 10 SEAM requirements are satisfied. All 8 plan artifacts exist and are substantive. All key links are wired. The phase goal — "every contribution point that a plugin needs to extend is backed by a dynamic registry instead of a hardcoded union or const array" — is fully achieved:

- **Guard pipeline:** GuardId/GuardCategory/ConfigFieldType opened; Map-backed registry with register/unregister/dispose
- **File types:** FileType opened; Map + Proxy registry with custom detector pipeline
- **Detection traces:** plugin_trace variant added to ExplainabilityTrace
- **Desktop shell:** AppId/PluginIcon/CapsuleKind/ShelfMode opened; CapsuleRendererRegistry replaces switch
- **Workbench UI:** StatusBarRegistry replaces hardcoded JSX; built-in segments registered as components

All backward-compatible exports (GUARD_REGISTRY, ALL_GUARD_IDS, GUARD_DISPLAY_NAMES, GUARD_CATEGORIES, FILE_TYPE_REGISTRY, PLUGIN_ICONS) are implemented via Proxy pattern, preserving the 60+ existing consumer files without modification.

---

_Verified: 2026-03-18T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
