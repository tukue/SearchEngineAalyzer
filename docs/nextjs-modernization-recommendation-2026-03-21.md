# Search Analyzer Modernization Recommendation (March 21, 2026)

## Executive Recommendation

**Choose a targeted rebuild in Next.js App Router (not a direct in-place refactor of the Vite app).**

This should be a **structured rebuild** that reuses proven domain logic (`shared/*`, selected server services) while rebuilding the frontend and web runtime boundaries cleanly in Next.js.

---

## Why this recommendation is opinionated

### What the current codebase indicates

1. The current production-facing root runtime is still centered on Vite + Express scripts (`dev`, `build:client`, `vercel-dev`) even though Next.js dependencies are present.
2. The Vite frontend has a large orchestration page (`client/src/pages/Home.tsx`) that combines routing concerns, API orchestration, plan gating, history, export UX, footer, and tabbed dashboard concerns in one file.
3. The `next/` app exists but is still migration-oriented with a placeholder-like homepage and partial API movement.
4. There is a documented hybrid-state architecture already recognized as complex.

### Decision

Given those constraints, the cleanest long-term architecture is:

- **Rebuild the web app shell and feature modules in Next.js App Router with TypeScript.**
- **Reuse stable shared schemas/types/business logic where it reduces risk.**
- **Retire Vite UI and Express route layer once parity is complete.**

---

## Refactor vs Rebuild Scorecard

| Dimension | Refactor Vite -> Next in place | Rebuild/Bootstrap in Next (recommended) |
|---|---|---|
| Maintainability | Medium risk: carries legacy file boundaries and coupled page composition | **High**: clean module boundaries, modern conventions from day 1 |
| Migration effort | Appears lower initially, but often increases due to incremental compatibility shims | **Moderate but predictable** with phased parity checklist |
| Performance | Can improve, but mixed paradigms can delay gains | **Best path** to App Router SSR/streaming, route-level splitting, server actions where useful |
| Deployability | Transitional complexity (dual runtimes, env toggles, fallback logic) | **Strong**: single runtime, single build, Vercel-native defaults |
| Future scalability | Medium: likely legacy drag | **High**: easier to add auth, billing, teams, async pipelines, analytics |

**Bottom line:** rebuild wins for a portfolio-grade, production-ready outcome.

---

## Proposed Target Architecture (Next.js App Router + TypeScript)

```text
next/
  app/
    (marketing)/
      page.tsx
    (dashboard)/
      layout.tsx
      analyzer/
        page.tsx
      history/
        page.tsx
      settings/
        page.tsx
      loading.tsx
      error.tsx
      not-found.tsx
    api/
      analyze/route.ts
      history/route.ts
      plan/route.ts
      quota/route.ts
      health/route.ts
    globals.css
    layout.tsx
  components/
    layout/
      app-shell.tsx
      top-nav.tsx
      side-nav.tsx
    analyzer/
      url-search-form.tsx
      analysis-results-panel.tsx
      recommendation-card.tsx
      issue-table.tsx
      score-gauge.tsx
      export-menu.tsx
    history/
      history-table.tsx
      history-filters.tsx
    states/
      loading-state.tsx
      error-state.tsx
      empty-state.tsx
    ui/
      (shadcn primitives)
  features/
    analyzer/
      api/
      hooks/
      mapper/
      types.ts
    plan/
      api/
      hooks/
      types.ts
    history/
      api/
      hooks/
      types.ts
  lib/
    api-client.ts
    env.ts
    logger.ts
    utils.ts
    a11y.ts
  server/
    services/
      analyzer.ts
      usage.ts
    storage/
      index.ts
  shared/
    schema.ts
    validation.ts
  tests/
    unit/
    integration/
    e2e/
```

---

## Migration Plan (Rebuild Path)

## Phase 0 — Guardrails and Baseline (1–2 days)

1. Freeze feature work on legacy Vite UI except bug fixes.
2. Define acceptance criteria for parity (analyze flow, history, plan gating, exports, quota, health).
3. Capture baseline performance and error metrics for current app.
4. Confirm Vercel env var matrix and secrets naming.

## Phase 1 — Bootstrap Clean Next Foundation (1–2 days)

1. Initialize/normalize Next app to App Router-only conventions.
2. Enforce TypeScript strict mode, ESLint, Prettier, import aliases.
3. Establish route groups `(marketing)` and `(dashboard)`.
4. Add shared providers: QueryClient, theme, toast, error boundary.

## Phase 2 — Design System + Layout (2–4 days)

