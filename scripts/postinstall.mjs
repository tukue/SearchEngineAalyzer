import { spawnSync } from 'node:child_process';

const shouldSkip = Boolean(process.env.VERCEL) || process.env.CI === 'true';

if (shouldSkip) {
  console.log('[postinstall] Skipping nested Next.js install on CI/Vercel.');
  process.exit(0);
}

console.log('[postinstall] Installing dependencies for ./next workspace...');
const result = spawnSync('npm', ['--prefix', 'next', 'install'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
