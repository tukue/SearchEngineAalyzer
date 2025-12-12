# Requirements and Tasks: Must-Have Features

Implement one feature at a time using the steps below. Each section lists requirements (what “done” means) and ordered tasks to ship safely.

## 1) Authenticated Multi-Tenant Access
**Requirements**
- Every API/DB operation is scoped by `tenant_id` and `user_id`.
- Roles (owner/member/read-only) enforced on write actions.
- Tenant leakage tests pass (no cross-tenant data returned).

**Tasks**
1. Add request context middleware to attach `tenantId`/`userId` after auth.
2. Wrap DB helper/ORM calls to auto-apply `tenantId` filters; add guards for missing context.
3. Add role checks to audit creation/update/delete endpoints.
4. Write integration tests for cross-tenant isolation and role enforcement.

## 2) Reliable Audit Queueing
**Requirements**
- Audit trigger enqueues a job with idempotency and backoff retries.
- Queue metrics/logs emitted; dead-letter queue exists.
- Timeouts applied to external audit calls.

**Tasks**
1. Define standard job payload and idempotency key helper.
2. Configure queue retries with exponential backoff + DLQ; set per-job timeout.
3. Instrument logs/metrics for enqueue/start/success/fail durations.
4. Add regression tests for duplicate submissions and retry behavior.

## 3) Result Persistence & History
**Requirements**
- DB tables for audits, runs, and findings exist with migrations.
- API returns last 5 runs per audit; history respects tenant scope.
- Large artifacts stored in object storage when available.

**Tasks**
1. Create migrations for `audits`, `audit_runs`, `findings` tables with indexes.
2. Update worker to persist summary + findings; send raw artifacts to object storage when size threshold exceeded.
3. Add API endpoint/handler to fetch recent runs and findings; include pagination later if needed.
4. Add tests covering creation, retrieval, and tenant scoping for history.

## 4) Actionable Reports
**Requirements**
- Reports show health score, pass/fail counts, and top prioritized fixes.
- Trend delta vs. previous run displayed when history exists.
- Export to PDF/HTML available when plan allows.

**Tasks**
1. Add report service that derives health score and prioritized fixes from findings.
2. Update UI to render summary cards + prioritized list; include trend indicators.
3. Implement export generator (PDF/HTML) and secure share link; gate via entitlements.
4. Add UI/API tests for summary accuracy, gating, and export flow.

## 5) Usage Limits
**Requirements**
- Monthly audit cap per tenant with 80/90% warnings.
- Graceful block when limit exceeded; events logged.
- Automatic monthly reset job.

**Tasks**
1. Create `usage_ledger` table and helper to read/update counts atomically.
2. Add middleware check before enqueueing; return friendly error + quota remaining.
3. Add scheduled job to reset counters monthly and send warning notifications.
4. Add tests for quota warnings, blocking, and reset logic.

## 6) Plan Gating
**Requirements**
- Plans (Free/Pro) defined with quotas and feature flags.
- Features (exports, history length, webhooks) checked via centralized entitlements helper.
- UI hides or disables gated actions when unavailable.

**Tasks**
1. Add plans config and `tenant_plan` mapping/seed.
2. Build entitlements helper to resolve feature availability per tenant.
3. Apply entitlements checks in API and UI (exports, history depth, webhooks placeholder).
4. Add tests confirming correct gating for Free vs. Pro tenants.

## 7) Operational Hygiene
**Requirements**
- CI runs lint + tests; build artifacts produced on main branch.
- Migrations executed during deploy; secrets pulled from environment.
- Post-deploy smoke tests run; alerts on failure/error spike.

**Tasks**
1. Update CI to run lint/tests and publish artifacts (frontend/backend images or bundles).
2. Add migration step to deploy scripts (`drizzle-kit migrate`), with rollback guidance.
3. Ensure secrets come from env/secret store; audit repo for hardcoded secrets.
4. Add smoke test script and hook to deployments; wire alerting on failure.
