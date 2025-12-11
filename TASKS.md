# Implementation Tasks for Must-Have Features

Work through these tasks sequentially. Each item is scoped so it can be completed and shipped independently, while keeping the product in a releasable state.

## 0. Foundations (pre-flight)
- [ ] Confirm existing auth identifies `tenantId` and `userId` on each request.
- [ ] Document current DB schema and queue configuration as baseline.

## 1. Authenticated Multi-Tenant Access
1. [ ] Add request context middleware to extract and validate `tenantId`/`userId` from auth tokens; fail fast if missing.
2. [ ] Wrap DB helpers to auto-apply `tenantId` filters and reject unscoped queries.
3. [ ] Implement role checks (owner/member/read-only) on audit create/update/delete APIs.
4. [ ] Add integration tests for cross-tenant isolation and role enforcement.

## 2. Reliable Audit Queueing
1. [ ] Define a standard job schema (payload + idempotency key: `tenantId|auditType|url`).
2. [ ] Configure queue retries with exponential backoff and a dead-letter queue; enforce per-job timeout.
3. [ ] Emit structured logs/metrics for enqueue, start, success, and fail with duration.
4. [ ] Add tests for duplicate submissions, retries, and DLQ routing.

## 3. Result Persistence & History
1. [ ] Add migrations for `audits`, `audit_runs`, `findings` with tenant-scoped indexes.
2. [ ] Update workers to persist summaries and findings; push large artifacts to object storage when available.
3. [ ] Expose an API to fetch the last 5 runs per audit (tenant-scoped) with findings; plan pagination later.
4. [ ] Write tests covering creation, retrieval, and isolation of history data.

## 4. Actionable Reports
1. [ ] Build a report service that computes health score, pass/fail counts, and top prioritized fixes from findings.
2. [ ] Update UI to render summary cards, prioritized list, and trend delta vs. previous run.
3. [ ] Implement PDF/HTML export with secure share links; gate via entitlements.
4. [ ] Add UI/API tests for summary correctness, gating, and export flow.

## 5. Usage Limits
1. [ ] Create `usage_ledger` table and atomic helper to read/update monthly counts.
2. [ ] Add middleware to enforce caps before enqueueing; return friendly quota errors.
3. [ ] Add scheduled job to reset counts monthly and send 80/90% warnings.
4. [ ] Add tests for warnings, blocking, and reset logic.

## 6. Plan Gating
1. [ ] Define plan config (Free/Pro) with quotas and feature flags; seed `tenant_plan` mapping.
2. [ ] Build an entitlements helper to resolve feature availability per tenant and plan.
3. [ ] Apply entitlements checks in API and UI (exports, history depth, webhooks placeholder).
4. [ ] Add tests verifying correct gating for Free vs. Pro tenants and UI visibility.

## 7. Operational Hygiene
1. [ ] Update CI to run lint/tests and publish frontend/backend artifacts on main.
2. [ ] Add deploy migration step (`drizzle-kit migrate`) with rollback guidance.
3. [ ] Ensure secrets are sourced from environment/secret store; remove any hardcoded values.
4. [ ] Add post-deploy smoke test script and wire alerting for failures/error spikes.

## 8. Rollout & Observability
- [ ] Enable feature flags for gated features to allow gradual rollout.
- [ ] Add dashboards for queue latency, job failure rate, audit throughput, and per-tenant usage.
- [ ] Set SLOs for job success latency and error rate; configure alerts.

## 9. Launch Checklist
- [ ] Security review (SSRF protections, rate limits, audit logging verified).
- [ ] Backup/restore tested for DB and object storage.
- [ ] Billing webhooks tested in staging; plan mapping verified in app.
- [ ] Update onboarding copy and in-app messaging to reflect new capabilities.
