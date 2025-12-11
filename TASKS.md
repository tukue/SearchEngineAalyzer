# Must-Have Feature Task Board

Execute features sequentially. Each block is self-contained and follows KISS, SOLID, and clean architecture: keep domain logic in services, keep transport/controllers thin, and isolate infra concerns (DB, queue, storage).

## 0) Foundations (Pre-Flight)
- [ ] Ensure auth middleware surfaces `tenantId` and `userId` to request context. Fail fast if missing.
- [ ] Document current DB schema, queue setup, and storage locations.
- [ ] Add a tiny playground route (dev-only) to echo context for smoke testing.

## 1) Authenticated Multi-Tenant Access
- **Goal:** Enforce tenant isolation and simple RBAC.
- **Architecture notes:** Controller → service → repository pattern; repository always scopes by `tenantId`.
- **Tasks:**
  - [ ] Add request context middleware to extract/validate `tenantId`/`userId` from tokens.
  - [ ] Wrap DB helpers with a tenant-scoped repository base; reject unscoped queries.
  - [ ] Add role checks (owner/member/read-only) in services before mutating audits.
  - [ ] Integration tests: cross-tenant access blocked; roles enforced.
- **DoD:** All audit CRUD/API calls require scoped context; tests green.

## 2) Reliable Audit Queueing
- **Goal:** Predictable async execution without duplicate work.
- **Architecture notes:** Job producer/consumer separated; idempotency at queue boundary.
- **Tasks:**
  - [ ] Standardize job payload + idempotency key `tenantId|auditType|url`.
  - [ ] Configure retries with exponential backoff, per-job timeout, and dead-letter queue.
  - [ ] Emit structured logs/metrics at enqueue/start/success/fail with durations.
  - [ ] Tests for duplicate submissions, retry behavior, and DLQ routing.
- **DoD:** Duplicate enqueue blocked, failed jobs visible in DLQ, metrics/logs present.

## 3) Result Persistence & History
- **Goal:** Durable audit records with tenant scoping and trend support.
- **Architecture notes:** `audits` (identity), `audit_runs` (instances), `findings` (details); large artifacts to object storage.
- **Tasks:**
  - [ ] Add migrations for `audits`, `audit_runs`, `findings` with indexes on `(tenantId, createdAt)`.
  - [ ] Workers persist summaries and findings; store large payloads in object storage URL refs.
  - [ ] API: fetch last 5 runs per audit (tenant-scoped) with findings and timestamps.
  - [ ] Tests for creation, retrieval, and tenant isolation.
- **DoD:** Audits and runs retrievable with correct scoping; history visible in UI/API tests.

## 4) Actionable Reports
- **Goal:** Clear health snapshot and prioritized fixes.
- **Architecture notes:** Reporting service computes scores; transport just formats.
- **Tasks:**
  - [ ] Reporting service: health score, pass/fail counts, top prioritized fixes (impact × effort).
  - [ ] UI renders summary cards, prioritized list, and previous-run delta.
  - [ ] PDF/HTML export with signed/expiring share links; behind entitlements helper.
  - [ ] Tests for summary correctness, gating, and export flow.
- **DoD:** Reports consistent across API/UI/export; entitlements enforced.

## 5) Usage Limits
- **Goal:** Enforce monthly audit caps per plan.
- **Architecture notes:** Atomic counter helper; middleware guard before enqueue.
- **Tasks:**
  - [ ] Create `usage_ledger` table and atomic helper to read/update monthly counts.
  - [ ] Middleware rejects enqueue when quota exceeded; returns friendly error with remaining/limit.
  - [ ] Scheduled job resets counts monthly and emits 80/90% warnings.
  - [ ] Tests for warnings, blocking, and reset.
- **DoD:** Limits enforced in API; reset job works; tests pass.

## 6) Plan Gating
- **Goal:** Feature exposure aligned with plan.
- **Architecture notes:** Plan config map; entitlements helper used by services/UI.
- **Tasks:**
  - [ ] Define plan config (Free/Pro) with quotas and feature flags; seed `tenant_plan` mapping.
  - [ ] Entitlements helper resolving plan → capabilities (exports, history depth, webhooks placeholder).
  - [ ] Apply entitlements checks in APIs and UI components.
  - [ ] Tests verifying Free vs. Pro behavior and UI visibility.
- **DoD:** Feature gates consistent across stack; tests cover both plans.

## 7) Operational Hygiene
- **Goal:** Safe delivery pipeline.
- **Architecture notes:** CI runs lint/test; deployments run migrations with rollback guidance.
- **Tasks:**
  - [ ] CI: lint + tests + build for client/server; artifact or image per service.
  - [ ] Deploy step runs `drizzle-kit migrate`; document rollback procedure.
  - [ ] Secrets from env/secret store; remove hardcoded values.
  - [ ] Post-deploy smoke test script; alert on failures/error spikes.
- **DoD:** CI/CD green; migrations safe; secrets externalized; smoke tests wired.

## 8) Observability & Rollout
- **Goal:** Visibility and gradual enablement.
- **Architecture notes:** Feature flags at config layer; dashboards/alerts for core flows.
- **Tasks:**
  - [ ] Feature flags for gated features to allow phased rollout.
  - [ ] Dashboards: queue latency, job failure rate, audit throughput, per-tenant usage.
  - [ ] SLOs for job latency/success; alerts on breach.
- **DoD:** Dashboards live; alerts configured; flags available for staged rollout.

## 9) Launch Checklist
- [ ] Security review (SSRF protections, rate limits, audit logging verified).
- [ ] Backup/restore tested for DB and object storage.
- [ ] Billing webhooks tested in staging; plan mapping verified in app.
- [ ] Onboarding copy updated to reflect new capabilities.
