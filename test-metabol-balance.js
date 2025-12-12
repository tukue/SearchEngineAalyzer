/**
 * Test script for metabol-balance-app.vercel.app
 * Validates the Meta Tag Analyzer with real website data
 */

const fetch = require('node-fetch');

const TEST_URL = 'https://metabol-balance-app.vercel.app/';
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

async function testMetabolBalanceApp() {
  console.log('🧪 Testing Meta Tag Analyzer with metabol-balance-app.vercel.app');
  console.log('=' .repeat(60));

  try {
    // Test 1: Health Check
    console.log('1. Health Check...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health:', healthData.status);

    // Test 2: Immediate Audit
    console.log('\n2. Running immediate audit...');
    const auditResponse = await fetch(`${API_BASE}/audit?url=${encodeURIComponent(TEST_URL)}`, {
      headers: {
        'x-tenant-id': 'test-tenant-metabol',
        'x-user-id': 'test-user-001'
      }
    });

    if (!auditResponse.ok) {
      throw new Error(`Audit failed: ${auditResponse.status} ${auditResponse.statusText}`);
    }

    const auditData = await auditResponse.json();
    console.log('✅ Audit completed');
    console.log(`   URL: ${auditData.url}`);
    console.log(`   Overall Score: ${auditData.scores?.overall || 'N/A'}`);
    console.log(`   SEO Score: ${auditData.scores?.seo || 'N/A'}`);
    console.log(`   Social Score: ${auditData.scores?.social || 'N/A'}`);
    console.log(`   Technical Score: ${auditData.scores?.technical || 'N/A'}`);
    console.log(`   Issues Found: ${auditData.issues?.length || 0}`);
    console.log(`   Recommendations: ${auditData.recommendations?.length || 0}`);

    // Test 3: Queued Audit
    console.log('\n3. Testing queued audit...');
    const queueResponse = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'test-tenant-metabol',
        'x-user-id': 'test-user-001'
      },
      body: JSON.stringify({ url: TEST_URL })
    });

    if (!queueResponse.ok) {
      throw new Error(`Queue failed: ${queueResponse.status} ${queueResponse.statusText}`);
    }

    const queueData = await queueResponse.json();
    console.log('✅ Audit queued');
    console.log(`   Job ID: ${queueData.jobId}`);
    console.log(`   Run ID: ${queueData.runId}`);
    console.log(`   Status: ${queueData.status}`);

    // Test 4: Plan Information
    console.log('\n4. Checking plan information...');
    const planResponse = await fetch(`${API_BASE}/plan`, {
      headers: {
        'x-tenant-id': 'test-tenant-metabol',
        'x-user-id': 'test-user-001'
      }
    });

    if (planResponse.ok) {
      const planData = await planResponse.json();
      console.log('✅ Plan info retrieved');
      console.log(`   Plan: ${planData.plan}`);
      console.log(`   Remaining Runs: ${planData.remainingRuns}`);
      console.log(`   Max Monthly Runs: ${planData.maxMonthlyRuns}`);
      console.log(`   Can Export: ${planData.canExportReports}`);
    }

    // Test 5: Security - Test blocked URLs
    console.log('\n5. Testing security (blocked URLs)...');
    const blockedUrls = [
      'http://localhost:3000',
      'https://127.0.0.1',
      'http://192.168.1.1'
    ];

    for (const blockedUrl of blockedUrls) {
      const securityResponse = await fetch(`${API_BASE}/audit?url=${encodeURIComponent(blockedUrl)}`, {
        headers: {
          'x-tenant-id': 'test-tenant-metabol',
          'x-user-id': 'test-user-001'
        }
      });

      if (securityResponse.status === 400) {
        console.log(`✅ Blocked: ${blockedUrl}`);
      } else {
        console.log(`❌ Should have blocked: ${blockedUrl}`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\nSample Meta Tags Found:');
    
    if (auditData.issues && auditData.issues.length > 0) {
      auditData.issues.slice(0, 5).forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.title || issue.type}: ${issue.description || 'No description'}`);
      });
    }

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

// Run the test
if (require.main === module) {
  testMetabolBalanceApp();
}

module.exports = { testMetabolBalanceApp };