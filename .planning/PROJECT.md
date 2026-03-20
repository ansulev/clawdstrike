# ClawdStrike Academy

## What This Is

An interactive Next.js onboarding web app that teaches new engineers (recent CS grads) the ClawdStrike runtime security system through hands-on, in-browser experiences. Instead of reading static docs, new hires use the real WASM-compiled policy engine to evaluate actions, break guards, write policies, and build intuition for how the system works — all before touching the Rust codebase.

## Core Value

A new engineer understands *why* ClawdStrike exists and *how* it works by interacting with the real engine in their browser, compressing weeks of onboarding into days.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Interactive threat scenario showing why AI agent security enforcement exists
- [ ] Live WASM-powered guard playgrounds for all 13 built-in guards
- [ ] Guard Gallery with threat descriptions, annotated source, and bypass challenges
- [ ] Visual YAML policy editor with live validation against the real schema
- [ ] Policy inheritance visualization (extends chains, merge strategies)
- [ ] Built-in ruleset comparison view (all 10 rulesets side-by-side)
- [ ] MDX content system for lesson authoring with embedded React components
- [ ] Progress tracking (per-track, per-lesson completion)
- [ ] Annotated source code viewer pulling real .rs/.ts files with Shiki highlighting
- [ ] Security regression scenarios from actual bugs (URL spoofing, path traversal)
- [ ] Dark/light mode with clean modern design (shadcn/ui)

### Out of Scope

- Architecture interactive graph (Track 4) — defer to v2, complex D3/React Flow work
- "Your First PR" exercises (Track 5) — needs CLI integration, defer to v2
- CTF scoring/leaderboard system — defer to v2
- User accounts/auth — this is an internal tool, no login needed
- Mobile responsiveness — desktop-first for onboarding
- CI/CD deployment — local dev and static export sufficient for v1
- Tauri wrapper — Next.js web app only for now

## Context

- ClawdStrike is an 84K+ LOC Rust workspace with 12+ TS packages
- `hush-wasm` crate already compiles to WASM (~1.6MB binary, web + Node.js targets)
- WASM exports: guard evaluation, jailbreak detection, prompt injection detection, canonical JSON
- 13 built-in guards, each with its own security domain (filesystem, network, shell, CUA, ML-based)
- 10 built-in rulesets (YAML policies) ready to embed as interactive content
- Existing mdBook docs (152 chapters, ~12K lines) provide raw content to draw from
- 23 example directories in the repo for scenario material
- Security regression tests (`security_regressions.rs`) contain real attack stories
- The new engineer will work in both Rust and TypeScript
- Target audience: recent CS grad, can code but not yet a full software engineer
- Complexity zones: crypto (2/5), policy engine (3/5), broker (4/5), formal verification (5/5)
- App lives at `apps/academy/` inside the clawdstrike monorepo

## Constraints

- **Tech stack**: Next.js 15 (App Router), MDX, shadcn/ui, Tailwind, Shiki, hush-wasm
- **WASM dependency**: Must load hush-wasm in browser for live guard evaluation
- **Content accuracy**: All guard descriptions and code annotations must match current codebase
- **Monorepo integration**: Lives in `apps/academy/`, excluded from default cargo workspace (like other Tauri apps)
- **No backend**: Static/client-side only — WASM handles all evaluation logic

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js over Tauri | Browser-based = easier to share, WASM runs natively, no install | — Pending |
| MDX for content | Write lessons as Markdown, embed interactive React components inline | — Pending |
| Real WASM engine, not mocks | The "wow" moment is running the actual policy engine in-browser | — Pending |
| Tracks 1-3 for v1 | Threat intro + Guard Gallery + Policy Lab covers the interactive core | — Pending |
| shadcn/ui + clean modern | Professional look, dark/light toggle, matches dev tooling aesthetics | — Pending |
| apps/academy/ location | Alongside existing apps in monorepo, shares workspace tooling | — Pending |

---
*Last updated: 2026-03-20 after initialization*
