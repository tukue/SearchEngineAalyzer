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
- `API_AUTH_TOKEN` - Required bearer token accepted by serverless APIs unless `API_AUTH_DISABLED=true`.
- `API_AUTH_TOKENS` - Optional JSON array for multiple tokens (tenantId/userId/role entries).
- `API_AUTH_DISABLED` - Set to `true` to bypass auth during local testing.
- `KV_REST_API_URL` - Vercel KV / Upstash Redis REST endpoint (enables persistent audit status + rate limiting).
- `KV_REST_API_TOKEN` - Vercel KV / Upstash Redis REST token.
- `RATE_LIMIT_MAX_REQUESTS` - Optional max audits per window (default 15).
- `RATE_LIMIT_WINDOW_SECONDS` - Optional rate limit window (default 60s).
- Any client-exposed variables must be prefixed with `VITE_` (e.g., `VITE_API_TOKEN`). Server-only secrets are read via `process.env` in `api/` handlers.

## Verification checklist (local + Vercel)
- Node version: **20.x** (Vercel inherits this from the repo root `package.json` and the Project Settings Node version should match; the build error `Function Runtimes must have a valid version` appears if runtimes are not set to `nodejs20.x` for the `api/**/*.{js,ts}` handlers).
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
