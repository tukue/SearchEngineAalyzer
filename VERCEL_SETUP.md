# Vercel Deployment Setup

## Required Secrets in GitHub

Add these secrets to your GitHub repository settings:

### 1. Get Vercel Token
```bash
npx vercel login
npx vercel --token
```

### 2. Get Project IDs
```bash
npx vercel link
cat .vercel/project.json
```

### 3. Add GitHub Secrets
Go to: `Settings > Secrets and variables > Actions`

Add:
- `VERCEL_TOKEN` - Your Vercel token
- `VERCEL_ORG_ID` - Your organization ID
- `VERCEL_PROJECT_ID` - Your project ID

## Deployment mode used in this repo
This repository deploys as:
- **Frontend:** static Vite build (`npm run build:client`) published from `dist/public`.
- **Backend:** Vercel serverless API handlers under `api/`.

This keeps production serving compiled UI assets (not source files) while preserving `/api/*` routes.

## Environment variables
- `VITE_*` variables are exposed to the frontend build (for example, `VITE_API_BASE_URL`).
- Server-only secrets must be regular env vars consumed from `process.env` by `api/` handlers.

## Verification checklist (local + Vercel)
- Node version: **20.x**.
- Install step: `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund`.
- Build step: `npm run build:client`.
- Expected frontend output path: `dist/public`.
- API handlers live under `api/` and are pinned in `vercel.json` to `@vercel/node@5.5.19`.

## Manual Deployment
```bash
npx vercel --prod
```

## Next Steps
1. In Vercel Project Settings, keep Node.js version on **20.x** (the repo `engines.node` is `20.x`).
2. Configure GitHub secrets.
3. Trigger CI/CD pipeline.
4. Verify:
   - `/` serves built frontend UI.
   - `/api/health` returns JSON.


## Docker runtime note
- The Docker image serves `dist/public` with nginx and includes SPA fallback via `nginx.conf` (`try_files $uri $uri/ /index.html;`).
