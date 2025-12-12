import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AuditService } from '../auditService';
import { MemStorage } from '../storage';
import { type AnalysisResult } from '@shared/schema';

// Mock the audit engine to avoid external HTTP calls
jest.mock('../auditEngine', () => ({
  runMetaAudit: jest.fn(),
  normalizeUrl: (url: string) => url.startsWith('http') ? url : `https://${url}`
}));

import { runMetaAudit } from '../auditEngine';
const mockRunMetaAudit = runMetaAudit as jest.MockedFunction<typeof runMetaAudit>;

describe('MVP Measurements E2E Integration Tests', () => {
  let auditService: AuditService;
  let storage: MemStorage;
  let mockAnalysisResult: AnalysisResult & { mvpMeasurements: any };

  beforeEach(() => {
    storage = new MemStorage();
    auditService = new AuditService(storage);
    
    // Mock analysis result with MVP measurements
    mockAnalysisResult = {
      analysis: {
        id: 0,
        url: 'https://example.com',
        totalCount: 8,
        seoCount: 4,
        socialCount: 3,
        technicalCount: 1,
        missingCount: 2,
        healthScore: 75,
        timestamp: new Date().toISOString(),
      },
      tags: [
        { id: 1, name: 'title', content: 'Example Title', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, name: 'description', content: 'This is a good meta description that is long enough', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 3, property: 'og:title', content: 'OG Title', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 4, property: 'og:description', content: 'OG Description for sharing', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 5, name: 'viewport', content: 'width=device-width', isPresent: true, tagType: 'Technical', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null }
      ],
      recommendations: [
        { id: 1, analysisId: 0, tagName: 'og:image', description: 'Add Open Graph image', example: '<meta property="og:image" content="...">' }
      ],
      mvpMeasurements: {
        seoVisibleAtFirstByte: 85,
        prioritizedHealthScore: 80,
        sharePreviewConfidence: 65
      }
    };

    mockRunMetaAudit.mockResolvedValue(mockAnalysisResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Queued Audit Flow', () => {
    it('should create and process audit with MVP measurements', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const userId = 'test-user';
      const target = 'https://example.com';

      // Act - Create queued run
      const { run, jobId } = await auditService.createQueuedRun({
        tenantId,
        userId,
        target
      });

      expect(run.status).toBe('QUEUED');
      expect(jobId).toBeDefined();

      // Act - Process the job
      await auditService.processJob({
        runId: run.id,
        tenantId,
        userId,
        target,
        idempotencyKey: run.idempotencyKey || 'test-key'
      });

      // Assert - Check run was completed
      const completedRun = await storage.findAuditRun(run.id, tenantId);
      expect(completedRun?.status).toBe('COMPLETED');
      expect(completedRun?.healthScore).toBe(75);

      // Assert - Check analysis was stored with MVP measurements
      const analysis = await storage.getAnalysis(run.id);
      expect(analysis).toBeDefined();
      expect(analysis?.analysis.seoVisibleAtFirstByte).toBe(85);
      expect(analysis?.analysis.prioritizedHealthScore).toBe(80);
      expect(analysis?.analysis.sharePreviewConfidence).toBe(65);
    });

    it('should handle audit failure gracefully', async () => {
      // Arrange
      mockRunMetaAudit.mockRejectedValue(new Error('Network error'));
      
      const tenantId = 'test-tenant';
      const userId = 'test-user';
      const target = 'https://failing-site.com';

      // Act
      const { run } = await auditService.createQueuedRun({
        tenantId,
        userId,
        target
      });

      await auditService.processJob({
        runId: run.id,
        tenantId,
        userId,
        target,
        idempotencyKey: 'test-key'
      });

      // Assert
      const failedRun = await storage.findAuditRun(run.id, tenantId);
      expect(failedRun?.status).toBe('FAILED');
      expect(failedRun?.summary).toBe('Audit failed');
    });
  });

  describe('Immediate Audit Flow', () => {
    it('should run immediate audit with MVP measurements', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const userId = 'test-user';
      const url = 'https://example.com';

      // Act
      const run = await auditService.createImmediateRun({
        tenantId,
        userId,
        url
      });

      const { audit } = await auditService.runFullAudit(run, url);

      // Assert
      expect(audit.meta.mvpMeasurements).toBeDefined();
      expect(audit.meta.mvpMeasurements.seoVisibleAtFirstByte).toBe(85);
      expect(audit.meta.mvpMeasurements.prioritizedHealthScore).toBe(80);
      expect(audit.meta.mvpMeasurements.sharePreviewConfidence).toBe(65);

      // Check storage
      const storedAnalysis = await storage.getAnalysis(run.id);
      expect(storedAnalysis?.analysis.seoVisibleAtFirstByte).toBe(85);
    });
  });

  describe('Quota Management', () => {
    it('should enforce quota limits', async () => {
      // Arrange - Set up tenant with limited quota
      const tenantId = 'limited-tenant';
      storage.setTenantPlan(tenantId, 'free'); // Free plan has 20 runs limit
      
      // Simulate usage near limit
      for (let i = 0; i < 20; i++) {
        await storage.incrementUsage(tenantId, 'free');
      }

      // Act & Assert
      await expect(auditService.createQueuedRun({
        tenantId,
        userId: 'test-user',
        target: 'https://example.com'
      })).rejects.toThrow('Monthly quota exceeded');
    });
  });

  describe('Idempotency', () => {
    it('should return existing run for duplicate requests', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const userId = 'test-user';
      const target = 'https://example.com';
      const idempotencyKey = 'unique-key-123';

      // Act - Create first run
      const { run: firstRun } = await auditService.createQueuedRun({
        tenantId,
        userId,
        target,
        idempotencyKey
      });

      // Act - Create duplicate run
      const { run: secondRun } = await auditService.createQueuedRun({
        tenantId,
        userId,
        target,
        idempotencyKey
      });

      // Assert
      expect(firstRun.id).toBe(secondRun.id);
      expect(firstRun.idempotencyKey).toBe(secondRun.idempotencyKey);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency across operations', async () => {
      // Arrange
      const tenantId = 'test-tenant';
      const userId = 'test-user';
      const target = 'https://example.com';

      // Act - Create and process audit
      const { run } = await auditService.createQueuedRun({
        tenantId,
        userId,
        target
      });

      await auditService.processJob({
        runId: run.id,
        tenantId,
        userId,
        target,
        idempotencyKey: 'test-key'
      });

      // Assert - Check all data is consistent
      const storedRun = await storage.findAuditRun(run.id, tenantId);
      const storedAnalysis = await storage.getAnalysis(run.id);
      const usage = await storage.getUsage(tenantId);

      expect(storedRun?.id).toBe(run.id);
      expect(storedAnalysis?.analysis.id).toBe(run.id);
      expect(storedAnalysis?.analysis.url).toBe(target);
      expect(usage.runsCount).toBeGreaterThan(0);

      // Check MVP measurements are properly stored
      expect(storedAnalysis?.analysis.seoVisibleAtFirstByte).toBeGreaterThanOrEqual(0);
      expect(storedAnalysis?.analysis.prioritizedHealthScore).toBeGreaterThanOrEqual(0);
      expect(storedAnalysis?.analysis.sharePreviewConfidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial failures gracefully', async () => {
      // Arrange - Mock partial failure scenario
      const originalCreateAnalysis = storage.createAnalysis;
      let callCount = 0;
      
      storage.createAnalysis = jest.fn().mockImplementation((data) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Storage temporarily unavailable');
        }
        return originalCreateAnalysis.call(storage, data);
      });

      const tenantId = 'test-tenant';
      const userId = 'test-user';
      const target = 'https://example.com';

      // Act - First attempt should fail
      const { run } = await auditService.createQueuedRun({
        tenantId,
        userId,
        target
      });

      await auditService.processJob({
        runId: run.id,
        tenantId,
        userId,
        target,
        idempotencyKey: 'test-key'
      });

      // Assert - Run should be marked as failed
      const failedRun = await storage.findAuditRun(run.id, tenantId);
      expect(failedRun?.status).toBe('FAILED');

      // Cleanup
      storage.createAnalysis = originalCreateAnalysis;
    });
  });
});