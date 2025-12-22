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
- `API_BASE_URL` - API origin used by Next.js rewrites; set under `Project Settings > Environment Variables` in the Vercel dashboard (or via `.vercel/env.*`).
- `NEXT_MIGRATED_API_ENDPOINTS` - Optional comma-separated list of migrated endpoints that should keep running on Next.js (e.g., include `history` once the search history routes are moved to `app/api`).

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
