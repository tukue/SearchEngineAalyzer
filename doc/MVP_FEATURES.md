# Web Audit SaaS MVP Features

This document defines the minimum viable product (MVP) feature set for the Meta Tag Analyzer / Web Audit SaaS. It aligns the build with the must-have outcomes in `ANALYSIS.md` and the incremental design steps in `DESIGN.md` so engineering, design, and GTM stay in sync.

## Product Goals

- Ship a secure, reliable audit workflow that demonstrates value in the first session.
- Keep tenants isolated while preserving a fast path from sign-up to first audit.
- Provide actionable, exportable reports that help users fix issues and monitor progress.
- Enforce simple plan rules (limits and entitlements) to prepare for monetization.

## MVP Release Definition

- **Audience:** Early adopters evaluating automated web audits for SEO/metadata health.
- **Success Metrics:**
  - <3% job failure rate after retries; 95th percentile audit completion under target SLA.
  - Zero cross-tenant data leakage; all requests scoped to authenticated tenant and user.
  - Clear quota messaging with graceful blocking once limits are reached.
  - Exports and history match plan entitlements; top fixes are obvious and reproducible.
- **Non-Goals:** Enterprise SSO/SCIM, multi-region failover, or deep AI insights.

## Feature Breakdown (Must-Have)

Each item lists the customer promise, key behaviors, and acceptance criteria for the MVP.

### 1) Authenticated Multi-Tenant Access
- **Outcome:** Every action is tied to a logged-in user and tenant with role-aware access.
- **Behaviors:**
  - Requests include tenant and user context after auth; DB queries are tenant-scoped.
  - Roles (owner/member/read-only) govern audit creation, exports, and settings changes.
- **Acceptance:**
  - Cross-tenant access attempts return 403/404; audit results never leak between tenants.
  - Session/JWT renewal preserves tenant context; audit logs capture login and audit submissions.

### 2) Reliable Audit Runs via Queue
- **Outcome:** Audit triggers enqueue durable jobs to avoid duplicates and ensure completion.
- **Behaviors:**
  - Job payloads are standardized with `{tenantId, userId, url, auditType, requestId}`.
  - Idempotency keys prevent duplicate runs; retries/backoff and dead-letter queues handle failures.
- **Acceptance:**
  - Users can trigger an audit, see queued/processing states, and receive results or error messaging.
  - Job metrics (queued/started/succeeded/failed duration) are emitted for observability.

### 3) Result Persistence & History
- **Outcome:** Audit summaries and findings are stored and visible across sessions.
- **Behaviors:**
  - Audit runs persist summary JSON, scores, timestamps, and top findings; large artifacts can live in object storage.
  - Dashboard exposes the last 5 runs per project/audit with trend indicators when available.
- **Acceptance:**
  - Refreshing the app preserves recent runs; pagination or truncation respects plan limits.
  - Data model indexes tenant and audit identifiers to keep history queries responsive.

### 4) Actionable Reports
- **Outcome:** Users see a health score, pass/fail counts, and prioritized fixes with impact/effort hints.
- **Behaviors:**
  - Top 3–5 recommended fixes surface first; category filters highlight SEO/Social/Technical tags.
  - Export to PDF/HTML behind a feature flag; exports reflect the on-screen data.
- **Acceptance:**
  - Reports display consistent scores and counts across views; exports succeed or provide a clear error.
  - Each finding links to guidance (“what to fix” and “why it matters”).

### 5) Usage Limits
- **Outcome:** Monthly audit caps per tenant with proactive warnings and graceful blocking.
- **Behaviors:**
  - Usage ledger increments on enqueue or completion; scheduled job resets monthly counters.
  - Dashboard shows remaining quota; requests beyond quota return 402/429-style responses.
- **Acceptance:**
  - Quota warnings appear at 80% and 90%; audit requests beyond the limit are blocked without crashes.
  - Usage data is tenant-scoped and auditable.

### 6) Plan Gating (Free vs. Pro)
- **Outcome:** Feature access depends on the tenant’s plan to enable upsell without surprise interruptions.
- **Behaviors:**
  - Plans config defines quotas and entitlements (exports, history depth, webhooks when available).
  - UI hides or disables gated actions for ineligible plans; backend enforces the same rules.
- **Acceptance:**
  - Changing a tenant’s plan immediately updates allowed features; history length respects plan caps.
  - Gated features provide upgrade prompts instead of silent failures.

### 7) Operational Hygiene
- **Outcome:** MVP ships with basic quality gates, migrations, and secrets management.
- **Behaviors:**
  - CI runs lint/tests on PRs; migrations run before deploy; secrets load from environment variables.
  - Structured logs and audit trails exist for auth and audit submission events.
- **Acceptance:**
  - A failing test or migration blocks deploy; no secrets are committed to the repo.
  - Post-deploy smoke tests verify the audit flow and exports.

## User Journeys
- **New tenant runs first audit:** sign up → landing page highlights value → enter URL → audit enqueued → progress indicator → results with top fixes → invite teammate (optional).
- **Returning user monitors progress:** log in → dashboard shows recent runs + trends → view quota remaining → export report for stakeholders.
- **Tenant hits quota:** dashboard warns at 80/90% → audit button disabled when exceeded → prompt to upgrade plan.

## Release Checklist
- Tenant-scoped auth middleware enabled across API routes.
- Queue worker configured with retries, dead-letter handling, and observability hooks.
- DB schema for audits, runs, findings, usage ledger, and tenant plans migrated and seeded.
- Dashboard updated to show recent runs, quota remaining, and gated actions.
- Export feature flagged per plan; errors are surfaced with user-friendly messaging.
- CI pipeline green; smoke tests cover sign-in, audit submission, history display, quota block, and export flow.
