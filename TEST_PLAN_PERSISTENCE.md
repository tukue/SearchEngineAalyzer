# Persistence System Test Plan

## Test Coverage Overview

The persistence system includes comprehensive test coverage across multiple dimensions:

### 1. Unit Tests (`persistence.test.ts`)
- **Tenant Isolation**: Ensures complete data separation between tenants
- **Plan Limits**: Validates free vs pro plan history depth enforcement
- **Pagination**: Tests cursor-based pagination with proper ordering
- **Findings Management**: Verifies creation and retrieval of audit findings

### 2. Integration Tests (`persistence-integration.test.ts`)
- **End-to-End API Testing**: Full request/response cycle validation
- **Project Management**: Create, list, and validate projects
- **Audit Management**: Audit creation and listing with tenant scoping
- **Run Operations**: Complete audit run lifecycle testing
- **Plan Enforcement**: API-level plan limit validation
- **Error Handling**: Invalid inputs and edge cases

### 3. Performance Tests (`persistence-performance.test.ts`)
- **Large Dataset Handling**: 1000+ runs performance validation
- **Query Performance**: Sub-100ms response time requirements
- **Concurrent Operations**: Multi-threaded access patterns
- **Memory Management**: Cleanup without memory leaks
- **High-Frequency Operations**: Stress testing with 50+ concurrent queries

### 4. Security Tests (`persistence-security.test.ts`)
- **Tenant Isolation**: Cross-tenant access prevention
- **ID Security**: UUID usage and enumeration attack prevention
- **Data Validation**: Input sanitization and validation
- **Access Control**: Unauthorized modification prevention
- **Data Integrity**: Referential integrity and concurrent safety

### 5. Cleanup Job Tests (`cleanup-job.test.ts`)
- **Job Lifecycle**: Start/stop functionality
- **Cleanup Execution**: Retention policy enforcement
- **Error Handling**: Graceful failure recovery
- **Signal Handling**: SIGTERM/SIGINT processing
- **Metrics Emission**: Monitoring data generation

## Test Execution Strategy

### Running Tests

```bash
# Run all persistence tests
npm run test:persistence

# Run specific test suites
npx jest server/__tests__/persistence.test.ts
npx jest server/__tests__/persistence-integration.test.ts
npx jest server/__tests__/persistence-performance.test.ts
npx jest server/__tests__/persistence-security.test.ts
npx jest server/__tests__/cleanup-job.test.ts

# Run with coverage
npm run test:coverage
```

### Test Environment Setup

```typescript
beforeEach(() => {
  // Reset persistence service state
  service = new MemoryPersistenceService();
  
  // Clear all data structures
  (service as any).projects.clear();
  (service as any).audits.clear();
  (service as any).auditRuns.clear();
  (service as any).findings.clear();
  
  // Reset ID counters
  (service as any).currentProjectId = 1;
  (service as any).currentAuditId = 1;
  (service as any).currentRunId = 1;
});
```

## Critical Test Scenarios

### 1. Tenant Isolation Validation

```typescript
it('should prevent cross-tenant data access', async () => {
  // Create data for tenant 1
  const t1Project = await service.createProject(1, projectData);
  const t1Run = await service.createRun(1, runData);
  
  // Attempt access as tenant 2
  const result = await service.getRunDetails(2, t1Run.runId);
  expect(result).toBeNull();
  
  // Verify tenant 1 can access their data
  const validResult = await service.getRunDetails(1, t1Run.runId);
  expect(validResult).not.toBeNull();
});
```

### 2. Plan Limit Enforcement

```typescript
it('should enforce free plan history depth', async () => {
  // Create 10 runs (exceeds free plan limit of 5)
  for (let i = 0; i < 10; i++) {
    await service.createRun(1, runData);
  }
  
  // Run cleanup
  const deletedCount = await service.cleanupOldRuns(1, 'free');
  expect(deletedCount).toBe(5);
  
  // Verify only 5 runs remain
  const remainingRuns = await service.getDashboardRuns(1, 10);
  expect(remainingRuns).toHaveLength(5);
});
```

### 3. Performance Validation

```typescript
it('should handle large datasets efficiently', async () => {
  // Create 1000 runs
  const startTime = performance.now();
  for (let i = 0; i < 1000; i++) {
    await service.createRun(1, runData);
  }
  const createTime = performance.now() - startTime;
  
  // Query performance test
  const queryStart = performance.now();
  const results = await service.getDashboardRuns(1, 50);
  const queryTime = performance.now() - queryStart;
  
  expect(results).toHaveLength(50);
  expect(queryTime).toBeLessThan(100); // Sub-100ms requirement
});
```

### 4. Security Validation

```typescript
it('should use secure UUIDs for public IDs', async () => {
  const run = await service.createRun(1, runData);
  
  // Verify UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(uuidRegex.test(run.runId)).toBe(true);
  
  // Verify non-sequential IDs
  const run2 = await service.createRun(1, runData);
  expect(run2.runId).not.toBe(run.runId);
});
```

