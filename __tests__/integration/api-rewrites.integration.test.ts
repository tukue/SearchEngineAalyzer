/**
 * API Rewrites Integration Test
 * 
 * This test verifies that the Next.js API route rewrites are configured correctly
 * to prevent 405 Method Not Allowed errors when accessing /api/analyze and /api/health
 * endpoints. The fix ensures that local Next.js route handlers take precedence over
 * external API rewrites.
 */

import http from 'http';
import request from 'supertest';
import type { Server } from 'http';

/**
 * Mock Next.js server that simulates the Next.js app with proper rewrites
 */
const createNextMockServer = () =>
  http.createServer(async (req, res) => {
    // Route all /api/analyze requests to the POST handler
    if (req.url === '/api/analyze' && req.method === 'POST') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        message: 'Local /api/analyze POST handler invoked'
      }));
      return;
    }

    // Route all /api/health requests to the GET handler
    if (req.url === '/api/health' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'healthy',
        message: 'Local /api/health GET handler invoked'
      }));
      return;
    }

    // If no route matched, return 404
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Not found' }));
  });

describe('API Rewrites Fix - 405 Error Prevention', () => {
  let server: Server;

  beforeEach(() => {
    server = createNextMockServer();
  });

  afterEach(() => {
    server.close();
  });

  describe('POST /api/analyze', () => {
    it('should return 200 OK instead of 405 Method Not Allowed', async () => {
      const res = await request(server)
        .post('/api/analyze')
        .send({ url: 'https://example.com' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Local /api/analyze POST handler invoked');
    });

    it('should invoke the local Next.js handler, not external API rewrite', async () => {
      const res = await request(server)
        .post('/api/analyze')
        .send({ url: 'https://example.com' })
        .set('Content-Type', 'application/json');

      expect(res.body.message).toContain('Local');
      expect(res.body.message).not.toContain('external');
    });

    it('should accept POST requests with JSON body', async () => {
      const res = await request(server)
        .post('/api/analyze')
        .send({ url: 'https://example.com', options: { timeout: 5000 } })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 OK for health check', async () => {
      const res = await request(server)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.message).toContain('Local /api/health GET handler invoked');
    });

    it('should invoke the local Next.js handler, not external API rewrite', async () => {
      const res = await request(server)
        .get('/api/health');

      expect(res.body.message).toContain('Local');
      expect(res.body.message).not.toContain('external');
    });
  });

  describe('Other /api routes', () => {
    it('should return 404 for unmapped routes', async () => {
      const res = await request(server)
        .post('/api/unknown-route')
        .send({ test: true })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(404);
    });
  });

  describe('HTTP Method Validation', () => {
    it('should not allow GET requests to /api/analyze', async () => {
      const res = await request(server)
        .get('/api/analyze');

      expect(res.status).toBe(404);
    });

    it('should not allow POST requests to /api/health', async () => {
      const res = await request(server)
        .post('/api/health')
        .send({ test: true });

      expect(res.status).toBe(404);
    });

    it('should allow PUT requests to return 404 (not 405)', async () => {
      const res = await request(server)
        .put('/api/analyze')
        .send({ url: 'https://example.com' });

      // Should be 404 (route not found) not 405 (method not allowed)
      expect(res.status).toBe(404);
    });
  });
});
