# Smoother Delivery Pipeline Guide

This guide outlines pragmatic steps to keep the delivery pipeline lean while letting the team ship new features confidently. It focuses on fast feedback, predictable releases, and minimizing toil.

## Goals
- Shorten feedback loops so feature branches surface issues before they reach main.
- Keep release trains predictable with small, reversible changes.
- Reduce one-off work by standardizing how apps, database changes, and infrastructure are validated.

## Core Pipeline Steps
1. **Static checks early**: run `npm run check` and lightweight linting at the start of every CI job to fail fast.
2. **Unit/integration tests**: execute `npm test` (or targeted suites like `npm run test:plan-gating`) in parallel shards when the diff is large; always collect coverage for changed packages to catch gaps.
3. **Type-safe builds**: use `npm run build` as a gating step; cache dependencies and `.next` artifacts to keep cycle times low.
4. **Database safety**: require `npm run db:push` (or equivalent migration check) in CI to ensure schema drift is detected before deployment.
5. **Artifact promotion**: build once, promote the same artifact through staging and production to avoid “works on staging only” bugs.
6. **Preview environments**: create per-PR previews (e.g., Vercel or ephemeral containers) seeded with anonymized fixtures so reviewers can click through features quickly.
7. **Smoke tests**: after deploy, run a small `npm run test` subset plus a health-check endpoint probe to detect obvious regressions.

## Branch & Release Hygiene
- Keep a short-lived `main` that always passes CI; feature branches are merged with squash or rebase after green checks.
- Use conventional commit messages to auto-generate changelogs and release notes.
- Prefer feature flags for risky work so code can ship dark and be toggled without redeploys.

## Local Developer Experience
- Standardize on Node 20 (per `package.json`) via `.nvmrc` or `volta` to avoid version drift.
- Provide `make dev` or `npm run dev` shortcuts that start backend and Next.js together; document required env vars and seed scripts.
- Offer a one-command “happy path” (`npm run check && npm test && npm run build`) that mirrors the CI pipeline.

## Observability & Quality Gates
- Enforce minimum coverage on changed lines and fail CI when it drops below target.
- Add lightweight tracing/logging in critical APIs and surface dashboard links in PRs for quick debugging.
- Alert on slow build times and flaky tests; auto-create tickets when thresholds are crossed.

## Automation Backlog
- Add dependency scanning (e.g., `npm audit` or SCA service) as a nightly job to avoid slowing feature builds.
- Automate database migration review (lint for destructive changes, require approvals for production pushes).
- Periodically prune caches and preview environments to keep CI fast and costs predictable.

Implementing these steps incrementally will keep the pipeline smooth while leaving room to ship features quickly.
