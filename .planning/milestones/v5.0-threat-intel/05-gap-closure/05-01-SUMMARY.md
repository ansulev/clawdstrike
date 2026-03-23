---
phase: "05"
plan: "01"
name: "Plugin bootstrap, mount FindingDetailActions and EnrichmentDashboard"
subsystem: workbench-threat-intel
tags: [gap-closure, bootstrap, component-mounting, threat-intel]
dependency_graph:
  requires: [04-03]
  provides: [threat-intel-bootstrap, finding-actions-mount, enrichment-dashboard-mount]
  affects: [App.tsx, finding-detail.tsx, findings-intel-page.tsx]
tech_stack:
  added: []
  patterns: [plugin-bootstrap-at-startup, secureStore-key-pattern, tab-routing]
key_files:
  created:
    - apps/workbench/src/lib/plugins/threat-intel/bootstrap.ts
  modified:
    - apps/workbench/src/App.tsx
    - apps/workbench/src/components/workbench/findings/finding-detail.tsx
    - apps/workbench/src/components/workbench/findings/findings-intel-page.tsx
decisions:
  - Bootstrap registers sources directly with ThreatIntelSourceRegistry (simpler than pluginRegistry+pluginLoader for built-in sources)
  - getApiKey in FindingDetailActions wired to secureStore with plugin:clawdstrike.{service}:api_key pattern
  - EnrichmentDashboard mounted as third tab in FindingsIntelPage (not separate route)
  - MISP base_url defaults to https://localhost when not configured
metrics:
  duration: "3m 12s"
  completed: "2026-03-23T00:07:48Z"
  tasks_completed: 4
  tasks_total: 4
---

# Phase 5 Plan 1: Plugin Bootstrap, Mount FindingDetailActions and EnrichmentDashboard Summary

Closes three v5.0 audit gaps: bootstraps all 6 threat intel plugins at app startup, mounts FindingDetailActions with bidirectional reporting in finding-detail, and adds EnrichmentDashboard as a third tab on the findings page.

## What Was Done

### Task 1: Create threat intel plugin bootstrap module
Created `bootstrap.ts` that declares a `PLUGINS` descriptor array with all 6 sources (VirusTotal, GreyNoise, Shodan, AbuseIPDB, OTX, MISP). The `bootstrapThreatIntelPlugins()` function reads API keys from secureStore using the `plugin:{pluginId}:api_key` key pattern, creates sources via their factory functions, and registers them with ThreatIntelSourceRegistry. Per-plugin try/catch ensures one failure doesn't block others. MISP additionally reads `base_url`.
- Commit: `1696daaf5`

### Task 2: Wire bootstrap into App startup
Added `bootstrapThreatIntelPlugins()` to the App.tsx startup chain, called after `secureStore.init()` and `migrateCredentialsToStronghold()` complete. This ensures threat intel sources are registered before UI components render.
- Commit: `3c86dfc91`

### Task 3: Mount FindingDetailActions in finding-detail.tsx
Replaced the inline action buttons (Confirm/Dismiss/Promote/Mark FP) with the `FindingDetailActions` component, which adds the "Report to..." button for confirmed findings. Wired `getApiKey` to secureStore using the plugin key pattern. Removed the now-unused local `ActionButton` component and dead icon imports.
- Commit: `9475c7059`

### Task 4: Mount EnrichmentDashboard as tab in FindingsIntelPage
Extended the Tab type to include `"dashboard"` and added a third tab button with `IconChartBar`. When active, renders `EnrichmentDashboard` with findings from the store. Accessible via `/findings?tab=dashboard`.
- Commit: `be31aee8e`

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Direct registry over loader pipeline** -- Built-in sources register directly with `ThreatIntelSourceRegistry` rather than going through `pluginRegistry` + `pluginLoader.routeContributions()`. Built-in sources don't need the trust/sandbox/manifest lifecycle that third-party plugins do.

2. **secureStore key pattern for getApiKey** -- `FindingDetailActions.getApiKey(service)` maps to `secureStore.get("plugin:clawdstrike.{service}:api_key")`, matching the existing `createSecretsApi` prefix pattern.

3. **Tab over route for dashboard** -- EnrichmentDashboard lives in the existing findings tab bar (`/findings?tab=dashboard`) rather than getting its own top-level route. This keeps intelligence views colocated.

4. **MISP base_url fallback** -- When MISP `base_url` is not configured in secureStore, defaults to `https://localhost` so the source object can still be constructed (requests will fail gracefully at runtime).

## Verification

- [x] `bootstrapThreatIntelPlugins()` exported from bootstrap.ts
- [x] App.tsx calls bootstrap after secureStore init
- [x] FindingDetailActions rendered in finding-detail.tsx
- [x] EnrichmentDashboard accessible via tab in findings-intel-page.tsx
- [x] TypeScript compiles without errors in modified files (pre-existing test errors unrelated)

## Self-Check: PASSED

All 4 files verified present. All 4 commits verified in git log.
