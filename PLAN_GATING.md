# Plan Gating Implementation

This document describes the comprehensive plan gating system implemented for the Meta Tag Analyzer SaaS application.

## Overview

The plan gating system enforces feature access based on tenant subscription plans (Free vs Pro), with consistent enforcement across backend APIs and frontend UI.

## Architecture

### 1. Plan Configuration (`shared/schema.ts`)

Plans are defined as code configuration for MVP simplicity:

```typescript
export const PLAN_CONFIGS = {
  free: {
    monthlyAuditLimit: 10,
    historyDepth: 5,
    exportsEnabled: false,
    webhooksEnabled: false,
    apiAccessEnabled: false
  },
  pro: {
    monthlyAuditLimit: 1000,
    historyDepth: 100,
    exportsEnabled: true,
    webhooksEnabled: true,
    apiAccessEnabled: true
  }
} as const;
```

**Design Decision**: Code-based configuration chosen for MVP to avoid database complexity while maintaining type safety and easy modification.

### 2. Database Schema

#### Tenants Table
```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Plan Changes Audit Log
```sql
CREATE TABLE plan_changes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  previous_plan TEXT NOT NULL,
  new_plan TEXT NOT NULL,
  actor_user_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Usage Tracking
```sql
CREATE TABLE usage_tracking (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM format
  audit_count INTEGER DEFAULT 0,
  export_count INTEGER DEFAULT 0
);
```

### 3. Backend Enforcement (`server/plan-gating.ts`)

#### PlanGatingService
- `checkEntitlement(tenantContext, feature)`: Boolean entitlement check
- `getQuotaLimit(tenantContext, quota)`: Get numeric limits
- `createPlanError()`: Structured error responses

#### Middleware
- `requireEntitlement(feature)`: Blocks requests for disabled features
- `checkQuota(quotaType)`: Validates usage against limits

#### Error Responses
```typescript
{
  code: "PLAN_UPGRADE_REQUIRED",
  feature: "exportsEnabled",
  currentPlan: "free",
  requiredPlan: "pro",
  message: "exportsEnabled requires pro plan. Current plan: free"
}
```

### 4. Frontend Gating (`client/src/components/PlanGating.tsx`)

#### Components
- `FeatureGate`: Conditionally renders features with fallbacks
- `UpgradePrompt`: Shows upgrade messaging for blocked features
- `QuotaExceededPrompt`: Displays quota limit messages
- `PlanComparison`: Side-by-side plan comparison

#### Hooks
- `usePlanInfo()`: Fetches current plan and entitlements
- `usePlanGatingErrorHandler()`: Handles plan-related API errors

## API Endpoints

### Plan Information
```
GET /api/plan
Response: {
  currentPlan: "free",
  entitlements: { ... },
  tenantId: 1
}
```

### Analysis History (Gated)
```
GET /api/history
Response: {
  analyses: [...],
  limit: 5,
  currentPlan: "free"
}
```

### Export Analysis (Pro Only)
```
POST /api/export/:id
Body: { format: "pdf" }
Response: 403 for free plan with structured error
```

### Analysis Creation (Quota Limited)
```
POST /api/analyze
Body: { url: "https://example.com" }
Response: 403 when quota exceeded
```

## History Depth Behavior

**Implementation**: Soft limit approach for MVP
- Database retains all analyses
- API responses limited by `historyDepth` entitlement
- UI shows only allowed number of results

**Tradeoffs**:
- **Soft Limit (Chosen)**: Simple implementation, data preserved, easy plan upgrades
- **Hard Limit**: Better storage efficiency, more complex retention logic

## Observability & Auditability

### Plan Change Logging
All plan changes are logged with:
- Tenant ID
- Previous and new plan
- Actor user ID (when available)
- Timestamp

### Usage Tracking
- Audit count per tenant per month
- Export count per tenant per month
- Extensible for future metrics

### Metrics (Recommended)
```typescript
// Example metrics to implement
planGatingBlocked.increment({ feature: 'exports', plan: 'free' });
quotaExceeded.increment({ quota: 'monthlyAuditLimit', plan: 'free' });
planUpgrade.increment({ from: 'free', to: 'pro' });
```

## Security Considerations

### Tenant Isolation
- All database queries scoped by `tenant_id`
- Middleware enforces tenant context on all requests
- No cross-tenant data leakage possible

### Defense in Depth
- Backend enforcement is primary security boundary
- Frontend gating provides UX enhancement only
- All gated endpoints validate entitlements server-side

### Request Context
```typescript
interface TenantContext {
  tenantId: number;
  plan: 'free' | 'pro';
}
```

## Testing Strategy

### Unit Tests (`server/__tests__/plan-gating.test.ts`)
- Entitlement checking logic
- Quota limit calculations
- Error message generation

### Integration Tests (`server/__tests__/plan-gating-integration.test.ts`)
- End-to-end API gating
- Plan upgrade/downgrade flows
- Cross-tenant isolation
- Error response formats

### Test Scenarios
1. **Free Plan Limitations**
   - Export attempts blocked with 403
   - History limited to 5 items
   - Quota enforcement

2. **Pro Plan Features**
   - Export functionality enabled
   - Extended history access
   - Higher quotas

3. **Plan Transitions**
   - Immediate effect of plan changes
   - Proper audit logging
   - No cache inconsistencies

## Deployment Considerations

### Database Migrations
```sql
-- Add tenant_id to existing tables
ALTER TABLE analyses ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meta_tags ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;

-- Create new tables
-- (See schema definitions above)
```

### Default Tenant Setup
For MVP, a default tenant is created automatically:
```typescript
// In storage constructor
this.createTenant("Default Tenant", "free");
```

### Environment Configuration
```env
# Future: External plan configuration
PLAN_CONFIG_SOURCE=code|database|feature_flags
FEATURE_FLAGS_ENDPOINT=https://flags.example.com
```

## Future Enhancements

### 1. Multi-User Tenants
- User-tenant relationships
- Role-based access within tenants
- User-specific quotas vs tenant quotas

### 2. Usage-Based Billing
- Real-time usage tracking
- Overage charges
- Usage alerts and notifications

### 3. Feature Flags Integration
- Dynamic plan configuration
- A/B testing for pricing
- Gradual feature rollouts

### 4. Advanced Quotas
- Rate limiting (requests per minute)
- Concurrent analysis limits
- Storage quotas

### 5. Self-Service Plan Management
- Stripe/payment integration
- Automated plan upgrades
- Billing portal integration

## Monitoring & Alerts

### Key Metrics to Track
- Plan upgrade conversion rates
- Feature usage by plan
- Quota utilization rates
- Plan gating error rates

### Recommended Alerts
- High quota utilization (>80%)
- Frequent plan gating blocks
- Plan change failures
- Cross-tenant access attempts

## Conclusion

This plan gating implementation provides:
- ✅ Consistent backend enforcement
- ✅ User-friendly frontend experience
- ✅ Comprehensive audit logging
- ✅ Extensible architecture
- ✅ Strong tenant isolation
- ✅ Comprehensive testing

The system is production-ready for MVP while providing clear paths for future enhancements.