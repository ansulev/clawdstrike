# ClawdStrike Academy

Next.js app (`clawdstrike-academy`): interactive onboarding and docs UX in this monorepo.

## UI / design (required)

**All UI work in `apps/academy` must follow:**

`docs/design/DESIGN.md`

That file is the design-system reference (colors, typography, shadows, layout, components). Read it before adding or changing pages, components, or global styles. When AI agents implement UI here, point them at that path.

**Implementation note:** `DESIGN.md` references Waldenburg / Geist; the app uses **Cormorant Garamond** (300/600) for display and **JetBrains Mono** for code until licensed/self-hosted fonts are added.

## Development

From the repository root (workspaces):

```bash
npm install
cd apps/academy
npm run dev
```

Requires Node 24 per root `package.json` `engines` (use `mise` or another version manager if needed).
