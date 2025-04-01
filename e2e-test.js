/**
 * End-to-End Testing Script for Meta Tag Analyzer
 * 
 * This script performs end-to-end tests on the Meta Tag Analyzer application.
 * It tests the API endpoints and validates the responses to ensure the application
 * is functioning correctly.
 */

import fetch from 'node-fetch';
import assert from 'assert';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_URL = 'https://example.com';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test runner
async function runTests() {
  console.log(`${colors.cyan}===== Meta Tag Analyzer E2E Tests =====${colors.reset}`);
  console.log(`Testing against API: ${API_URL}\n`);
  
  let passedTests = 0;
  let failedTests = 0;
  
  // Test 1: API Health Check
  try {
    console.log(`${colors.blue}[TEST] Checking API health...${colors.reset}`);
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'GET',
    });
    
    if (response.ok) {
      console.log(`${colors.green}✓ API health check passed${colors.reset}`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ API health check failed with status: ${response.status}${colors.reset}`);
      failedTests++;
    }
  } catch (err) {
    console.log(`${colors.red}✗ API health check failed: ${err.message}${colors.reset}`);
    console.log(`  Note: This test will fail if the health endpoint is not implemented`);
    failedTests++;
  }
  
  // Test 2: URL Analysis
  try {
    console.log(`\n${colors.blue}[TEST] Testing URL analysis with ${TEST_URL}...${colors.reset}`);
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: TEST_URL }),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Validate response structure
      assert(data.analysis, 'Response should include analysis data');
      assert(data.tags && Array.isArray(data.tags), 'Response should include tags array');
      assert(data.recommendations && Array.isArray(data.recommendations), 'Response should include recommendations array');
      
      // Validate analysis data
      assert(typeof data.analysis.healthScore === 'number', 'Health score should be a number');
      assert(typeof data.analysis.totalCount === 'number', 'Total count should be a number');
      
      console.log(`${colors.green}✓ URL analysis passed${colors.reset}`);
      console.log(`  Health Score: ${data.analysis.healthScore}%`);
      console.log(`  Total Tags: ${data.analysis.totalCount}`);
      console.log(`  Found Tags: ${data.tags.filter(tag => tag.isPresent).length}`);
      console.log(`  Missing Tags: ${data.tags.filter(tag => !tag.isPresent).length}`);
      console.log(`  Recommendations: ${data.recommendations.length}`);
      passedTests++;
    } else {
      const errorData = await response.json();
      console.log(`${colors.red}✗ URL analysis failed with status: ${response.status}${colors.reset}`);
      console.log(`  Error: ${errorData.message || 'Unknown error'}`);
      failedTests++;
    }
  } catch (err) {
    console.log(`${colors.red}✗ URL analysis test failed: ${err.message}${colors.reset}`);
    failedTests++;
  }
  
  // Test 3: Invalid URL Test
  try {
    console.log(`\n${colors.blue}[TEST] Testing with invalid URL...${colors.reset}`);
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'invalid-url-format' }),
    });
    
    if (response.status === 400) {
      const errorData = await response.json();
      console.log(`${colors.green}✓ Invalid URL handling passed${colors.reset}`);
      console.log(`  Error message: ${errorData.message}`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ Invalid URL test failed. Expected 400 status, got ${response.status}${colors.reset}`);
      failedTests++;
    }
  } catch (err) {
    console.log(`${colors.red}✗ Invalid URL test failed: ${err.message}${colors.reset}`);
    failedTests++;
  }
  
  // Test Summary
  console.log(`\n${colors.cyan}===== Test Summary =====${colors.reset}`);
  console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Failed: ${colors.red}${failedTests}${colors.reset}`);
  console.log(`Total: ${passedTests + failedTests}`);
  
  if (failedTests > 0) {
    console.log(`\n${colors.red}✗ Some tests failed!${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
    process.exit(0);
  }
}

// Run the tests
runTests().catch(err => {
  console.error(`${colors.red}Error running tests: ${err.message}${colors.reset}`);
  process.exit(1);
});