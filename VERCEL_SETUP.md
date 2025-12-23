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

## Environment variables
- `API_BASE_URL` - API origin used by the Express functions; set under `Project Settings > Environment Variables` in the Vercel dashboard (or via `.vercel/env.*`).
- Any client-exposed variables must be prefixed with `VITE_` (e.g., `VITE_API_BASE_URL`). Server-only secrets are read via `process.env` in `api/` handlers.

## Verification checklist (local + Vercel)
- Node version: **20.x** (Vercel inherits this from the repo root `package.json` and the Project Settings Node version should match; the build error `Function Runtimes must have a valid version` appears if runtimes are not set to `nodejs20.x` for the `api/**/*.js|ts` handlers).
- Install step: `npm install --legacy-peer-deps` at the repo root (matches the Vercel `installCommand`).
- Build step: `npm run build` (runs the Vite build and emits `dist/public`).
- Expected output path: `dist/public`.
- If a clean-room check is needed, run locally: `rm -rf node_modules && npm install --legacy-peer-deps && npm run build`.

## Manual Deployment
```bash
npx vercel --prod
```

## Status
- ✅ Vercel configuration fixed
- ✅ Source code protection added
- ✅ CI/CD pipeline updated
- ⏳ Secrets need to be configured

## Next Steps
1. Configure GitHub secrets
2. Trigger CI/CD pipeline
3. Verify deployment at Vercel URL
