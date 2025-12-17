# Usage Limits MVP - Implementation Summary

## Overview

This document provides implementation-ready guidance for the Usage Limits MVP feature, which implements tenant-scoped monthly audit caps with proactive warnings (80% and 90%) and graceful blocking once limits are reached.

## Architecture Decisions

### 1. Usage Counting Strategy: **Enqueue-Based with Reconciliation**

**Decision**: Count usage on enqueue (request submission) rather than completion.

**Rationale**:
- Prevents quota gaming (submitting many requests before limits kick in)
- Provides early blocking to protect system resources
- Simpler to implement and reason about
- More predictable for users

**Implementation**:
- Reserve quota immediately when request is received
- Track request lifecycle (enqueued → completed/failed)
- Maintain audit trail for reconciliation

### 2. Data Model

#### Usage Ledger Table
```sql
CREATE TABLE usage_ledger (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,           -- for idempotency
  audit_type TEXT NOT NULL DEFAULT 'meta_analysis',
  status TEXT NOT NULL DEFAULT 'enqueued', -- enqueued, completed, failed
  url TEXT,
  user_id TEXT,
  enqueued_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  period TEXT NOT NULL               -- YYYY-MM format
);

CREATE UNIQUE INDEX idx_usage_ledger_tenant_request 
ON usage_ledger(tenant_id, request_id);
```

#### Monthly Usage Summary Table
```sql
CREATE TABLE monthly_usage (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  period TEXT NOT NULL,              -- YYYY-MM format
  enqueued_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_monthly_usage_tenant_period 
ON monthly_usage(tenant_id, period);
```

### 3. Enforcement Flow

#### Audit Enqueue Request Sequence
1. **Validate Request**: Check URL format, extract/generate requestId
2. **Check Idempotency**: Look for existing request with same tenantId + requestId
3. **Check Quota**: Query monthly usage vs plan limits
4. **Reserve Quota**: Create usage_ledger entry with status='enqueued'
5. **Update Summary**: Increment monthly_usage.enqueued_count
6. **Process Audit**: Execute the actual audit work
7. **Update Status**: Mark as 'completed' or 'failed'
8. **Update Summary**: Increment completed_count or failed_count

#### Worker Completion Callback
```typescript
// On successful completion
await UsageLimitsService.completeAudit(tenantId, requestId);

// On failure
await UsageLimitsService.failAudit(tenantId, requestId);
```

## API Contracts

### 1. Get Current Quota Status
```http
GET /api/quota
```

**Response**:
```json
{
  "quotaRemaining": 8,
  "quotaUsed": 2,
  "quotaLimit": 10,
  "quotaPercentUsed": 20.0,
  "warningLevel": "none",
  "period": "2024-01"
}
```

### 2. Enqueue Audit with Quota Check
```http
POST /api/analyze
Content-Type: application/json

{
  "url": "https://example.com",
  "requestId": "optional-uuid-for-idempotency",
  "auditType": "meta_analysis",
  "userId": "user123"
}
```

**Success Response (200)**:
```json
{
  "analysis": { /* analysis results */ },
  "tags": [ /* meta tags */ ],
  "recommendations": [ /* recommendations */ ],
  "quota": {
    "quotaRemaining": 7,
    "quotaUsed": 3,
    "quotaLimit": 10,
    "quotaPercentUsed": 30.0,
    "warningLevel": "none",
    "period": "2024-01"
  }
}
```

**Quota Exceeded Response (429)**:
```json
{
  "code": "QUOTA_EXCEEDED",
  "feature": "monthlyAuditLimit",
  "currentPlan": "free",
  "message": "Monthly audit quota exceeded. Used 10/10 audits for 2024-01.",
  "quota": {
    "quotaRemaining": 0,
    "quotaUsed": 10,
    "quotaLimit": 10,
    "quotaPercentUsed": 100.0,
    "warningLevel": "exceeded",
    "period": "2024-01"
  }
}
```

## Handling Tricky Cases

