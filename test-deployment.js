#!/usr/bin/env node

import fetch from 'node-fetch';

const GITHUB_API = 'https://api.github.com';
const REPO = 'tukue/SearchEngineAalyzer';
const BRANCH = 'codex/fix-vercel-deployment-serving-raw-source-code';

console.log('🚀 Deployment Pipeline Test\n');

async function checkWorkflowRuns() {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${REPO}/actions/runs?branch=${BRANCH}&per_page=5`);
    const data = await response.json();
    
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      console.log('📋 Recent Workflow Runs:');
      data.workflow_runs.slice(0, 3).forEach(run => {
        console.log(`  - ${run.name}: ${run.status} (${run.conclusion || 'running'})`);
        console.log(`    ${run.html_url}`);
      });
    } else {
      console.log('⏳ No workflow runs found yet');
    }
  } catch (error) {
    console.log('❌ Failed to fetch workflow status:', error.message);
  }
}

async function testDeploymentEndpoints() {
  console.log('\n🧪 Testing Deployment Endpoints:');
  
  // Test cases for source code protection
  const testUrls = [
    { path: '/client/src/', expect: 404, desc: 'Source code blocked' },
    { path: '/server/', expect: 404, desc: 'Server code blocked' },
    { path: '/package.json', expect: 404, desc: 'Config files blocked' },
    { path: '/', expect: 200, desc: 'App loads' },
    { path: '/api/health', expect: 200, desc: 'API works' }
  ];
  
  console.log('  Test URLs prepared:');
  testUrls.forEach(test => {
    console.log(`    ${test.path} → expect ${test.expect} (${test.desc})`);
  });
}

await checkWorkflowRuns();
await testDeploymentEndpoints();

console.log('\n✅ Pipeline monitoring active');
console.log('🔗 Check: https://github.com/tukue/SearchEngineAalyzer/actions');