# Result Persistence & History Design

## Database Schema (ERD)

```sql
-- Tenants (from existing plan gating)
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects - group audits by URL/domain
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audits - audit definitions/types per project
CREATE TABLE audits (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'seo', 'performance', 'accessibility'
  config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Runs - each execution instance
CREATE TABLE audit_runs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  audit_id INTEGER NOT NULL REFERENCES audits(id),
  run_id UUID DEFAULT gen_random_uuid() NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  summary JSONB NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration INTEGER, -- milliseconds
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Findings - normalized issues per run
CREATE TABLE findings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  run_id INTEGER NOT NULL REFERENCES audit_runs(id),
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  guidance TEXT NOT NULL,
  impact TEXT NOT NULL,
  element TEXT,
  line INTEGER,
  column INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Artifacts - pointers to object storage
CREATE TABLE artifacts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  run_id INTEGER NOT NULL REFERENCES audit_runs(id),
  type TEXT NOT NULL, -- 'html_snapshot', 'screenshot', 'response_dump'
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Index Strategy

### Critical Performance Indexes

```sql
-- Tenant isolation (most important)
CREATE INDEX projects_tenant_id_idx ON projects(tenant_id);
CREATE INDEX audits_tenant_id_idx ON audits(tenant_id);
CREATE INDEX audit_runs_tenant_id_idx ON audit_runs(tenant_id);
CREATE INDEX findings_tenant_id_idx ON findings(tenant_id);
CREATE INDEX artifacts_tenant_id_idx ON artifacts(tenant_id);

-- Dashboard queries (recent runs across tenant)
CREATE INDEX audit_runs_tenant_started_idx ON audit_runs(tenant_id, started_at DESC);

-- Project-specific queries
CREATE INDEX audit_runs_tenant_project_idx ON audit_runs(tenant_id, project_id);
CREATE INDEX audit_runs_tenant_project_started_idx ON audit_runs(tenant_id, project_id, started_at DESC);

-- Audit-specific queries
CREATE INDEX audit_runs_tenant_audit_started_idx ON audit_runs(tenant_id, audit_id, started_at DESC);

-- Finding queries
CREATE INDEX findings_tenant_run_idx ON findings(tenant_id, run_id);
CREATE INDEX findings_tenant_category_idx ON findings(tenant_id, category);
CREATE INDEX findings_tenant_severity_idx ON findings(tenant_id, severity);

-- Artifact queries
CREATE INDEX artifacts_tenant_run_idx ON artifacts(tenant_id, run_id);

-- Public ID lookups
CREATE UNIQUE INDEX audit_runs_run_id_idx ON audit_runs(run_id);
CREATE INDEX artifacts_storage_key_idx ON artifacts(storage_key);

-- Domain grouping
CREATE INDEX projects_tenant_domain_idx ON projects(tenant_id, domain);
```

### Index Justification

1. **Tenant Isolation**: Every query must filter by `tenant_id` first
2. **Time-based Queries**: Most history queries sort by `started_at DESC`
3. **Composite Indexes**: Combine tenant + project/audit + time for efficient "last N runs" queries
4. **Foreign Key Performance**: Speed up joins and cascading operations
5. **Public ID Lookups**: UUID-based run IDs for secure external references

## Key Queries

### 1. Dashboard Recent Runs
```sql
SELECT 
  ar.run_id,
  p.name as project_name,
  a.name as audit_name,
  ar.status,
  ar.summary->>'scores'->>'overall' as overall_score,
  ar.started_at,
  ar.duration,
  COUNT(f.id) as findings_count
FROM audit_runs ar
JOIN projects p ON ar.project_id = p.id
JOIN audits a ON ar.audit_id = a.id
LEFT JOIN findings f ON ar.id = f.run_id
WHERE ar.tenant_id = $1
GROUP BY ar.id, p.name, a.name
ORDER BY ar.started_at DESC
LIMIT $2;
```

### 2. Project Run History (Paginated)
```sql
SELECT 
  ar.run_id,
  p.name as project_name,
  a.name as audit_name,
  ar.status,
  ar.summary->>'scores'->>'overall' as overall_score,
  ar.started_at,
  ar.duration,
  COUNT(f.id) as findings_count
FROM audit_runs ar
JOIN projects p ON ar.project_id = p.id
JOIN audits a ON ar.audit_id = a.id
LEFT JOIN findings f ON ar.id = f.run_id
WHERE ar.tenant_id = $1 
  AND ar.project_id = $2
  AND ($3::timestamp IS NULL OR ar.started_at < $3)
GROUP BY ar.id, p.name, a.name
ORDER BY ar.started_at DESC
LIMIT $4;
```

### 3. Run Details with Findings
```sql
-- Main run data
SELECT 
  ar.run_id,
  p.name as project_name,
  a.name as audit_name,
  ar.status,
  ar.summary,
  ar.started_at,
  ar.completed_at,
  ar.duration
FROM audit_runs ar
JOIN projects p ON ar.project_id = p.id
JOIN audits a ON ar.audit_id = a.id
WHERE ar.tenant_id = $1 AND ar.run_id = $2;

-- Findings for the run
SELECT 
  id, category, severity, rule_id, title, 
  message, guidance, impact, element, metadata
FROM findings
WHERE tenant_id = $1 AND run_id = $2
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
    WHEN 'info' THEN 5
  END,
  category;
```

## API Contracts

### Dashboard Runs
```json
GET /api/dashboard/runs?limit=10

Response:
{
  "runs": [
    {
      "runId": "123e4567-e89b-12d3-a456-426614174000",
      "projectName": "My Website",
      "auditName": "SEO Audit",
      "status": "completed",
      "overallScore": 85,
      "startedAt": "2024-01-15T10:30:00Z",
      "duration": 5000,
      "findingsCount": 12
    }
  ],
  "limit": 10,
  "planLimit": 50,
  "currentPlan": "pro"
}
```

### Project Runs (Paginated)
```json
GET /api/projects/123/runs?limit=20&cursor=2024-01-15T10:30:00Z

