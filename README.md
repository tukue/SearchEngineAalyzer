# Meta Tag Analyzer

Meta Tag Analyzer is a web application that analyzes and validates meta tags from any website. It provides actionable recommendations to improve SEO, social media sharing, and technical metadata.

## Features

- **Meta Tag Analysis**: Analyze meta tags from any website and categorize them into SEO, Social, and Technical tags.
- **Recommendations**: Get actionable recommendations to improve your meta tags.
- **Search History**: View and manage your recent analyses.
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.


## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v8 or higher)

### Environment configuration

Authentication is required for write APIs. Set the following variables when running locally:

- **API_AUTH_TOKEN** (server): required bearer token value accepted by the API. Example: `API_AUTH_TOKEN=dev-token-123`.
- **VITE_API_TOKEN** (client): token the frontend sends in the `Authorization` header. This must match `API_AUTH_TOKEN` (or an entry in `API_AUTH_TOKENS` if using multiple tokens).

For automated tests, `TEST_API_TOKEN` can be set; otherwise a `test-token` default is used while `NODE_ENV=test`.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/tukue/SearchEngineAalyzer.git
   cd SearchEngineAalyzer
   ```

### Installing dependencies

Run dependencies installation with scripts disabled for faster CI:

```bash
npm ci --ignore-scripts
```

If the registry responds with **403 Forbidden** (common in restricted environments), set an auth token and retry:

```bash
export NPM_TOKEN="<npm-registry-token>"
npm ci --ignore-scripts --registry=https://registry.npmjs.org
```

The repository includes a `.npmrc` that uses `NPM_TOKEN` automatically so CI systems can inject credentials without modifying commands.

## Next.js API migration

- The analyze API is now implemented under `next/app/api/analyze/route.ts`, reusing the existing meta-tag analysis logic and shared storage. This handler mirrors `POST /api/analyze` so traffic can be routed to the Next.js runtime once parity is confirmed.
- Use `NEXT_MIGRATED_API_ENDPOINTS` (comma-separated, case-insensitive) to control which handlers run via Next.js. By default Next.js serves every migrated endpoint; omit an endpoint from the list to fall back to the Express implementation in `server/routes.ts` during the transition.
- Additional Express routes (plan, quota, history, export) should be migrated incrementally to `app/api/<route>/route.ts` and added to `NEXT_MIGRATED_API_ENDPOINTS` before fully retiring the Express server.
- Running `npm run build` at the repo root now invokes the Next workspace (`next/package.json`), so `rm -rf next/.next && npm run build` mirrors Vercel's pipeline and ensures the Next-only stack is what's deployed.

## Deployment

- Vercel now builds the Next.js app (`next/package.json`) directly by targeting the `next` directory (see `vercel.json`), so deploying to Vercel triggers `npm run build` from that folder and serves the new `app` router.
- Before pointing production traffic to Vercel's Next.js deployment, confirm parity on each API route and include them in `NEXT_MIGRATED_API_ENDPOINTS`. Leaving the list empty keeps every migrated endpoint on Next.js; remove an entry (e.g., `plan`) to fall back to the Express server while the rest continue to run in Next.js.
- After parity is confirmed and all needed endpoints run on Next.js, remove the Express service from the Vercel deployment, keep the `NEXT_MIGRATED_API_ENDPOINTS` env listing all endpoints, and rely on the `next/app/api` handlers for both UI and API traffic.
