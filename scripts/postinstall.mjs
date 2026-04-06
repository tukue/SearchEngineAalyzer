const isCi = process.env.CI === 'true';

if (isCi) {
  console.log('[postinstall] CI detected. Skipping optional setup.');
} else {
  console.log('[postinstall] Vite + Express mode active. No nested framework install is required.');
}
