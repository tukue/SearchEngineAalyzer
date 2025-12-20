# Design: Implementing Must-Have MVP Features

This design describes how to implement the must-have features listed in `ANALYSIS.md` using the current Web Audit SaaS stack. It focuses on incremental changes that fit the existing codebase and hosting model.

## Goals & Non-Goals
- **Goals**: Secure multi-tenant access, reliable queued audits, persisted history, actionable reports, usage limits, plan gating, and operational hygiene (tests, migrations, secrets).
- **Non-goals**: Full enterprise features (SSO/SCIM), multi-region failover, or deep AI insights—these belong to later phases.

## Architectural Context
- **Frontend**: Vite + React (Tailwind), currently rendering dashboard and audit results.
- **Backend**: Node/Express (server directory) with existing audit trigger endpoints and queue/worker primitives.
- **Storage**: Primary relational DB (Drizzle config present) for users/tenants/audits; object storage can be added later for raw artifacts.
- **CI/CD**: GitHub Actions (or similar) running lint/tests; containerized deploy via Docker Compose/Kubernetes.

## Feature Designs
### 1) Authenticated Multi-Tenant Access
- **Scope**: Ensure every request is scoped by `tenant_id`/`user_id` from the session/JWT.
- **Design**:
  - Add request-scoped context middleware that injects `tenantId` and `userId` after auth.
  - Wrap DB helpers to automatically include `tenantId` filters; reject cross-tenant access early.
  - Add role checks (owner/member/read-only) on audit mutation endpoints.

### 2) Run + Queue Audits Reliably
- **Scope**: Back the existing audit trigger with a durable queue.
- **Design**:
  - Standardize job payload `{tenantId, userId, url, auditType, requestId}`.
  - Use idempotency key `hash(tenantId + url + auditType + scheduledAt bucket)` to dedupe.
  - Configure retries with exponential backoff and a dead-letter queue; set per-job timeout.
  - Emit structured logs and job metrics (queued, started, succeeded, failed durations).

### 3) Result Persistence + History
- **Scope**: Persist summaries in DB and expose recent runs.
- **Design**:
  - Tables: `audits(id, tenant_id, url, audit_type, created_at, updated_at)`, `audit_runs(id, audit_id, status, score, summary_json, started_at, completed_at)`, `findings(id, audit_run_id, category, severity, impact, effort, message, raw_ref)`.
  - Store large artifacts in object storage; keep `summary_json` small.
  - API endpoints return last 5 runs per audit; index `(tenant_id, audit_id, created_at)`.

### 4) Actionable Reports
- **Scope**: Present clear scores and prioritized fixes.
- **Design**:
  - Compute `healthScore`, pass/fail counts, and top 3–5 findings by `impact/effort` ratio.
  - Add export service producing PDF/HTML; gate behind plan flag.
  - Include trend delta vs. previous run when history exists.

### 5) Usage Limits
- **Scope**: Simple monthly caps per tenant.
- **Design**:
  - Table `usage_ledger(id, tenant_id, month, audit_runs, last_reset_at)`; increment on job enqueue or completion.
  - Middleware checks quota before enqueuing; return 402/429-style response when exceeded.
  - Scheduled job resets counters monthly; send warnings at 80/90% thresholds.

### 6) Plan Gating
- **Scope**: Hard-coded Free/Pro plan flags.
- **Design**:
  - `plans` config defining quotas and features (exports, history length, webhooks).
  - `tenant_plan` mapping table or seeded field on tenant record.
  - Feature checks centralized in a small `entitlements` helper; UI hides gated actions when unavailable.

### 7) Operational Hygiene
- **Scope**: CI, migrations, secrets, and observability.
- **Design**:
  - CI runs lint/tests on PR; build artifacts for frontend/backend.
  - Migration workflow: `drizzle-kit generate && drizzle-kit migrate` before deploy.
  - Secrets from environment; never stored in repo; rotate keys periodically.
  - Post-deploy smoke tests + alerts on error-rate spikes.

## Success Metrics
- <3% job failure rate after retries; 95th percentile audit completion under target SLA.
- Zero cross-tenant data leakage in integration tests.
- Quota errors surfaced gracefully with user-facing messaging.
- Exports and history match plan entitlements.

## Risks & Mitigations
- **Queue overload**: Add backpressure and per-tenant rate limits.
- **Large payloads**: Move raw artifacts to object storage with signed URLs.
- **Migration errors**: Use backward-compatible migrations and staged rollouts.
- **UX confusion**: Surface quota and plan info prominently in dashboard and run modal.