### 1. Duplicate Submissions (Same requestId)
```typescript
// Check for existing entry
const existing = await storage.getUsageLedgerEntry(tenantId, requestId);
if (existing) {
  // Return success without incrementing usage
  const quotaStatus = await UsageLimitsService.getQuotaStatus(tenantId);
  return { success: true, quotaStatus };
}
```

### 2. Retries and Dead Letter Queue
```typescript
// On retry, use same requestId to maintain idempotency
const requestId = req.body.requestId || generateUniqueId();

// On DLQ processing, mark as failed
await UsageLimitsService.failAudit(tenantId, requestId);
```

### 3. Partial Failures (Job Started but Never Completed)
- **Detection**: Background job finds entries older than timeout threshold
- **Resolution**: Mark as 'failed' and update counters
- **Prevention**: Set reasonable timeouts and implement heartbeat mechanism

```typescript
// Cleanup job (run periodically)
async function cleanupStaleEntries() {
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
  const staleEntries = await storage.getStaleUsageEntries(staleThreshold);
  
  for (const entry of staleEntries) {
    await UsageLimitsService.failAudit(entry.tenantId, entry.requestId);
  }
}
```

## Warning System

### Warning Levels
- **none**: 0-79% usage
- **warning_80**: 80-89% usage  
- **warning_90**: 90-99% usage
- **exceeded**: 100%+ usage

### Warning Triggers
```typescript
let warningLevel: "none" | "warning_80" | "warning_90" | "exceeded" = "none";
if (quotaPercentUsed >= 100) {
  warningLevel = "exceeded";
} else if (quotaPercentUsed >= 90) {
  warningLevel = "warning_90";
} else if (quotaPercentUsed >= 80) {
  warningLevel = "warning_80";
}
```

### Warning Delivery
- **API Response Fields**: Always include quota status in responses
- **HTTP Headers**: Optional quota headers for client-side monitoring
- **Event Emission**: Log events for future notification system

## Monthly Reset Strategy

### Period-Based Counters (Recommended for MVP)
- **No Reset Job Needed**: Compute usage by period (YYYY-MM)
- **Automatic Rollover**: New month = new period = fresh quota
- **Simple and Reliable**: No complex scheduling or failure scenarios

```typescript
const currentPeriod = new Date().toISOString().slice(0, 7); // "2024-01"
const usage = await storage.getMonthlyUsage(tenantId, currentPeriod);
```

### Alternative: Scheduled Reset Job
```typescript
// Run on 1st of each month
async function resetMonthlyQuotas() {
  const previousPeriod = getPreviousPeriod();
  const currentPeriod = getCurrentPeriod();
  
  // Archive previous period data
  await storage.archiveUsageData(previousPeriod);
  
  // Initialize current period
  await storage.initializePeriod(currentPeriod);
}
```

## Tenant Isolation & Auditability

### Tenant Isolation
- All queries include `tenant_id` filter
- No cross-tenant data access possible
- Separate usage counters per tenant

### Audit Trail
```sql
-- Full audit trail query
SELECT 
  ul.tenant_id,
  ul.request_id,
  ul.audit_type,
  ul.status,
  ul.url,
  ul.user_id,
  ul.enqueued_at,
  ul.completed_at,
  ul.failed_at,
  ul.period
FROM usage_ledger ul
WHERE ul.tenant_id = $1
  AND ul.period = $2
ORDER BY ul.enqueued_at DESC;
```

### Admin Queries
```sql
-- Usage summary by tenant and period
SELECT 
  tenant_id,
  period,
  enqueued_count,
  completed_count,
  failed_count,
  (completed_count::float / NULLIF(enqueued_count, 0)) * 100 as success_rate
FROM monthly_usage
WHERE period = '2024-01'
ORDER BY enqueued_count DESC;
```

## Implementation Checklist

### Core Components
- ✅ **UsageLimitsService**: Main service class with quota logic
- ✅ **Storage Layer**: Methods for usage ledger and monthly summaries
- ✅ **Middleware**: `checkAndReserveQuota()` for request interception
- ✅ **Schema Updates**: New tables and types
- ✅ **API Updates**: Quota endpoints and response enrichment

