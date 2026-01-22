# WebAnalyzer Feature Review & Main Backlog

## 1. Feature Audit Summary

### Documents reviewed
- `doc/MVP_FEATURES.md`
- `doc/audit_queue_mvp.md`
- `doc/meta-blueprint-mvp.md`
- `doc/mvp_feature.md`
- `doc/new_features_documentation.md`
- `doc/next_app_overview.md`
- `doc/pipeline-simplification-action-plan.md`
- `doc/pipeline-simplification.md`
- `doc/prioritized-web-audit-plan.md`

### Features identified (by intent)
- Authenticated, multi-tenant access with role-based permissions and tenant-scoped data.
- Reliable audit execution via queue with idempotency, retries, DLQ, and metrics.
- URL intake security (SSRF guardrails) and safe fetching constraints.
- Audit execution stability (timeouts, retry, concurrency caps).
- Persistent audit records, history, and tenant-scoped pagination.
- Audit status/progress surfaced in API/UI.
- Actionable reports with health scores, prioritized fixes, and exports.
- Rerun audits from history/report views.
- Usage limits, quota warnings, and plan gating (free/pro) with upgrade prompts.
- Rate limiting and backpressure for submit/rerun/export.
- Observability and health endpoints (structured logs, /healthz, /readyz).
- Configuration and environment hygiene (required env validation, secrets handling).
- Meta Fix Blueprint (deterministic meta tag recommendations, copy/export, plan gating).
- Shareable summary/copy-all for audit findings.
- Advanced audit modules: Deploy Delta Radar, Revenue Journey Stress Test, Perception of Trust Scan, Delivery Dependency Sentinel, Fragmentation Risk Audit, Content Freshness & Drift Monitor.
- CI/CD pipeline simplification (Node version pinning, single install recipe, lean CI, env var guards, preview smoke checks, local CI command, cache hygiene, dependency scanning).

### Duplicates merged
- **Meta tag fix guidance**: `meta-blueprint-mvp.md` and `mvp_feature.md` both describe deterministic meta-tag recommendations with copyable snippets and shareable outputs; merged into a single “Meta Fix Blueprint” backlog item that includes copy-all/share actions and plan gating.
- **Queue reliability + idempotency**: `MVP_FEATURES.md` and `audit_queue_mvp.md` overlap on durable queuing, retries, DLQ, and status tracking; consolidated into one “Queue-backed audit execution” item.
- **Auth + tenant scoping**: `MVP_FEATURES.md` and `new_features_documentation.md` overlap on write-path auth and tenant isolation; merged into one “Authenticated, tenant-scoped access control” item.
- **Persistence + history**: `MVP_FEATURES.md` and `new_features_documentation.md` overlap on audit record storage and history; merged into one “Persistent audit history” item.
- **Reports + exports**: `MVP_FEATURES.md`, `new_features_documentation.md`, and `mvp_feature.md` overlap on reports/exports/shareable outputs; merged into a single “Actionable reports and exports” item with explicit export formats and shareable summary.
- **Observability + health checks**: `MVP_FEATURES.md` and `new_features_documentation.md` overlap; merged into one “Observability and health endpoints” item.
- **Pipeline improvements**: `pipeline-simplification-action-plan.md` and `pipeline-simplification.md` cover the same CI/CD simplification goals; merged into a single “CI/CD simplification” backlog item with concrete tasks.

### Features excluded (already implemented)
- **Next.js analyze endpoint + URL normalization + fetch limits + tag classification + recommendations** are described as already implemented in `doc/next_app_overview.md` and are excluded from the backlog.
- **Next.js `/api/health` endpoint and `/analyze` UI route** are described as already implemented in `doc/next_app_overview.md` and are excluded from the backlog.

### Features excluded (unclear or speculative)
- **Broad multi-region failover, enterprise SSO/SCIM, deep AI insights** are explicitly non-goals in `doc/MVP_FEATURES.md` and are excluded.
- **Advanced/premium audit ideas** that rely on embeddings or multi-geo/device matrices (from `doc/prioritized-web-audit-plan.md`) are deferred unless explicitly prioritized below.

