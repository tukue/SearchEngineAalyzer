# Two-Week Execution Plan: Website Analyzer MVP

Assumptions:
- One senior developer working full time.
- Backend: Node.js + TypeScript (tsx runtime).
- Frontend: Next.js app in `/next`.
- Goal: deployed MVP with automated site analysis (performance, SEO, technical checks), actionable UI.

## Week 1 – Build & Integrate

### Day 1: Scope & skeleton
- **Primary goal:** Finalize scope and project scaffolding.
- **Tasks:**
  - Define MVP feature list (URL input, queue/run analysis, show results, simple auth-less UI).
  - Confirm tech choices (Playwright/Lighthouse/psi-lite or custom checks) and create service interfaces.
  - Set up repos/branches, environment variables template, base scripts (`npm run dev`, `npm run analyze`).
- **Deliverable:** Project checklist, updated README with run instructions, env template committed.

### Day 2: Analysis service groundwork
- **Primary goal:** Implement analysis runner foundation.
- **Tasks:**
  - Implement URL validation/parsing helper and job schema.
  - Stub analysis pipeline with async steps (performance, SEO, tech) returning structured JSON.
  - Add simple in-memory job store and status tracking.
- **Deliverable:** API-ready analysis module with mocked results, unit tests for validation and pipeline shape.

### Day 3: API endpoints
- **Primary goal:** Expose analysis creation + retrieval.
- **Tasks:**
  - Implement POST `/api/analyze` to enqueue/run analysis immediately; return job ID + status.
  - Implement GET `/api/analyze/:id` to fetch job status/results.
  - Add request validation, error handling, basic rate limiting (IP-based) to prevent abuse.
- **Deliverable:** Working HTTP API with minimal tests (happy-path + invalid URL).

### Day 4: Wire frontend input flow
- **Primary goal:** Let users submit URLs and see pending state.
- **Tasks:**
  - Build Next.js page with URL form, client-side validation, and optimistic job creation.
  - Implement polling hook for job status retrieval.
  - Display loading/error states; store recent submissions in local state.
- **Deliverable:** Usable frontend that creates analyses and shows progress placeholder.

### Day 5: Render results + actionable insights
- **Primary goal:** Show clear, grouped analysis output.
- **Tasks:**
  - Design results components (Performance, SEO, Technical) with severity badges and actionable text.
  - Map pipeline JSON to UI sections; add copy-to-clipboard/share link for job ID.
  - Add minimal accessibility (ARIA labels) and mobile-friendly layout.
- **Deliverable:** Results page/cards rendering real pipeline data locally.

### Day 6: Real checks integration
- **Primary goal:** Replace mocks with real analyzers.
- **Tasks:**
  - Integrate Lighthouse (headless) or PSI API for core performance metrics (LCP, FID proxy, CLS, TTI) with budgeted timeout.
  - Add SEO checks (meta tags, robots, sitemap, canonical) via headless fetch + HTML parse.
  - Add technical checks (HTTPS, redirects, response codes, compression, caching headers, security headers).
- **Deliverable:** End-to-end analysis producing real metrics for most sites; fallback messaging for blocked sites.

### Day 7: Hardening & metrics
- **Primary goal:** Make the system stable for public trials.
- **Tasks:**
  - Add logging, request/analysis timeouts, concurrency limits; guard against SSRF (URL allowlist, disallow private IPs).
  - Persist jobs to lightweight DB (SQLite/Drizzle or Supabase) with migrations.
  - Add basic analytics (event logging) and feature flags for expensive checks.
- **Deliverable:** Stable backend with persistence and safeguards; observability hooks.

## Week 2 – Polish, Deploy & Validate

### Day 8: UX polish & empty states
- **Primary goal:** Improve clarity for new users.
- **Tasks:**
  - Add onboarding copy, helpful tooltips, and empty states explaining what to expect.
  - Improve loading skeletons, retries, and error surfaces (e.g., blocked site, timeout).
  - Add result badges (pass/warn/fail) and quick recommendations.
- **Deliverable:** Polished UI for first-time use.

### Day 9: Sharing & history
- **Primary goal:** Make results re-accessible.
- **Tasks:**
  - Implement sharable links per job ID and recent history per browser (localStorage) and per account if auth added later.
  - Add “re-run analysis” action with last-used settings.
  - Optional: simple CSV/JSON export.
- **Deliverable:** Users can revisit/share analyses; re-run flow working.

