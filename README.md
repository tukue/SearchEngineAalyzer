# Website Analyzer (MVP)

Website Analyzer is a lightweight web app that analyzes and validates meta tags from any website. It delivers actionable recommendations to improve SEO, social sharing, and technical metadata.

## Features

- **Meta Tag Analysis**: Analyze meta tags from any website and categorize them into SEO, Social, and Technical tags.
- **Recommendations**: Get actionable recommendations to improve your meta tags.
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.
- **Simple Build**: Runs on a single Express + Vite stack (Next.js is intentionally disabled for now).

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

## Local Setup

```bash
npm ci
npm run dev
```

The API and frontend share the same port (`http://localhost:5000`).

## Running locally

Start the API + frontend together:

```bash
npm run dev
```

The API and frontend share the same port (`http://localhost:5000`).

## Production build

```bash
npm run build
npm run start
```

## Troubleshooting

- **Node version mismatch**: The project requires Node 20.x. Use `nvm use` (with the provided `.nvmrc`) if you see an `EBADENGINE` warning.
- **Registry access errors**: Ensure your network allows access to `https://registry.npmjs.org/` and retry `npm ci` if you encounter 403 errors.
