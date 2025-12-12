import assert from 'assert';
import http from 'http';

const BASE_URL = 'http://localhost:5000';

function startFixtureServer(port = 5656) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      const html = `<!doctype html>
<html lang="en">
  <head>
    <title>TDD Fixture</title>
    <meta name="description" content="Integration test fixture" />
    <meta property="og:title" content="Fixture OG" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
    <link rel="canonical" href="https://example.com/tdd" />
  </head>
  <body>
    <h1>Fixture</h1>
    <a href="#broken">Broken link</a>
  </body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });

    server.on('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

async function requestAudit(url) {
  const res = await fetch(`${BASE_URL}/api/audit?url=${encodeURIComponent(url)}`, {
    headers: {
      'x-tenant-id': 'tdd-tenant',
      'x-user-id': 'tdd-user',
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function runTests() {
  let fixture;
  try {
    fixture = await startFixtureServer();
    const target = 'http://localhost:5656/page';

    const { status, body } = await requestAudit(target);
    assert.strictEqual(status, 200, 'Audit should succeed for local fixture');
    assert.ok(body.url || body.runId, 'Response should include identifiers');
    assert.ok(body.scores, 'Scores should be present');
    assert.ok(typeof body.scores.seo === 'number', 'SEO score should be numeric');
    assert.ok(Array.isArray(body.issues), 'Issues should be an array');
    assert.ok(Array.isArray(body.recommendations), 'Recommendations should be an array');

    const bad = await requestAudit('not-a-url');
    assert.strictEqual(bad.status, 400, 'Invalid URL should return 400');
    assert.ok(bad.body.message, 'Error response should include message');

    console.log('✓ Audit integration tests passed');
  } finally {
    if (fixture) fixture.close();
  }
}

runTests().catch((err) => {
  console.error('Audit integration tests failed:', err.message);
  process.exit(1);
});
