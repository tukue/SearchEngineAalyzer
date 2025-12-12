#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Pre-Deployment Validation...\n');

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function logCheck(status, message) {
  const symbols = { pass: '✅', fail: '❌', warn: '⚠️' };
  console.log(`${symbols[status]} ${message}`);
  checks[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
}

function runCommand(command, description) {
  try {
    console.log(`\n📋 ${description}...`);
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    logCheck('pass', description);
    return output;
  } catch (error) {
    logCheck('fail', `${description} - ${error.message}`);
    throw error;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    logCheck('pass', `${description} exists`);
    return true;
  } else {
    logCheck('fail', `${description} missing`);
    return false;
  }
}

try {
  // 1. Environment Check
  console.log('🔍 Environment Validation');
  runCommand('node --version', 'Node.js version check');
  runCommand('npm --version', 'npm version check');

  // 2. Dependencies Check
  console.log('\n📦 Dependencies Validation');
  if (!checkFile('package.json', 'package.json')) {
    throw new Error('package.json is required');
  }
  
  if (!checkFile('package-lock.json', 'package-lock.json')) {
    logCheck('warn', 'package-lock.json missing - using npm ci may fail');
  }

  // 3. Install Dependencies
  runCommand('npm ci', 'Installing dependencies');

  // 4. TypeScript Compilation Check
  console.log('\n🔨 Build Validation');
  runCommand('npm run build', 'Building application');

  // 5. Critical Files Check
  console.log('\n📁 Critical Files Validation');
  const criticalFiles = [
    { path: 'vercel.json', desc: 'Vercel configuration' },
    { path: 'api/index.ts', desc: 'API entry point' },
    { path: 'server/measurementEngine.ts', desc: 'MVP measurements engine' },
    { path: 'shared/schema.ts', desc: 'Shared schema definitions' }
  ];

  criticalFiles.forEach(file => {
    checkFile(file.path, file.desc);
  });

  // 6. API Endpoint Validation
  console.log('\n🔌 API Endpoints Validation');
  const apiContent = fs.readFileSync('api/index.ts', 'utf8');
  
  const requiredEndpoints = [
    '/api/health',
    '/api/analyze', 
    '/api/audits/:id',
    '/api/plan'
  ];

  requiredEndpoints.forEach(endpoint => {
    if (apiContent.includes(endpoint.replace(':id', ''))) {
      logCheck('pass', `Endpoint ${endpoint} implemented`);
    } else {
      logCheck('fail', `Endpoint ${endpoint} missing`);
    }
  });

  // 7. MVP Measurements Integration Check
  console.log('\n⚡ MVP Measurements Validation');
  
  if (fs.existsSync('server/measurementEngine.ts')) {
    const measurementContent = fs.readFileSync('server/measurementEngine.ts', 'utf8');
    
    const mvpFeatures = [
      'calculateMVPMeasurements',
      'SeoVisibilityCalculator',
      'PrioritizedHealthCalculator', 
      'SharePreviewCalculator'
    ];

    mvpFeatures.forEach(feature => {
      if (measurementContent.includes(feature)) {
        logCheck('pass', `MVP feature ${feature} implemented`);
      } else {
        logCheck('fail', `MVP feature ${feature} missing`);
      }
    });
  }

  // 8. Schema Validation
  console.log('\n📋 Schema Validation');
  const schemaContent = fs.readFileSync('shared/schema.ts', 'utf8');
  
  const mvpFields = [
    'seoVisibleAtFirstByte',
    'prioritizedHealthScore',
    'sharePreviewConfidence'
  ];

  mvpFields.forEach(field => {
    if (schemaContent.includes(field)) {
      logCheck('pass', `MVP schema field ${field} defined`);
    } else {
      logCheck('fail', `MVP schema field ${field} missing`);
    }
  });

  // 9. Build Output Validation
  console.log('\n🏗️ Build Output Validation');
  
  const buildFiles = [
    { path: 'dist/index.js', desc: 'Server build output' },
    { path: 'dist/client', desc: 'Client build directory' }
  ];

  buildFiles.forEach(file => {
    checkFile(file.path, file.desc);
  });

  // 10. Vercel Configuration Validation
  console.log('\n⚙️ Vercel Configuration Validation');
  
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  if (vercelConfig.buildCommand) {
    logCheck('pass', 'Build command configured');
  } else {
    logCheck('fail', 'Build command missing');
  }

  if (vercelConfig.functions && vercelConfig.functions['api/*.ts']) {
    logCheck('pass', 'API functions configured');
  } else {
    logCheck('fail', 'API functions configuration missing');
  }

  if (vercelConfig.rewrites && vercelConfig.rewrites.length > 0) {
    logCheck('pass', 'URL rewrites configured');
  } else {
    logCheck('fail', 'URL rewrites missing');
  }

  // 11. Test Suite Validation (if tests exist)
  console.log('\n🧪 Test Suite Validation');
  
  if (fs.existsSync('server/__tests__')) {
    try {
      runCommand('npm run test:unit', 'Running unit tests');
      runCommand('npm run test:mvp', 'Running MVP integration tests');
    } catch (error) {
      logCheck('warn', 'Some tests failed - review before deployment');
    }
  } else {
    logCheck('warn', 'No test suite found');
  }

  // 12. Security Check
  console.log('\n🔒 Security Validation');
  
  try {
    runCommand('npm audit --audit-level=high', 'Security audit');
  } catch (error) {
    logCheck('warn', 'Security vulnerabilities found - review npm audit output');
  }

  // Final Summary
  console.log('\n📊 Pre-Deployment Summary');
  console.log(`✅ Passed: ${checks.passed}`);
  console.log(`❌ Failed: ${checks.failed}`);
  console.log(`⚠️  Warnings: ${checks.warnings}`);

  if (checks.failed === 0) {
    console.log('\n🎉 Pre-deployment validation PASSED! Ready for Vercel deployment.');
    
    // Generate deployment info
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      checks: checks,
      mvpFeatures: ['SEO-Visible at First Byte', 'Prioritized Health Score', 'Share Preview Confidence'],
      buildCommand: vercelConfig.buildCommand,
      apiEndpoints: requiredEndpoints
    };
    
    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('📄 Deployment info saved to deployment-info.json');
    
    process.exit(0);
  } else {
    console.log('\n💥 Pre-deployment validation FAILED! Fix issues before deploying.');
    process.exit(1);
  }

} catch (error) {
  console.error('\n💥 Pre-deployment validation failed:', error.message);
  process.exit(1);
}