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
- **API_BASE_URL** (Next.js): base URL for rewrites to the API; defaults to `http://localhost:5000` and only needs to be set when proxying to a hosted backend.
- **NEXT_MIGRATED_API_ENDPOINTS** (Next.js): optional comma-separated list limiting which migrated handlers stay on Next.js. Leave empty to run all migrated endpoints there; include `history` (and other features) when their routes move to `app/api`.

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

## Next.js API migration (paused)

The Next.js migration is currently paused. The active runtime is Vite + Express only, so focus on the `client/` frontend and `server/` API for now. The `next/` workspace remains in the repository for future work, but it is not part of the active build/deploy flow.

## Deployment

- Deploy the Vite build output (`dist/public`) with the Express API running from `server/index.ts`.
