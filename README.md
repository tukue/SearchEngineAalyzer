# Meta Tag Analyzer (Vite + Express)

Meta Tag Analyzer analyzes website metadata and returns actionable SEO, social, and technical recommendations.

This repository now runs as a single **Vite frontend + Express backend** application.

## Stack

- Frontend: React + Vite (`client/`)
- Backend: Express + TypeScript (`server/`)
- Shared contracts/types: `shared/`

## Prerequisites

- Node.js 20+
- npm 8+

## Environment variables

- `API_AUTH_TOKEN` (server): required bearer token for protected API calls.
- `VITE_API_TOKEN` (client): bearer token sent by the frontend; should match `API_AUTH_TOKEN`.
- `TEST_API_TOKEN` (optional): token used during test runs.

## Install

```bash
npm ci --ignore-scripts
```

## Run locally

```bash
npm run dev
```

This starts Express on port `5000` and serves Vite middleware in development.

## Build (production)

```bash
npm run build
```

Build output:

- `dist/public` — Vite static frontend bundle
- `dist/index.js` — bundled Express server

## Start (production)

```bash
npm run start
```

## Deploy

Use a Node host (Docker, Render, Railway, Fly, etc.) that can run a long-lived Express process.

Deployment command sequence:

1. `npm ci --ignore-scripts`
2. `npm run build`
3. `npm run start`

### Docker

A Dockerfile is included. Typical flow:

```bash
docker build -t meta-tag-analyzer .
docker run -p 5000:5000 --env-file .env meta-tag-analyzer
```

## Test and CI checks

```bash
npm test
npm run ci:checks
```
