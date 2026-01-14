// Global setup for Jest tests
jest.mock('node-fetch', () => {
  return {
    __esModule: true,
    default: jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('<html><head><title>Test</title></head><body></body></html>'),
      headers: new Map([['content-type', 'text/html']]),
      url: 'https://example.com'
    }))
  };
});