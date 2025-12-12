#!/usr/bin/env node

const { calculateMVPMeasurements } = require('./dist/measurementEngine.js');

// Simple test to validate MVP measurements
const testHTML = `
<html>
  <head>
    <title>Test Page Title</title>
    <meta name="description" content="This is a test meta description that is long enough to be meaningful">
    <meta property="og:title" content="Test OG Title">
    <meta property="og:description" content="Test OG description for social sharing">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script type="application/ld+json">{"@type": "WebPage"}</script>
  </head>
  <body>
    <h1>Test Heading</h1>
  </body>
</html>
`;

const mockAnalysisResult = {
  analysis: {
    id: 1,
    url: 'https://test.com',
    totalCount: 6,
    seoCount: 3,
    socialCount: 2,
    technicalCount: 1,
    missingCount: 0,
    healthScore: 100,
    timestamp: new Date().toISOString(),
  },
  tags: [
    { id: 1, name: 'title', content: 'Test Page Title', isPresent: true, tagType: 'SEO', url: 'https://test.com', property: null, httpEquiv: null, charset: null, rel: null },
    { id: 2, name: 'description', content: 'This is a test meta description that is long enough to be meaningful', isPresent: true, tagType: 'SEO', url: 'https://test.com', property: null, httpEquiv: null, charset: null, rel: null },
    { id: 3, property: 'og:title', content: 'Test OG Title', isPresent: true, tagType: 'Social', url: 'https://test.com', name: null, httpEquiv: null, charset: null, rel: null },
    { id: 4, property: 'og:description', content: 'Test OG description for social sharing', isPresent: true, tagType: 'Social', url: 'https://test.com', name: null, httpEquiv: null, charset: null, rel: null },
    { id: 5, name: 'viewport', content: 'width=device-width, initial-scale=1', isPresent: true, tagType: 'Technical', url: 'https://test.com', property: null, httpEquiv: null, charset: null, rel: null }
  ],
  recommendations: []
};

console.log('Testing MVP Measurements...\n');

try {
  const results = calculateMVPMeasurements(testHTML, mockAnalysisResult);
  
  console.log('✅ MVP Measurements Results:');
  console.log(`   SEO-Visible at First Byte: ${results.seoVisibleAtFirstByte}/100`);
  console.log(`   Prioritized Health Score: ${results.prioritizedHealthScore}/100`);
  console.log(`   Share Preview Confidence: ${results.sharePreviewConfidence}/100`);
  
  // Validate results are reasonable
  const allScoresValid = Object.values(results).every(score => 
    typeof score === 'number' && score >= 0 && score <= 100
  );
  
  if (allScoresValid) {
    console.log('\n✅ All MVP measurements are working correctly!');
    process.exit(0);
  } else {
    console.log('\n❌ Some measurements returned invalid scores');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error testing MVP measurements:', error.message);
  process.exit(1);
}