---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Presence & Awareness
status: defining_requirements
stopped_at: null
last_updated: "2026-03-23T01:00:00.000Z"
last_activity: 2026-03-23 -- Milestone v2.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)
**Core value:** Security operators work across multiple views simultaneously with IDE-grade workflows
**Current focus:** v2.0 Presence & Awareness — real-time analyst collaboration foundation

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-23 — Milestone v2.0 started

## Previous Milestones

**v1.0 -- IDE Pivot** (2026-03-18): 4 phases, 9 plans, 45 reqs
**v1.1 -- IDE Completeness** (2026-03-18/19): 13 phases, ~28 plans, 50+ reqs
**v1.2 -- Explorer Polish** (partial, filter bar done): 1 phase, 1 plan
**v1.3 -- Live Features** (2026-03-22): 15 phases (incl. gap closure), 29+ plans, 23 reqs
**v1.4 -- Cleanup & Store Migration** (2026-03-23): 3 phases, 5 plans

## Accumulated Context

### Collaborative Threat Hunting Roadmap
Track A (v2.0): Presence & Awareness — WebSocket, presence protocol, cursors
Track B (v2.1): Shared Investigation Sessions — investigation=swarm, shared findings, task assignment
Track C (v2.2): Co-Editing — CRDT layer (Yjs/Automerge), conflict-free edits
Track D (v2.3): Investigation Orchestration — runbooks, roles, status board, export

### Key Existing Assets for Collaboration
- SwarmCoordinator with InProcessEventBus — designed for networked transport swap
- Speakeasy chat with Ed25519 signed messages — secure comms channel
- Fleet SSE streaming (FleetEventStream) — real-time server→client pattern
- Finding timeline annotations — chronological event log per finding
- Receipt system (hush-core Ed25519) — cryptographic proof chain
- Signal→Finding→Intel pipeline — shared intel as natural multiplayer data type

### Decisions
- Build on cryptographic receipt system — every collaborative action is a signed receipt
- Investigation timeline IS the Merkle tree — unique to ClawdStrike
- Reuse fleet SSE auth patterns for WebSocket connection
- InProcessEventBus was always placeholder for networked transport

### Blockers/Concerns
- None

## Session Continuity

Last session: 2026-03-23T01:00:00.000Z
Stopped at: Milestone v2.0 started, defining requirements
