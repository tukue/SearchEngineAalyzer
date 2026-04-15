#!/usr/bin/env node

/**
 * End-to-End Test for 405 Fix Verification
 * 
 * Tests the analyze endpoint with actual websites to verify the 405 error is fixed.
 * The fix ensures POST requests to /api/analyze use the local Next.js handler
 * instead of being rewritten to an external API.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test URLs - use a variety of websites to ensure robustness
const TEST_URLS = [
  'https://example.com',
  'https://github.com',
  'https://vercel.com',
];

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log(title, 'cyan');
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function testAnalyzeEndpoint(url) {
  const testName = `Testing analyze with: ${url}`;
  log(`\n→ ${testName}`, 'blue');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type');
    let responseData = null;

    try {
      responseData = await response.json();
    } catch (e) {
      responseData = { error: 'Failed to parse JSON response' };
    }

    // Check for 405 error - this indicates the fix didn't work
    if (response.status === 405) {
      log(`✗ FAILED - 405 Method Not Allowed (rewrite issue not fixed)`, 'red');
      log(`  Status: ${response.status}`, 'red');
      log(`  Duration: ${duration}ms`, 'red');
      return { success: false, status: response.status, duration, url };
    }

    // Check for other error status codes
    if (!response.ok) {
      // 400 is expected for some validation errors
      if (response.status === 400) {
        log(`✓ PASSED - Request routed correctly (validation error expected)`, 'green');
        log(`  Status: ${response.status}`, 'green');
        log(`  Message: ${responseData.message || 'Bad Request'}`, 'green');
        log(`  Duration: ${duration}ms`, 'green');
        return { success: true, status: response.status, duration, url };
      }

      log(`✗ FAILED - Unexpected status code`, 'red');
      log(`  Status: ${response.status}`, 'red');
      log(`  Message: ${responseData.message || 'Unknown error'}`, 'red');
      log(`  Duration: ${duration}ms`, 'red');
      return { success: false, status: response.status, duration, url };
    }

    // 200 OK - the ideal case
    if (response.ok && responseData.analysis) {
      log(`✓ PASSED - Successfully analyzed website`, 'green');
      log(`  Status: ${response.status} OK`, 'green');
      log(`  URL: ${responseData.analysis.url}`, 'green');
      log(`  Health Score: ${responseData.analysis.healthScore}%`, 'green');
      log(`  SEO Tags: ${responseData.analysis.seoCount}`, 'green');
      log(`  Social Tags: ${responseData.analysis.socialCount}`, 'green');
      log(`  Technical Tags: ${responseData.analysis.technicalCount}`, 'green');
      log(`  Missing Tags: ${responseData.analysis.missingCount}`, 'green');
      log(`  Duration: ${duration}ms`, 'green');
      return { success: true, status: response.status, duration, url, analysis: responseData.analysis };
    }

    log(`✗ FAILED - Unexpected response`, 'red');
    log(`  Status: ${response.status}`, 'red');
    log(`  Duration: ${duration}ms`, 'red');
    return { success: false, status: response.status, duration, url };

  } catch (error) {
    log(`✗ FAILED - Network error`, 'red');
    log(`  Error: ${error.message}`, 'red');
    if (error.message.includes('ECONNREFUSED')) {
      log(`  Server not running at ${BASE_URL}`, 'red');
    }
    return { success: false, error: error.message, url };
  }
}

async function testHealthEndpoint() {
  const testName = 'Testing health endpoint';
  log(`\n→ ${testName}`, 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const contentType = response.headers.get('content-type');
    let responseData = null;

    try {
      responseData = await response.json();
    } catch (e) {
      responseData = { error: 'Failed to parse JSON response' };
    }

    if (response.status === 405) {
      log(`✗ FAILED - 405 Method Not Allowed (rewrite issue not fixed)`, 'red');
      log(`  Status: ${response.status}`, 'red');
      return { success: false, status: response.status };
    }

    if (response.ok) {
      log(`✓ PASSED - Health endpoint working`, 'green');
      log(`  Status: ${response.status} OK`, 'green');
      log(`  Status: ${responseData.status || 'healthy'}`, 'green');
      return { success: true, status: response.status };
    }

    log(`✗ FAILED - Unexpected status code`, 'red');
    log(`  Status: ${response.status}`, 'red');
    return { success: false, status: response.status };

  } catch (error) {
    log(`✗ FAILED - Network error`, 'red');
    log(`  Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  logSection('405 Fix Verification Tests');

  log(`Base URL: ${BASE_URL}`, 'cyan');
  log(`Testing POST requests to verify local handlers are used`, 'cyan');
  log(`If you see 405 errors, the fix is not working\n`, 'cyan');

  const results = {
    health: null,
    analyze: [],
  };

  // Test health endpoint first
  logSection('1. Testing Health Endpoint');
  results.health = await testHealthEndpoint();

  // Test analyze endpoint with multiple URLs
  logSection('2. Testing Analyze Endpoint with Real Websites');
  for (const url of TEST_URLS) {
    results.analyze.push(await testAnalyzeEndpoint(url));
  }

  // Summary
  logSection('Test Results Summary');

  const healthPassed = results.health?.success;
  const analyzePassed = results.analyze.filter(r => r.success).length;
  const analyzeTotal = results.analyze.length;

  log(`Health Endpoint: ${healthPassed ? '✓ PASSED' : '✗ FAILED'}`, healthPassed ? 'green' : 'red');
  log(`Analyze Endpoint: ${analyzePassed}/${analyzeTotal} tests passed`, analyzePassed === analyzeTotal ? 'green' : 'red');

  const allPassed = healthPassed && analyzePassed === analyzeTotal;

  if (allPassed) {
    logSection('✓ All Tests Passed - 405 Fix is Working!');
    log('The POST requests are being routed to the local Next.js handlers correctly.', 'green');
    log('The 405 error has been fixed by the beforeFiles rewrite configuration.', 'green');
    process.exit(0);
  } else {
    logSection('✗ Some Tests Failed');
    
    const failed405 = results.analyze.filter(r => r.status === 405);
    if (failed405.length > 0) {
      log(`${failed405.length} test(s) returned 405 - Fix not working properly`, 'red');
      log('Check next.config.js to ensure beforeFiles rewrites are configured', 'red');
    }
    
    const failedOther = results.analyze.filter(r => !r.success && r.status !== 405);
    if (failedOther.length > 0) {
      log(`${failedOther.length} test(s) failed for other reasons`, 'yellow');
    }
    
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
