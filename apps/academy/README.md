# ClawdStrike Academy

Next.js app (`clawdstrike-academy`): interactive onboarding for the ClawdStrike runtime security system — lesson tracks, guard gallery, policy lab, and in-browser WASM demos.

## Screenshots

Assets live in `[images/](./images/)`. Paths are relative to this README (`./images/…`).

### Landing

Hero, primary CTAs, and learning tracks.

### Guard Gallery

Tier sections and guard cards.

## UI / design (required)

**All UI work in `apps/academy` must follow:**

`[docs/design/DESIGN.md](docs/design/DESIGN.md)`

That document is the design-system reference (colors, typography, shadows, layout, components). Read it before adding or changing pages, components, or global styles. When AI agents implement UI here, point them at that path.

**Implementation note:** `DESIGN.md` references Waldenburg / Geist; the app uses **Cormorant Garamond** (300/600) for display and **JetBrains Mono** for code until licensed or self-hosted fonts are added.

## Development

From the repository root (npm workspaces):

```bash
npm install
cd apps/academy
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

**Tooling:** Node **24** matches root `package.json` `engines` (e.g. `mise install` / `mise exec -- npm run dev`). The `dev` script runs a `prebuild` (ruleset + source extraction) before Next.js.

**Hydration noise in dev:** Some browser extensions (e.g. Grammarly) inject attributes on `<body>`. The root layout uses `suppressHydrationWarning` on `<body>` so that does not surface as a React hydration error.