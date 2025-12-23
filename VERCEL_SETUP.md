# Vercel Deployment Setup

## Required Secrets in GitHub
Add these secrets to your GitHub repository settings:

1) **Get Vercel Token**
```bash
npx vercel login
npx vercel --token
```

2) **Get Project IDs** (run in each project root: repo root for Express+Vite, `next/` for Next.js)
```bash
npx vercel link
cat .vercel/project.json
```

3) **Add GitHub Secrets**
Go to: `Settings > Secrets and variables > Actions`

Add:
- `VERCEL_TOKEN` - Your Vercel token
- `VERCEL_ORG_ID` - Your organization ID
- `VERCEL_PROJECT_ID` - Project ID for the Express + Vite deployment
- `VERCEL_PROJECT_ID_NEXT` - Project ID for the Next.js deployment (if using the Next variant)

## Environment variables
- Express + Vite: `API_BASE_URL` and other server secrets via `process.env`; client vars prefixed with `VITE_`.
- Next.js: use `NEXT_PUBLIC_*` for browser-exposed values; server vars stay unprefixed and are read via `process.env` in route handlers.
- Configure Preview and Production scopes separately in each Vercel project.

## Verification checklist (local + Vercel)
- Node version: **20.x** everywhere. Vercel honors `engines.node` in `package.json`; keep Project Settings Node at 20.x to avoid warnings.
- Install step: `npm install --legacy-peer-deps` at the repo root for Express + Vite, and `npm install --legacy-peer-deps` inside `next/` for the Next.js project.
- Build step: `npm run build` (root) and `(cd next && npm run build)`.
- Outputs: `dist/public` for Vite; `.next` handled automatically by Vercel.
- `.vercelignore` should keep source and config files (`client/`, `server/`, `shared/`, `vite.config.ts`, lockfiles) so Vercel can build; only tests/logs/caches are ignored in the current file.
- Clean-room check: `rm -rf node_modules && npm install --legacy-peer-deps && npm run build` (repeat inside `next/`).

## Manual Deployment
```bash
# Express + Vite
npx vercel --prod

# Next.js (from the next/ directory)
cd next
npx vercel --prod
```

## Status
- ✅ Vercel configuration split for Express/Vite vs Next.js
- ✅ Source code protection added
- ✅ CI/CD pipeline updated
- ⏳ Secrets need to be configured per project

## Next Steps
1. Configure GitHub secrets
2. Link both Vercel projects (`vercel link` in root and `next/`)
3. Trigger CI/CD pipelines and verify preview + production URLs for both apps
