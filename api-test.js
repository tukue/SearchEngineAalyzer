// API test script to validate the API functionality

import fetch from 'node-fetch';

// Test URL to analyze
const testUrl = 'https://example.com';
const apiUrl = 'http://localhost:5000/api/analyze';

async function testApi() {
  console.log('Testing Meta Tag Analyzer API...');
  console.log(`Testing URL: ${testUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl }),
    });
    
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
  }
}

// Run the test
testApi().then(success => {
  if (!success) {
    console.error('\n❌ API test failed!');
    process.exit(1);
  }
});