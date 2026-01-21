# Implementation Backlog

Date: 2026-01-21

## Critical (Blockers)
1. Implement durable audit queue with job persistence, retry/backoff, DLQ, and worker execution.
2. Add queued → processing → completed/failed status lifecycle surfaced to users.
3. Add monthly usage reset job (scheduled) and verify quota ledger rollovers.

## High Priority
1. Implement real PDF/HTML export generation matching on-screen data and return proper files.
2. Add plan change endpoints and ensure plan changes apply immediately across sessions.
3. Add structured logs for auth events and audit submissions (include tenantId/userId/requestId).

## Medium Priority
1. Add explicit DB indexes on tenant-scoped lookups (tenantId + url/id + period).
2. Add dashboard display for remaining quota and 80%/90% warning alerts.
3. Add post-deploy smoke tests for sign-in, audit submission, history, quota blocking, export.
4. Add CI lint step and enforce migrations before app start in deployment.

## Low Priority
1. Refine recommendation prioritization (top 3–5) and surface them separately.
2. Extend audit history UX with paging/filters once history depth increases.
