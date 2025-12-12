/**
 * Simple test for metabol-balance-app.vercel.app
 * Tests the Meta Tag Analyzer with real website
 */

import fetch from 'node-fetch';

const TEST_URL = 'https://metabol-balance-app.vercel.app/';
const API_BASE = 'http://localhost:5000/api';

async function testMetabolApp() {
  console.log('🧪 Testing Meta Tag Analyzer with metabol-balance-app');
  console.log('=' .repeat(50));

  try {
    // Test 1: Health Check
    console.log('1. Health Check...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (!healthResponse.ok) throw new Error('Health check failed');
    console.log('✅ API is healthy');

    // Test 2: Analyze metabol-balance-app
    console.log('\n2. Analyzing metabol-balance-app...');
    const auditResponse = await fetch(`${API_BASE}/audit?url=${encodeURIComponent(TEST_URL)}`, {
      headers: {
        'x-tenant-id': 'test-tenant',
        'x-user-id': 'test-user'
      }
    });

    if (!auditResponse.ok) {
      const error = await auditResponse.text();
      throw new Error(`Audit failed: ${auditResponse.status} - ${error}`);
    }

    const auditData = await auditResponse.json();
    console.log('✅ Audit completed');
    console.log(`   URL: ${auditData.url}`);
    console.log(`   Overall Score: ${auditData.scores?.overall || 'N/A'}`);
    console.log(`   Issues Found: ${auditData.issues?.length || 0}`);
    console.log(`   Recommendations: ${auditData.recommendations?.length || 0}`);

    // Test 3: Security - Block localhost
    console.log('\n3. Testing security (localhost blocking)...');
    const securityResponse = await fetch(`${API_BASE}/audit?url=localhost:3000`, {
      headers: {
        'x-tenant-id': 'test-tenant',
        'x-user-id': 'test-user'
      }
    });

    if (securityResponse.status === 400) {
      console.log('✅ Security: localhost blocked');
    } else {
      console.log('❌ Security: localhost should be blocked');
    }

    console.log('\n🎉 All tests passed!');
    
    if (auditData.recommendations && auditData.recommendations.length > 0) {
      console.log('\nTop Recommendations:');
      auditData.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.title}: ${rec.description}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  testMetabolApp();
}