Response:
{
  "runs": [...],
  "nextCursor": "2024-01-14T15:20:00Z",
  "limit": 20,
  "planLimit": 50,
  "currentPlan": "pro"
}
```

### Run Details
```json
GET /api/runs/123e4567-e89b-12d3-a456-426614174000

Response:
{
  "runId": "123e4567-e89b-12d3-a456-426614174000",
  "projectName": "My Website",
  "auditName": "SEO Audit",
  "status": "completed",
  "summary": {
    "scores": {
      "overall": 85,
      "seo": 90,
      "performance": 80,
      "accessibility": 85
    },
    "counts": {
      "total": 12,
      "critical": 1,
      "high": 3,
      "medium": 5,
      "low": 2,
      "info": 1
    },
    "metadata": {
      "url": "https://example.com",
      "loadTime": 1200,
      "pageSize": 2048000
    }
  },
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z",
  "duration": 5000,
  "findings": [
    {
      "id": 1,
      "category": "seo",
      "severity": "high",
      "ruleId": "missing-meta-description",
      "title": "Missing Meta Description",
      "message": "Page is missing a meta description",
      "guidance": "Add a meta description tag with 150-160 characters",
      "impact": "Reduces click-through rates from search results",
      "element": "head",
      "metadata": {}
    }
  ],
  "artifacts": [
    {
      "id": 1,
      "type": "html_snapshot",
      "filename": "page-snapshot.html",
      "size": 45000,
      "downloadUrl": "https://signed-url.s3.amazonaws.com/..."
    }
  ]
}
```

## Retention Strategy

### Option A: Hard Delete (Chosen for MVP)

**Implementation**: Delete runs beyond plan limit immediately
**Justification**:
- Simple implementation
- Clear storage costs
- Immediate plan enforcement
- No confusion about "hidden" data

**Tradeoffs**:
- Data loss on plan downgrades
- No recovery option
- Potential user frustration

### Background Cleanup Job

```typescript
// Cron job runs daily
async function cleanupOldRuns() {
  const tenants = await getTenants();
  
  for (const tenant of tenants) {
    const deletedCount = await persistenceService.cleanupOldRuns(
      tenant.id, 
      tenant.plan
    );
    
    console.log(`Cleaned up ${deletedCount} runs for tenant ${tenant.id}`);
  }
}
```

## Security Considerations

### Tenant Isolation
- All queries include `tenant_id` filter
- UUID-based public run IDs prevent enumeration
- No cross-tenant data access possible

### ID Strategy
- Internal IDs: Auto-increment integers (performance)
- Public IDs: UUIDs (security, no enumeration)
- Composite lookups: `tenant_id + run_id`

### Access Control
- All endpoints require tenant context
- Plan-based feature gating for artifacts
- Rate limiting on expensive queries

## Performance Optimizations

### Query Patterns
1. **Index-First**: All queries use tenant_id index first
2. **Limit Early**: Apply LIMIT at database level
3. **Selective Joins**: Only join tables when needed
4. **Cursor Pagination**: Avoid OFFSET for large datasets

### Caching Strategy
- Cache project/audit metadata (rarely changes)
- Cache recent runs for dashboard (5-minute TTL)
- No caching for run details (always fresh)

### Object Storage
- Store large artifacts in S3/compatible storage
- Generate signed URLs for downloads
- Implement lifecycle policies for cleanup

## Test Plan

### Tenant Isolation Tests
```typescript
describe('Tenant Isolation', () => {
  it('should not return runs from other tenants', async () => {
    // Create runs for tenant A and B
    // Query as tenant A
    // Verify only tenant A runs returned
  });
  
  it('should not allow access to other tenant run details', async () => {
    // Create run for tenant A
    // Try to access as tenant B
    // Verify 404 response
  });
});
```

### Pagination Tests
```typescript
describe('Pagination', () => {
  it('should respect plan limits', async () => {
    // Create more runs than plan allows
    // Query with high limit
    // Verify plan limit enforced
  });
  
  it('should handle cursor-based pagination', async () => {
    // Create sequential runs
    // Test cursor navigation
    // Verify correct ordering and no duplicates
  });
});
```

### Plan Cap Enforcement
```typescript
describe('Plan Caps', () => {
  it('should cleanup old runs beyond plan limit', async () => {
    // Create runs beyond plan limit
    // Run cleanup
    // Verify correct number of runs remain
  });
  
  it('should enforce different limits per plan', async () => {
    // Test free vs pro limits
    // Verify correct enforcement
  });
});
```

## Migration Strategy

### Phase 1: Schema Creation
```sql
-- Create new tables with indexes
-- Migrate existing analysis data
-- Update application to use new schema
```

### Phase 2: Data Migration
```typescript
// Migrate existing analyses to new structure
async function migrateExistingData() {
  const existingAnalyses = await getExistingAnalyses();
  
  for (const analysis of existingAnalyses) {
    // Create project if not exists
    // Create audit if not exists
    // Create run with findings
  }
}
```

### Phase 3: Cleanup
```sql
-- Drop old tables after verification
-- Update indexes based on production usage
-- Implement monitoring and alerting
```

## Monitoring & Alerting

### Key Metrics
- Query performance (p95 latency)
- Storage growth rate
- Plan limit violations
- Cleanup job success rate

### Alerts
- Slow queries (>1s)
- High storage usage
- Failed cleanup jobs
- Tenant isolation violations

This design provides a robust, scalable foundation for result persistence while maintaining strict tenant isolation and plan-aware limits.