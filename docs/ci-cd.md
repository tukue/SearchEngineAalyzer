# Simplified CI/CD for the Web Audit App

## Overview
This repository contains a Node/TypeScript backend at the root and a Next.js frontend in `/next`. Deployments run on Vercel, while GitHub Actions performs CI checks to keep builds reliable and predictable. For broader pipeline philosophy and future optimizations, see `doc/pipeline-simplification.md`; this page stays scoped to the concrete GitHub/Vercel setup.

## What happens on PRs vs merges to `main`
- **Pull Requests:** GitHub Actions runs linting, tests, and both backend and Next.js builds. Vercel creates an automatic **Preview Deployment** so reviewers can test the changes.
- **Merges to `main`:** The same GitHub Actions checks run. On success, Vercel publishes a **Production Deployment**.

## What Vercel handles automatically vs what GitHub Actions checks
- **Vercel:** Installs dependencies, builds the app, and serves Preview/Production environments. Handles routing via `vercel.json` and keeps build artifacts isolated per deployment.
- **GitHub Actions:** Runs deterministic validation (lint, tests, type checks, and builds) before deploys. Prevents broken code from reaching Vercel by blocking merges when checks fail.

## Branching & Environments
- `main` → Production environment in Vercel.
- Any PR branch → Preview environment in Vercel.
- **Environment variables:**
  - Configure **Production** env vars in Vercel Project → Settings → Environment Variables with target `Production`.
  - Configure **Preview** env vars in the same panel with target `Preview` so PR deploys have access to required secrets.

## CI Pipeline (GitHub Actions)
- **Workflow file:** `.github/workflows/ci.yml`.
- **Node & package manager:** Node.js 20.x using npm (lockfile present). The workflow caches npm based on `package-lock.json`.
- **Checks that run:**
  - Install dependencies with `npm install --legacy-peer-deps` (helps resolve peer conflicts).
  - Backend lint (if configured) via `npm run lint || echo "Linting skipped"`.
  - Structure/API/frontend sanity checks: `node test.js`, `node api-test.js`, `node frontend-check.js`, and `bash npm-test.sh`.
  - Root build: `npm run build --if-present`.
  - Next.js lint/build from `/next`: `npm run lint` and `npm run build` (working directory `next`).
- **Run the same checks locally:**
  ```bash
  npm install --legacy-peer-deps
  npm run lint || echo "Linting skipped"
  node test.js && node api-test.js && node frontend-check.js
  bash npm-test.sh
  npm run build --if-present
  (cd next && npm run lint && npm run build)
  ```

## CD Pipeline (Vercel)
- **Project settings (Vercel → Settings → General):**
  - Root Directory: repository root (`.`).
  - Install Command: `npm install && npm --prefix next install`.
  - Build Command: `npm run build` (runs `npm --prefix next run build`).
  - Output Directory: `next/.next`.
- **Triggers:**
  - Opening/updating a PR triggers a Preview Deployment via the Vercel GitHub integration.
  - Merging to `main` triggers a Production Deployment.
- **Logs & rollbacks:**
  - View build/runtime logs in Vercel → Deployments. Promote or roll back by selecting a previous deployment and clicking **Promote to Production**.

## Local Developer Workflow
- **Install dependencies:** `npm install --legacy-peer-deps && npm --prefix next install`.
- **Run backend in dev:** `npm run dev` (Node/Express via `tsx server/index.ts`).
- **Run frontend in dev:** In another terminal: `(cd next && npm run dev)`.
- **Full validation (CI equivalent):**
  ```bash
  npm install --legacy-peer-deps && npm --prefix next install
  npm run lint || echo "Linting skipped"
  node test.js && node api-test.js && node frontend-check.js
  bash npm-test.sh
  npm run build --if-present && (cd next && npm run lint && npm run build)
  ```

## Common Issues & Fixes
- **npm ERESOLVE / peer dependency conflicts:** Use the same flag as CI: `npm install --legacy-peer-deps`. Ensure `package-lock.json` is up to date.
- **Missing env vars during build:** Add required env vars in Vercel under both Preview and Production. For local runs, create a `.env.local` in `/next` and a `.env` at repo root for the backend.
- **Wrong root directory causing Next build to fail:** Confirm Vercel Root Directory is the repo root and `outputDirectory` is `next/.next`.
- **API 404s from rewrites/misconfigured routes:** Verify `vercel.json` routes and that backend endpoints are exposed through the Next/Express handlers. Re-run `npm run dev` (backend) and `(cd next && npm run dev)` to validate locally.

## Minimal Checklist
- [ ] GitHub Actions workflow passes on PRs and `main`.
- [ ] Vercel project Root Directory set to `.` with correct install/build/output commands.
- [ ] Preview env vars set (target: Preview); Production env vars set (target: Production).
- [ ] Preview Deployment appears on each PR and links in the PR checks.
- [ ] Production deployment succeeds after merging to `main`.
- [ ] Ability to promote or roll back to a previous Vercel deployment is confirmed.

## Quick Start CI/CD
- Install deps: `npm install --legacy-peer-deps && npm --prefix next install`.
- Run backend: `npm run dev`.
- Run frontend: `(cd next && npm run dev)`.
- Run full CI checks locally (see block above).
- Push branch → GitHub Actions runs checks → Vercel preview link appears.
- Merge to `main` → Production deployment on Vercel.
- Use Vercel Deployments page to view logs and promote/rollback.
