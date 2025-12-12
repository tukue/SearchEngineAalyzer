// Quick test to verify progress tracking works
import fetch from 'node-fetch';

async function testProgressTracking() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // Start an audit
    console.log('Starting audit...');
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'test-tenant',
        'x-user-id': 'test-user'
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    
    const result = await response.json();
    console.log('Audit started:', result);
    
    if (result.runId) {
      // Poll for progress updates
      console.log('Polling for progress...');
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`${baseUrl}/api/audits/${result.runId}`, {
          headers: {
            'x-tenant-id': 'test-tenant',
            'x-user-id': 'test-user'
          }
        });
        
        const status = await statusResponse.json();
        console.log(`Progress: ${status.run?.progress || 0}% - Status: ${status.run?.status}`);
        
        if (status.run?.status === 'SUCCEEDED' || status.run?.status === 'FAILED') {
          console.log('Audit completed!');
          break;
        }
      }
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testProgressTracking();