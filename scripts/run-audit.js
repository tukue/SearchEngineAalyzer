#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const targetUrl = process.argv[2] || process.env.AUDIT_URL;
if (!targetUrl) {
  console.error('Usage: npm run audit:url -- <url>');
  process.exit(1);
}

const PORT = process.env.PORT || '5000';
const LOG_FILE = path.resolve('/tmp/manual-audit.log');

const server = spawn('npm', ['run', 'start'], {
  env: { ...process.env, PORT },
  stdio: ['ignore', fs.openSync(LOG_FILE, 'w'), fs.openSync(LOG_FILE, 'a')],
});

const cleanup = () => {
  if (server && !server.killed) {
    try {
      server.kill('SIGTERM');
    } catch (err) {
      // noop
    }
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`);
      if (res.ok) return;
    } catch (err) {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (server.exitCode !== null) {
      const tail = fs.existsSync(LOG_FILE)
        ? fs.readFileSync(LOG_FILE, 'utf8').split('\n').slice(-20).join('\n')
        : '';
      throw new Error(`Server exited early. Logs:\n${tail}`);
    }
  }
  throw new Error('Server did not become healthy in time');
}

async function runAudit(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(
      `http://localhost:${PORT}/api/audit?url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Audit failed with status ${res.status}: ${body}`);
    }
    const data = JSON.parse(body);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  try {
    console.log(`Starting production server on port ${PORT}...`);
    await waitForHealth();
    console.log('Server is healthy. Running audit...');
    const result = await runAudit(targetUrl);
    console.log('Audit result summary:\n');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Manual audit failed:', err.message);
    process.exit(1);
  } finally {
    cleanup();
  }
})();
