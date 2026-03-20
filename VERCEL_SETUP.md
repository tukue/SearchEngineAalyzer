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
- Install step: `npm install --legacy-peer-deps`.
- Build step: `npm run build:client`.
- Expected frontend output path: `dist/public`.
- API handlers live under `api/` and are configured to run on `nodejs20.x` in `vercel.json`.

## Manual Deployment
```bash
npx vercel --prod
```

## Next Steps
1. Configure GitHub secrets.
2. Trigger CI/CD pipeline.
3. Verify:
   - `/` serves built frontend UI.
   - `/api/health` returns JSON.
