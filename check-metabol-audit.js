// Check the metabol-balance-app audit results
import fetch from 'node-fetch';

async function checkMetabolAudit() {
  try {
    const response = await fetch('http://localhost:5000/api/audits/2', {
      headers: {
        'x-tenant-id': 'test-tenant-2',
        'x-user-id': 'test-user-2'
      }
    });
    
    const result = await response.json();
    
    console.log('=== AUDIT SUMMARY ===');
    console.log('URL:', result.run.target);
    console.log('Status:', result.run.status);
    console.log('Health Score:', result.run.healthScore);
    console.log('Summary:', result.run.summary);
    console.log('');
    
    if (result.analysis) {
      console.log('=== ANALYSIS DETAILS ===');
      console.log('Total Tags Found:', result.analysis.analysis.totalCount);
      console.log('SEO Tags:', result.analysis.analysis.seoCount);
      console.log('Social Tags:', result.analysis.analysis.socialCount);
      console.log('Technical Tags:', result.analysis.analysis.technicalCount);
      console.log('Missing Tags:', result.analysis.analysis.missingCount);
      console.log('');
      
      console.log('=== FOUND TAGS ===');
      const presentTags = result.analysis.tags.filter(tag => tag.isPresent);
      presentTags.forEach(tag => {
        const identifier = tag.name || tag.property || tag.rel || tag.httpEquiv || 'charset';
        console.log(`✓ ${identifier}: "${tag.content}"`);
      });
      console.log('');
      
      console.log('=== MISSING TAGS ===');
      const missingTags = result.analysis.tags.filter(tag => !tag.isPresent);
      missingTags.forEach(tag => {
        const identifier = tag.name || tag.property || tag.rel || tag.httpEquiv || 'charset';
        console.log(`✗ ${identifier} (${tag.tagType})`);
      });
      console.log('');
      
      console.log('=== RECOMMENDATIONS ===');
      result.analysis.recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`${i + 1}. ${rec.tagName}: ${rec.description}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkMetabolAudit();