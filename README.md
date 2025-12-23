# Meta Tag Analyzer

Meta Tag Analyzer is a web application that analyzes and validates meta tags from any website. It provides actionable recommendations to improve SEO, social media sharing, and technical metadata.

## Features

- **Meta Tag Analysis**: Analyze meta tags from any website and categorize them into SEO, Social, and Technical tags.
- **Recommendations**: Get actionable recommendations to improve your meta tags.
- **Search History**: View and manage your recent analyses.
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.


## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v8 or higher)

### Environment configuration

Authentication is required for write APIs. Set the following variables when running locally:

- **API_AUTH_TOKEN** (server): required bearer token value accepted by the API. Example: `API_AUTH_TOKEN=dev-token-123`.
- **VITE_API_TOKEN** (client): token the frontend sends in the `Authorization` header. This must match `API_AUTH_TOKEN` (or an entry in `API_AUTH_TOKENS` if using multiple tokens).
- **API_BASE_URL** (Next.js): base URL for rewrites to the API; defaults to `http://localhost:5000` and only needs to be set when proxying to a hosted backend.
- **NEXT_MIGRATED_API_ENDPOINTS** (Next.js): optional comma-separated list limiting which migrated handlers stay on Next.js. Leave empty to run all migrated endpoints there; include `history` (and other features) when their routes move to `app/api`.

For automated tests, `TEST_API_TOKEN` can be set; otherwise a `test-token` default is used while `NODE_ENV=test`.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/tukue/SearchEngineAalyzer.git
   cd SearchEngineAalyzer
   ```

### Installing dependencies

Run dependencies installation with scripts disabled for faster CI:

```bash
npm ci --ignore-scripts
```

If the registry responds with **403 Forbidden** (common in restricted environments), set an auth token and retry:

```bash
export NPM_TOKEN="<npm-registry-token>"
npm ci --ignore-scripts --registry=https://registry.npmjs.org
```

The repository includes a `.npmrc` that uses `NPM_TOKEN` automatically so CI systems can inject credentials without modifying commands.

## Next.js API migration

- The analyze API is now implemented under `next/app/api/analyze/route.ts`, reusing the existing meta-tag analysis logic and shared storage. This handler mirrors `POST /api/analyze` so traffic can be routed to the Next.js runtime once parity is confirmed.
- Use `NEXT_MIGRATED_API_ENDPOINTS` (comma-separated, case-insensitive) to control which handlers run via Next.js. By default Next.js serves every migrated endpoint; omit an endpoint from the list to fall back to the Express implementation in `server/routes.ts` during the transition.
- The health check now also runs at `next/app/api/health/route.ts` behind the same migration flag so probes can target the Next.js runtime without bypassing the toggle list.
- A beta `/analyze` page in the app router exercises the migrated handler end-to-end, showing loading/error states and the returned health score so parity checks can happen in the Next.js UI.
- Additional Express routes (plan, quota, history, export) should be migrated incrementally to `app/api/<route>/route.ts` and added to `NEXT_MIGRATED_API_ENDPOINTS` before fully retiring the Express server. When migrating the search history feature, list its endpoints in `NEXT_MIGRATED_API_ENDPOINTS` so they stay on the Next.js runtime.
- Running `npm run build` at the repo root now invokes the Next workspace (`next/package.json`), so `rm -rf next/.next && npm run build` mirrors Vercel's pipeline and ensures the Next-only stack is what's deployed.

## Deployment

- Vercel now builds the Next.js app (`next/package.json`) directly by targeting the `next` directory (see `vercel.json`), so deploying to Vercel triggers `npm run build` from that folder and serves the new `app` router.
- Before pointing production traffic to Vercel's Next.js deployment, confirm parity on each API route and include them in `NEXT_MIGRATED_API_ENDPOINTS`. Leaving the list empty keeps every migrated endpoint on Next.js; remove an entry (e.g., `plan`) to fall back to the Express server while the rest continue to run in Next.js.
- After parity is confirmed and all needed endpoints run on Next.js, remove the Express service from the Vercel deployment, keep the `NEXT_MIGRATED_API_ENDPOINTS` env listing all endpoints, and rely on the `next/app/api` handlers for both UI and API traffic.

## GitHub + Vercel CI/CD (Next.js + Express as serverless)

This repository now ships as a single Vercel project: the Next.js app lives in `/next` and the Express API is exposed as serverless functions from `/api/index.ts` (powered by the shared `server/` code). The setup favors an MVP that can scale without changing hosts.

### A) Recommended repo structure

- `/next` — Next.js app (UI and any app router API routes)
- `/server` — Express logic shared by both local dev and the Vercel function
- `/api/index.ts` — Serverless entry point that wraps the Express app for Vercel
- `/shared` — shared DTOs/schemas (used by both UI and API)

Minimal refactor applied: `server/app.ts` builds the Express app without binding to a port so it can run inside a Vercel function; local dev still uses `server/index.ts` to listen on `PORT`.

### B) Vercel configuration

- `vercel.json` (checked in):

  ```json
  {
    "version": 2,
    "functions": {
      "api/index.ts": {
        "runtime": "nodejs20.x",
        "maxDuration": 10,
        "memory": 1024,
        "includeFiles": ["server/**", "shared/**"]
      }
    },
    "installCommand": "npm ci --legacy-peer-deps",
    "buildCommand": "npm run build",
    "outputDirectory": "next/.next",
    "routes": [
      { "src": "/api/(.*)", "dest": "api/index.ts" },
      { "src": "/(.*)", "dest": "next/$1" }
    ]
  }
  ```

- Vercel project settings:
  - **Root Directory:** repository root (Vercel will find `vercel.json`)
  - **Install Command:** `npm ci --legacy-peer-deps`
  - **Build Command:** `npm run build`
  - **Output Directory:** `next/.next`
  - **Node version:** inherited from `"engines.node": "20.x"` in `package.json`
- GitHub ↔︎ Vercel Git integration yields previews for every PR and production deploys on merges to `main`. No extra Vercel action is required.

### C) GitHub Actions

Workflow: `.github/workflows/ci.yml`

- Enforces Node 20 via `actions/setup-node`
- Uses npm cache for both root and `next/package-lock.json`
- Steps: `npm ci --legacy-peer-deps` → `npm run lint` → `npm run typecheck` → `npm test -- --runInBand` → `npm run build`
- Required checks to protect `main`: `CI / quality-checks`

### D) Environment variables plan

Set these in Vercel **Environment Variables**:

| Variable | Preview | Production | Notes |
| --- | --- | --- | --- |
| `API_AUTH_TOKEN` | value for PR testing | production secret | backend bearer token accepted by Express routes |
| `NEXT_PUBLIC_API_BASE_URL` | auto (Vercel preview URL) or explicit | production domain | public; do **not** reuse private secrets |
| `DATABASE_URL` | staging/preview DB | production DB | server-only |
| `CORS_ALLOWED_ORIGINS` | `https://preview-url.vercel.app` (comma-separated) | production domain(s) | leave empty to mirror request origin for testing |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | optional overrides | tuned for prod | server-only |
| `NEXT_MIGRATED_API_ENDPOINTS` | optional | optional | keep empty to serve API from Express serverless handler |
| `API_BASE_URL` | optional override | optional override | used if the UI proxies to an external API |

