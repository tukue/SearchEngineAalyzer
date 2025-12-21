#!/usr/bin/env node
const path = require('path');

function resolveNextBin() {
  const searchRoots = [
    process.cwd(),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..'),
  ];

  let lastError;
  for (const root of searchRoots) {
    try {
      return require.resolve('next/dist/bin/next', { paths: [root] });
    } catch (error) {
      lastError = error;
    }
  }

  console.error('Unable to locate Next.js binary.');
  console.error('Searched from:', searchRoots.join(', '));
  throw lastError;
}

const nextBin = resolveNextBin();
const args = process.argv.slice(2);
process.argv = [process.argv[0], nextBin, ...args];
require(nextBin);
