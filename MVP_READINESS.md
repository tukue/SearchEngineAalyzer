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

## MVP Readiness Coverage (Current Build)
| Item | Status | Notes | Priority |
| --- | --- | --- | --- |
| Health endpoint for uptime checks | ✅ Implemented | `/api/health` responds with status/version. | P1 |
| URL submission + audit execution | ⚠️ Partially implemented | `/api/meta/analyze` fetches and parses meta tags inline on the web thread; no timeout/backoff and no input allowlist. | P0 |
| Quota/plan gating | ⚠️ Partially implemented | Middleware exists but uses in-memory ledger with default tenant; resets on restart. | P0 |
| Persistent audit storage/history | ❌ Missing | `MemStorage` only; Drizzle schemas unused in runtime. | P0 |
| SSRF and URL safety | ❌ Missing | No HTTPS-only enforcement, no private/localhost blocking, no response size/time limits. | P0 |
| Auth for write paths | ❌ Missing | API routes unauthenticated; tenant context is defaulted. | P0 |
| Shareable read-only reports | ❌ Missing | No signed link or read-only report route. | P1 |
| Report UX (scores, missing tags, recommendations) | ⚠️ Partially implemented | API returns structured data; confirm client surfaces scores, missing tags, and recommendations with loading/error states. | P1 |
| Error/retry visibility | ⚠️ Partially implemented | API returns errors but UI handling not verified; no retry/backoff surfaced. | P1 |
| Rate limiting/backpressure | ❌ Missing | No per-tenant/IP throttling; queue only dedupes in-memory. | P0 |
| Logging/observability | ⚠️ Partially implemented | Basic API request logging; no structured logs or metrics/health alerts. | P2 |
| CI smoke test (submit → audit → report) | ❌ Missing | No automated e2e covering the primary flow. | P1 |
| Export/PDF | ❌ Missing | Not present. | P2 |

## Launch Blockers (P0)
- Inline audit execution without timeouts/retries risks hanging the web thread.
- No SSRF protection (allows localhost/private network fetches) and no HTTPS-only enforcement.
- No auth or tenant-derived context for write paths.
- Audit/usage storage is in-memory; results and quota reset on restart.
- No rate limiting/backpressure to protect the audit handler.
- Quota/plan gating depends on volatile storage (can be bypassed after restart).

## UX / Product Flow Gaps
- Unknown client handling for loading/error/retry states during audits.
- No confirmation that reports show missing tags and recommendations clearly.
- No shareable report experience or read-only tokenized view.

## Minimum Action Plan to Ship (Prioritized)
1) Wire Drizzle/DB for audits, usage ledger, and plan changes; keep MemStorage for tests.  
2) Add request validation guards: HTTPS-only, block private/loopback IPs, enforce fetch timeout and max body size for `/api/meta/analyze`.  
3) Add lightweight auth/token gate for write paths and derive tenant context from identity.  
4) Add basic rate limiting/backpressure (per-IP or per-tenant) ahead of audit handler; cap concurrent audits and set per-request timeout with limited retries.  
5) Surface clear statuses to users (queued/running/failed/complete) and ensure error messaging in the client.  
6) Add an automated smoke test: submit URL → audit completes → report retrieved.  
7) Implement signed read-only share links for reports (can be short-lived tokens).  

## Go / No-Go
- **Recommendation: NO-GO** until the P0 blockers are addressed.  
- After completing the Minimum Action Plan items 1–6, re-evaluate; item 7 can be parallelized if time permits but should not block if a basic share flow is acceptable post-MVP.

## Final MVP Feature List (Must-Have Only)
### Core Product Flow
- **Feature: Durable audit pipeline (P0)**  
  - Problem: Audits and quotas reset on restart; inline audits can hang.  
  - User value: Reliable “submit → audit → view” without lost history.  
  - Acceptance: Audit requests persist to DB with requestId; audit completes or fails with status; restart does not lose completed audits or quota reservations.
- **Feature: Safe URL intake (P0)**  
  - Problem: SSRF/localhost risk and unbounded fetches.  
  - User value: Safe, predictable audits.  
  - Acceptance: Reject non-HTTPS and private/localhost targets; enforce fetch timeout and max body size; log blocked attempts.
- **Feature: Authenticated submissions (P0)**  
  - Problem: Anyone can run audits using default tenant.  
  - User value: Only authorized users consume quota and see history.  
  - Acceptance: Write routes require auth/token; tenant context derived from identity on every request.

### UX & Clarity
- **Feature: Report visibility (P1)**  
  - Problem: Unknown if client surfaces scores/missing tags/recs.  
  - User value: Clear, actionable report.  
  - Acceptance: Report page shows audited URL, timestamp, scores, missing tags, recommendations; loading/error states visible.
- **Feature: Shareable read-only report (P1)**  
  - Problem: No way to share results safely.  
  - User value: Can share findings without edit risk.  
  - Acceptance: Signed tokenized link renders read-only report; token expiry or revocation supported.

### Reliability & Error Handling
- **Feature: Backpressure and retries (P0)**  
  - Problem: No rate limits; inline audits can overwhelm the server.  
  - User value: Responsive app under load.  
  - Acceptance: Per-tenant/IP rate limit ahead of audit; per-request timeout and limited retries with jitter; queue/semaphore caps concurrency.
- **Feature: Status and failure surfacing (P1)**  
  - Problem: Users can’t tell if audit queued/running/failed.  
  - User value: Transparency on progress and errors.  
  - Acceptance: API and UI expose queued/running/failed/complete; failed audits show reason and allow resubmit.

### Security & Trust
- **Feature: SSRF and network controls (P0)**  
  - Problem: Audits can hit internal networks.  
  - User value: Trustworthy tool that doesn’t exfiltrate.  
  - Acceptance: Explicit blocklist for private/loopback/reserved IPs; DNS re-resolution per request; HTTPS-only.
- **Feature: Tenant-scoped quotas (P0)**  
  - Problem: Quota bypass after restart.  
  - User value: Fair, predictable limits.  
  - Acceptance: Quota ledger persisted in DB; repeat requestId is idempotent and returns prior result without double-charging.

### Launch Essentials (Onboarding, Limits, Feedback)
- **Feature: Usage feedback in UI (P1)**  
  - Problem: Users don’t know remaining quota.  
  - User value: Avoids surprise lockouts.  
  - Acceptance: UI surfaces remaining audits for the period; 80/90/100% warnings returned by API and shown in UI.
- **Feature: Smoke test coverage (P1)**  
  - Problem: No automated proof of primary flow.  
  - User value: Prevents regressions pre-launch.  
  - Acceptance: CI test submits URL → audit completes (mocked network OK) → report retrieved.

## Launch Blockers Summary (P0)
- Durable DB-backed storage for audits/quota (no in-memory resets).
- HTTPS-only + private-network blocking with timeouts/size limits.
- Authenticated submissions with tenant-derived context.
- Per-tenant/IP rate limiting and concurrency caps.
- Persisted quota ledger with idempotent requestIds.

## MVP Definition of Done
- All P0 items above implemented, tested, and enabled in production config.
- P1 items for report visibility, status surfacing, usage feedback, share links, and smoke test in place or explicitly waived with documented rationale.
- CI passes including smoke test; manual sanity confirms submit → audit → view with persisted data.
- Security checks: SSRF protections verified; auth required on write; logs capture blocked requests.

## Out of Scope for Launch
- Scheduled audits, alerts, or trend dashboards.
- Team roles/SSO/SCIM.
- Webhooks and external integrations.
- Advanced analytics or AI insights.
- Full PDF/export pipeline beyond the core report view.
