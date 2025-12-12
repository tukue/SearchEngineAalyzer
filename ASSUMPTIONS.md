# Implementation Assumptions

- **Environment**: Node.js 20+ with npm; tests run entirely on localhost. Outbound network access may be blocked, so all audits and integration tests rely on local fixture servers.
- **Storage**: Current implementation uses in-memory storage for audits, usage counters, and plan flags. No schema changes are applied until persistent DB migrations are introduced.
- **Tenancy**: Tenant and user context are provided via `x-tenant-id` and `x-user-id` headers with sensible defaults for local testing. No role-based checks are enforced yet.
- **Plans & quotas**: Free/Pro plan flags and monthly run limits are defined in code; counters reset automatically at month boundaries in memory only.
- **Frontend**: The existing SPA remains unchanged and is served from the built `dist/client` bundle. The `/deploy-home` page is only for deployment verification and does not replace the main UI.
- **Queueing**: Audits enqueue into an in-memory queue for now; retries/backoff and dead-letter behavior are pending tasks.
