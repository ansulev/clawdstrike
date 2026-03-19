# Roadmap: ClawdStrike Workbench v1.3 — Live Features

## Overview

Three parallel feature tracks that bring the workbench to life with real-time data, agent coordination, and threat intelligence. These transform the workbench from "editor with tools" to "live security operations center."

**Prior milestones:**
- v1.0: IDE shell (activity bar, panes, sidebar panels, commands)
- v1.1: IDE completeness (search, nav, file tree, editor, session restore, detection integration)
- v1.2: Explorer polish (icons, filters, indent guides, context menus)

## Feature Tracks

- [ ] **Track A: Live Fleet Dashboard** — Real-time agent monitoring, posture visualization, drift detection, one-click policy push
- [ ] **Track B: Swarm Board Evolution** — Launch swarms from editor, real-time agent coordination graph, receipt flow visualization
- [ ] **Track C: Threat Intel Feed** — Signal clustering, severity scoring, promote-to-detection workflow

## Track A: Live Fleet Dashboard

### Phase A1: Fleet Data Layer
**Goal**: Real-time agent heartbeats and posture data flowing from hushd into the workbench via SSE streaming, with accurate drift detection
**Requirements**: FLEET-01, FLEET-02, FLEET-03, FLEET-04
**Success Criteria**:
  1. Fleet dashboard shows connected agents with live heartbeat status (online/offline/degraded)
  2. Each agent shows: posture score, active policy version, last heartbeat timestamp, guard count
  3. Agents that drift from the fleet-wide policy are flagged with a drift indicator
  4. Dashboard auto-refreshes on a configurable interval (default 10s) or via SSE when connected to hushd
**Plans**: 1 plan
Plans:
- [x] track-a-fleet-01-PLAN.md — SSE event stream, heartbeat reducer, drift detection fix, store integration (complete)

### Phase A2: Fleet Visualization & Actions
**Goal**: Topology map of agents, one-click policy push, bulk operations
**Depends on**: Phase A1
**Requirements**: FLEET-05, FLEET-06, FLEET-07, FLEET-08
**Success Criteria**:
  1. Topology view shows agents as nodes with edges representing trust relationships
  2. Agent detail panel (right sidebar or drawer) shows full config, recent receipts, policy diff
  3. "Push Policy" button deploys the active policy to selected agent(s) with confirmation
  4. Bulk select agents for batch policy push, restart, or retire operations
**Plans**: 1 plan
Plans:
- [x] track-a-fleet-02-PLAN.md — Agent detail page, SVG topology, bulk select, quick deploy, dashboard enhancements (complete)

## Track B: Swarm Board Evolution

### Phase B1: Editor-to-Swarm Bridge
**Goal**: Launch a swarm session directly from the policy editor or command palette
**Requirements**: SWARM-01, SWARM-02, SWARM-03
**Success Criteria**:
  1. "Launch Swarm" button in the editor toolbar spawns a new swarm session with the active policy
  2. Swarm Board opens as a pane tab alongside the editor (split view)
  3. Swarm session is pre-configured with the active policy and connected sentinels
**Plans**: TBD

### Phase B2: Real-Time Swarm Visualization
**Goal**: Live agent coordination visible on the graph — receipts flowing, decisions animating
**Depends on**: Phase B1
**Requirements**: SWARM-04, SWARM-05, SWARM-06, SWARM-07
**Success Criteria**:
  1. Agent nodes pulse/glow when they evaluate a policy (real-time via SSE or polling)
  2. Receipts appear as animated edges flowing between nodes
  3. Trust graph updates live as agents join/leave or trust relationships change
  4. Click a receipt edge to open the receipt inspector in a pane tab
**Plans**: TBD

## Track C: Threat Intel Feed

### Phase C1: Signal Ingestion & Clustering
**Goal**: Incoming signals from sentinels are automatically clustered and scored
**Requirements**: INTEL-01, INTEL-02, INTEL-03, INTEL-04
**Success Criteria**:
  1. Findings sidebar panel shows a live feed of incoming signals (not just static list)
  2. Signals are automatically clustered by similarity (same source, same technique, same timeframe)
  3. Each cluster shows a severity score (critical/high/medium/low) with color coding
  4. New signals trigger a badge count update on the Findings activity bar icon
**Plans**: TBD

### Phase C2: Promote-to-Detection Workflow
**Goal**: Turn a finding or signal cluster into a detection rule with one click
**Depends on**: Phase C1
**Requirements**: INTEL-05, INTEL-06, INTEL-07, INTEL-08
**Success Criteria**:
  1. "Draft Detection" button on a finding generates a Sigma rule from the finding's indicators
  2. "Draft Policy Guard" button generates a guard config block from the finding's pattern
  3. Generated content opens in a new file tab in the editor for review/editing
  4. The finding is linked to the generated detection (bidirectional reference)
**Plans**: 1 plan
Plans:
- [x] C2-01-PLAN.md -- Finding mapper, draftFromFinding hook, Draft Detection button (complete)

## Progress

| Track | Phase | Status |
|-------|-------|--------|
| A. Fleet Dashboard | A1: Data Layer | Complete (1 plan) |
| A. Fleet Dashboard | A2: Viz & Actions | Complete (1 plan) |
| B. Swarm Board | B1: Editor Bridge | Not started |
| B. Swarm Board | B2: Real-Time Viz | Not started |
| C. Threat Intel | C1: Signal Clustering | Complete (2 plans) |
| C. Threat Intel | C2: Promote-to-Detection | Complete (1 plan: C2-01) |