1. Standardize design tokens (spacing, type scale, color system incl. dark mode).
2. Build reusable shell components: sidebar, topbar, command/search entry, content container.
3. Build state primitives: loading skeletons, error callouts, empty states.
4. Build accessibility baseline: focus rings, keyboard order, aria labels, contrast checks.

## Phase 3 — Rebuild Core Analyzer Feature (3–5 days)

1. Create `features/analyzer` module with typed API client contracts.
2. Rebuild URL input and submit lifecycle with clear validation and disabled states.
3. Build results dashboard modules: score summary, issue list/table, recommendations, top fixes.
4. Add optimistic UX where appropriate and explicit pending transitions.
5. Implement robust error handling for validation, rate-limit, and server failures.

## Phase 4 — Rebuild Supporting Features (3–4 days)

1. History page with pagination/filters/sorting and empty states.
2. Plan & quota panels with clear usage widgets and upgrade prompts.
3. Export workflows with feature-gated UI and feedback states.
4. Add mobile-specific layout polish and responsive data table behaviors.

## Phase 5 — API Consolidation (2–4 days)

1. Move/finish remaining API parity into `app/api/*` handlers.
2. Reuse shared schema validation and selected existing services to avoid logic drift.
3. Remove fallback migration flags once parity is validated.
4. Add structured logging and request correlation IDs.

## Phase 6 — Quality, Performance, and Launch (2–4 days)

1. Add test layers:
   - Unit: mapping/formatting/components
   - Integration: API handlers + storage boundary
   - E2E: analyze flow, error flow, quota exceeded flow
2. Performance hardening:
   - cache/static boundaries where safe
   - suspense/lazy loading for heavy panels
   - image/font optimization
3. Accessibility sweep with keyboard and screen-reader checks.
4. Canary deploy to Vercel preview, then production cutover.

## Phase 7 — Decommission Legacy Runtime (1–2 days)

1. Remove `client/` Vite app and Express routing path from production surface.
2. Simplify root scripts to Next-only build/dev/start.
3. Update README/runbooks/ops docs to single runtime instructions.

---

## Sample Reusable Component Structure

- `components/analyzer/url-search-form.tsx`
  - Props: `onSubmit`, `isSubmitting`, `disabledReason?`
  - Includes accessible label/help/error text, URL validation hints.
- `components/analyzer/analysis-results-panel.tsx`
  - Composes cards and tables from normalized analysis model.
- `components/analyzer/issue-table.tsx`
  - Reusable column definitions, mobile stacked row fallback.
- `components/states/loading-state.tsx`
  - Supports `variant="card|table|panel"`.
- `components/states/error-state.tsx`
  - Supports retry action and contextual messages.
- `components/states/empty-state.tsx`
  - Supports icon/title/body/CTA pattern.

---

## Suggested Tech Stack (Practical, production-friendly)

- Framework: **Next.js App Router + TypeScript**
- Data fetching/cache: **TanStack Query** for client interactions + native server data fetch where suitable
- UI system: **Tailwind CSS + shadcn/ui + Radix primitives**
- Forms: **React Hook Form + Zod**
- Tables: **TanStack Table** for advanced filtering/sorting if needed
- Charts (optional): **Recharts** for score trends/health summaries
- Testing: **Vitest/Jest + Testing Library + Playwright**
- Monitoring: **Vercel Analytics + Sentry (recommended)**

---

## Vercel Deployment Considerations

1. Keep a **single Next runtime** (no dual Vite/Express production entrypoint).
2. Use Vercel preview environments for each PR with production-like env vars.
3. Use region-aware runtime settings for analyzer latency patterns.
4. Keep server route handlers stateless; externalize sessions/storage cleanly.
5. Add health endpoint and synthetic checks.
6. Define rollback strategy: immutable deploy + environment toggle safety.

---

## Key Risks and Tradeoffs

1. **Risk: temporary feature drift during migration.**
   - Mitigation: parity checklist + endpoint contract tests.
2. **Risk: over-engineering new architecture.**
   - Mitigation: start with feature modules and only add abstractions after second use.
3. **Risk: timeline slip from UI polish requests.**
   - Mitigation: ship functional parity first, then staged visual enhancements.
4. **Tradeoff: rebuild takes slightly more up-front work.**
   - Return: lower long-term maintenance cost and cleaner portfolio-quality output.

---

## Practical Final Call

If your goal is truly **production-ready, clean, scalable, and portfolio-worthy**, do a **targeted rebuild in Next.js App Router** with phased parity, not an incremental in-place refactor of the current Vite UI shell.
