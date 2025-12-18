# MVP Readiness – Meta Tag Analyzer

Lean assessment of the current MVP (URL → audit → stored result → report) with decisions focused on shipping quickly and safely.

## Core Problem Validation
- Early adopters need a fast way to verify a page’s meta tags and get fix-ready recommendations. The current flow (`POST /api/meta/analyze`) already parses meta data and returns recommendations inline, so the MVP should center on that speed and clarity.

## MVP Feature Matrix
- **Must**: URL submission with validation, audit execution with quota checks, persisted audit record, results view (scores/tags/recommendations), read-only share link, error states, basic auth/gating for write paths, minimal rate limiting/backpressure, request/job logging.
- **Should**: Retry/backoff for flaky fetches, short-term audit history list, health/metrics endpoint, export to PDF/HTML of report, dedupe recent requests.
- **Later**: Team roles/SSO, scheduled audits/alerts, custom audit profiles, trend dashboards, webhooks/integrations.

## Architecture Readiness (API / Data / Compute / Security)
- **API & Workflow**: Single Express API with in-process audit handler; usage limits and plan gating already wrap `/api/meta/analyze`, but the audit still runs synchronously on the web thread. **Decision**: Keep synchronous handler for MVP, but add per-request timeout and retry to avoid web thread stalls; queue only if the timeouts are insufficient.
- **Data**: Storage is in-memory (`MemStorage`) with Drizzle schemas defined but not wired. **Decision**: Promote Drizzle to the live code path for audits/usage and keep the in-memory store only for tests; persist analysis records, usage ledger, and plan changes.
- **Compute**: Single Node process; audits use `fetch + cheerio` (no headless browser). **Decision**: Cap concurrent audits (e.g., simple semaphore) and apply network/request timeouts to keep the process responsive; scale-out later.
- **Security**: No auth on API routes, and URL fetch has no SSRF or private-network guardrails. **Decision**: Require auth/token on write routes, reject non-HTTPS and private/localhost targets, and set conservative fetch limits (timeout, max size). Add signed, read-only share links for reports.

## Critical Risks & Mitigations
- **Volatile storage**: In-memory data loses audits on restart → move audits/usage to the Drizzle-backed database now.
- **Inline long-running audits**: Network stalls can block the web thread → enforce timeouts and limited retries; if still slow, enqueue to the existing in-memory queue with a small worker.
- **SSRF/data exfiltration**: Unvalidated target URLs could hit internal hosts → block private/loopback ranges and require HTTPS.
- **No auth/tenant isolation**: Default tenant context means any caller can use the API → gate `/api` writes behind auth/token and ensure tenant context is derived from identity.
- **Quota bypass**: Quota ledger lives in memory → persist reservations/usage to prevent resets after restart.

## Non-Negotiable MVP Requirements
- Submit → audit → store → retrieve must succeed with clear queued/running/failed/completed states.
- URL validation with SSRF protections and request timeouts.
- Persistent storage for audit results, usage ledger, and plan changes.
- Authenticated submissions; share links are signed and read-only.
- Logging for requests and audit outcomes; health/metrics endpoint exposed.

## Launch Readiness Checklist
- **Product**
  - [ ] URL form enforces HTTPS and explains quota/state transitions.
  - [ ] Report page shows scores, missing tags, recommendations, timestamp, and audited URL.
  - [ ] Shareable link works read-only and expires or is signed.
  - [ ] Error/retry states are visible to the user.
- **Tech**
  - [ ] Audits persist to the database (not memory) with history and quotas wired.
  - [ ] SSRF guardrails + request/response size and timeouts.
  - [ ] Auth/token required for write paths; tenant derived from identity.
  - [ ] Basic rate limiting/backpressure to protect the audit handler.
  - [ ] Health/metrics endpoint and request/audit logs live in the deploy.
  - [ ] CI smoke test: submit URL → audit completes → report retrieved.
