// A wrapper for running tests via npm
import { execSync } from 'child_process';

try {
  console.log('Running all tests...');
  execSync('./run-tests.sh', { stdio: 'inherit' });
  console.log('All tests passed!');
} catch (error) {
  console.error('Tests failed!');
  process.exit(1);
}