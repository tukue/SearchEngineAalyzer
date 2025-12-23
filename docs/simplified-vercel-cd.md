# Simplified CD Pipeline for Express + Vite on Vercel

This guide explains how to set up and operate a minimal continuous deployment pipeline for a single-repo Express + Vite application on Vercel.

## 1. Deployment Flow (High Level)
- **Pull Requests**: Every PR creates an isolated **Preview Deployment**. Vercel auto-builds from the PR branch and posts a preview URL. Environment variables scoped to “Preview” are used.
- **`main` branch**: Merges or direct pushes to `main` trigger a **Production Deployment**. Vercel promotes the build to the production domain and uses “Production” environment variables.
- **Vercel automation**: Vercel handles build orchestration, serverless packaging for the `api/` folder, static hosting for the `client/` build, preview URLs, and GitHub status checks. No extra CI is required unless you want tests before deploy.
- **Alternate variants**: If you need a separate variant (e.g., white-label or enterprise edition), create a second Vercel project that points to the same repo but uses a different root directory or env var set. Each project will still auto-create previews for PRs and deploy `main` to its own production domain.
- **Optional CI gate before deploy**: Add a lightweight GitHub Actions workflow (see §6) to run lint/tests on pull requests and `main` pushes. Vercel will wait for required status checks to pass before shipping.

## 2. Vercel Configuration
### Repository structure
```
/
├─ api/            # Express serverless entry points (Vercel functions)
├─ client/         # Vite app (React or similar)
├─ package.json
├─ vercel.json
```
This matches Vercel’s expectations: `api/` becomes serverless functions, and the frontend builds from `client/` to static assets.

### `vercel.json`
```json
{
  "version": 2,
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "functions": {
    "api/**/*.ts": { "runtime": "nodejs20.x" },
    "api/**/*.js": { "runtime": "nodejs20.x" }
  },
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```
Notes:
- The `installCommand` uses legacy peer resolution to avoid React 19 peer conflicts on Vercel. If you later align peer deps, revert to `npm ci`/`npm install`.
- Root directory should be the repo root. Vercel will run installs at the repo root and treat `api/` as serverless while serving the static output from `dist/public`.
- The Vite build uses the repo-level `vite.config.ts`, which already outputs to `dist/public`. If you customize `outDir`, update `outputDirectory` and the SPA catch-all route to match.
- Express handlers live under `api/` (e.g., `api/index.ts`, `api/health.ts`); each file exports a handler as a serverless function.

## 3. Environment Variables
- Configure env vars in **Vercel Project Settings → Environment Variables**.
- Provide values for both **Preview** and **Production** scopes when appropriate (e.g., `API_BASE_URL`, `DATABASE_URL`, `THIRD_PARTY_KEY`). PR previews automatically pick Preview values; `main` uses Production values.
- For multi-variant setups that use separate Vercel projects, keep env vars isolated per project to prevent cross-talk (e.g., use distinct API keys, domains, and feature flags).
- Frontend variables that should be exposed to the browser must be prefixed with `VITE_` and read via `import.meta.env.VITE_*`.
- Backend/serverless code reads from `process.env.*`. Avoid referencing secret vars in client code without a `VITE_` prefix; otherwise, they remain undefined in the browser.

## 4. Local Workflow
```bash
# Install dependencies
npm install

# Run dev servers (two terminals)
npm run dev:client             # Vite dev server (defaults to http://localhost:5173)
npm run dev                    # Express dev server (defaults to http://localhost:5000)

# Validate production build locally
npm run build                  # Generates dist/public with Vite
npm run lint && npm test        # Optional: run repo checks before pushing
```
Adjust the Express dev command to your preferred runner if needed (e.g., `nodemon server/index.ts`).

