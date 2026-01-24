# WebAnalyzer Supabase Postgres Integration Guide

This guide documents the recommended Supabase Postgres integration for WebAnalyzer, including schema, RLS, backend structure, validation, observability, performance, security, and testing practices.

## 1) Database Schema (Supabase Postgres)

The migration in `supabase/migrations/20240310120000_web_analyzer_init.sql` defines a multi-tenant schema scoped by `tenant_id`, plus a simple async job queue table for audits/analysis processing.

Key entities:
- `tenants` + `tenant_members` for org membership and role-based access.
- `websites` for tracked domains/URLs (unique per tenant by `normalized_url`).
- `analyses`, `analysis_tags`, `analysis_recommendations` for results.
- `analysis_jobs` for async processing queue (worker/cron/edge functions).

## 2) RLS Policies

RLS is enabled for all application tables. Membership is enforced via `public.is_tenant_member` and `public.is_tenant_owner` helper functions. Policies ensure:
- Members can read/write their tenant’s websites, analyses, tags, and recommendations.
- Only owners can manage tenant membership rows and tenant metadata.

See the migration file for the complete policy definitions.

## 3) Backend Folder Structure (Recommended)

```
server/
  api/
    handlers/
      analyses.ts
      websites.ts
      jobs.ts
  middleware/
    auth.ts
    rateLimit.ts
    requestId.ts
  repositories/
    analysesRepository.ts
    websitesRepository.ts
    jobsRepository.ts
  services/
    analysesService.ts
    jobsService.ts
  supabase/
    auth.ts
  db/
    client.ts
  observability/
    logger.ts
    metrics.ts
    tracing.ts
```

- **repositories**: pure database access (one table or aggregate at a time).
- **services**: compose multiple repositories, enforce domain rules.
- **middleware**: auth, tenant context, rate limiting.
- **observability**: structured logging + metrics/tracing hooks.

## 4) Input Validation + Error Handling Strategy

- **Validation**: use `zod` schemas at the API boundary.
- **Errors**: return typed error payloads with `code`, `message`, and `details` fields.

```ts
import { z } from "zod";

export const createWebsiteSchema = z.object({
  url: z.string().url(),
  label: z.string().max(120).optional(),
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;
```

Error format example:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": {
    "url": "Invalid url"
  }
}
```

## 5) Environment Variables & Secrets

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SUPABASE_JWT_SECRET`
- `DATABASE_URL` (direct Postgres connection, optional)
- `LOG_LEVEL`, `NODE_ENV`

## 6) Logging, Tracing, Metrics

- Use structured logs: `request_id`, `tenant_id`, `user_id`, `route`, `latency_ms`, `status`.
- Tracing: wrap DB calls or major service methods with spans.
- Metrics to track:
  - request latency (p95/p99)
  - background job duration and failures
  - analysis throughput per tenant
  - quota usage
  - DB connection saturation and slow queries

## 7) Performance Best Practices

- Indexes: see migration for tenant, status, and time-based indexes.
- Pagination: cursor-based pagination by `requested_at` + `id`.
- Avoid N+1: batch fetch tags/recommendations by `analysis_id`.
- Limit payloads: store large computed results in `summary` JSONB or external storage if needed.

## 8) Security Best Practices

- Always verify JWTs server-side (Supabase `SUPABASE_JWT_SECRET`).
- Enforce RLS. Test with anon tokens to ensure policies don’t leak.
- Use parameterized queries (via ORM or safe query builder).
- Rate limit by `tenant_id` and/or IP.
- CORS: allow only known origins and only required headers.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## 9) Testing Strategy

- **Unit tests**: repositories/services with a mocked DB client.
- **Integration tests**: run against a seeded Supabase test project or local Postgres with RLS enabled.
- **Seed strategy**: seed a tenant + member + website + analysis for deterministic tests.

## 10) Queue / Async Processing

`analysis_jobs` supports queued work:
- `status`: queued/processing/completed/failed
- `run_at`: when it becomes eligible
- `locked_at`, `locked_by`: worker leasing
- `attempts`: increment on retries

Simple options:
- **Supabase Edge Functions** scheduled via cron.
- **pg_cron** to trigger a worker SQL function.
- **External worker** polling `analysis_jobs` with `FOR UPDATE SKIP LOCKED`.

## 11) Sample TypeScript Snippets

### DB Client
```ts
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});
```

### Repository
```ts
export async function listAnalyses({ tenantId, limit, cursor }: {
  tenantId: string;
  limit: number;
  cursor?: { requestedAt: string; id: string };
}) {
  const values = [tenantId, limit];
  let cursorClause = "";
  if (cursor) {
    values.push(cursor.requestedAt, cursor.id);
    cursorClause = "and (requested_at, id) < ($3, $4)";
  }

  const result = await pool.query(
    `select id, website_id, status, requested_at, completed_at, health_score
     from analyses
     where tenant_id = $1 ${cursorClause}
     order by requested_at desc, id desc
     limit $2`,
    values,
  );

  return result.rows;
}
```

### Endpoints (Express-style)
```ts
import { Router } from "express";
import { createWebsiteSchema } from "../validation";

const router = Router();

router.post("/websites", async (req, res) => {
  const parsed = createWebsiteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const website = await websitesRepository.create({
    tenantId: req.tenantContext.tenantId,
    ...parsed.data,
  });

  res.status(201).json(website);
});

router.get("/websites", async (req, res) => {
  const websites = await websitesRepository.list({
    tenantId: req.tenantContext.tenantId,
  });
  res.json({ websites });
});

router.post("/analyses", async (req, res) => {
  const job = await jobsRepository.enqueue({
    tenantId: req.tenantContext.tenantId,
    websiteId: req.body.websiteId,
    requestedBy: req.tenantContext.userId,
  });
  res.status(202).json(job);
});

router.get("/analyses", async (req, res) => {
  const analyses = await analysesRepository.list({
    tenantId: req.tenantContext.tenantId,
    limit: Number(req.query.limit ?? 25),
  });
  res.json({ analyses });
});

router.get("/analyses/:id", async (req, res) => {
  const analysis = await analysesRepository.get({
    tenantId: req.tenantContext.tenantId,
    analysisId: req.params.id,
  });
  if (!analysis) return res.status(404).json({ code: "NOT_FOUND" });
  res.json(analysis);
});

router.post("/analyses/:id/retry", async (req, res) => {
  const job = await jobsRepository.retry({
    tenantId: req.tenantContext.tenantId,
    analysisId: req.params.id,
  });
  res.status(202).json(job);
});
```

## 12) Pitfalls Checklist (Supabase + Postgres)

- ✅ RLS enabled on all tables and verified with anon key
- ✅ Ensure composite foreign keys enforce tenant consistency
- ✅ Avoid using service role keys in browser code
- ✅ Validate JWT `exp`, `aud`, and tenant claims
- ✅ Don’t forget indexes for tenant + timestamp pagination
- ✅ Carefully handle async job locking to avoid double processing
- ✅ Confirm CORS settings and required headers for JWT
