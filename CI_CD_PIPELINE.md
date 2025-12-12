# CI/CD Pipeline Documentation

## Overview
Updated CI/CD pipeline for Meta Tag Analyzer with MVP measurements integration, comprehensive testing, and automated deployment validation.

## Pipeline Structure

### 1. Continuous Integration (ci.yml)
**Triggers**: Push/PR to main, master, develop branches

**Jobs**:
- **Environment Setup**: Node.js 20.x, npm cache
- **Dependency Installation**: `npm ci`
- **Code Quality**: Linting (if present)
- **Unit Testing**: MVP measurement engine tests
- **Integration Testing**: MVP measurements integration
- **Build Validation**: Full application build
- **Deployment Validation**: MVP features verification
- **E2E Testing**: End-to-end audit flow
- **Smoke Testing**: Production server validation

### 2. MVP Measurements Validation (mvp-validation.yml)
**Triggers**: Changes to measurement engine, tests, API, or schema

**Jobs**:
#### MVP Validation:
- Measurement engine existence check
- MVP unit tests execution
- MVP integration tests
- E2E MVP tests
- Build with MVP measurements
- Deployment readiness validation
- Live MVP calculations test
- API integration verification
- Schema updates validation

#### Performance Check:
- Performance benchmarking (100 iterations)
- Average calculation time validation
- Performance thresholds enforcement (<50ms acceptable, >200ms fails)

### 3. Production Deployment (deploy.yml)
**Triggers**: Manual workflow dispatch with approval

**Jobs**:
#### Input Validation:
- Approver authorization check
- Timeout validation (5-240 minutes)
- Git reference validation (main/release branches only)

#### CI Status Verification:
- Ensures green CI status on target branch
- Validates latest workflow run success

#### Quality Checks:
- Full test suite execution
- MVP measurements validation
- Build verification
- Deployment readiness check

#### Agentic Review:
- Type checking
- MVP measurements validation
- Security audit (moderate level)

#### Manual Approval:
- Human approval requirement
- Configurable approvers list
- Timeout-based cancellation

#### Production Deployment:
- Final validation checks
- Production build
- Vercel deployment with production flag

## Test Strategy

### Unit Tests (`npm run test:unit`)
```bash
# Tests individual measurement calculators
jest server/__tests__/measurementEngine.test.ts
```

**Coverage**:
- `MetaTagFinder` functionality
- `SeoVisibilityCalculator` scoring
- `PrioritizedHealthCalculator` weighting
- `SharePreviewCalculator` social media assessment
- Error handling and edge cases

### MVP Integration Tests (`npm run test:mvp`)
```bash
# Tests MVP measurements integration
jest server/__tests__/mvp-measurements.integration.test.ts
```

**Coverage**:
- End-to-end measurement calculations
- HTML parsing with real content
- Score validation and ranges
- Edge cases (empty HTML, malformed content)

### E2E Tests (`npm run test:e2e`)
```bash
# Tests complete audit workflow
jest server/__tests__/audit-mvp.e2e.test.ts
```

**Coverage**:
- Full audit service workflow
- MVP measurements in audit results
- Storage integration
- Error scenarios and recovery

### Performance Tests
```bash
# Automated performance benchmarking
node performance-benchmark.js
```

**Metrics**:
- Calculation time per MVP measurement
- Memory usage validation
- Throughput testing (100+ iterations)

## Deployment Validation

### Pre-Deployment Checks
```bash
node validate-deployment.js
```

**Validation Points**:
- ✅ vercel.json configuration
- ✅ API endpoints implementation
- ✅ MVP measurement engine presence
- ✅ Build outputs generation
- ✅ Schema field definitions
- ✅ Package.json scripts

### Build Process Validation
```bash
npm run build
```

**Build Outputs**:
- Client bundle: `dist/client/` (optimized assets)
- Server bundle: `dist/index.js` (serverless function)
- API functions: Compiled TypeScript to JavaScript

### Security Validation
```bash
npm audit --audit-level=moderate
```

