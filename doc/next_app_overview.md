# Next.js App Overview

## Purpose
This Next.js workspace hosts the Meta Tag Analyzer UI and API so the migrated stack can serve audits without relying on the legacy Express server. The Next app runs the analyze endpoint under the app router while reusing shared storage and schemas to keep behavior aligned during the transition.

## Tech stack and scripts
- Next.js 14 with React 18 powers the app directory experience.
- Cheerio handles HTML parsing, Zod guards request payloads, and React Query supports client data fetching patterns.
- Core scripts: `npm run dev` for local development, `npm run build` for production bundles, `npm run start` for serving the build, and `npm run lint` for static checks.

## API surface
- **POST /api/analyze** (app router): Enabled by default or gated by `NEXT_MIGRATED_API_ENDPOINTS` so traffic can fall back to Express during migration.
- Incoming payloads must include a `url` matching the shared schema; the handler normalizes URLs missing a scheme.
- The fetch routine sets a MetaTagAnalyzer user agent, aborts after 10 seconds, and rejects responses larger than 5 MB to avoid stalls and oversized downloads.
- Parsed pages record title and canonical tags explicitly, then classify meta tags into SEO, Social, and Technical buckets while counting health scores and missing coverage.
- Missing important tags generate recommendations with copy-ready snippets, and the persisted response includes analysis metadata, normalized tags, and recommendations saved via shared storage.
- **GET /api/health**: Mirrors the Express health endpoint and is also gated by `NEXT_MIGRATED_API_ENDPOINTS`. Responds with the shared health payload so uptime probes can validate the Next.js runtime without hitting the legacy server.

## UI routes
- **/analyze**: Client-side page that exercises the migrated analyze endpoint. It accepts a URL, surfaces loading/error states, and renders the returned tag counts and health score so teams can validate the new handler without leaving the Next.js app router.

## Migration and deployment notes
- The repository’s root build now targets this workspace (`next/package.json`), mirroring the Vercel pipeline; clearing `.next` before builds replicates deployment behavior.
- Use the `NEXT_MIGRATED_API_ENDPOINTS` env var to toggle which endpoints run on Next.js versus Express until parity is confirmed.
