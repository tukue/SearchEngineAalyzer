import assert from 'assert';
import http from 'http';

const BASE_URL = 'http://localhost:5000';

async function withFixtureServer(handler) {
  const server = http.createServer((_req, res) => {
    const html = `<!doctype html>
<html><head>
  <title>Fixture Page</title>
  <meta name="description" content="Test page for audits">
</head>
<body>
  <h1>Fixture</h1>
  <img src="/img.png">
  <a href="#">Broken</a>
</body></html>`;
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
  });

  await new Promise((resolve) => server.listen(5050, resolve));

  try {
    await handler('http://localhost:5050');
  } finally {
    server.close();
  }
}

async function runAudit(url) {
  const res = await fetch(`${BASE_URL}/api/audit?url=${encodeURIComponent(url)}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  console.log('Running audit endpoint test...');
  await withFixtureServer(async (fixtureUrl) => {
    const { status, body } = await runAudit(`${fixtureUrl}/test`);
    assert.strictEqual(status, 200, 'Audit endpoint should return 200');
    assert.ok(body.runId || body.url, 'Response should include identifiers');
    assert.ok(body.scores, 'Response should include scores');
    assert.ok(typeof body.scores.seo === 'number', 'SEO score should be numeric');
    assert.ok(Array.isArray(body.issues), 'Issues should be an array');
    assert.ok(Array.isArray(body.recommendations), 'Recommendations should be an array');
  });
  console.log('✓ Audit endpoint test passed');
}

main().catch((err) => {
  console.error('Audit endpoint test failed:', err.message);
  process.exit(1);
});
