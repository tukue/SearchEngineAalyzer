#!/usr/bin/env node

import { spawn } from 'child_process';
import fetch from 'node-fetch';

console.log('🧪 Testing API Endpoint...\n');

// Start local server
const server = spawn('tsx', ['server/index.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Server running on port')) {
    serverReady = true;
    testAPI();
  }
});

server.stderr.on('data', (data) => {
  console.error(`Server error: ${data}`);
});

async function testAPI() {
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const healthData = await healthResponse.json();
    
    if (healthResponse.status === 405) {
      console.log('❌ Health endpoint returned 405 Method Not Allowed (rewrite issue)');
    } else if (healthResponse.ok) {
      console.log('✅ Health endpoint working');
      console.log(`   Status: ${healthData.status}`);
    } else {
      console.log('❌ Health endpoint failed with status:', healthResponse.status);
    }

    // Test analyze endpoint with 405 error detection
    const analyzeResponse = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    if (analyzeResponse.status === 405) {
      console.log('❌ Analyze endpoint returned 405 Method Not Allowed (rewrite issue - 405 FIX NOT WORKING)');
      console.log('   This means /api/analyze is being rewritt to external API instead of using local handler');
    } else if (analyzeResponse.ok) {
      console.log('✅ Analyze endpoint working');
      console.log('   ✓ 405 fix verified - using local POST handler');
    } else if (analyzeResponse.status === 400) {
      console.log('✅ Analyze endpoint working (validation error - expected behavior)');
      console.log('   ✓ 405 fix verified - local handler processed request and validated URL');
    } else {
      console.log('❌ Analyze endpoint failed with status:', analyzeResponse.status);
    }

  } catch (error) {
    console.log('❌ API test failed:', error.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

// Timeout after 10 seconds
setTimeout(() => {
  if (!serverReady) {
    console.log('❌ Server startup timeout');
    server.kill();
    process.exit(1);
  }
}, 10000);
