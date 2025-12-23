# Dependency Separation Strategy: Express + Vite vs. Next.js

This repository ships two deployable apps: the Express + Vite stack (root) and the Next.js variant (`next/`). To avoid cross-framework dependency conflicts and to keep installs lean, use the following separation model.

## Goals
- Keep each app’s dependency graph isolated so React/Next/Vite peer ranges don’t collide.
- Let each app ship independently on Vercel with its own lockfile and environment config.
- Preserve a simple onboarding flow for contributors who only need one app.

## Recommended Layout
```
/                # Express + Vite project root
├─ package.json  # Express + Vite only (no Next.js deps)
├─ package-lock.json
├─ vercel.json   # Express + Vite config
└─ next/         # Next.js variant
   ├─ package.json
   ├─ package-lock.json
   └─ vercel.json
```

### Why not share one `package.json`?
- **Peer conflicts**: Next.js and Vite may pin different React or tooling ranges (e.g., React 19 peers). Splitting avoids `ERESOLVE` churn.
- **Faster installs**: Each pipeline installs only what it needs (no Vite deps during Next builds and vice versa).
- **Clear ownership**: Changes to one app’s dependencies don’t impact the other app’s lockfile.

## Two Options for Managing Installs

### Option A: Independent installs (default)
- Run root installs for Express + Vite: `npm install --legacy-peer-deps`.
- Run Next installs inside `next/`: `npm --prefix next install --legacy-peer-deps`.
- Each app keeps its own `package-lock.json`. Vercel projects should be rooted separately (repo root for Express + Vite, `next/` for the Next app) with matching install commands.
- CI: add two steps—one for root (`npm ci || npm install --legacy-peer-deps`) and one for `next/` (`npm --prefix next ci || npm --prefix next install --legacy-peer-deps`).

### Option B: NPM workspaces (single lockfile, still isolated)
- Mark the root as a workspace controller:
  ```json
  {
    "private": true,
    "name": "search-engine-analyzer",
    "workspaces": ["./", "next"],
    "engines": { "node": "20.x" }
  }
  ```
- Keep framework-specific dependencies in their respective `package.json` files (root for Express + Vite, `next/package.json` for Next.js). The workspace root should not list Next.js packages.
- Use `npm install --legacy-peer-deps` at the root to produce a single lockfile that captures both workspaces.
- Vercel: set the Express + Vite project root to `/` and the Next.js project root to `/next`; both will respect workspace hoisting while still scoping builds to their directories.
- Trade-off: a single lockfile simplifies Dependabot/renovations but ties both apps to the same lockfile updates.

## Runtime and Build Alignment
- Node version: 20.x across both projects (`engines.node` in each `package.json`, Vercel Project Settings, and function runtimes).
- Install commands: stick to `--legacy-peer-deps` until React/Next/Vite peer ranges are aligned.
- Build commands: `npm run build` at the root (Vite) and `npm --prefix next run build` for Next.js.

## Rollout Checklist
- [ ] Confirm each `package.json` lists only its framework’s deps.
- [ ] Ensure both `package-lock.json` files are up to date after the split.
- [ ] Verify Vercel projects are linked to the correct roots and install commands.
- [ ] Update CI to run installs/builds for both roots (or enable workspaces and adjust accordingly).
- [ ] Document contributor instructions (see `docs/simplified-vercel-cd.md`) so teammates know which install path to follow.
