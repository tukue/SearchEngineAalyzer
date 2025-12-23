# CI/CD Simplification Action Plan

This plan keeps improvements bite-sized so we can ship them incrementally while maintaining safe GitHub Actions + Vercel deployments. It builds on `doc/pipeline-simplification.md` and `docs/ci-cd.md`.

## Objectives
- Shrink feedback time for PRs by eliminating redundant work and clarifying required checks.
- Keep deployments predictable with minimal, well-documented configuration.
- Make local reproduction of CI straightforward for contributors.

## Step-by-step plan (small, incremental)
1. **Pin the runtime** (quick win)
   - Add `.nvmrc` with Node 20 and update the GitHub Actions workflow to use Node 20. This removes “works on my machine” drift.
2. **Single install recipe** (reduces churn)
   - Adopt one command for all contexts: `npm install --legacy-peer-deps && npm --prefix next install`. Add it to the workflow, Vercel settings, and `docs/ci-cd.md`.
3. **Lean CI job** (fast feedback)
   - In `.github/workflows/ci.yml`, run only: lint (or skip message), `node test.js`, `node api-test.js`, `node frontend-check.js`, `bash npm-test.sh`, root build, then Next lint/build. Enable npm cache keyed by `package-lock.json`.
4. **Env var guardrail** (prevents broken previews)
   - Add a small script that fails CI early when required env vars are missing for backend or Next builds. Reference it from the workflow before builds.
5. **Preview smoke ping** (safety net)
   - After Vercel posts a Preview URL, run a light health check (e.g., `curl` a key route) and surface failures in PR checks.
6. **One-button local CI** (developer ergonomics)
   - Add `npm run ci:local` (or `make ci`) that chains the CI commands so contributors can reproduce failures.

## Backlog (nice-to-have)
- **Nightly dependency scan**: run `npm audit --production` and surface issues without blocking feature builds.
- **Flake/slow-test tracking**: collect timings from CI and auto-create tickets for slow or flaky checks.
- **Cache hygiene**: schedule cache cleanup to prevent cache bloat from slowing installs.

## Definition of Done
- Single CI workflow file documents the exact commands and matches Vercel settings.
- PRs consistently get green checks within a predictable duration (target: under 10 minutes).
- Contributors can reproduce CI with one documented command.
- Preview and production deploys share the same build inputs and env validation.
