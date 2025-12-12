/**
 * Comprehensive Integration Test Suite
 * Tests Meta Tag Analyzer with metabol-balance-app.vercel.app
 */

import fetch from 'node-fetch';

const TEST_URL = 'https://metabol-balance-app.vercel.app/';
const API_BASE = 'http://localhost:5000/api';

class IntegrationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async test(name, testFn) {
    try {
      console.log(`🧪 ${name}...`);
      await testFn();
      console.log(`✅ ${name} - PASSED`);
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
    } catch (error) {
      console.log(`❌ ${name} - FAILED: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async runAll() {
    console.log('🚀 Starting Integration Tests for Meta Tag Analyzer');
    console.log('=' .repeat(60));

    // Test 1: Health Check
    await this.test('Health Check', async () => {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
      
      const data = await response.json();
      if (data.status !== 'ok') throw new Error('Health status not ok');
    });

    // Test 2: Immediate Audit with metabol-balance-app
    await this.test('Immediate Audit - metabol-balance-app', async () => {
      const response = await fetch(`${API_BASE}/audit?url=${encodeURIComponent(TEST_URL)}`, {
        headers: {
          'x-tenant-id': 'test-tenant-metabol',
          'x-user-id': 'test-user-001'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Audit failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.url) throw new Error('Missing URL in response');
      if (!data.scores) throw new Error('Missing scores in response');
      if (!data.issues) throw new Error('Missing issues in response');
      if (!data.recommendations) throw new Error('Missing recommendations in response');
      
      // Validate scores
      const { overall, seo, social, technical } = data.scores;
      if (typeof overall !== 'number' || overall < 0 || overall > 100) {
        throw new Error(`Invalid overall score: ${overall}`);
      }
      
      console.log(`   📊 Scores - Overall: ${overall}, SEO: ${seo}, Social: ${social}, Technical: ${technical}`);
      console.log(`   🔍 Found ${data.issues.length} issues, ${data.recommendations.length} recommendations`);
    });

    // Test 3: Queued Audit
    await this.test('Queued Audit Flow', async () => {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-tenant-metabol',
          'x-user-id': 'test-user-001'
        },
        body: JSON.stringify({ url: TEST_URL })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Queue failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.jobId) throw new Error('Missing jobId');
      if (!data.runId) throw new Error('Missing runId');
      if (data.status !== 'QUEUED') throw new Error(`Expected QUEUED status, got ${data.status}`);
      
      console.log(`   🎯 Job queued - ID: ${data.jobId}, Run: ${data.runId}`);
    });

    // Test 4: Security - SSRF Protection
    await this.test('Security - SSRF Protection', async () => {
      const blockedUrls = [
        'localhost:3000',
        '127.0.0.1',
        '192.168.1.1',
        'http://localhost',
        'https://10.0.0.1'
      ];

      for (const url of blockedUrls) {
        const response = await fetch(`${API_BASE}/audit?url=${encodeURIComponent(url)}`, {
          headers: {
            'x-tenant-id': 'test-tenant-metabol',
            'x-user-id': 'test-user-001'
          }
        });

        if (response.status !== 400) {
          throw new Error(`URL ${url} should be blocked but got status ${response.status}`);
        }
      }
      
      console.log(`   🛡️ Blocked ${blockedUrls.length} malicious URLs`);
    });

    // Test 5: Plan Information
    await this.test('Plan Information Retrieval', async () => {
      const response = await fetch(`${API_BASE}/plan`, {
        headers: {
          'x-tenant-id': 'test-tenant-metabol',
          'x-user-id': 'test-user-001'
        }
      });

      if (!response.ok) {
        throw new Error(`Plan info failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.plan) throw new Error('Missing plan information');
      if (typeof data.remainingRuns !== 'number') throw new Error('Missing remaining runs');
      
      console.log(`   📋 Plan: ${data.plan}, Remaining: ${data.remainingRuns}/${data.maxMonthlyRuns}`);
    });

    // Test 6: Error Handling
    await this.test('Error Handling - Invalid URL', async () => {
      const response = await fetch(`${API_BASE}/audit?url=not-a-valid-url`, {
        headers: {
          'x-tenant-id': 'test-tenant-metabol',
          'x-user-id': 'test-user-001'
        }
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400 for invalid URL, got ${response.status}`);
      }

      const data = await response.json();
      if (!data.message) throw new Error('Missing error message');
    });

    // Test 7: Missing Tenant Context
    await this.test('Security - Missing Tenant Context', async () => {
      const response = await fetch(`${API_BASE}/audit?url=${encodeURIComponent(TEST_URL)}`);
      
      if (response.status !== 401) {
        throw new Error(`Expected 401 for missing tenant, got ${response.status}`);
      }
    });

    // Test 8: Progress Tracking
    await this.test('Progress Tracking', async () => {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-progress',
          'x-user-id': 'test-user-progress'
        },
        body: JSON.stringify({ url: TEST_URL })
      });

      const data = await response.json();
      const runId = data.runId;
      
      // Poll for progress updates
      let finalProgress = 0;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const statusResponse = await fetch(`${API_BASE}/audits/${runId}`, {
          headers: {
            'x-tenant-id': 'test-progress',
            'x-user-id': 'test-user-progress'
          }
        });
        
        const status = await statusResponse.json();
        finalProgress = status.run?.progress || 0;
        
        if (status.run?.status === 'SUCCEEDED') break;
      }
      
      if (finalProgress !== 100) {
        throw new Error(`Expected final progress 100%, got ${finalProgress}%`);
      }
      
      console.log(`   📈 Progress tracking completed: ${finalProgress}%`);
    });

    // Test 9: Audit Content Validation
    await this.test('Audit Content Validation', async () => {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'test-content',
          'x-user-id': 'test-user-content'
        },
        body: JSON.stringify({ url: TEST_URL })
      });

      const data = await response.json();
      const runId = data.runId;
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const auditResponse = await fetch(`${API_BASE}/audits/${runId}`, {
        headers: {
          'x-tenant-id': 'test-content',
          'x-user-id': 'test-user-content'
        }
      });
      
      const audit = await auditResponse.json();
      
      if (!audit.analysis) throw new Error('Missing analysis data');
      if (!audit.analysis.tags) throw new Error('Missing tags data');
      if (!audit.analysis.recommendations) throw new Error('Missing recommendations');
      
      const presentTags = audit.analysis.tags.filter(tag => tag.isPresent);
      const missingTags = audit.analysis.tags.filter(tag => !tag.isPresent);
      
      if (presentTags.length === 0) throw new Error('No tags found - audit may have failed');
      
      // Validate specific expected tags for metabol-balance-app
      const hasTitle = presentTags.some(tag => tag.name === 'title' && tag.content.includes('Metabolic'));
      if (!hasTitle) throw new Error('Expected title tag with "Metabolic" not found');
      
      console.log(`   🏷️ Found ${presentTags.length} present tags, ${missingTags.length} missing tags`);
      console.log(`   💡 Generated ${audit.analysis.recommendations.length} recommendations`);
    });

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Integration Test Results');
    console.log('=' .repeat(60));
    
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
    }
    
    console.log('\n🎯 Test completed for metabol-balance-app.vercel.app');
    
    if (this.results.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests
const tester = new IntegrationTester();
tester.runAll().catch(error => {
  console.error('💥 Test suite crashed:', error.message);
  process.exit(1);
});