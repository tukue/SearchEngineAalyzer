// Simple test script to validate the application structure

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths to check
const criticalFiles = [
  'server/routes.ts',
  'server/storage.ts',
  'server/index.ts',
  'shared/schema.ts',
  'client/src/App.tsx',
  'client/src/pages/Home.tsx',
  'client/src/components/URLInputForm.tsx',
  'client/src/components/ResultsContainer.tsx',
  'client/src/components/TagsTable.tsx',
  'client/src/components/RecommendationsList.tsx'
];

// Check for required files
console.log('Checking critical files...');
const missingFiles = [];

criticalFiles.forEach(file => {
  if (!fs.existsSync(path.resolve(file))) {
    missingFiles.push(file);
  } else {
    console.log(`✓ ${file} exists`);
  }
});

if (missingFiles.length > 0) {
  console.error('Missing files:');
  missingFiles.forEach(file => console.error(`✗ ${file}`));
  process.exit(1);
} else {
  console.log('\nAll critical files are present.');
}

// Validate the server schema
console.log('\nValidating shared schema...');
try {
  const schemaContent = fs.readFileSync(path.resolve('shared/schema.ts'), 'utf8');
  
  const requiredSchemaElements = [
    'metaTags', 
    'analyses', 
    'recommendations', 
    'MetaTag', 
    'Analysis', 
    'Recommendation',
    'AnalysisResult'
  ];

  const missingElements = [];
  requiredSchemaElements.forEach(element => {
    if (!schemaContent.includes(element)) {
      missingElements.push(element);
    } else {
      console.log(`✓ Schema includes ${element}`);
    }
  });

  if (missingElements.length > 0) {
    console.error('Missing schema elements:');
    missingElements.forEach(element => console.error(`✗ ${element}`));
    process.exit(1);
  }
} catch (error) {
  console.error('Error validating schema:', error);
  process.exit(1);
}

// Validate the server routes
console.log('\nValidating server routes...');
try {
  const routesContent = fs.readFileSync(path.resolve('server/routes.ts'), 'utf8');
  
  if (!routesContent.includes('/analyze')) {
    console.error('✗ Missing /analyze endpoint');
    process.exit(1);
  } else {
    console.log('✓ Routes include /analyze endpoint');
  }
} catch (error) {
  console.error('Error validating routes:', error);
  process.exit(1);
}

// All checks passed
console.log('\n✅ All tests passed! The application structure is valid.');