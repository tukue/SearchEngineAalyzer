import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';
const SAMPLE_PORT = 5757;
const tenantHeaders = {
  'x-tenant-id': 'sample-fixture-tenant',
  'x-user-id': 'sample-user',
};

function startSampleServer(port = SAMPLE_PORT) {
  const htmlPath = path.resolve('fixtures', 'sample-site.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });

    server.on('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json();
  return { status: res.status, body };
}

async function run() {
  let fixture;
  try {
    fixture = await startSampleServer();
    const target = `http://localhost:${SAMPLE_PORT}`;

    const audit = await fetchJson(`${BASE_URL}/api/audit?url=${encodeURIComponent(target)}`, {
      headers: tenantHeaders,
    });

    assert.strictEqual(audit.status, 200, 'Audit should succeed for sample fixture');
    assert.ok(audit.body.scores, 'Scores should be returned');
    assert.ok(typeof audit.body.scores.seo === 'number', 'SEO score is numeric');
    assert.ok(Array.isArray(audit.body.issues), 'Issues is an array');
    assert.ok(Array.isArray(audit.body.recommendations), 'Recommendations is an array');

    const recent = await fetchJson(`${BASE_URL}/api/recent-runs`, { headers: tenantHeaders });
    assert.strictEqual(recent.status, 200, 'Recent runs should be accessible');
    const match = (recent.body.runs || []).some((run) => run.target?.includes(`localhost:${SAMPLE_PORT}`));
    assert.ok(match, 'Recent runs should include the sample fixture target');

    console.log('✓ Full functionality sample audit passed');
  } catch (err) {
    console.error('Full functionality sample audit failed:', err.message);
    process.exit(1);
  } finally {
    if (fixture) fixture.close();
  }
}

run();
