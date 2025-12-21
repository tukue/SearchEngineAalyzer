#!/usr/bin/env node
function resolveNextBin() {
  try {
    return require.resolve('next/dist/bin/next', { paths: [process.cwd()] });
  } catch (error) {
    console.error('Unable to locate Next.js binary from current workspace.');
    console.error('Searched from:', process.cwd());
    throw error;
  }
}

const nextBin = resolveNextBin();
const args = process.argv.slice(2);
process.argv = [process.argv[0], nextBin, ...args];
require(nextBin);