## 5. Common Pitfalls & Fixes
- **API routes return 404**: Ensure routes are under `api/` with file-based endpoints (e.g., `api/users.ts`). Confirm `routes` in `vercel.json` include `{ "src": "/api/(.*)", "dest": "/api/$1" }` so API requests bypass the static frontend.
- **Vite assets not loading in production**: Verify `client` build output folder matches `distDir` (`dist`). If using a custom base path, set `base` in `vite.config.ts` accordingly.
- **Environment variables missing in preview**: Add Preview-scope values in Vercel settings. Client vars must be prefixed with `VITE_`; serverless vars are read via `process.env`.
- **Mismatch between local and Vercel Node version**: Align local Node version with Vercel runtime (Node 20.x). Set `engines.node` in `package.json` if needed and match it in Vercel Project Settings → General → Node.js Version; otherwise Vercel will honor `engines` and ignore the project setting. This repo pins Node 20.x to match a Vercel project set to 20.x—keep both in sync to avoid warnings.
- **Unexpected rebuilds or missing lockfile**: Commit `package-lock.json`/`pnpm-lock.yaml` to keep installs reproducible across previews and production builds.
- **`npm install` fails with ERESOLVE on Vercel**: Ensure the Node.js version matches what the lockfile was created with (see above). If peer conflicts persist (e.g., React 19 with libraries that still declare React 18 peers), use the `installCommand` above with `--legacy-peer-deps` or fix peer ranges locally and regenerate the lockfile. Keep the Vercel install command in sync with how you install locally.
- **Multiple variants share a repo**: If you spin up separate Vercel projects (e.g., "app-enterprise" and "app-standard"), ensure each has its own domain, environment variables, and `vercel.json` overrides as needed. Keep build outputs distinct by using the project’s Root Directory setting.

## 6. Optional CI/CD Guardrails (GitHub Actions)
Use Vercel for deployment and add a minimal CI workflow to keep previews and production healthy.

### Workflow file (`.github/workflows/ci.yml`)
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

### How it integrates with Vercel
- Connect the repo to Vercel with GitHub App integration. Set the project Root Directory to `/`.
- In Vercel Project Settings → Git, mark the **CI** workflow as a required status check for `main`. Vercel waits for required checks before promoting a deployment.
- When a PR opens, GitHub Actions runs `CI` and Vercel builds a Preview. If tests fail, the status check blocks merge; if tests pass, merging to `main` triggers Vercel Production deployment.

### Secrets and env handling in CI
- Add any needed secrets (e.g., private registry tokens) to GitHub repo secrets; keep application secrets in Vercel envs. Tests that need runtime secrets should use GitHub **Actions secrets**, while browser-exposed vars must still be prefixed with `VITE_` and injected via `.env` files or Vercel env scopes.

## Quick Start for New Contributors
1. Fork/clone, run `npm install` at root.
2. Create feature branch, develop locally with `npm run dev:client` (frontend) and `npm run dev` (Express API).
3. Open a PR: Vercel posts a preview URL. Test there with Preview env vars.
4. Merge to `main`: Vercel automatically promotes to production with Production env vars.

## 7. Dependency Layout: Shared vs. Separate `package.json`
- **Keep a shared root `package.json`** when you only deploy the Express + Vite stack. It keeps install times shorter, avoids duplicated tools (linters, test runners), and matches the `vercel.json` here which assumes root-level scripts.
- **Split dependencies per app (recommended when Vite and Next variants coexist)**:
  - Use npm workspaces (or pnpm/yarn workspaces) with `package.json` files under `client/` (Vite) and `next/` (Next) so each can pin its own React and framework versions without peer conflicts.
  - Keep a minimal root `package.json` for shared dev tooling and the workspace definition; commit a single top-level lockfile.
  - In Vercel, create separate projects per variant and set each project’s **Root Directory** to the matching workspace. Use per-project `installCommand`/`buildCommand` so Vercel installs only that workspace’s deps.
  - Pros: fewer peer conflicts (e.g., React 19 in Vite vs React 18 in Next), smaller install/build surface per deployment, clearer ownership of framework-specific deps.
  - Trade-off: duplicated scripts between apps and the need to keep workspace metadata aligned (e.g., `npm install --workspaces`), but it’s usually worth it once two frameworks ship side by side.
