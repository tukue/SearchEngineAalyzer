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
| URL submission + audit execution | ⚠️ Partially implemented | `/api/meta/analyze` runs end-to-end but inline on web thread and lacks timeouts/retries. | P0 |
| Quota/plan gating | ⚠️ Partially implemented | Usage limits and plan gating middleware exist but rely on in-memory storage and default tenant. | P0 |
| Persistent audit storage/history | ❌ Missing | Audits and usage ledger use `MemStorage`; no Drizzle/DB persistence wired. | P0 |
| SSRF and URL safety | ❌ Missing | No HTTPS-only enforcement, no private-network/localhost blocking, no response size/time limits. | P0 |
| Auth for write paths | ❌ Missing | API routes unauthenticated; tenant context is defaulted. | P0 |
| Shareable read-only reports | ❌ Missing | No signed link or read-only report route. | P1 |
| Report UX (scores, missing tags, recommendations) | ⚠️ Partially implemented | API returns structured data; need to confirm client renders full report with states. | P1 |
| Error/retry visibility | ⚠️ Partially implemented | API returns errors; no UI surfacing of retry/failed states. | P1 |
| Rate limiting/backpressure | ❌ Missing | No middleware; queue only dedupes per key in-memory. | P0 |
| Logging/observability | ⚠️ Partially implemented | Basic request logging for `/api`; no metrics/structured logs. | P2 |
| CI smoke test (submit → audit → report) | ❌ Missing | No automated smoke covering end-to-end path. | P1 |
| Export/PDF | ❌ Missing | Not present. | P2 |

## Launch Blockers (P0)
- Inline audit execution without timeouts/retries risks hanging the web thread.
- No SSRF protection (allows localhost/private network fetches) and no HTTPS-only enforcement.
- No auth or tenant-derived context for write paths.
- Audit/usage storage is in-memory; results and quota reset on restart.
- No rate limiting/backpressure to protect the audit handler.
- Quota/plan gating depends on volatile storage (can be bypassed after restart).

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
