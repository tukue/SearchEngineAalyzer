// Check audit details
import fetch from 'node-fetch';

async function checkAudit() {
  try {
    const response = await fetch('http://localhost:5000/api/audits/1', {
      headers: {
        'x-tenant-id': 'test-tenant',
        'x-user-id': 'test-user'
      }
    });
    
    const result = await response.json();
    console.log('Audit details:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAudit();