// API test script to validate the API functionality

import { spawn } from 'child_process';

// Allow CI to bypass this script unless explicitly requested
if (process.env.RUN_API_TESTS !== '1') {
  console.log('Skipping API test (set RUN_API_TESTS=1 to enable).');
  process.exit(0);
}

// Test URL to analyze
const testUrl = 'https://example.com';
const apiUrl = 'http://localhost:5000/api/analyze';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureServerRunning() {
  console.log('Starting API server for tests...');
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });

  return { started: true, serverProcess };
}

async function shutdownServer(serverProcess) {
  if (!serverProcess) return;

  return new Promise(resolve => {
    serverProcess.on('exit', resolve);
    serverProcess.kill();
    setTimeout(resolve, 5000); // safety net
  });
}

async function testApi() {
  console.log('Testing Meta Tag Analyzer API...');
  console.log(`Testing URL: ${testUrl}`);

  const { started, serverProcess } = await ensureServerRunning();

  try {
    // Give the dev server a short moment to boot before sending requests
    await delay(2000);

    let response;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: testUrl }),
        });
        break;
      } catch (error) {
        if (error?.code !== 'ECONNREFUSED') {
          console.warn('Request error:', error.message || error);
        }
        await delay(1000);
      }
    }

    if (!response) {
      throw new Error('API server did not become ready in time');
    }

    if (!response.ok) {
      console.error(`API returned error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      return false;
    }

    const data = await response.json();

    // Validate response structure
    console.log('\nValidating API response structure...');

    if (!data.analysis) {
      console.error('✗ Missing analysis property in response');
      return false;
    } else {
      console.log('✓ Analysis property exists');
    }

    if (!Array.isArray(data.tags)) {
      console.error('✗ Tags property is not an array');
      return false;
    } else {
      console.log(`✓ Tags array exists with ${data.tags.length} items`);
    }

    if (!Array.isArray(data.recommendations)) {
      console.error('✗ Recommendations property is not an array');
      return false;
    } else {
      console.log(`✓ Recommendations array exists with ${data.recommendations.length} items`);
    }

    // Validate analysis data
    console.log('\nValidating analysis data...');
    const requiredAnalysisProps = ['id', 'url', 'totalCount', 'seoCount', 'socialCount', 'technicalCount', 'missingCount', 'healthScore'];

    const missingProps = requiredAnalysisProps.filter(prop => !(prop in data.analysis));
    if (missingProps.length > 0) {
      console.error(`✗ Missing analysis properties: ${missingProps.join(', ')}`);
      return false;
    } else {
      console.log('✓ All required analysis properties exist');
    }

    // Validate URL normalization
    if (data.analysis.url.includes(testUrl)) {
      console.log('✓ URL was correctly processed');
    } else {
      console.error(`✗ URL mismatch: ${data.analysis.url} does not include ${testUrl}`);
      return false;
    }

    // Show health score
    console.log(`\nHealth Score: ${data.analysis.healthScore}%`);
    console.log(`Total Tags: ${data.analysis.totalCount}`);
    console.log(`SEO Tags: ${data.analysis.seoCount}`);
    console.log(`Social Tags: ${data.analysis.socialCount}`);
    console.log(`Technical Tags: ${data.analysis.technicalCount}`);
    console.log(`Missing Tags: ${data.analysis.missingCount}`);

    // List some found tags
    console.log('\nSample of found meta tags:');
    const sampleSize = Math.min(5, data.tags.length);
    for (let i = 0; i < sampleSize; i++) {
      const tag = data.tags[i];
      console.log(`- ${tag.name || tag.property || tag.httpEquiv || tag.rel || 'unknown'}: ${tag.content || 'N/A'} (${tag.tagType})`);
    }

    console.log('\n✅ API test passed! The API is functioning correctly.');
    return true;
  } catch (error) {
    console.error('Error testing API:', error);
    return false;
  } finally {
    if (started) {
      await shutdownServer(serverProcess);
    }
  }
}

// Run the test
testApi().then(success => {
  if (!success) {
    console.error('\n❌ API test failed!');
    process.exit(1);
  }
});
