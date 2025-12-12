# Test-Driven Development Notes

The must-have audit features are delivered incrementally with tests leading each change. All tests run locally without external network calls to keep iterations fast and deterministic.

## Approach
- **Small, composable units**: Audit parsing and storage helpers stay pure so they can be validated with lightweight assertions.
- **Service-level coverage**: Queue/idempotency and quota logic are exercised at the API boundary to mirror real usage.
- **Integration-first for risky paths**: End-to-end API checks run against a local fixture server to cover fetch, scoring, persistence, and quota checks together.

## Feature → Test Mapping
- **Multi-tenant access & idempotent queueing**: `integration-test.js` ensures tenants only see their runs and idempotent keys reuse run IDs.
- **Usage limits & plans**: `integration-test.js` verifies quota exhaustion returns 429 and plan counters decrement exactly once.
- **Audit engine contract**: `audit-endpoint.test.js` and `audit-integration.test.js` validate `/api/audit` responses include scores, issues, and recommendations.
- **Homepage safety**: `homepage-test.js` confirms compiled HTML is served (no source leakage) and the deploy-home helper page is reachable.

## How to Run
```bash
npm run test:local   # builds, boots the server, and runs all checks including integration tests
```
