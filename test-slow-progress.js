// Test progress tracking with metabol-balance-app.vercel.app
import fetch from 'node-fetch';

async function testSlowProgress() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // Start an audit with metabol-balance-app.vercel.app
    console.log('Starting audit with metabol-balance-app.vercel.app...');
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'test-tenant-2',
        'x-user-id': 'test-user-2'
      },
      body: JSON.stringify({ url: 'https://metabol-balance-app.vercel.app/' })
    });
    
    const result = await response.json();
    console.log('Audit started:', result);
    
    if (result.runId) {
      // Poll for progress updates more frequently
      console.log('Polling for progress every 300ms...');
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms
        
        const statusResponse = await fetch(`${baseUrl}/api/audits/${result.runId}`, {
          headers: {
            'x-tenant-id': 'test-tenant-2',
            'x-user-id': 'test-user-2'
          }
        });
        
        const status = await statusResponse.json();
        const progress = status.run?.progress || 0;
        const auditStatus = status.run?.status;
        
        console.log(`[${new Date().toLocaleTimeString()}] Progress: ${progress}% - Status: ${auditStatus}`);
        
        if (auditStatus === 'SUCCEEDED' || auditStatus === 'FAILED') {
          console.log('Audit completed!');
          console.log('Final summary:', status.run?.summary);
          console.log('Health Score:', status.run?.healthScore);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSlowProgress();