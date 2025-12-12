import fetch from 'node-fetch';
import http from 'http';

const apiBase = 'http://localhost:5000/api';
const fixtureHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>Fixture Page</title>
    <meta name="description" content="A local test page" />
    <meta property="og:title" content="Fixture OG Title" />
    <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
    <link rel="canonical" href="https://example.com/fixture" />
  </head>
  <body><h1>Hello Fixture</h1></body>
</html>`;

function startFixtureServer(port = 5555) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fixtureHtml);
    });

    server.on('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

async function enqueueAudit(url, tenantId, userId) {
  const response = await fetch(`${apiBase}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-user-id': userId,
    },
    body: JSON.stringify({ url }),
  });

  return { status: response.status, body: await response.json() };
}

async function pollRun(runId, tenantId, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${apiBase}/audits/${runId}`, {
      headers: { 'x-tenant-id': tenantId },
    });
    const data = await res.json();

    if (data.run && ["SUCCEEDED", "FAILED", "TIMED_OUT"].includes(data.run.status)) {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error('Timed out waiting for audit to finish');
}

async function getRecentRuns(tenantId) {
  const res = await fetch(`${apiBase}/recent-runs`, {
    headers: { 'x-tenant-id': tenantId },
  });
  return res.json();
}

async function getPlan(tenantId) {
  const res = await fetch(`${apiBase}/plan`, {
    headers: { 'x-tenant-id': tenantId },
  });
  return res.json();
}

async function testTenantIsolation() {
  console.log('\n=== Tenant isolation test ===');
  const urlA = 'http://localhost:5555/tenant-a';
  const urlB = 'http://localhost:5555/tenant-b';

  const jobA = await enqueueAudit(urlA, 'tenant-a', 'user-a');
  const jobB = await enqueueAudit(urlB, 'tenant-b', 'user-b');

  const resultA = await pollRun(jobA.body.runId, 'tenant-a');
  const resultB = await pollRun(jobB.body.runId, 'tenant-b');

  const runsA = await getRecentRuns('tenant-a');
  const runsB = await getRecentRuns('tenant-b');

  const tenantAHasB = runsA.runs.some((run) => run.target === urlB);
  const tenantBHasA = runsB.runs.some((run) => run.target === urlA);

  if (tenantAHasB || tenantBHasA) {
    throw new Error('Cross-tenant data leakage detected in recent runs');
  }

  if (!resultA.run || !resultB.run) {
    throw new Error('Missing run data for tenants');
  }

  console.log('✓ Each tenant sees only their own runs');
}

async function testIdempotencyAndPlan() {
  console.log('\n=== Idempotent enqueue + plan usage test ===');
  const tenantId = 'tenant-idem';
  const url = 'http://localhost:5555/idempotent';

  const first = await enqueueAudit(url, tenantId, 'user-1');
  const second = await enqueueAudit(url, tenantId, 'user-1');

  if (first.body.runId !== second.body.runId) {
    throw new Error('Expected idempotent enqueue to reuse runId');
  }

  await pollRun(first.body.runId, tenantId);

  const plan = await getPlan(tenantId);
  if (plan.remainingRuns !== plan.maxMonthlyRuns - 1) {
    throw new Error(`Expected remaining runs to be maxMonthlyRuns - 1, got ${plan.remainingRuns}`);
  }

  console.log('✓ Idempotent enqueue reuses existing run and usage increments once');
}

async function testQuotaLimit() {
  console.log('\n=== Usage quota enforcement test ===');
  const tenantId = 'tenant-quota';
  const maxRuns = 20; // aligns with free plan default

  for (let i = 0; i < maxRuns; i++) {
    const { status } = await enqueueAudit(`http://localhost:5555/quota-${i}`, tenantId, `user-${i}`);
    if (status !== 200) {
      throw new Error(`Expected run ${i + 1} to be accepted, got status ${status}`);
    }
  }

  const blocked = await enqueueAudit('http://localhost:5555/quota-blocked', tenantId, 'user-block');
  if (blocked.status !== 429) {
    throw new Error(`Expected quota to block request with 429, got ${blocked.status}`);
  }

  console.log('✓ Monthly quota blocks once limit is reached');
}

async function run() {
  let fixtureServer;
  try {
    fixtureServer = await startFixtureServer();
    await testTenantIsolation();
    await testIdempotencyAndPlan();
    await testQuotaLimit();
    console.log('\n✅ Integration tests passed');
  } catch (err) {
    console.error(err);
    console.error('\n❌ Integration tests failed');
    process.exit(1);
  } finally {
    if (fixtureServer) fixtureServer.close();
  }
}

run();