### 5. API Integration Testing

```typescript
it('should create and retrieve run via API', async () => {
  // Create run via API
  const createResponse = await request(app)
    .post('/api/runs')
    .send(runData);
  
  expect(createResponse.status).toBe(201);
  const runId = createResponse.body.runId;
  
  // Retrieve run details
  const getResponse = await request(app)
    .get(`/api/runs/${runId}`);
  
  expect(getResponse.status).toBe(200);
  expect(getResponse.body.runId).toBe(runId);
});
```

## Test Data Patterns

### Standard Test Data

```typescript
const testProject = {
  name: 'Test Project',
  url: 'https://test.example.com',
  description: 'Test project for integration tests'
};

const testAudit = {
  projectId: 1,
  name: 'SEO Audit',
  type: 'seo',
  config: { checkImages: true }
};

const testRunSummary = {
  scores: { overall: 85, seo: 90, performance: 80, accessibility: 85 },
  counts: { total: 12, critical: 1, high: 3, medium: 5, low: 2, info: 1 },
  metadata: { url: 'https://test.com', loadTime: 1200 }
};

const testFinding = {
  category: 'seo',
  severity: 'high',
  ruleId: 'missing-meta-description',
  title: 'Missing Meta Description',
  message: 'Page is missing a meta description',
  guidance: 'Add a meta description tag',
  impact: 'Reduces click-through rates'
};
```

### Edge Case Data

```typescript
const edgeCases = {
  emptyProject: { name: '', url: 'invalid-url' },
  maxLengthProject: { name: 'x'.repeat(1000), url: 'https://test.com' },
  specialCharacters: { name: '<script>alert("xss")</script>', url: 'https://test.com' },
  unicodeProject: { name: '测试项目', url: 'https://测试.com' }
};
```

## Performance Benchmarks

### Response Time Requirements

| Operation | Target | Acceptable | Test Data Size |
|-----------|--------|------------|----------------|
| Dashboard Query | <50ms | <100ms | 1000 runs |
| Project Runs | <50ms | <100ms | 500 runs |
| Run Details | <25ms | <50ms | 100 findings |
| Run Creation | <100ms | <200ms | 50 findings |
| Cleanup Job | <5s | <10s | 1000 runs |

### Memory Usage Limits

| Operation | Memory Increase | Acceptable |
|-----------|----------------|------------|
| 1000 Run Creation | <50MB | <100MB |
| Dashboard Query | <10MB | <25MB |
| Cleanup Cycle | <5MB | <10MB |

## Error Scenarios

### Expected Failures

```typescript
const errorScenarios = [
  {
    name: 'Invalid tenant ID',
    input: { tenantId: -1 },
    expected: 'Validation error'
  },
  {
    name: 'Non-existent run ID',
    input: { runId: '00000000-0000-0000-0000-000000000000' },
    expected: 'Run not found'
  },
  {
    name: 'Invalid UUID format',
    input: { runId: 'not-a-uuid' },
    expected: 'Invalid format'
  },
  {
    name: 'Cross-tenant access',
    input: { tenantId: 2, runId: 'tenant-1-run-id' },
    expected: 'Not found'
  }
];
```

## Continuous Integration

### Test Pipeline

```yaml
test-persistence:
  runs-on: ubuntu-latest
  steps:
    - name: Run Unit Tests
      run: npx jest server/__tests__/persistence.test.ts
    
    - name: Run Integration Tests
      run: npx jest server/__tests__/persistence-integration.test.ts
    
    - name: Run Performance Tests
      run: npx jest server/__tests__/persistence-performance.test.ts
    
    - name: Run Security Tests
      run: npx jest server/__tests__/persistence-security.test.ts
    
    - name: Generate Coverage Report
      run: npm run test:coverage
    
    - name: Upload Coverage
      uses: codecov/codecov-action@v3
```

### Quality Gates

- **Test Coverage**: Minimum 90% line coverage
- **Performance**: All queries under 100ms with 1000 records
- **Security**: Zero cross-tenant access violations
- **Reliability**: Zero data integrity failures

## Test Maintenance

### Regular Updates

1. **Monthly**: Review performance benchmarks
2. **Quarterly**: Update test data patterns
3. **Release**: Validate all security scenarios
4. **Feature**: Add corresponding test coverage

### Test Data Cleanup

```typescript
afterEach(async () => {
  // Clean up test data
  await service.cleanupOldRuns(1, 'free');
  await service.cleanupOldRuns(2, 'pro');
  
  // Reset service state
  (service as any).projects.clear();
  (service as any).audits.clear();
  (service as any).auditRuns.clear();
});
```

This comprehensive test plan ensures the persistence system is robust, secure, and performant across all usage scenarios.