## 2. Main Feature Backlog

### 1) Authenticated, tenant-scoped access control (M)
**Description:** Add authenticated write-path access (JWT/API key or session), inject tenant/user context, enforce role-based permissions, and ensure all audit data is tenant-scoped.
**Expected outcome/value:** Prevents anonymous usage and guarantees tenant isolation for audit data, history, and billing features.
**Dependencies:** Auth middleware, tenant-aware data model.
**Status:** New
**Notes:** Consolidates MVP multi-tenant access and auth gate requirements.

### 2) URL intake security (SSRF guardrails) (M)
**Description:** Validate and normalize input URLs; block private/loopback/reserved IPs (IPv4/IPv6), prevent protocol downgrades, cap redirects, enforce fetch timeouts and max response sizes.
**Expected outcome/value:** Reduces infrastructure risk and prevents audits from reaching internal resources.
**Dependencies:** URL validation middleware, DNS/IP resolution utilities.
**Status:** New
**Notes:** Complements existing fetch timeouts/size caps by adding SSRF and redirect protections.

### 3) Queue-backed audit execution with idempotency, retries, and DLQ (L)
**Description:** Enqueue audits with standardized payloads, implement idempotency keys, handle retries/backoff and DLQ routing, and track lifecycle status transitions.
**Expected outcome/value:** Reliable audit completion, reduced duplicates, and operational visibility into failures.
**Dependencies:** Queue infrastructure (e.g., BullMQ/Redis), audit run persistence.
**Status:** New
**Notes:** Incorporates metrics/logging for queued/started/succeeded/failed runs.

### 4) Audit execution stability controls (M)
**Description:** Add per-run timeouts, retry on transient errors, and cap concurrency to prevent resource exhaustion.
**Expected outcome/value:** Improves completion rate and avoids hung audits.
**Dependencies:** Audit runner wrapper, queue or in-process executor.
**Status:** New

### 5) Persistent audit records and history (M)
**Description:** Store audit status, timestamps, scores, findings, and raw payloads in Postgres; expose a paginated, tenant-scoped history endpoint and UI view.
**Expected outcome/value:** Allows report retrieval across sessions and supports quotas and reruns.
**Dependencies:** Database schema + repository layer.
**Status:** New

### 6) Status/progress surfacing in API/UI (S)
**Description:** Expose `queued/running/succeeded/failed` status for audits and display progress and error states in the UI with retry actions.
**Expected outcome/value:** Users understand audit lifecycle and can recover from failures.
**Dependencies:** Audit status fields and polling endpoint.
**Status:** New

### 7) Actionable reports and exports (M)
**Description:** Provide report detail pages with scores, top issues, and prioritized fixes; support PDF/HTML/JSON/CSV exports and a shareable summary/copy-all flow.
**Expected outcome/value:** Users can share findings and act on fixes quickly.
**Dependencies:** Stored audit results and export serialization.
**Status:** Partial (extension)
**Notes:** Builds on existing recommendations to add full report views and export tooling.

### 8) Rerun audit from history/report (S)
**Description:** Allow users to rerun an audit using the stored URL and create a new audit record while preserving the original.
**Expected outcome/value:** Enables refresh of stale results without re-entering URL.
**Dependencies:** Audit history persistence.
**Status:** New

### 9) Usage limits and plan gating (M)
**Description:** Track monthly audit usage per tenant, surface quota warnings at 80%/90%, enforce over-limit blocking, and gate features (exports/history depth/copy actions) by plan.
**Expected outcome/value:** Supports monetization and prevents runaway usage.
**Dependencies:** Usage ledger + plan configuration.
**Status:** New

