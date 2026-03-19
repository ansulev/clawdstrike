# Technology Stack

**Project:** Plugin Developer Experience
**Researched:** 2026-03-18

## Recommended Stack

### CLI Scaffolding
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | >=20 | Runtime | Plugin authors are TS developers; need Node anyway |
| @clack/prompts | latest | Interactive CLI prompts | Modern, lightweight, beautiful terminal UI; successor to inquirer |
| TypeScript | ^5.x | Template type-checking | Same as SDK and workbench |
| tsup | ^8.x | Build CLI package | Already used by plugin-sdk, consistent tooling |

### Dev Server
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vite | ^6.x | Plugin HMR | Workbench already uses Vite 6; custom plugin API for HMR |
| chokidar | (via Vite) | File watching | Built into Vite, no extra dependency |

### Testing Harness
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vitest | ^4.x | Test runner | Already used by SDK and workbench |
| (no additional deps) | - | Mock context | Zero-dep mocks using PluginContext interface |

### Plugin Playground
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CodeMirror 6 | ^6.x | Plugin code editor | Already in workbench deps (8 CM packages) |
| @codemirror/lang-javascript | ^6.x | TypeScript editing | Already in workbench deps |
| sucrase | ^3.x | TS -> JS transform | Fast (100x faster than tsc), small (~200KB), transform-only |

### Documentation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| mdBook | existing | Plugin dev guide | Already project standard (docs/book.toml) |
| TypeDoc | ^0.27.x | API reference | Standard for TS libraries, generates from JSDoc/TSDoc |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI prompts | @clack/prompts | inquirer | inquirer is heavier, less modern UX |
| CLI prompts | @clack/prompts | dialoguer (Rust) | Wrong language for TS plugin authors |
| CLI scaffolding | Node package | Rust command in hush-cli | Plugin authors need Node, not Rust |
| CLI scaffolding | npm create convention | yeoman (yo code) | Yeoman is heavyweight, dated |
| Dev server | Vite plugin | Webpack plugin | Workbench uses Vite, not Webpack |
| Dev server | Vite custom HMR | Full page reload | HMR preserves workbench state |
| TS transform | sucrase | esbuild-wasm | esbuild-wasm is ~8MB; sucrase is ~200KB |
| TS transform | sucrase | tsc | tsc is slow and requires full type system |
| Docs | mdBook | Docusaurus | mdBook is established; Docusaurus adds React build |
| Docs | mdBook | VitePress | VitePress is Vue-oriented |
| API docs | TypeDoc | TSDoc standalone | TypeDoc generates HTML directly from source |
| Playground | Built-in panel | Separate web app | Needs real workbench context for contribution preview |
| Playground | Built-in panel | Storybook | Storybook is for UI components, not plugins |

## Installation

```bash
# New packages to create (workspace members)
# packages/cli/create-plugin/
npm init -y
npm install @clack/prompts

# packages/dev/vite-plugin-clawdstrike/
npm init -y
# vite is a peer dependency

# SDK testing entry point (no new packages)
# Add to packages/sdk/plugin-sdk/src/testing.ts

# Documentation
npm install -D typedoc  # in root or plugin-sdk package
# mdBook already installed

# Playground (in apps/workbench)
npm install sucrase  # TS transform for plugin evaluation
```

## Sources

- `apps/workbench/package.json` -- existing dependency versions
- `packages/sdk/plugin-sdk/package.json` -- SDK build tooling (tsup, vitest, typescript)
- `apps/workbench/vite.config.ts` -- Vite 6 configuration
- `docs/book.toml` -- mdBook configuration
- `mise.toml` -- Node 24, Rust 1.93, Python 3.12
