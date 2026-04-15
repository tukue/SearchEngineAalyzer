# Testing the 405 Fix

This guide explains how to verify that the 405 error fix is working correctly.

## What Was Fixed

The 405 (Method Not Allowed) error was occurring because:
- The `next.config.js` had a rewrite rule that forwarded ALL `/api/*` requests to an external API server
- This rewrite bypassed the local Next.js route handlers for `/api/analyze` and `/api/health`
- The external API only accepted GET requests, causing POST requests to fail with 405

**The Fix:** Updated `next.config.js` to use `beforeFiles` rewrites to explicitly exclude local API routes from being rewritten. This ensures POST requests to `/api/analyze` are handled by the local Next.js handler.

## Quick Test (Automated)

### Run the E2E Test Script

```bash
# Start your Next.js dev server in one terminal
npm run dev

# In another terminal, run the test
node test-analyze-405-fix.js
```

**What to expect:**
- ✓ All tests pass with green checkmarks
- ✓ No 405 errors appear
- ✓ Analysis results show meta tag counts and health scores

**If it fails:**
- If you see `405 Method Not Allowed` → The fix isn't working, check next.config.js
- If you see `ECONNREFUSED` → The dev server isn't running on port 3000

### Run Jest Integration Tests

```bash
# Run the integration tests for API rewrites
npm test -- --testPathPattern="api-rewrites|405-fix"
```

## Manual Testing in Browser

### 1. Navigate to the Analyze Page

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000/analyze in your browser
3. You should see a form asking for a website URL

### 2. Analyze a Real Website

1. Enter a URL in the input field (e.g., `example.com` or `https://vercel.com`)
2. Click the "Analyze" button
3. **Expected behavior:**
   - Loading spinner appears
   - After 2-5 seconds, you see the analysis results
   - Results show meta tag counts, health score, and recommendations
   - NO error message

### 3. Try Different URLs

Test with:
- `https://example.com` - Simple website
- `https://github.com` - Complex website with lots of meta tags
- `https://vercel.com` - Modern SPA with social meta tags
- `example.com` (without https://) - Should auto-add https://

### 4. What Success Looks Like

```
✓ Audit ready for https://example.com
  - Health score: 85%
  - SEO tags: 5
  - Social tags: 3
  - Technical tags: 4
  - Missing essentials: 2
```

### 5. What Failure Looks Like (405 Bug)

If you see an error message like:
```
API request failed with status 405
```

This means:
- The local Next.js handler isn't being used
- The request is being forwarded to the external API
- The fix needs to be checked/reapplied

## Testing Different Scenarios

### Scenario 1: Valid Public Website
- Input: `https://github.com`
- Expected: ✓ Analysis succeeds with full results

### Scenario 2: Invalid URL
- Input: `not a real url!!!`
- Expected: ✓ Form validation error (doesn't submit)

### Scenario 3: Unreachable Domain
- Input: `https://this-domain-definitely-does-not-exist-12345.com`
- Expected: ✓ HTTP 400 error with message "Failed to fetch website"

### Scenario 4: Rapid Fire Requests
- Input: Click "Analyze" multiple times quickly
- Expected: ✓ Previous requests cancel, only latest processes

### Scenario 5: Large Website
- Input: `https://en.wikipedia.org`
- Expected: ✓ Completes in 5-10 seconds

## Debugging Tips

### If Tests Fail with 405 Error:

1. Check `next.config.js`:
```javascript
// Should have beforeFiles array that includes:
beforeFiles: [
  {
    source: "/api/analyze",
    destination: "/api/analyze",
  },
  {
    source: "/api/health",
    destination: "/api/health",
  },
]
```

2. Verify the route handler exists:
```bash
ls -la next/app/api/analyze/route.ts
```

3. Check if environment variables are set:
```bash
echo $API_BASE_URL
echo $NEXT_MIGRATED_API_ENDPOINTS
```

### If Tests Fail with Network Error:

1. Make sure dev server is running:
```bash
npm run dev
```

2. Check if it's listening on port 3000:
```bash
lsof -i :3000
```

3. Try accessing health endpoint directly:
```bash
curl -X GET http://localhost:3000/api/health
```

### If Browser Shows Loading Forever:

1. Check browser console (F12 → Console tab)
2. Look for network errors in Network tab
3. Check server logs for errors
4. Try analyzing a simpler URL

## Performance Expectations

- Simple websites (< 100 KB): 1-2 seconds
- Medium websites (100 KB - 1 MB): 2-5 seconds
- Large websites (> 1 MB): 5-10 seconds
- Timeout after 10 seconds

## Files Changed for This Fix

1. **next/next.config.js** - Updated rewrite configuration
2. **test-analyze-405-fix.js** - New end-to-end test script
3. **__tests__/integration/api-rewrites.integration.test.ts** - Integration tests
4. **__tests__/integration/405-fix-verification.integration.test.ts** - Verification tests

## Next Steps

After confirming the fix works:

1. ✓ Run all tests: `npm test`
2. ✓ Build the project: `npm run build`
3. ✓ Deploy to production when ready
4. ✓ Monitor for any 405 errors in production logs

## Questions?

If something isn't working:
1. Check the console/server logs
2. Run the E2E test script
3. Try the manual browser test
4. Check that next.config.js has the beforeFiles rewrite configuration
