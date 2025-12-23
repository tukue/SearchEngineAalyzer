# Simplified CD Pipelines for Express + Vite and Next.js on Vercel

This guide explains how to run side-by-side continuous deployment pipelines for the Express + Vite stack and the optional Next.js variant in this repository. Each framework has its own dependencies, build commands, and Vercel project so teams can iterate independently without cross-breaking installs.

## 1. Deployment Flow (High Level)
- **Pull Requests**: Every PR creates a Preview Deployment for **each project** (Express+Vite and Next.js). Preview-scoped environment variables are used automatically.
- **`main` branch**: Merges or direct pushes to `main` promote a Production Deployment per project, using Production env vars for that project.
- **Vercel automation**: Vercel handles builds, serverless packaging for `api/` (Express) or Next.js route handlers, static hosting for Vite output, preview URLs, and GitHub status checks.
- **Framework split**: Use two Vercel projects—one rooted at the repo root for Express + Vite, and another rooted at `/next` for the Next.js variant. Each installs only its own dependencies and runs its own build pipeline.
- **Optional CI gate before deploy**: Add a lightweight GitHub Actions workflow (see §6) to run lint/tests on PRs and `main` pushes. Mark it as a required check in Vercel if desired.

## 2. Vercel Configuration
### Repository structure
```
/
├─ api/            # Express serverless entry points (Vercel functions)
├─ client/         # Vite app (React or similar)
├─ package.json    # Express + Vite dependencies only
├─ vercel.json     # Express + Vite Vercel config
├─ next/           # Next.js variant with its own package.json + vercel.json
```

### `vercel.json` (Express + Vite project root)
```json
{
  "version": 2,
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "functions": {
    "api/**/*.js": { "runtime": "nodejs20.x" },
    "api/**/*.ts": { "runtime": "nodejs20.x" }
  },
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```
Notes:
- The `installCommand` uses legacy peer resolution to dodge React 19 peer conflicts. If you later align peer deps, you can revert to `npm ci`/`npm install`.
- Root directory for this project is the repo root so Vercel picks up `api/`, `client/`, and this config. The Vite build uses `vite.config.ts` (outputs to `dist/public`).
- Ensure `.vercelignore` does **not** exclude `client/`, `server/`, `shared/`, `vite.config.ts`, or the lockfile—Vercel needs those to build. The repo uses a minimal ignore list that only drops tests, logs, and caches.

### `next/vercel.json` (Next.js project root)
```json
{
  "version": 2,
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build",
  "functions": {
    "app/api/**/*.js": { "runtime": "nodejs20.x" },
    "app/api/**/*.ts": { "runtime": "nodejs20.x" }
  },
  "framework": "nextjs"
}
```
Notes:
- Set the Vercel project Root Directory to `next/`. Vercel runs installs and builds inside that folder and respects its own `package.json`.
- Next.js output handling is automatic (`.next`); no custom `outputDirectory` needed.

### Build and output configuration
- **Express + Vite project**
  - Install: `npm install --legacy-peer-deps`
  - Build: `npm run build`
  - Output: `dist/public`
- **Next.js project**
  - Install: `npm install --legacy-peer-deps` (inside `next/`)
  - Build: `npm run build` (inside `next/`)
  - Output: handled automatically by Vercel (`.next`)

### How routes are exposed
- Express handlers under `api/` map to `/api/*` routes. The SPA catch-all sends other traffic to `index.html` so the Vite app handles routing client-side.
- Next.js route/API handlers under `next/app/api` are built and hosted by the Next.js Vercel project.

## 3. Environment Variables
- Set env vars per project under **Project Settings → Environment Variables** in Vercel.
- Use **Preview** scope for PRs and **Production** for `main` deploys.
- Client-facing prefixes: `VITE_` for the Vite app, `NEXT_PUBLIC_` for the Next.js app.
- Server-only vars are read via `process.env` in Express `api/` handlers or Next.js route handlers.

## 4. Local Workflow
```bash
# Express + Vite
npm install --legacy-peer-deps
npm run dev:client    # Vite dev server
npm run dev           # Express dev server
npm run build && npm run start

# Next.js
cd next
npm install --legacy-peer-deps
npm run dev
npm run build && npm run start
```
Adjust the Express dev command to your preferred runner if needed (e.g., `nodemon server/index.ts`).

## 5. Common Pitfalls & Fixes
- **Vercel build error "Function Runtimes must have a valid version"**: Ensure runtime strings are explicit (`nodejs20.x`) for JS and TS handlers. Both `vercel.json` files pin Node 20.x.
- **API routes return 404**: Confirm Express routes live under `api/` and that the Vercel routes array includes `{ "src": "/api/(.*)", "dest": "/api/$1" }` so requests bypass the SPA.
- **Vite assets not loading in production**: Ensure the Vite build emits to `dist/public` (default). If you change `outDir` in `vite.config.ts`, update `outputDirectory` and the catch-all route.
- **Environment variables missing in preview**: Add Preview-scope values in each Vercel project. Remember the `VITE_`/`NEXT_PUBLIC_` prefixes for browser exposure.
- **Mismatch between local and Vercel Node version**: Keep Node 20.x locally, in `package.json` `engines`, and in Vercel Project Settings. Vercel honors `engines` over the project Node setting.
- **Peer dependency conflicts**: If installs fail (e.g., React 19 peers), keep using `--legacy-peer-deps` or align peer ranges and regenerate the lockfile per project.

## 6. Optional CI/CD Guardrails (GitHub Actions)
Use Vercel for deployments and add a minimal CI workflow to keep previews and production healthy.

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: |
          cd client
          npm ci
          npm run build
```
Integration tips:
- In Vercel Project Settings → Git, mark the CI workflow as a required status check if you want deploys gated on tests.
- Each Vercel project (root and `next/`) will still build previews; required checks must pass before production promotion.
- Keep secrets that CI needs in GitHub Actions secrets; app secrets stay in Vercel envs.

## 7. Dependency Layout: Shared vs. Separate `package.json`
- **Express + Vite**: Uses the root `package.json` and lockfile. Only Vite/Express/server deps live here (Next.js is removed to avoid cross-framework conflicts).
- **Next.js**: Lives entirely in `next/package.json` with its own lockfile and Vercel project rooted at `next/`.
- **Why split**: Avoids peer conflicts (React 19 + Vite vs. Next.js), keeps installs smaller per deployment, and lets each framework evolve at its own pace.
- **Workspace option**: If you want a single lockfile, you can add npm workspaces that include `.` and `next/`, but keep framework-specific deps inside their respective `package.json` files.
- **Detailed plan**: See `docs/dependency-separation.md` for two supported models (fully independent installs vs. a workspace-controlled single lockfile) and a rollout checklist.

## Quick Start for New Contributors
1. Install root deps and run `npm run dev:client` (Vite) plus `npm run dev` (Express). For the Next.js variant, `cd next && npm install` then `npm run dev`.
2. Open a PR: Vercel posts preview URLs for both projects. Test with Preview env vars.
3. Merge to `main`: Vercel automatically promotes both projects to production with their own Production env vars.
