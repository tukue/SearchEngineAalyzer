# CI/CD Simplification Action Plan

This plan focuses on reducing friction in the GitHub Actions + Vercel pipeline while keeping production deployments safe. It builds on `doc/pipeline-simplification.md` and `docs/ci-cd.md`.

## Objectives
- Shrink feedback time for PRs by eliminating redundant work and clarifying required checks.
- Keep deployments predictable with minimal, well-documented configuration.
- Make local reproduction of CI straightforward for contributors.

## Immediate Changes (1–2 days)
1. **Unify install step**
   - Set a single install command (`npm install --legacy-peer-deps && npm --prefix next install`) for both CI and Vercel.
   - Document this as the canonical install in `docs/ci-cd.md` and the workflow.
2. **Lean CI workflow**
   - Consolidate the GitHub Actions job to run: lint → targeted tests (`node test.js`, `node api-test.js`, `node frontend-check.js`, `bash npm-test.sh`) → root build → Next.js lint/build.
   - Cache npm based on `package-lock.json`; drop any unused steps or matrices.
3. **Standardize Node version**
   - Pin Node 20 in `.nvmrc` and ensure the workflow uses the same version to avoid drift.
4. **Env var sanity checks**
   - Add a pre-build script that validates required env vars for backend and Next during CI and fails fast with a clear message.

## Short-Term Improvements (1–2 sprints)
1. **Preview parity smoke test**
   - After Vercel preview deploys, run a lightweight health check (e.g., ping key routes) via a GitHub Actions job using the Vercel preview URL.
2. **Reusable commands**
   - Add a `make ci` (or `npm run ci:local`) that chains the CI steps so contributors can reproduce checks locally.
3. **Clear artifacts & logs**
   - Ensure Vercel build logs are linked in PR comments; document rollback steps in `docs/ci-cd.md`.

## Backlog (nice-to-have)
- **Nightly dependency scan**: run `npm audit --production` and surface issues without blocking feature builds.
- **Flake/slow-test tracking**: collect timings from CI and auto-create tickets for slow or flaky checks.
- **Cache hygiene**: schedule cache cleanup to prevent cache bloat from slowing installs.

## Definition of Done
- Single CI workflow file documents the exact commands and matches Vercel settings.
- PRs consistently get green checks within a predictable duration (target: under 10 minutes).
- Contributors can reproduce CI with one documented command.
- Preview and production deploys share the same build inputs and env validation.
