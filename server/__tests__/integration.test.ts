import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

/**
 * Integration Tests - TDD Implementation
 * Tests the complete request/response cycle with real test URL
 */

describe('Meta Tag Analyzer - Integration Tests', () => {
  let app: express.Application;
  const TEST_URL = 'https://metabol-balance-app.vercel.app/';
  const TEST_TENANT = 'test-tenant-123';
  const TEST_USER = 'test-user-456';

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Mock tenant middleware for testing
    app.use('/api', (req: any, res, next) => {
      req.tenant = {
        tenantId: TEST_TENANT,
        userId: TEST_USER
      };
      next();
    });
    
    await registerRoutes(app);
    
    // Set up test tenant with Pro plan
    storage.setTenantPlan(TEST_TENANT, 'pro');
  });

  beforeEach(() => {
    // Reset storage state between tests
    (storage as any).auditRuns.clear();
    (storage as any).analyses.clear();
    (storage as any).metaTags.clear();
    (storage as any).recommendations.clear();
    (storage as any).usage.clear();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        message: 'Meta Tag Analyzer API is healthy',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Immediate Audit Flow', () => {
    it('should complete full audit for test website', async () => {
      const response = await request(app)
        .get('/api/audit')
        .query({ url: TEST_URL })
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('url', TEST_URL);
      expect(response.body).toHaveProperty('scores');
      expect(response.body).toHaveProperty('issues');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('summary');

      // Verify scores structure
      expect(response.body.scores).toHaveProperty('overall');
      expect(response.body.scores).toHaveProperty('seo');
      expect(response.body.scores).toHaveProperty('social');
      expect(response.body.scores).toHaveProperty('technical');

      // Verify scores are numbers between 0-100
      Object.values(response.body.scores).forEach((score: any) => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      // Verify issues array
      expect(Array.isArray(response.body.issues)).toBe(true);
      
      // Verify recommendations array
      expect(Array.isArray(response.body.recommendations)).toBe(true);
      if (response.body.recommendations.length > 0) {
        expect(response.body.recommendations[0]).toHaveProperty('title');
        expect(response.body.recommendations[0]).toHaveProperty('description');
        expect(response.body.recommendations[0]).toHaveProperty('impact');
      }
    }, 30000); // 30 second timeout for network request

    it('should handle invalid URLs gracefully', async () => {
      const invalidUrls = [
        'not-a-url',
        'localhost:3000',
        '192.168.1.1',
        'ftp://example.com',
        ''
      ];

      for (const url of invalidUrls) {
        const response = await request(app)
          .get('/api/audit')
          .query({ url })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid');
      }
    });
  });

  describe('Queued Audit Flow', () => {
    it('should queue audit and return job details', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('status', 'QUEUED');
      expect(response.body).toHaveProperty('target', TEST_URL);
    });

    it('should prevent duplicate submissions with idempotency', async () => {
      // First request
      const response1 = await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL })
        .expect(200);

      // Second identical request should return same job
      const response2 = await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL })
        .expect(200);

      expect(response1.body.runId).toBe(response2.body.runId);
    });
  });

  describe('Audit History & Management', () => {
    it('should retrieve recent runs for tenant', async () => {
      // Create a test audit run
      await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL });

      const response = await request(app)
        .get('/api/recent-runs')
        .expect(200);

      expect(response.body).toHaveProperty('runs');
      expect(Array.isArray(response.body.runs)).toBe(true);
      
      if (response.body.runs.length > 0) {
        const run = response.body.runs[0];
        expect(run).toHaveProperty('id');
        expect(run).toHaveProperty('target');
        expect(run).toHaveProperty('status');
        expect(run).toHaveProperty('createdAt');
      }
    });

    it('should retrieve specific audit run', async () => {
      // Create audit run
      const createResponse = await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL });

      const runId = createResponse.body.runId;

      // Retrieve specific run
      const response = await request(app)
        .get(`/api/audits/${runId}`)
        .expect(200);

      expect(response.body).toHaveProperty('run');
      expect(response.body.run.id).toBe(runId);
    });

    it('should delete audit run', async () => {
      // Create audit run
      const createResponse = await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL });

      const runId = createResponse.body.runId;

      // Delete run
      await request(app)
        .delete(`/api/audits/${runId}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/audits/${runId}`)
        .expect(404);
    });
  });

  describe('Plan & Usage Management', () => {
    it('should return plan information', async () => {
      const response = await request(app)
        .get('/api/plan')
        .expect(200);

      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('remainingRuns');
      expect(response.body).toHaveProperty('maxMonthlyRuns');
      expect(response.body).toHaveProperty('maxHistoryLength');
      expect(response.body).toHaveProperty('canExportReports');
    });

    it('should enforce usage limits for free plan', async () => {
      // Set tenant to free plan
      storage.setTenantPlan(TEST_TENANT, 'free');
      
      // Simulate usage at limit
      const usage = await storage.getUsage(TEST_TENANT);
      const freePlanFlags = storage.getPlanFlags('free');
      
      // Set usage to limit
      for (let i = 0; i < freePlanFlags.maxMonthlyRuns; i++) {
        await storage.incrementUsage(TEST_TENANT, 'free');
      }

      // Next request should be rejected
      const response = await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL })
        .expect(429);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('quota');
    });
  });

  describe('Dashboard Statistics', () => {
    it('should return dashboard stats', async () => {
      // Create some test data
      await request(app)
        .post('/api/analyze')
        .send({ url: TEST_URL });

      const response = await request(app)
        .get('/api/dashboard/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalRuns');
      expect(response.body).toHaveProperty('successfulRuns');
      expect(response.body).toHaveProperty('failedRuns');
      expect(response.body).toHaveProperty('averageScore');
      expect(response.body).toHaveProperty('trendsData');
      expect(response.body).toHaveProperty('recentRuns');

      expect(Array.isArray(response.body.trendsData)).toBe(true);
      expect(Array.isArray(response.body.recentRuns)).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('should handle export requests for Pro plan', async () => {
      // Ensure Pro plan
      storage.setTenantPlan(TEST_TENANT, 'pro');
      
      // Create completed audit
      const auditResponse = await request(app)
        .get('/api/audit')
        .query({ url: TEST_URL });

      const runId = auditResponse.body.runId;

      // Request export
      const response = await request(app)
        .post(`/api/audits/${runId}/export`)
        .send({
          format: 'pdf',
          includeRecommendations: true,
          includeRawData: false,
          customTitle: 'Test Export'
        })
        .expect(200);

      expect(response.body).toHaveProperty('downloadUrl');
    });

    it('should reject export for free plan', async () => {
      // Set to free plan
      storage.setTenantPlan(TEST_TENANT, 'free');
      
      // Create audit
      const auditResponse = await request(app)
        .get('/api/audit')
        .query({ url: TEST_URL });

      const runId = auditResponse.body.runId;

      // Request export should fail
      await request(app)
        .post(`/api/audits/${runId}/export`)
        .send({ format: 'pdf' })
        .expect(403);
    });
  });

  describe('Security & Tenant Isolation', () => {
    it('should prevent cross-tenant access', async () => {
      const TENANT_A = 'tenant-a';
      const TENANT_B = 'tenant-b';

      // Create audit for tenant A
      const appA = express();
      appA.use(express.json());
      appA.use('/api', (req: any, res, next) => {
        req.tenant = { tenantId: TENANT_A, userId: 'user-a' };
        next();
      });
      await registerRoutes(appA);

      const auditResponse = await request(appA)
        .post('/api/analyze')
        .send({ url: TEST_URL });

      const runId = auditResponse.body.runId;

      // Try to access from tenant B
      const appB = express();
      appB.use(express.json());
      appB.use('/api', (req: any, res, next) => {
        req.tenant = { tenantId: TENANT_B, userId: 'user-b' };
        next();
      });
      await registerRoutes(appB);

      await request(appB)
        .get(`/api/audits/${runId}`)
        .expect(404); // Should not find audit from different tenant
    });

    it('should block malicious URLs', async () => {
      const maliciousUrls = [
        'http://localhost:3000',
        'https://127.0.0.1',
        'http://192.168.1.1',
        'https://10.0.0.1',
        'http://172.16.0.1'
      ];

      for (const url of maliciousUrls) {
        await request(app)
          .get('/api/audit')
          .query({ url })
          .expect(400);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tenant context', async () => {
      const appNoTenant = express();
      appNoTenant.use(express.json());
      await registerRoutes(appNoTenant);

      await request(appNoTenant)
        .get('/api/audit')
        .query({ url: TEST_URL })
        .expect(401);
    });

    it('should handle network errors gracefully', async () => {
      const response = await request(app)
        .get('/api/audit')
        .query({ url: 'https://nonexistent-domain-12345.com' })
        .expect(502);

      expect(response.body).toHaveProperty('message');
    });
  });
});