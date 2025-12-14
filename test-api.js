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
    
    if (healthResponse.ok) {
      console.log('✅ Health endpoint working');
      console.log(`   Status: ${healthData.status}`);
    } else {
      console.log('❌ Health endpoint failed');
    }

    // Test analyze endpoint
    const analyzeResponse = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    if (analyzeResponse.ok) {
      console.log('✅ Analyze endpoint working');
    } else {
      console.log('❌ Analyze endpoint failed');
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