# Phase 1: Core Detection Plugin Infrastructure - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Extension points for detection adapter plugins: unregisterAdapter(), visual panel registry, translation provider registry, shared field mapping table, extensible PublishTarget. Existing built-in panels (Sigma, YARA, OCSF) migrated to standardized props.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key guidance from research:
- Add `unregisterAdapter()` to detection workflow (currently missing)
- Visual panel registry for format-specific editor UIs (extends ViewRegistry pattern)
- Translation provider registry: adapters declare `from`/`to` format pairs, registry resolves translation paths
- Shared field mapping table: Map<sigmaField, Map<format, siemField>> for cross-format field name translation
- Change `PublishTarget` from closed enum to extensible string (like Phase 1 v1.0 seam pattern)
- `DetectionAdapterContribution` in manifest bundles fileType + adapter + visualPanel + translationProvider atomically
- Existing Sigma/YARA/OCSF panels migrated to standardized `DetectionVisualPanelProps`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Detection workflow adapters (`lib/workbench/detection-workflow/adapters.ts`) — has registerAdapter(), needs unregister
- Sigma adapter (sigma-adapter.ts), YARA adapter (yara-adapter.ts), OCSF adapter (ocsf-adapter.ts)
- sigma-conversion.ts (685 LOC) — already outputs SPL/KQL/ES|QL
- ViewRegistry from v3.0 (for visual panel slot)
- File type registry from v1.0 (for format registration)
- Plugin SDK types.ts (for DetectionAdapterContribution)

### Integration Points
- PluginLoader.routeContributions() — needs detectionAdapters routing
- Editor visual panel rendering — needs dynamic panel registry
- Policy editor format selector — needs extensible format list

</code_context>

<specifics>
## Specific Ideas
Reference: `.planning/research/detection-adapter-plugins.md`
</specifics>

<deferred>
## Deferred Ideas
- Individual adapter plugins (Phases 2-5)
- Connected SIEM execution mode (v2)
</deferred>
