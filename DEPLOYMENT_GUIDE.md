# 405 Error Fix - Deployment Guide

## Overview
This guide walks you through deploying the 405 error fix to production via GitHub and Vercel.

## What Was Fixed
- **Issue**: POST requests to `/api/analyze` were returning 405 Method Not Allowed errors
- **Root Cause**: Next.js `next.config.js` was rewriting all `/api/*` requests to an external API, bypassing local route handlers
- **Solution**: Updated rewrites configuration to use `beforeFiles` to keep local handlers from being rewritten

## Files Modified
1. **next/next.config.js** - Fixed API route rewrite configuration
2. **test-api.js** - Enhanced with 405 error detection
3. **test-analyze-405-fix.js** - New end-to-end test with real websites
4. **TESTING_405_FIX.md** - Testing guide and scenarios
5. **__tests__/integration/405-fix-verification.integration.test.ts** - Integration tests
6. **__tests__/integration/api-rewrites.integration.test.ts** - API rewrite tests

## Option 1: Push to GitHub via Command Line

### Step 1: Make sure you're on the correct branch
```bash
git status
# Should show branch: website-error-405
```

### Step 2: Add and commit changes
```bash
git add -A
git commit -m "fix: resolve 405 error on analyze endpoint by fixing API route rewrites

- Modified next.config.js to use beforeFiles rewrites
- Local Next.js route handlers now take precedence
- Added comprehensive test suites
- Created end-to-end test script for real website testing"
```

### Step 3: Push to GitHub
```bash
git push origin website-error-405
```

### Step 4: Create a Pull Request
1. Go to: https://github.com/tukue/SearchEngineAnalyzer
2. Click "Compare & pull request"
3. Add description of the fix
4. Merge into `main` branch

## Option 2: Use the Deploy Script

```bash
# Make the script executable
chmod +x deploy.sh

# Run the script
./deploy.sh
```

This will automatically:
- Commit all changes with a descriptive message
- Push to your current branch (website-error-405)
- Show you the next steps

## Option 3: Deploy Directly via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your "SearchEngineAnalyzer" project
3. Go to the "Deployments" tab
4. Click "Deploy" for the latest commit
5. Or connect the GitHub branch to auto-deploy on push

## Verification After Deployment

### 1. Test in Production
```bash
# Test the analyze endpoint
curl -X POST https://your-vercel-deployment.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Expected response: 200 OK (not 405)

### 2. Manual Testing in Browser
1. Go to https://your-vercel-deployment.vercel.app/analyze
2. Enter a website URL (e.g., `github.com`)
3. Click "Analyze"
4. Should see results without 405 error

### 3. Run Test Suite
After deployment, run tests to verify:
```bash
npm test -- --testPathPattern="405-fix|api-rewrites"
```

## Rollback Plan

If issues occur after deployment:

1. **Check Vercel Logs**:
   - Go to Vercel dashboard → Deployments
   - Click on the deployment and check "Functions" logs
   - Look for 405 or rewrite errors

2. **Quick Rollback**:
   ```bash
   git revert <commit-hash>
   git push origin website-error-405
   # Redeploy from Vercel dashboard
   ```

3. **Alternative**: Deploy the previous working commit from Vercel dashboard

## Deployment Checklist

- [ ] All changes committed to `website-error-405` branch
- [ ] Branch pushed to GitHub
- [ ] Pull request created (if using PR workflow)
- [ ] Vercel deployment started
- [ ] Deployment is building (check Vercel dashboard)
- [ ] Deployment completed successfully
- [ ] Test endpoint returns 200 (not 405)
- [ ] Manual browser test passes
- [ ] Integration tests pass (if run post-deployment)

## Questions or Issues?

1. Check the browser console for errors (F12)
2. Check Vercel deployment logs
3. Run local tests: `npm test`
4. Review the fix in `next/next.config.js`

## Success Indicators

✅ Analyze button works without 405 error
✅ Website analysis returns valid results
✅ No rewrite-related errors in logs
✅ All integration tests pass
