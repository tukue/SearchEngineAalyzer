// Ensures the root path serves the compiled frontend instead of source code
import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function main() {
  console.log('Checking homepage is rendered (not source code)...');

  const res = await fetch(`${BASE_URL}/`);
  const body = await res.text();

  assert.strictEqual(res.status, 200, 'Expected 200 from root path');
  const contentType = res.headers.get('content-type') || '';
  assert.ok(contentType.includes('text/html'), 'Root should return HTML content');
  assert.ok(/<!doctype html>/i.test(body), 'Root should include HTML doctype');
  assert.ok(body.includes('div id="root"') || body.includes('id="root"'), 'HTML should include root mount point');
  assert.ok(!body.includes('import express'), 'Should not expose server source code');

  console.log('✓ Homepage returns compiled HTML');
}

main().catch((err) => {
  console.error('Homepage check failed:', err.message);
  process.exit(1);
});
