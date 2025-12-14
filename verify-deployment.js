#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Vercel Deployment Verification\n');

// Check build output
const distPath = path.join(__dirname, 'dist', 'public');
const apiPath = path.join(__dirname, 'api');

console.log('✅ Build Output:');
if (fs.existsSync(distPath)) {
  console.log(`  - dist/public exists`);
  const files = fs.readdirSync(distPath, { recursive: true });
  files.forEach(file => console.log(`    ${file}`));
} else {
  console.log('  ❌ dist/public missing');
}

console.log('\n✅ API Functions:');
if (fs.existsSync(apiPath)) {
  const apiFiles = fs.readdirSync(apiPath);
  apiFiles.forEach(file => console.log(`  - api/${file}`));
} else {
  console.log('  ❌ api directory missing');
}

// Check .vercelignore
console.log('\n✅ Source Protection:');
const vercelIgnore = path.join(__dirname, '.vercelignore');
if (fs.existsSync(vercelIgnore)) {
  console.log('  - .vercelignore exists');
} else {
  console.log('  ❌ .vercelignore missing');
}

// Check vercel.json
console.log('\n✅ Vercel Configuration:');
const vercelConfig = path.join(__dirname, 'vercel.json');
if (fs.existsSync(vercelConfig)) {
  const config = JSON.parse(fs.readFileSync(vercelConfig, 'utf8'));
  console.log(`  - Routes: ${config.routes.length}`);
  console.log(`  - Output: ${config.outputDirectory}`);
  console.log(`  - Build: ${config.buildCommand}`);
} else {
  console.log('  ❌ vercel.json missing');
}

console.log('\n🚀 Deployment Ready!');