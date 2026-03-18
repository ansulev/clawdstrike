# ClawdStrike Plugin Ecosystem

## What This Is

A plugin/extension SDK and runtime for the ClawdStrike Workbench — enabling third-party and internal teams to build custom guards, detection adapters, threat intel sources, fleet providers, and full UI extensions. Inspired by VS Code's contribution point model but security-domain-first.

## Core Value

Security teams can extend ClawdStrike with custom guards, detection formats, intel sources, and UI panels without forking the workbench. Plugin authors get a typed SDK, manifest-driven contribution points, and signed distribution.

## Architecture Vision

### Trust Tiers
- **Internal plugins** — React components, full API access, run in-process
- **Community plugins** — iframe sandbox, postMessage SDK, isolated
- **MCP plugins** — external processes, stdio/SSE transport (already supported)

### Contribution Points
- Commands, activity bar items, editor tabs, bottom panel tabs, right sidebar panels
- Status bar items, guards, file types, detection adapters
- Threat intel sources, compliance frameworks, fleet providers

### Plugin Manifest
JSON manifest declaring id, version, publisher, activation events, and contributions.
Signed with Ed25519 (ClawdStrike's own crypto primitives).

### SDK Package
`@clawdstrike/plugin-sdk` — typed API surface for commands, panes, guards, policies,
detections, findings, sentinels, fleet, editor, and storage.

## Existing Infrastructure to Build On

- Command registry (50+ commands, categories, keybindings, context)
- Activity bar store (7+1 items, panel switching)
- Pane system (openApp, closeView, binary tree)
- Guard pipeline (13 built-in guards, custom guard support)
- Detection workflow (Sigma, YARA, OCSF adapters)
- File type registry
- Athas extension registry/store/loader (reference implementation)
- MCP plugin architecture (already in workbench)

## Constraints

- Tauri 2 + React 19 + TypeScript
- Must not break existing workbench functionality
- Internal plugins run in-process (no iframe overhead)
- Community plugins must be sandboxed
- Plugin manifests must be Ed25519 signed for distribution
