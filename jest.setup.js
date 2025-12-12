// Jest setup file for global test configuration

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';