`NEXT_PUBLIC_*` values are bundled into the client—never place secrets there. All other values stay server-side for both builds and runtime.

### E) Verification commands (local)

```bash
# Install once (matches CI/Vercel)
npm ci --legacy-peer-deps

# Quality gates
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build

# Run locally (Express on port 5000)
npm run dev

# Curl smoke tests (after running dev server or against Vercel preview)
curl -i http://localhost:5000/api/health
curl -i -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_AUTH_TOKEN" \
  -d '{"url":"https://example.com","requestId":"cli-smoke"}'
```

### F) Common failures & fixes

- **npm ERESOLVE/403:** use `npm ci --legacy-peer-deps` and, if needed, configure `NPM_TOKEN` for the registry (see "Installing dependencies" above).
- **Missing env vars at build time:** Vercel previews inherit dashboard variables; ensure required keys are present before opening PRs so previews build successfully.
- **Wrong root/build command:** match the values above; a missing `outputDirectory` leads to blank deployments.
- **API 404s:** confirm `/api/index.ts` exists in the deployment output and routes include `/api/(.*)` → `api/index.ts`.
- **Serverless cold start/timeouts:** keep requests idempotent and under 10 seconds; adjust `maxDuration` in `vercel.json` if needed.
- **CORS errors:** set `CORS_ALLOWED_ORIGINS` to the deployed frontend origin(s); defaults mirror the request origin for local dev.

### Final checklist

- [ ] PR creates a Vercel preview (GitHub ↔︎ Vercel integration enabled)
- [ ] `CI / quality-checks` required on PRs and `main`
- [ ] Secrets configured for Preview + Production in Vercel
- [ ] `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, and `npm run build` all pass locally
- [ ] `/api/health` and `/api/analyze` respond from preview and production URLs
