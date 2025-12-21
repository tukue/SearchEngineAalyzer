# New Feature Documentation – Web Audit MVP

Concise documentation of the MVP features that remain to be implemented for the Web Audit app. These items assume the existing flow: user submits URL → audit runs (SEO/performance/accessibility/best practices/meta) → results persist → reports can be viewed, rerun, and exported.

## App Assumptions
- Node/Express API with existing `/api/meta/analyze` or `/api/audits` handler.
- Frontend is React/TypeScript with pages for submission, history, and report detail.
- Drizzle/Postgres available; MemStorage currently in code for tests.
- No current auth or SSRF guardrails; queue optional but not mandatory for MVP.

## Feature Requirements (MVP)

### 1) URL Intake with SSRF Guardrails (P0)
- **Why it matters:** Protects infrastructure from internal network access and bad inputs.
- **Scope:** Reject non-HTTP/HTTPS, private/loopback/reserved IPs (IPv4/IPv6); enforce fetch timeout and max body size; validate redirect chains to avoid protocol downgrade and private-target hops.
- **Minimal implementation:** Add middleware to normalize and validate URLs; perform DNS resolve + IP check for IPv4/IPv6; enforce HTTPS; set request timeout and size limits; cap redirect hops and reject protocol downgrades.
- **Verification:** Submit invalid, private, and valid URLs; confirm 400 for blocked targets and 202/200 for valid ones; test redirect chains to private IPs and HTTPS→HTTP downgrades are blocked.
- **Likely files:** `server/routes/audits.ts`, `server/middleware/validateUrl.ts`, `server/config/security.ts`.

### 2) Auth Gate for Write Paths (P0)
- **Why it matters:** Prevents anonymous usage and enables tenant scoping for quotas/history.
- **Scope:** Token/API-key or session auth on POST routes (submit/rerun/export), tenant/user context passed downstream; secure token validation and storage with rotation/expiration.
- **Minimal implementation:** Add auth middleware with JWT/API-key validation (HMAC/RS256); reject missing/invalid/expired tokens; inject `tenantId/userId` into handlers; store secrets in a secrets manager or env only at boot and rotate keys periodically.
- **Verification:** Call write endpoints with/without valid token; ensure tenant context is stored with audits; verify expired/rotated tokens are rejected.
- **Likely files:** `server/middleware/auth.ts`, `server/routes/*.ts`, `server/config/auth.ts`.

### 3) Audit Execution Stability (P0)
- **Why it matters:** Prevents hung requests and improves completion rate.
- **Scope:** Per-run timeout, single retry on transient network errors, limited concurrency.
- **Minimal implementation:** Wrap audit runner with timeout + retry; optional semaphore to cap concurrent audits; ensure browser/page closes.
- **Verification:** Run against slow and fast URLs; confirm timeout path returns `failed` with reason; concurrent submissions do not stall.
- **Likely files:** `server/services/auditRunner.ts`, `server/config/audit.ts`.

### 4) Persistent Audit Records & History (P0)
- **Why it matters:** Enables report retrieval, rerun, and quota accuracy after restarts.
- **Scope:** Store audit record with status, timestamps, scores, issues, encrypted raw payload; list endpoint with pagination and tenant isolation.
- **Minimal implementation:** Wire Drizzle/Postgres repository with encryption at rest (DB-managed or application-level for sensitive blobs); replace MemStorage in runtime; add list route with limit/offset or cursor that enforces tenant scoping/ACLs.
- **Verification:** Submit audits, restart server, confirm history persists; verify pagination returns consistent ordering; ensure tenants cannot read others’ records and encrypted payloads are inaccessible without keys.
- **Likely files:** `server/db/schema.ts`, `server/repositories/auditRepo.ts`, `server/routes/history.ts`.

### 5) Status/Progress Surfacing (P1)
- **Why it matters:** Users need clarity while audits run or fail.
- **Scope:** Expose `queued/running/success/failed` states via API and UI; show error banner and retry action on failure.
- **Minimal implementation:** Add status fields to audit model; poll `/api/audits/:id`; UI shows spinner/badge and error message.
- **Verification:** Submit audit and watch status change; force a failure to confirm UI messaging and retry works.
- **Likely files:** `client/src/components/AuditStatus.tsx`, `client/src/pages/index.tsx`, `client/src/api/audits.ts`.

### 6) Report Detail + Export (P1)
- **Why it matters:** Delivers shareable, actionable output.
- **Scope:** Report page with scores and top issues; export to PDF/JSON/CSV.
- **Minimal implementation:** Backend export endpoint serializing stored result; frontend export buttons; simple HTML-to-PDF converter acceptable.
- **Verification:** Open report; trigger exports; validate MIME types and content; 404 on missing auditId.
- **Likely files:** `server/routes/exports.ts`, `server/serializers/reportExport.ts`, `client/src/pages/reports/[id].tsx`, `client/src/components/ExportMenu.tsx`.

### 7) Rerun Audit (P1)
- **Why it matters:** Lets users refresh stale results.
- **Scope:** Endpoint to enqueue a new run using stored URL; UI button in history/report views.
- **Minimal implementation:** `POST /api/audits/:id/rerun` creates new audit record with new status; returns new `auditId`.
- **Verification:** Rerun from history; confirm new entry appears and original remains intact.
- **Likely files:** `server/routes/audits.ts`, `server/services/auditRunner.ts`, `client/src/components/HistoryTable.tsx`.

### 8) Rate Limiting & Backpressure (P1)
- **Why it matters:** Protects service from abuse and runaway costs.
- **Scope:** Per-IP/tenant limits on submit/rerun/export; optional simple queue/semaphore to smooth spikes.
- **Minimal implementation:** Express middleware using fixed window or token bucket; return 429 with retry messaging.
- **Verification:** Exceed threshold in quick succession; observe 429s while normal traffic succeeds.
- **Likely files:** `server/middleware/rateLimit.ts`, `server/routes/*.ts`, `server/config/rateLimit.ts`.

### 9) Observability & Health (P1)
- **Why it matters:** Aids debugging and deploy readiness.
- **Scope:** Structured logs with `requestId`/`auditId`; `/healthz` (liveness) and `/readyz` (DB/queue/browser).
- **Minimal implementation:** Logger utility; add lifecycle logs to submit, run start/end, failure; implement health/readiness routes.
- **Verification:** Tail logs during submit/fail; curl health/readiness; simulate DB down to see `/readyz` fail.
- **Likely files:** `server/lib/logger.ts`, `server/routes/health.ts`, `server/routes/audits.ts`.

### 10) Configuration & Env Hygiene (P1)
- **Why it matters:** Ensures consistent deploys and quick setup.
- **Scope:** Document required environment variables and fail fast when missing; secure handling of credentials via secrets manager or encrypted storage.
- **Minimal implementation:** `.env.example` updates with placeholders; config loader that throws on absent critical vars (DB URL, API keys, Chrome path, base URLs); integrate secrets manager or encrypted env injection for production, avoiding hard-coded credentials.
- **Verification:** Start app without vars to confirm clear error; with vars set, app boots and audits run; ensure production loads secrets from manager and rejects hard-coded defaults.
- **Likely files:** `.env.example`, `server/config/index.ts`, `client/.env.example`.
