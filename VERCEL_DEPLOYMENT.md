# Vercel Deployment Pipeline

## Overview
This document outlines the complete Vercel deployment pipeline for the Meta Tag Analyzer with MVP measurements integration.

## Pre-Deployment Checklist

### 1. Environment Setup
- ✅ Node.js 20+ installed
- ✅ npm 8+ installed  
- ✅ Vercel CLI installed (`npm i -g vercel`)

### 2. Code Validation
- ✅ All MVP measurements implemented
- ✅ TypeScript compilation successful
- ✅ Tests passing
- ✅ No security vulnerabilities

### 3. Configuration Files
- ✅ `vercel.json` properly configured
- ✅ `api/index.ts` serverless function ready
- ✅ Build scripts updated

## Deployment Pipeline

### Phase 1: Pre-Deployment Validation
```bash
# Run comprehensive pre-deployment checks
node scripts/pre-deploy.js
```

**Validation Steps:**
1. Environment check (Node.js, npm versions)
2. Dependencies installation (`npm ci`)
3. TypeScript compilation (`npm run build`)
4. Critical files verification
5. API endpoints validation
6. MVP measurements integration check
7. Schema validation
8. Build output verification
9. Vercel configuration validation
10. Test suite execution
11. Security audit
12. Final summary and deployment readiness

### Phase 2: Build Process
```bash
# Vercel build command (defined in vercel.json)
npm run vercel-build
```

**Build Steps:**
1. Install dependencies with `npm ci`
2. Run TypeScript compilation
3. Build client assets
4. Prepare serverless functions
5. Generate deployment artifacts

### Phase 3: Deployment
```bash
# Deploy to Vercel
vercel --prod
```

## Configuration Files

### vercel.json
```json
{
  "version": 2,
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist/client",
  "installCommand": "npm ci",
  "functions": {
    "api/*.ts": {
      "runtime": "nodejs20.x"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### package.json Scripts
```json
{
  "scripts": {
    "vercel-build": "chmod +x build.sh && ./build.sh",
    "build": "npm run build:client && npm run build:server",
    "build:client": "npx vite build --config vite.config.simple.js",
    "build:server": "npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "pre-deploy": "node scripts/pre-deploy.js"
  }
}
```

## API Endpoints

### Core Endpoints
- `GET /api/health` - Health check
- `POST /api/analyze` - Analyze website meta tags
- `GET /api/audits/:id` - Get audit results
- `GET /api/plan` - Get user plan information

### MVP Measurements Integration
All endpoints now include MVP measurements:
- SEO-Visible at First Byte
- Prioritized Health Score  
- Share Preview Confidence

## Environment Variables

### Required for Production
```bash
# Vercel automatically provides these
VERCEL=1
VERCEL_ENV=production
VERCEL_URL=your-app.vercel.app

# Optional custom variables
NODE_ENV=production
```

## Deployment Commands

### Development Deployment
```bash
# Deploy to preview environment
vercel

# Deploy specific branch
vercel --target preview
```

### Production Deployment
```bash
# Deploy to production
vercel --prod

# Deploy with custom domain
vercel --prod --scope your-team
```

## Monitoring & Validation

### Post-Deployment Checks
1. **Health Check**: `GET https://your-app.vercel.app/api/health`
2. **Functionality Test**: Analyze a sample website
3. **MVP Measurements**: Verify new measurements appear
4. **Performance**: Check response times
5. **Error Handling**: Test invalid inputs

### Sample Test Request
```bash
curl -X POST https://your-app.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-tenant" \
  -H "x-user-id: test-user" \
  -d '{"url": "https://example.com"}'
```

### Expected Response Structure
```json
{
  "analysis": {
    "id": 1,
    "url": "https://example.com",
    "totalCount": 8,
    "seoCount": 4,
    "socialCount": 2,
    "technicalCount": 2,
    "missingCount": 3,
    "healthScore": 75,
    "seoVisibleAtFirstByte": 85,
    "prioritizedHealthScore": 80,
    "sharePreviewConfidence": 65,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "tags": [...],
  "recommendations": [...]
}
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs
vercel logs your-deployment-url

# Local build test
npm run vercel-build
```

#### Function Timeouts
- Vercel functions have 10s timeout on Hobby plan
- Optimize heavy calculations
- Consider caching strategies

#### Memory Limits
- Hobby plan: 1024MB memory limit
- Pro plan: 3008MB memory limit
- Monitor function memory usage

#### Cold Starts
- First request may be slower
- Consider warming functions
- Optimize bundle size

### Debug Commands
```bash
# Check deployment status
vercel ls

# View function logs
vercel logs --follow

# Inspect deployment
vercel inspect your-deployment-url
```

## Performance Optimization

### Bundle Size Optimization
- Use tree shaking
- Minimize dependencies
- Optimize imports

### Function Performance
- Cache calculations where possible
- Use efficient algorithms
- Minimize external API calls

### Client-Side Optimization
- Lazy load components
- Optimize images
- Use CDN for static assets

## Security Considerations

### API Security
- Validate all inputs
- Sanitize HTML content
- Rate limiting (Vercel Edge Config)
- CORS configuration

### Data Protection
- No sensitive data in logs
- Secure headers configuration
- Input validation and sanitization

## Rollback Strategy

### Quick Rollback
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote previous-deployment-url
```

### Gradual Rollout
- Use Vercel's traffic splitting
- Monitor error rates
- Gradual traffic increase

## Success Metrics

### Deployment Success Criteria
- ✅ All API endpoints responding
- ✅ MVP measurements calculating correctly
- ✅ Response times < 2 seconds
- ✅ Error rate < 1%
- ✅ All tests passing

### Monitoring Dashboard
- Function invocations
- Error rates
- Response times
- Memory usage
- Bandwidth usage

## Next Steps

1. **Run Pre-Deployment**: `node scripts/pre-deploy.js`
2. **Deploy to Preview**: `vercel`
3. **Test Functionality**: Validate MVP measurements
4. **Deploy to Production**: `vercel --prod`
5. **Monitor Performance**: Check Vercel dashboard
6. **Validate Success**: Run post-deployment tests