### Error Handling
- ✅ **Graceful Blocking**: 429 status with clear error messages
- ✅ **Idempotency**: Duplicate request handling
- ✅ **Failure Tracking**: Mark failed audits appropriately
- ✅ **Validation**: Input validation and sanitization

### Testing
- ✅ **Unit Tests**: Service logic and edge cases
- ✅ **Integration Tests**: End-to-end API workflows
- ✅ **Load Tests**: Concurrent request handling
- ✅ **Security Tests**: Tenant isolation verification

### Monitoring
- ✅ **Logging**: Usage events and quota violations
- ✅ **Metrics**: Usage trends and system health
- ✅ **Alerts**: Quota threshold notifications

## Performance Considerations

### Database Optimization
```sql
-- Essential indexes
CREATE INDEX idx_usage_ledger_tenant_period ON usage_ledger(tenant_id, period);
CREATE INDEX idx_usage_ledger_status ON usage_ledger(status);
CREATE INDEX idx_monthly_usage_lookup ON monthly_usage(tenant_id, period);
```

### Caching Strategy
```typescript
// Cache monthly usage summaries for fast quota checks
const cacheKey = `usage:${tenantId}:${period}`;
let usage = await cache.get(cacheKey);
if (!usage) {
  usage = await storage.getMonthlyUsage(tenantId, period);
  await cache.set(cacheKey, usage, 300); // 5 minute TTL
}
```

### Batch Operations
```typescript
// Update monthly summaries in batches
async function batchUpdateMonthlySummaries(entries: UsageLedgerEntry[]) {
  const summaries = new Map();
  
  for (const entry of entries) {
    const key = `${entry.tenantId}-${entry.period}`;
    if (!summaries.has(key)) {
      summaries.set(key, { tenantId: entry.tenantId, period: entry.period, count: 0 });
    }
    summaries.get(key).count++;
  }
  
  await storage.batchUpdateMonthlySummaries(Array.from(summaries.values()));
}
```

## Security Considerations

### Input Validation
- Validate `requestId` format and length
- Sanitize URL inputs
- Verify tenant context authenticity

### Rate Limiting
```typescript
// Additional rate limiting (requests per minute)
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per tenant
  keyGenerator: (req) => `tenant:${req.tenantContext.tenantId}`,
  message: "Too many requests, please try again later."
});
```

### Audit Logging
```typescript
// Log all quota-related events
logger.info('quota_check', {
  tenantId,
  requestId,
  quotaUsed,
  quotaLimit,
  action: 'allowed|blocked',
  timestamp: new Date().toISOString()
});
```

## Deployment Considerations

### Database Migration
```sql
-- Migration script
BEGIN;

-- Create new tables
CREATE TABLE usage_ledger (...);
CREATE TABLE monthly_usage (...);

-- Create indexes
CREATE INDEX ...;

-- Migrate existing data (if any)
INSERT INTO monthly_usage (tenant_id, period, enqueued_count)
SELECT tenant_id, month, audit_count 
FROM usage_tracking;

COMMIT;
```

### Feature Flags
```typescript
// Gradual rollout with feature flags
if (featureFlags.isEnabled('usage_limits_v2', tenantId)) {
  return checkAndReserveQuota();
} else {
  return checkQuota('monthlyAuditLimit');
}
```

### Monitoring & Alerts
```typescript
// Key metrics to monitor
const metrics = {
  'quota.checks.total': quotaChecks,
  'quota.blocks.total': quotaBlocks,
  'quota.warnings.80pct': warnings80,
  'quota.warnings.90pct': warnings90,
  'usage.ledger.entries': ledgerEntries,
  'usage.reconciliation.errors': reconciliationErrors
};
```

This implementation provides a robust, scalable foundation for usage limits while maintaining simplicity for the MVP. The design supports future enhancements like advanced analytics, notification systems, and more sophisticated billing integration.