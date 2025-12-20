# Usage Limits MVP - Test Plan

## Overview
This document outlines the test plan for the Usage Limits MVP feature, which implements tenant-scoped monthly audit caps with warnings, auditable usage tracking, and graceful blocking.

## Test Categories

### 1. Unit Tests (`usage-limits.test.ts`)

#### Quota Status Tests
- ✅ New tenant shows correct initial quota status
- ✅ Warning levels trigger at 80% and 90% usage
- ✅ Exceeded status shows when at 100% usage
- ✅ Quota calculations are accurate

#### Quota Enforcement Tests
- ✅ Allows audits when under quota
- ✅ Blocks audits when quota exceeded
- ✅ Returns proper error messages and codes

#### Idempotency Tests
- ✅ Duplicate requests with same requestId don't increment usage
- ✅ Request ID generation produces unique IDs
- ✅ Existing requests return success without side effects

#### Audit Lifecycle Tests
- ✅ Audits can be marked as completed
- ✅ Audits can be marked as failed
- ✅ Status updates are persisted correctly

#### Monthly Tracking Tests
- ✅ Usage is tracked per month/period
- ✅ Different months have separate counters
- ✅ Monthly summaries are accurate

### 2. Integration Tests (`usage-limits-integration.test.ts`)

#### API Endpoint Tests
- ✅ `GET /api/quota` returns current quota status
- ✅ `GET /api/plan` includes quota information
- ✅ `POST /api/analyze` enforces quotas and includes quota in response

#### End-to-End Workflow Tests
- ✅ Successful audit request reserves quota and completes
- ✅ Failed audit requests mark usage as failed
- ✅ Quota blocking prevents over-usage
- ✅ Warning levels appear in API responses

#### Error Handling Tests
- ✅ Invalid URLs are handled gracefully
- ✅ Network failures mark audits as failed
- ✅ Proper HTTP status codes (429 for quota exceeded)

#### Tenant Isolation Tests
- ✅ Different tenants have separate usage counters
- ✅ One tenant's usage doesn't affect another's quota

## Manual Test Scenarios

### Scenario 1: Normal Usage Flow
1. Check initial quota status (should show full quota available)
2. Submit audit request (should succeed and decrement quota)
3. Check quota status (should show usage incremented)
4. Complete several more audits
5. Verify quota decreases appropriately

### Scenario 2: Warning Thresholds
1. Use up 80% of monthly quota
2. Submit audit request (should succeed with warning_80 level)
3. Use up 90% of monthly quota  
4. Submit audit request (should succeed with warning_90 level)

### Scenario 3: Quota Exhaustion
1. Use up 100% of monthly quota
2. Submit audit request (should fail with 429 status)
3. Verify error message is user-friendly
4. Verify quota status shows exceeded

### Scenario 4: Idempotency
1. Submit audit with specific requestId
2. Submit same request again with same requestId
3. Verify quota only decremented once
4. Verify both requests succeed

### Scenario 5: Failure Handling
1. Submit audit request with invalid URL
2. Verify request fails gracefully
3. Verify usage is marked as failed (not completed)
4. Verify quota is still reserved (prevents gaming)

## Performance Tests

### Load Testing
- Submit multiple concurrent requests
- Verify quota enforcement remains accurate
- Verify no race conditions in usage counting

### Stress Testing  
- Submit requests at quota limit boundary
- Verify consistent blocking behavior
- Verify system remains stable

## Security Tests

### Tenant Isolation
- Verify tenant A cannot see tenant B's usage
- Verify tenant A cannot affect tenant B's quota
- Verify requestId uniqueness across tenants

### Input Validation
- Test malformed requestIds
- Test invalid tenant contexts
- Test SQL injection attempts (if using SQL storage)

## Monitoring & Observability Tests

### Audit Trail
- Verify all usage is logged with timestamps
- Verify audit trail includes user and request details
- Verify failed vs completed audits are distinguishable

### Metrics
- Verify quota usage can be queried by period
- Verify usage trends can be analyzed
- Verify reconciliation is possible

## Test Data Requirements

### Test Tenants
- Free plan tenant (10 audit limit)
- Pro plan tenant (1000 audit limit)  
- Multiple tenants for isolation testing

### Test Periods
- Current month data
- Previous month data (for period isolation)
- Future month data (for edge cases)

## Success Criteria

### Functional Requirements
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Manual scenarios complete successfully
- ✅ No quota leakage between tenants
- ✅ Idempotency works correctly

### Non-Functional Requirements
- ✅ Response times remain under 500ms
- ✅ System handles concurrent requests correctly
- ✅ Error messages are user-friendly
- ✅ Audit trail is complete and accurate

### Edge Cases
- ✅ Month boundary transitions
- ✅ Leap year handling
- ✅ Timezone considerations
- ✅ Large request ID strings
- ✅ Network timeouts and retries

## Running the Tests

```bash
# Run unit tests
npm test -- usage-limits.test.ts

# Run integration tests  
npm test -- usage-limits-integration.test.ts

# Run all usage limits tests
npm test -- --testNamePattern="usage.limits|Usage.Limits"

# Run with coverage
npm run test:coverage
```

## Known Limitations (MVP)

1. **In-Memory Storage**: Current implementation uses memory storage, data is lost on restart
2. **No Background Jobs**: No automated cleanup or reconciliation jobs
3. **Simple Period Logic**: Uses YYYY-MM format, no timezone handling
4. **No Rate Limiting**: Only quota limits, no request rate limiting
5. **No Usage Analytics**: Basic counting only, no detailed analytics

## Future Enhancements

1. **Database Persistence**: Replace memory storage with PostgreSQL
2. **Background Jobs**: Add monthly reset and reconciliation jobs
3. **Advanced Analytics**: Usage trends, forecasting, alerts
4. **Rate Limiting**: Add per-second/minute rate limits
5. **Usage Notifications**: Email/webhook notifications for warnings
6. **Admin Dashboard**: UI for monitoring and managing usage