# Feature Landscape

**Domain:** Plugin Developer Experience
**Researched:** 2026-03-18

## Table Stakes

Features plugin authors expect. Missing = platform feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CLI scaffolding (`npm create`) | Every modern platform has a generator | Medium | 6 template types, interactive prompts |
| Testing harness (`createMockContext`) | Plugins must be testable without full workbench | Low | Extract existing test helper to public API |
| API documentation | SDK types need reference docs | Low | TypeDoc from existing JSDoc comments |
| Getting started guide | Plugin authors need a tutorial | Low | mdBook section, ~5 pages |
| Example plugins | Learn by reading working code | Low | egress-guard-plugin.ts exists; add 2-3 more |

## Differentiators

Features that set ClawdStrike's plugin DX apart from typical extension platforms.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Plugin hot reload dev server | Edit plugin code, see changes instantly in workbench | Medium | Vite plugin with custom HMR |
| Dev console panel | See plugin lifecycle events, errors, registrations live | Medium | Bottom panel contribution |
| Plugin playground (in-app editor) | Write and test plugins without leaving the workbench | High | CodeMirror + client-side eval + live preview |
| Contribution inspector | Tree view of all registered contributions from a plugin | Medium | Right sidebar panel |
| Spy context for tests | Record all API calls for assertion-based testing | Low | Extension of mock context |
| Manifest validation in CLI | Catch manifest errors before running the workbench | Low | Reuse validateManifest() from workbench |
| Type-safe scaffolding | Generated code passes TypeScript strict mode | Low | Templates import from SDK types |
| CI guardrail for SDK type drift | Prevent SDK types from diverging from workbench types | Low | Diff check in architecture-guardrails.sh |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Yeoman-based generator | Heavy, dated, requires global install | Use npm create convention with @clack/prompts |
| Separate plugin dev app | Loses workbench context; plugins need real registries | Build playground as a workbench panel |
| eval() for playground | CSP violation, security risk | Use blob URL or dev server route for module loading |
| Full TypeScript language server in playground | Massive complexity, performance cost | Use basic CodeMirror JS/TS mode with autocompletion hints |
| Plugin dependency resolution | Premature complexity; plugins should be self-contained | Defer to v3; document peer dependency patterns instead |
| Visual plugin builder (drag-and-drop) | Over-engineering; plugins are code, not visual configs | Good editor + live preview is sufficient |
| Plugin hot reload in production | Security risk; plugins should be immutable in production | Dev mode only; production loads from .cpkg archives |

## Feature Dependencies

```
Testing Harness --> CLI Scaffolding (generated tests import from testing)
CLI Scaffolding --> Dev Server (dev server loads scaffolded projects)
Dev Server --> Plugin Playground (playground uses same HMR patterns)
Documentation --> (independent, can run in parallel with phases 3-5)
Contribution Inspector --> Plugin Playground (part of playground UI)
Dev Console Panel --> Dev Server (shows lifecycle events during dev)
```

## MVP Recommendation

Prioritize:
1. Testing harness (`plugin-sdk/testing`) -- unblocks plugin authors immediately, minimal effort
2. CLI scaffolding (`create-plugin`) -- zero-to-plugin in one command
3. Dev server (Vite plugin) -- the edit-reload loop is the core dev experience
4. Documentation (mdBook + TypeDoc) -- can be written while building dev server

Defer:
- Plugin playground: High complexity, depends on all other features. Build after dev server is validated.
- Contribution inspector: Part of playground; defer with it.
- In-app TypeScript language service: Future enhancement; basic CM mode is sufficient for now.

## Sources

- `packages/sdk/plugin-sdk/tests/create-plugin.test.ts` -- existing makeMockContext() helper
- `apps/workbench/src/lib/plugins/examples/` -- egress-guard-plugin.ts
- `crates/services/hush-cli/src/init.rs` -- existing CLI scaffolding patterns
- `crates/services/hush-cli/src/pkg_cli.rs` -- existing `hush pkg init` with 6 package types
- `apps/workbench/src/lib/plugins/manifest-validation.ts` -- validation for reuse
