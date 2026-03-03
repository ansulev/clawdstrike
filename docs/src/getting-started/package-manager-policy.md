# Package Manager Policy

This repository uses a deliberate split policy for JavaScript package managers.

## Default Policy

1. `npm` is the default package manager for workspace JavaScript packages under `packages/**` and `apps/control-console`.
2. `bun` is used in Bun-managed app/plugin projects that already carry `bun.lockb` (`apps/terminal`, `clawdstrike-plugin`, `cursor-plugin`).
3. `apps/agent` is Cargo-managed (Tauri Rust app); it does not use npm or Bun for primary build/test workflows.
4. Rust and Python workflows remain managed by Cargo and pip/venv, not by npm or Bun wrappers.

## Lockfile Rules

1. `package-lock.json` is authoritative for npm-managed projects.
2. `bun.lockb` is authoritative for Bun-managed projects.
3. A single package/app should not carry both lockfile types.

## CI and Contributor Expectations

1. Use the same package manager as the target project in that directory.
2. Do not switch a directory between npm and Bun in mixed refactor PRs.
3. If you need to change package manager policy for a domain, use a dedicated PR with migration notes.

## Quick Matrix

| Path | Package Manager |
| --- | --- |
| `packages/sdk/**` | npm |
| `packages/adapters/**` | npm |
| `packages/policy/**` | npm |
| `apps/control-console` | npm |
| `apps/terminal` | Bun |
| `clawdstrike-plugin` | Bun |
| `cursor-plugin` | Bun |
| `apps/agent` | Cargo (Tauri Rust app) |
