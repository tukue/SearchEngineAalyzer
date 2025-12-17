# Requirements and Tasks: Must-Have Features

Implement one feature at a time using the steps below. Each section lists requirements (what “done” means), a lightweight design, and ordered tasks to ship safely while keeping to KISS and clean/SOLID architecture principles.

## 1) Authenticated Multi-Tenant Access
**Requirements**
- Every API/DB operation is scoped by `tenant_id` and `user_id`.
- Roles (owner/member/read-only) enforced on write actions.
- Tenant leakage tests pass (no cross-tenant data returned).

**Design**
- Transport stays thin: middleware resolves `tenantId`/`userId` and rejects if missing.
- Services enforce RBAC before delegating to repositories.
- Repositories inherit from a tenant-aware base that auto-adds `tenantId` filters.
- Shared request context utility provides typed access to current tenant/user.

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

**Design**
- Producer builds a normalized payload and computes an idempotency key (`tenantId|auditType|url`).
- Queue client wrapper handles retry policy, DLQ routing, and per-job timeout.
- Consumer processes within a service layer; infrastructure concerns (queue, logger) are injected.
- Structured logging captures lifecycle events for observability.

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

**Design**
- Data model: `audits` (identity), `audit_runs` (per execution), `findings` (per rule) with tenant indexes.
- Worker writes summaries and findings via services; blob artifacts stored via storage adapter when size threshold exceeded.
- Read model uses repositories to fetch last 5 runs per audit, sorted by time, scoped by tenant.
- API handler remains thin and delegates to a history service that encapsulates filtering/pagination defaults.

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

**Design**
- Reporting service calculates score, counts, deltas, and prioritized fixes from normalized findings.
- UI consumes a single report DTO to render summary cards, prioritized lists, and trend chips.
- Export generator runs server-side, producing PDF/HTML via a renderer; share links are signed/expiring.
- Entitlements helper gates export and share-link creation.

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

**Design**
- `usage_ledger` table stores per-tenant monthly counters with timestamps.
- Atomic helper increments counts and returns thresholds; middleware enforces before enqueueing audits.
- Scheduler resets counts monthly and emits warning notifications at 80/90%.
- Logging captures limit decisions for observability and support.

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

**Design**
- Plan configuration map defines quotas and feature flags; seeded `tenant_plan` mapping links tenants.
- Entitlements helper resolves plan and exposes capability checks to services/UI.
- Controllers call entitlements before feature entrypoints; UI components receive gates via props/hooks.
- Feature flags can override plan settings for staged rollout.

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

**Design**
- CI pipeline stages: lint → tests → build; artifacts/images persisted per service.
- Deploy scripts run migrations (`drizzle-kit migrate`) with documented rollback steps.
- Secrets managed via environment/secret store; pre-commit check for hardcoded values.
- Post-deploy smoke tests execute via script and report to alerting channel on failure.

**Tasks**
1. Update CI to run lint/tests and publish artifacts (frontend/backend images or bundles).
2. Add migration step to deploy scripts (`drizzle-kit migrate`), with rollback guidance.
3. Ensure secrets come from env/secret store; audit repo for hardcoded secrets.
4. Add smoke test script and hook to deployments; wire alerting on failure.

## 8) Observability & Rollout
**Requirements**
- Feature flags available for staged rollout of gated features.
- Dashboards for queue latency, job failure rate, audit throughput, and per-tenant usage.
- SLOs for job latency/success with alerts on breach.

**Design**
- Config-driven feature flag module with per-tenant overrides; defaults in config file.
- Metrics emitted from queue producer/consumer and usage helper; dashboards built on these metrics.
- SLO definitions stored with alert rules in infra code (e.g., Terraform/monitoring config repo).
- Rollout playbook outlines flag enablement steps and rollback path.

**Tasks**
1. Add feature flag helper + config; expose hooks to services/UI for gradual enablement.
2. Emit metrics for queue latency, job failure rate, audit throughput, and per-tenant usage.
3. Create dashboards visualizing the emitted metrics; document links.
4. Define SLO thresholds and alerts for latency/success; add playbook for staged rollout.

## 9) Launch Checklist
**Design**
- Treat as a release gate: verify security, recovery, billing, and onboarding across environments with owners assigned.

**Tasks**
- [ ] Security review (SSRF protections, rate limits, audit logging verified).
- [ ] Backup/restore tested for DB and object storage.
- [ ] Billing webhooks tested in staging; plan mapping verified in app.
- [ ] Onboarding copy updated to reflect new capabilities.
