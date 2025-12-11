# Must-Have Feature Implementation Plan

Deliver features sequentially. Finish one section before starting the next. Keep KISS, SOLID, and clean architecture: controllers thin, services explicit, repositories scoped, and infra concerns isolated.

## 0) Foundations (Pre-flight)
- [ ] Confirm auth middleware surfaces `tenantId` and `userId` (server/index.ts). Add a dev-only `/api/debug/context` route to echo resolved context.
- [ ] Document current DB schema and queue/storage choices in `README.md` or `/docs` for fast onboarding.
- [ ] Add a shared request context type in `shared/` so server routes and workers use the same contract.

## 1) Authenticated Multi-Tenant Access
- [ ] Add request context middleware to extract/validate `tenantId`/`userId` from tokens; reject missing/invalid (server/index.ts → new middleware module).
- [ ] Introduce a tenant-scoped repository base that always scopes queries by `tenantId` (e.g., `server/repositories/tenantRepository.ts`).
- [ ] Add role checks (owner/member/read-only) in services before mutating audits; gate write routes in `server/routes.ts`.
- [ ] Tests: cross-tenant access blocked; roles enforced across API handlers and repositories.

## 2) Reliable Audit Queueing
- [ ] Standardize job payload and idempotency key `tenantId|auditType|url`; producer lives in API route, consumer in worker module.
- [ ] Configure retries with exponential backoff, per-job timeout, and dead-letter queue; expose minimal metrics/logs for enqueue/start/success/fail.
- [ ] Protect upstreams with timeouts/circuit-breakers when fetching sites (see `server/routes.ts`).
- [ ] Tests: duplicate submissions blocked; retries back off; DLQ receives poison messages.

## 3) Result Persistence & History
- [ ] Add migrations for `audits`, `audit_runs`, `findings` with indexes on `(tenantId, createdAt)`; keep large artifacts in object storage URLs.
- [ ] Persist summaries/findings in worker after audit completes; raw payloads go to storage via `server/storage.ts`.
- [ ] API: fetch last N runs per audit (tenant-scoped) with findings and timestamps; wire UI to list history in client.
- [ ] Tests: creation, retrieval, and tenant isolation for runs and findings.

## 4) Actionable Reports
- [ ] Reporting service computes health score, pass/fail counts, and prioritized fixes (impact × effort); controllers just call it.
- [ ] UI renders summary cards, prioritized list, and previous-run delta; keep components small and pure.
- [ ] PDF/HTML export with signed/expiring share links; gate via entitlements helper.
- [ ] Tests: summary correctness, gating, export flow; snapshot export if feasible.

## 5) Usage Limits
- [ ] Create `usage_ledger` table and atomic helper to read/update monthly counts; wrap in transaction/lock.
- [ ] Middleware guard rejects enqueue when quota exceeded; return remaining/limit in error body.
- [ ] Scheduled job resets counts monthly and emits 80/90% warnings (log or notification hook).
- [ ] Tests: warnings, blocking, and reset logic (unit + integration at API boundary).

## 6) Plan Gating
- [ ] Define plan config (Free/Pro/Team) with quotas and feature flags; seed `tenant_plan` mapping.
- [ ] Entitlements helper resolves plan → capabilities (exports, history depth, webhooks placeholder) and is reused by API/UI.
- [ ] Apply entitlements checks in routes, services, and UI components (e.g., hide export button when not allowed).
- [ ] Tests: Free vs. Pro behavior verified in API responses and UI rendering.

## 7) Operational Hygiene
- [ ] CI: lint + tests + build for client (`client/`) and server (`server/`); fail fast on type errors.
- [ ] Deploy: run migrations (drizzle) with rollback guidance; keep env-driven config for URLs/keys.
- [ ] Secrets via env/secret store; remove any hardcoded credentials.
- [ ] Post-deploy smoke script hits `/api/health` and a sample `/api/analyze` to verify pipeline.

## 8) Observability & Rollout
- [ ] Feature flags for gated features to allow staged rollout; default new features off.
- [ ] Dashboards: queue latency, job failure rate, audit throughput, per-tenant usage; alerts on SLO breach.
- [ ] Instrument API and worker logs with request/job IDs; include tenantId in structured logs.

## 9) Launch Checklist
- [ ] Security review (SSRF protections, rate limits, audit logging verified).
- [ ] Backup/restore tested for DB and object storage.
- [ ] Billing webhooks tested in staging; plan mapping verified in app.
- [ ] Onboarding copy updated in client to highlight new capabilities and limits.
