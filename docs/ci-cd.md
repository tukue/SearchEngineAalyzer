# CI/CD (Vite + Express)

## Overview

This repository deploys as a single Node application:

- Express API server (`server/`)
- Vite-built frontend assets (`client/` -> `dist/public`)

`npm run build` now builds both client and server artifacts for production.

## CI

Workflow file: `.github/workflows/ci.yml`

Checks executed:

1. `npm ci --ignore-scripts --legacy-peer-deps`
2. `npm run ci:checks`

`ci:checks` runs API tests, unit tests, and a full production build.

## Local validation

```bash
npm ci --ignore-scripts --legacy-peer-deps
npm run ci:checks
```

## Production build and run

```bash
npm run build
npm run start
```

Build outputs:

- `dist/public` (frontend)
- `dist/index.js` (Express server bundle)

## Suggested hosting

Use platforms that support persistent Node services (Docker, Render, Railway, Fly.io, VM/Kubernetes).

Standard deploy sequence:

1. Install dependencies: `npm ci --ignore-scripts`
2. Build artifacts: `npm run build`
3. Start service: `npm run start`
