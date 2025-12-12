#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Validating Vercel Deployment Setup...\n');

const checks = [];

function check(condition, message) {
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${message}`);
  checks.push({ condition, message });
  return condition;
}

// 1. Check vercel.json configuration
const vercelConfigExists = fs.existsSync('vercel.json');
check(vercelConfigExists, 'vercel.json exists');

if (vercelConfigExists) {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  check(vercelConfig.version === 2, 'Vercel config version 2');
  check(vercelConfig.builds && vercelConfig.builds.length > 0, 'Build configuration present');
  check(vercelConfig.rewrites && vercelConfig.rewrites.length > 0, 'URL rewrites configured');
}

// 2. Check API files
check(fs.existsSync('api/index.ts'), 'API entry point exists');

// 3. Check build outputs
check(fs.existsSync('dist/client'), 'Client build directory exists');
check(fs.existsSync('dist/index.js'), 'Server build file exists');

// 4. Check MVP measurements integration
const measurementEngineExists = fs.existsSync('server/measurementEngine.ts');
check(measurementEngineExists, 'MVP measurement engine exists');

if (measurementEngineExists) {
  const measurementContent = fs.readFileSync('server/measurementEngine.ts', 'utf8');
  check(measurementContent.includes('calculateMVPMeasurements'), 'MVP calculation function present');
  check(measurementContent.includes('SeoVisibilityCalculator'), 'SEO visibility calculator present');
  check(measurementContent.includes('SharePreviewCalculator'), 'Share preview calculator present');
}

// 5. Check API integration
const apiContent = fs.readFileSync('api/index.ts', 'utf8');
check(apiContent.includes('calculateMVPMeasurements'), 'API integrates MVP measurements');
check(apiContent.includes('/api/health'), 'Health endpoint present');
check(apiContent.includes('/api/analyze'), 'Analyze endpoint present');

// 6. Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check(packageJson.scripts['vercel-build'], 'vercel-build script configured');
check(packageJson.scripts['build'], 'build script configured');

// Summary
const passed = checks.filter(c => c.condition).length;
const total = checks.length;

console.log(`\n📊 Validation Summary: ${passed}/${total} checks passed`);

if (passed === total) {
  console.log('🎉 Deployment validation PASSED! Ready for Vercel deployment.');
  
  console.log('\n🚀 Next steps:');
  console.log('1. Install Vercel CLI: npm i -g vercel');
  console.log('2. Login to Vercel: vercel login');
  console.log('3. Deploy: vercel --prod');
  
  process.exit(0);
} else {
  console.log('💥 Deployment validation FAILED! Fix issues before deploying.');
  process.exit(1);
}