### 10) Rate limiting and backpressure (S)
**Description:** Add per-IP/tenant rate limits for submit/rerun/export endpoints, returning 429s with retry guidance.
**Expected outcome/value:** Prevents abuse and helps stabilize throughput.
**Dependencies:** Middleware + rate limit storage.
**Status:** New

### 11) Observability and health endpoints (S)
**Description:** Add structured logs with request/run IDs and `/healthz` + `/readyz` endpoints that validate DB/queue/browser readiness.
**Expected outcome/value:** Easier debugging and safer deployments with liveness/readiness checks.
**Dependencies:** Logger utility and health routes.
**Status:** Partial (extension)
**Notes:** Extends existing `/api/health` to include readiness checks and structured logging.

### 12) Configuration and environment hygiene (S)
**Description:** Document required env vars, provide `.env.example` updates, and fail fast when critical vars are missing; ensure secrets are loaded securely.
**Expected outcome/value:** Consistent deploys and fewer runtime misconfigurations.
**Dependencies:** Config loader.
**Status:** New

### 13) Meta Fix Blueprint (deterministic recommendations + UI) (M)
**Description:** Generate deterministic meta tag recommendations (title/description/OG/Twitter) from audit findings; provide copy buttons, character counts, empty state handling, and plan-gated copy/export actions.
**Expected outcome/value:** Users get copy-ready fixes tied to findings without manual research.
**Dependencies:** Stored audit findings + plan gating.
**Status:** New

### 14) Deploy Delta Radar (M)
**Description:** Store a baseline audit per URL/flow and surface regressions/deltas since the previous run.
**Expected outcome/value:** Provides ship/no-ship confidence by highlighting negative changes only.
**Dependencies:** Baseline storage and diffing logic.
**Status:** New

### 15) Revenue Journey Stress Test (L)
**Description:** Execute a small set of scripted, multi-step Playwright flows under varied network profiles and report latency/completion thresholds.
**Expected outcome/value:** Protects conversion-critical flows from regressions.
**Dependencies:** Playwright scripts + flow runner.
**Status:** New

### 16) Perception of Trust Scan (M)
**Description:** Run rule-based checks for trust cues (HTTPS hygiene, mixed content, favicon/logo presence, policy link discoverability).
**Expected outcome/value:** Flags trust breakers that can hurt conversions.
**Dependencies:** DOM/header checks during audits.
**Status:** New

### 17) CI/CD simplification (M)
**Description:** Pin Node 20 via `.nvmrc`, standardize install commands, simplify CI to a single `ci:checks` job, add env var guards, add preview smoke checks, and provide a one-command local CI script.
**Expected outcome/value:** Faster and more reliable delivery with consistent builds across environments.
**Dependencies:** GitHub Actions workflow updates and scripts.
**Status:** New

## 3. Deferred / Out-of-Scope Features
- **Delivery Dependency Sentinel** (network waterfall attribution) — Deferred as MVP stretch/premium.
- **Fragmentation Risk Audit** (cross-page template variance detection) — Deferred as MVP stretch/premium.
- **Content Freshness & Drift Monitor** (light crawl + embeddings) — Deferred due to embedding and crawl complexity.
- **Enterprise SSO/SCIM, multi-region failover, deep AI insights** — Explicitly excluded as non-goals in MVP docs.

## 4. Prioritization Rationale
1. **Core workflow safety and integrity first:** Auth/tenant isolation, SSRF protections, reliable execution, persistence, and status visibility are blocking dependencies for any trustworthy audits.
2. **User value delivery next:** Reports/exports, reruns, usage limits, and Meta Fix Blueprint provide actionable outcomes and monetization hooks once data is stable.
3. **Operational readiness:** Observability, config hygiene, and pipeline simplification ensure the product is deployable and maintainable.
4. **Differentiating audit modules last:** Delta Radar, Revenue Journey Stress Test, and Trust Scan expand value but depend on the core pipeline.
5. **Stretch/premium items deferred:** The more complex multi-page and embedding-based features are intentionally deferred.
