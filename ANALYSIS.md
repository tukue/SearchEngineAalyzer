# Web Audit SaaS MVP Analysis

This document summarizes the current strengths of the Web Audit SaaS MVP and outlines recommended steps to make it scalable, secure, and commercially viable.

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