### Day 10: Deployment pipeline
- **Primary goal:** Ship to a public environment.
- **Tasks:**
  - Create production config (env vars, secrets), Docker/Vercel deployment scripts.
  - Set up CI for lint/test on PR, and deploy on main (Vercel for Next, Fly/Render/railway for API if separate).
  - Add uptime/health endpoint and monitoring alerts.
- **Deliverable:** Deployed MVP accessible via public URL; CI/CD in place.

## Action plan: frictionless pipeline setup

The goal is to establish a zero-surprise CI/CD pipeline that mirrors production, gives fast feedback, and stays maintainable as scope grows.

1) **Environment + secrets**
   - Add `.env.example` for shared variables; document required secrets (API keys, DB URLs) with ownership and rotation notes.
   - Use a single secrets source per environment (e.g., Vercel env for Next, platform secrets for API) and forbid inline secrets in configs.
   - Configure per-branch preview envs (PR previews) and a locked-down `main` environment with stricter rate limits.

2) **Build + test stages**
   - Standardize scripts: `npm run lint`, `npm run test`, `npm run typecheck`, `npm run build` for both backend and `/next` frontend.
   - In CI, run lint/typecheck/tests in parallel, then gate `build` to ensure deployable artifacts.
   - Cache dependencies per lockfile hash to keep CI fast; fail fast on missing env vars.

3) **Artifact & image strategy**
   - For monorepo simplicity, build two artifacts: backend Docker image (with healthcheck) and Next.js output (Vercel build or static export if applicable).
   - Add build metadata (commit SHA, build time) injected via env for traceability.
   - Store images in a registry with short TTL for previews and longer retention for production tags.

4) **Deploy steps**
   - PR branch: auto-deploy preview (Vercel for `/next`, platform preview for API) with unique URL posted to PR.
   - `main` branch: promote tested artifacts to production; run database migrations in a pre-deploy step with rollback guard.
   - Add post-deploy smoke test script (hit health endpoint, run sample analysis against a known URL) and fail deployment if checks break.

5) **Observability & guardrails**
   - Add structured logs and request IDs; forward logs to a hosted sink (e.g., Logtail/Datadog) with retention defaults.
   - Monitor key SLOs: p95 latency for analysis requests, job failure rate, queue depth; alert on threshold breaches.
   - Enforce circuit-breakers: concurrency caps for headless runs, timeouts, and graceful degradation to cached results when limits are hit.

6) **Developer workflow**
   - Pre-commit hooks (lint + typecheck on staged files) and a `make dev`/`npm run dev` shortcut that mirrors production flags.
   - Document one-command onboarding: `npm install`, `cp .env.example .env.local`, `npm run dev` (back + front) with sample URLs.
   - Create a “CI broken?” runbook covering flaky tests, secret rotation, and rebuilding caches.

### Day 11: Performance & cost controls
- **Primary goal:** Keep runs fast and predictable.
- **Tasks:**
  - Add queue with per-request budget; cap headless browser concurrency.
  - Cache recent analyses (by URL + timestamp) to avoid reruns within short window.
  - Instrument metrics (p50/p95 latency, failure rates) and log aggregation.
- **Deliverable:** Predictable performance with basic caching and observability.

### Day 12: QA & edge cases
- **Primary goal:** Validate stability across site types.
- **Tasks:**
  - Test against diverse sites (slow, heavy JS, redirects, HTTP-only, blocked robots) and record outcomes.
  - Add fallbacks for blocked resources and graceful degradation (partial results with warnings).
  - Fix bugs from QA, expand test coverage for analyzers and API.
- **Deliverable:** QA report and fixes with higher test confidence.

### Day 13: Documentation & support
- **Primary goal:** Make the project understandable and operable.
- **Tasks:**
  - Document API (OpenAPI/README), env setup, and local dev workflow.
  - Add runbooks for common issues (timeouts, blocked sites), and feature flag toggles.
  - Provide privacy/terms placeholders and data handling notes.
- **Deliverable:** Updated docs, runbooks, and API reference.

### Day 14: Launch validation
- **Primary goal:** Collect early feedback and ensure stability.
- **Tasks:**
  - Add lightweight feedback widget/form and capture contact info.
  - Monitor logs/metrics, fix any launch bugs, and tighten limits if usage spikes.
  - Prepare post-launch backlog and next-step priorities based on feedback.
- **Deliverable:** Publicly usable MVP with feedback loop and prioritized backlog for iteration.
