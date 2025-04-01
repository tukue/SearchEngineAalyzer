// Frontend integration check script

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Checking frontend integration with backend...');

// Check Home component for API integration
try {
  const homeContent = fs.readFileSync(path.resolve('client/src/pages/Home.tsx'), 'utf8');
  
  // Check for queryClient usage
  if (!homeContent.includes('useQuery') && !homeContent.includes('useMutation')) {
    console.error('✗ Home component is missing React Query hooks');
    process.exit(1);
  } else {
    console.log('✓ Home component uses React Query');
  }
  
  // Check for API endpoint reference
  if (!homeContent.includes('/api/analyze')) {
    console.error('✗ Home component is missing reference to /api/analyze endpoint');
    process.exit(1);
  } else {
    console.log('✓ Home component references the correct API endpoint');
  }
  
  // Check for loading state
  if (!homeContent.includes('isLoading') && !homeContent.includes('isPending')) {
    console.error('✗ Home component is missing loading state handling');
    process.exit(1);
  } else {
    console.log('✓ Home component handles loading state');
  }
  
  // Check for error handling
  if (!homeContent.includes('error') || !homeContent.includes('onError')) {
    console.error('✗ Home component is missing error handling');
    process.exit(1);
  } else {
    console.log('✓ Home component includes error handling');
  }
  
  // Check for URL input component
  if (!homeContent.includes('URLInputForm')) {
    console.error('✗ Home component is missing URLInputForm component');
    process.exit(1);
  } else {
    console.log('✓ Home component includes URLInputForm component');
  }
  
  // Check for results container
  if (!homeContent.includes('ResultsContainer')) {
    console.error('✗ Home component is missing ResultsContainer component');
    process.exit(1);
  } else {
    console.log('✓ Home component includes ResultsContainer component');
  }
  
} catch (error) {
  console.error('Error checking Home component:', error);
  process.exit(1);
}

// Check URL input form
try {
  const formContent = fs.readFileSync(path.resolve('client/src/components/URLInputForm.tsx'), 'utf8');
  
  // Check for form submission
  if (!formContent.includes('onSubmit')) {
    console.error('✗ URLInputForm component is missing form submission handler');
    process.exit(1);
  } else {
    console.log('✓ URLInputForm component includes form submission handler');
  }
  
  // Check for URL validation
  if (!formContent.includes('url')) {
    console.error('✗ URLInputForm component is missing URL field');
    process.exit(1);
  } else {
    console.log('✓ URLInputForm component includes URL field');
  }
  
} catch (error) {
  console.error('Error checking URLInputForm component:', error);
  process.exit(1);
}

// Check Results Container
try {
  const resultsContent = fs.readFileSync(path.resolve('client/src/components/ResultsContainer.tsx'), 'utf8');
  
  // Check for tags display
  if (!resultsContent.includes('TagsTable') && !resultsContent.includes('tags')) {
    console.error('✗ ResultsContainer component is missing tags display');
    process.exit(1);
  } else {
    console.log('✓ ResultsContainer component includes tags display');
  }
  
  // Check for recommendations
  if (!resultsContent.includes('RecommendationsList') && !resultsContent.includes('recommendations')) {
    console.error('✗ ResultsContainer component is missing recommendations display');
    process.exit(1);
  } else {
    console.log('✓ ResultsContainer component includes recommendations display');
  }
  
} catch (error) {
  console.error('Error checking ResultsContainer component:', error);
  process.exit(1);
}

console.log('\n✅ Frontend integration checks passed!');