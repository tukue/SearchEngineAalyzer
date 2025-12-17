# Web Audit SaaS MVP Analysis

This document summarizes the current strengths of the Web Audit SaaS MVP and outlines recommended steps to make it scalable, secure, and commercially viable.

## 0. Must-Have Features (MVP, integrate with current code)
- **Authenticated multi-tenant access**: Keep the existing login/register flow and ensure every API call and DB query is scoped by `tenant_id`/`user_id` (start with middleware + per-request context).
- **Run + queue audits**: Use the current audit trigger UI/API but back it with a queued job (existing worker/`server` queue) with idempotent job keys, retries, and timeouts to avoid duplicate runs.
- **Result persistence + history**: Persist summaries in the current database tables; store raw artifacts in object storage if large. Surface a “Recent runs” list (last 5) in the existing dashboard component.
- **Actionable reports**: Reuse the present results view to show a health score, pass/fail counts, and the top 3–5 prioritized fixes with impact/effort hints; add PDF/HTML export behind a feature flag if already partially implemented.
- **Usage limits**: Add a simple monthly counter per tenant (DB table + middleware) and display remaining quota in the dashboard. Block new jobs gracefully when exceeded.
- **Basic plans**: Hard-code plan flags (Free/Pro) in config or DB seed; gate exports/history length/webhooks with those flags while Stripe/Paddle is being wired.
- **Operational hygiene**: CI runs lint/tests; migrations are applied before deploy; env secrets loaded via existing `.env` mechanism; add minimal audit logging for auth and audit submissions.

## 1. Evaluation of Current MVP
- **Strengths**: Functional end-to-end audit flow; actionable results; fast time-to-value.
- **Gaps**: Limited reliability/scalability for job handling; insufficient tenant isolation and data governance; UX polish needed for onboarding and reporting; monetization controls absent.

## 2. Positioning & Core Value
- **Launch Message**: "Fast, automated web audits that surface prioritized fixes and measurable impact."
- **Outcomes to Highlight**: Health snapshot, prioritized fixes with estimated impact, and history/trends for accountability.
- **Insights to Polish First**: Summary health score; top 5 prioritized actions with impact/effort; clear categories (performance, SEO, accessibility, security); history of last 5 runs with trends; exportable PDF/HTML reports; concise "how to fix" snippets.

## 3. Technical Improvements
### Job Handling / Async Architecture
- Standardize queue worker with retry + backoff, dead-letter queue, per-tenant rate limits, and idempotent job keys.
- Add timeouts and circuit breakers for external calls; ensure structured logging.

### Audit Result Storage & History
- Suggested schema: `audits` (id, tenant_id, url, audit_type, status, timestamps), `audit_runs` (id, audit_id, started/completed, status, score), `findings` (id, audit_run_id, category, severity, impact/effort, raw_ref).
- Store large raw artifacts in object storage; keep summaries in DB; index `(tenant_id, url, created_at)`; include `version` for audit engine changes.

### Account/Tenant Isolation & Security
- Enforce tenant scoping at ORM/service layer (consider Postgres RLS); per-tenant API keys and RBAC roles (owner, member, read-only).
- Harden inputs (URL validation, SSRF protection), add rate limits, audit logging, secret rotation, and minimum TLS settings.

## 4. UX Improvements
- Guided first audit with pre-filled example and progress indicator.
- Dashboard: hero health score, top 3 actions, last 5 runs with trends, quota remaining, and clear "Run audit" CTA.
- Report layout: summary score, pass/fail counts, top prioritized fixes, category scores, trend deltas, and exportable PDF/HTML/shareable links.

## 5. Monetization Readiness
- **Tiers**: Free/Trial (3–5 audits/mo, single project), Pro (100–250 audits/mo, multiple projects), Team (500–1,000 audits/mo, roles/webhooks), Enterprise (custom limits/support).
- **Enforcement**: Usage meter per tenant with warnings at 80/90% and hard caps; feature flags by plan; monthly counter reset via cron; billing via Stripe/Paddle with plan sync webhooks.

## 6. Roadmap
- **Phase 1 – Quick Wins**: Tenant-scoped RBAC and API keys; usage limits and plan flags; queue hardening; dashboard polish with trends and quota; PDF/HTML export with share links.
- **Phase 2 – Differentiation**: Trend charts, project comparisons, webhooks/CI triggers, improved impact/effort scoring, object storage for raw artifacts, stricter isolation (e.g., RLS).
- **Phase 3 – Advanced**: AI insights for fix tickets, deeper CI/CD checks, alerts on regressions, org SSO/SCIM, audit trails, multi-region workers with autoscaling and SLOs.

## 7. CI/CD Pipeline for Easy Deployment
- **Source control & quality gates**: Protect `main` with mandatory PR reviews; run unit tests, linting, and type checks on every PR using GitHub Actions (or your preferred CI). Block merges on failures.
- **Build & artifact steps**: Build frontend assets and container images for frontend/backend; tag images with commit SHA and `latest` per environment. Cache dependencies to speed up builds.
- **Environment matrices**: Separate pipelines for `staging` and `production` triggered by branch or tag conventions (e.g., `main` → staging, `v*` tags → production).
- **Database migrations**: Run migrations as a pre-deploy step with rollback strategy (e.g., `drizzle-kit migrate`). Require migrations to be idempotent and backward compatible.
- **Deploy automation**: Use IaC (Docker Compose/Kubernetes/managed PaaS) with zero-downtime rollout (blue/green or rolling). Promote the same artifact from staging to production after smoke tests.
- **Secrets & config**: Inject secrets via CI-managed variables (e.g., GitHub Secrets). Never bake secrets into images. Use per-environment configuration files and feature flags.
- **Tests after deploy**: Run smoke/end-to-end checks against staging and post-deploy health checks in production. Roll back automatically on failures.
- **Observability hooks**: Publish build metadata, deploy version, and changelog to your monitoring/logging stack. Alert on failed deploys or elevated error rates immediately after release.

