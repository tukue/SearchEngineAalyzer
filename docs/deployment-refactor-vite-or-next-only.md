# Deployment Refactor Plan (Vite-only or Next-only)

## 1) Current architecture (what exists now)

The repository is currently **hybrid** and carries two app runtimes:

- **Legacy Vite + Express runtime**
  - Frontend: `client/` built with Vite (`vite.config.ts`, `client/src/*`).
  - Backend: `server/` Express API (`server/index.ts`, `server/routes.ts`).
  - Root script still supports local server start via `tsx server/index.ts`.
- **Next.js runtime (newer migration path)**
  - App Router code in `next/app/*`.
  - API handlers in `next/app/api/*` (`/api/analyze`, `/api/health`).
  - Next UI components/hooks/lib in `next/components`, `next/hooks`, `next/lib`.

### Why deployment feels complex right now

1. There are **two frontend implementations** (`client/` and `next/app/`).
2. There are **two API surfaces** (Express and Next API routes).
3. Build scripts mix both worlds (`vite build` + `npm --prefix next run build`).
4. Environment routing relies on migration flags (`NEXT_MIGRATED_API_ENDPOINTS`) and fallback behavior.

---

## 2) Easy deployment refactor options

You asked for an easier deployment model using either Vite or Next only. Both are viable; choose one runtime and delete the other.

## Option A — **Next-only (recommended for fastest clean deploy)**

This is the lower-risk path in this repo because Next app + Next API migration already exists.

### Target end-state

- Only deploy `next/` app (UI + API handlers).
- Remove Express server from production deploy.
- Stop building Vite client in CI/CD.

### Minimal refactor checklist

1. **Complete API parity in `next/app/api/*`**
   - Migrate remaining Express endpoints needed by product usage.
2. **Switch traffic to Next handlers only**
   - Set `NEXT_MIGRATED_API_ENDPOINTS` to full migrated list (or remove fallback logic if complete).
3. **Simplify root scripts**
   - `build` should call only Next build.
   - `dev` should point to Next dev server.
4. **Retire legacy runtime**
   - Remove `server/` Express runtime from deployment path.
   - Remove `client/` Vite app after verification.
5. **Clean infra config**
   - Keep Vercel project root at `next/` (or equivalent monorepo target).

### Why this is easiest here

- Vercel setup already references Next deployment workflow.
- Next API routes already implement core analyzer paths.
- A single runtime removes migration flag complexity.

---

## Option B — Vite-only (valid but more migration effort)

Choose this if your team explicitly wants Express + Vite and does not want Next API/app router.

### Target end-state

- Keep `server/` + `client/` only.
- Remove `next/` workspace from deployment.

### Minimal refactor checklist

1. Move any Next-only API behavior back into Express routes.
2. Ensure Vite frontend has all active product pages/features from Next app.
3. Change deployment config to build/serve Express+Vite only.
4. Remove `next/` scripts and fallback env flags tied to Next migration.

### Tradeoff

- More work in this codebase because migration momentum is currently toward Next.

---

## 3) Recommended implementation sequence (Next-only)

1. **Freeze features** for 1 sprint while runtime is consolidated.
2. **Create endpoint parity matrix** (`Express route` -> `Next route`) and close gaps.
3. **Run integration tests** against Next endpoints only.
4. **Canary deploy** to Vercel with Next-only runtime.
5. **Delete dead paths** (`client/`, Express runtime glue, fallback flags).
6. **Update README + runbooks** so ops uses one deploy process.

---

## 4) Final recommendation

Use **Next-only** as the easy deployment refactor.

It is the shortest path to:

- one build command,
- one hosting target,
- one API runtime,
- and fewer deployment failure modes.

If you want, I can next generate a concrete PR-sized task list (10–15 small commits) to execute the Next-only cutover safely.
