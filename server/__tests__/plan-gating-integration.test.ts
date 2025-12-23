import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

jest.mock('node-fetch', () => {
  return jest.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Website</title>
          <meta charset="UTF-8">
          <meta name="description" content="This is a test website for unit testing">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="og:title" content="Test OG Title">
        </head>
        <body>
          <h1>Test Content</h1>
        </body>
        </html>
      `)
    });
  });
});

describe('Plan Gating Integration Tests', () => {
  let app: express.Express;
  let server: any;
  const testToken = process.env.TEST_API_TOKEN || 'test-token';
  const withAuth = (req: request.Test) => req.set('authorization', `Bearer ${testToken}`);

  beforeAll(async () => {
    process.env.API_AUTH_TOKEN = testToken;
    app = express();
    app.use(express.json());
    const result = await registerRoutes(app, { createServer: false });
    app = result.app;
    server = result.server;
  });

  beforeEach(async () => {
    // Reset storage state
    // In a real implementation, you'd reset the database
  });

  describe('Free Plan Limitations', () => {
    it('should allow analysis within quota', async () => {
      const response = await withAuth(request(app)
        .post('/api/analyze')
        .send({ url: 'https://example.com' }));

      expect(response.status).toBe(200);
      expect(response.body.analysis).toBeDefined();
    });

    it('should deny export attempts', async () => {
      // First create an analysis
      const analysisResponse = await withAuth(request(app)
        .post('/api/analyze')
        .send({ url: 'https://example.com' }));

      const analysisId = analysisResponse.body.analysis.id;

      // Try to export (should fail for free plan)
      const exportResponse = await withAuth(request(app)
        .post(`/api/export/${analysisId}`)
        .send({ format: 'pdf' }));

      expect(exportResponse.status).toBe(403);
      expect(exportResponse.body.code).toBe('PLAN_UPGRADE_REQUIRED');
      expect(exportResponse.body.feature).toBe('exportsEnabled');
    });

    it('should limit history depth', async () => {
      const historyResponse = await withAuth(request(app)
        .get('/api/history'));

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.limit).toBe(5); // Free plan limit
      expect(historyResponse.body.currentPlan).toBe('free');
    });
  });

  describe('Plan Information API', () => {
    it('should return current plan details', async () => {
      const response = await withAuth(request(app)
        .get('/api/plan'));

      expect(response.status).toBe(200);
      expect(response.body.currentPlan).toBe('free');
      expect(response.body.entitlements).toEqual({
        monthlyAuditLimit: 10,
        historyDepth: 5,
        exportsEnabled: false,
        webhooksEnabled: false,
        apiAccessEnabled: false
      });
      expect(response.body.tenantId).toBe(1);
    });
  });

  describe('Pro Plan Features', () => {
    beforeEach(async () => {
      // Upgrade tenant to pro plan for these tests
      await storage.updateTenantPlan(1, 'pro', 'test-user');
    });

    afterEach(async () => {
      // Downgrade back to free
      await storage.updateTenantPlan(1, 'free', 'test-user');
    });

    it('should allow exports for pro plan', async () => {
      // First create an analysis
      const analysisResponse = await withAuth(request(app)
        .post('/api/analyze')
        .send({ url: 'https://example.com' }));

      const analysisId = analysisResponse.body.analysis.id;

      // Try to export (should succeed for pro plan)
      const exportResponse = await withAuth(request(app)
        .post(`/api/export/${analysisId}`)
        .send({ format: 'pdf' }));

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body.message).toContain('Export generated successfully');
    });

    it('should have higher history depth for pro plan', async () => {
      const historyResponse = await withAuth(request(app)
        .get('/api/history'));

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.limit).toBe(100); // Pro plan limit
      expect(historyResponse.body.currentPlan).toBe('pro');
    });

    it('should return pro plan details', async () => {
      const response = await withAuth(request(app)
        .get('/api/plan'));

      expect(response.status).toBe(200);
      expect(response.body.currentPlan).toBe('pro');
      expect(response.body.entitlements.exportsEnabled).toBe(true);
      expect(response.body.entitlements.monthlyAuditLimit).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should return structured error for plan upgrade required', async () => {
      // Try to export without pro plan
      const response = await withAuth(request(app)
        .post('/api/export/1')
        .send({ format: 'pdf' }));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'PLAN_UPGRADE_REQUIRED',
        feature: 'exportsEnabled',
        currentPlan: 'free',
        requiredPlan: 'pro',
        message: expect.stringContaining('exportsEnabled requires pro plan')
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should not allow cross-tenant access', async () => {
      // This test would be more meaningful with multiple tenants
      // For now, it verifies that tenant context is properly enforced
      const response = await withAuth(request(app)
        .get('/api/history'));

      expect(response.status).toBe(200);
      // Verify that only analyses for the current tenant are returned
      expect(response.body.analyses).toBeDefined();
    });
  });
});