**Security Checks**:
- Dependency vulnerability scanning
- Moderate+ severity threshold
- Automated security updates integration

## Environment Configuration

### Required Secrets
```yaml
# Vercel deployment
VERCEL_TOKEN: "vercel_xxx"
VERCEL_ORG_ID: "team_xxx" 
VERCEL_PROJECT_ID: "prj_xxx"

# Approval system
VERCEL_PROD_APPROVERS: "tukue,admin"
```

### Environment Variables
```yaml
# Automatic (Vercel)
VERCEL: "1"
VERCEL_ENV: "production"
NODE_ENV: "production"

# Custom (optional)
DEBUG_MODE: "false"
LOG_LEVEL: "info"
```

## Workflow Triggers

### Automatic Triggers
- **CI**: Every push/PR to main branches
- **MVP Validation**: Changes to measurement files
- **Security**: Daily dependency scans

### Manual Triggers
- **Production Deploy**: Workflow dispatch with approval
- **Hotfix Deploy**: Emergency deployment process
- **Rollback**: Previous version promotion

## Quality Gates

### CI Quality Gates
1. ✅ All tests pass (unit, integration, E2E)
2. ✅ Build completes successfully
3. ✅ MVP measurements validate correctly
4. ✅ No high-severity security issues
5. ✅ Performance benchmarks meet thresholds

### Deployment Quality Gates
1. ✅ CI status green on target branch
2. ✅ Manual approval from authorized users
3. ✅ Final validation checks pass
4. ✅ No blocking security vulnerabilities
5. ✅ MVP features fully integrated

## Monitoring & Alerting

### Build Monitoring
- GitHub Actions status badges
- Slack/email notifications on failures
- Performance regression detection

### Deployment Monitoring
- Vercel deployment status tracking
- Post-deployment health checks
- Rollback triggers on failures

### MVP Measurements Monitoring
- Calculation performance tracking
- Error rate monitoring
- Feature usage analytics

## Rollback Strategy

### Automatic Rollback
```yaml
# Triggered on deployment failures
- Health check failures (>5% error rate)
- Performance degradation (>2s response time)
- Critical security vulnerabilities
```

### Manual Rollback
```bash
# Promote previous deployment
vercel promote [previous-deployment-url]

# Or redeploy previous commit
git revert [commit-hash]
vercel --prod
```

## Performance Benchmarks

### MVP Measurements Performance
- **Target**: <50ms per calculation
- **Warning**: 50-200ms per calculation  
- **Failure**: >200ms per calculation

### Build Performance
- **Client Bundle**: <1MB (gzipped <300KB)
- **Server Bundle**: <100KB
- **Build Time**: <60 seconds

### Deployment Performance
- **Cold Start**: <2 seconds
- **Warm Request**: <500ms
- **Deployment Time**: <5 minutes

## Troubleshooting

### Common CI Failures
1. **Test Failures**: Check MVP measurement logic
2. **Build Failures**: Verify TypeScript compilation
3. **Validation Failures**: Ensure all files present

### Common Deployment Failures
1. **Approval Timeout**: Extend timeout or notify approvers
2. **Vercel Errors**: Check secrets and project configuration
3. **Performance Issues**: Review bundle size and optimization

### MVP-Specific Issues
1. **Calculation Errors**: Validate input data structure
2. **Performance Degradation**: Profile measurement algorithms
3. **Integration Failures**: Check API endpoint integration

## Success Metrics

### CI Success Criteria
- ✅ 100% test pass rate
- ✅ Build completion <60 seconds
- ✅ Zero high-severity security issues
- ✅ MVP performance <50ms average

### Deployment Success Criteria
- ✅ Zero-downtime deployments
- ✅ <5 minute deployment time
- ✅ Successful health checks post-deployment
- ✅ MVP measurements functioning correctly

### Quality Metrics
- ✅ Code coverage >80%
- ✅ Performance regression <10%
- ✅ Security vulnerability resolution <24h
- ✅ Feature delivery velocity maintained