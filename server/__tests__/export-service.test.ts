import { ExportService } from '../export-service';
import { ReportService } from '../report-service';
import type { TenantContext } from '@shared/schema';
import type { ReportViewModel } from '@shared/report-schema';

// Mock dependencies
jest.mock('../report-service');
const mockReportService = ReportService as jest.Mocked<typeof ReportService>;

// Mock environment variables
const originalEnv = process.env;

describe('ExportService', () => {
  const mockTenantContext: TenantContext = {
    tenantId: 1,
    plan: 'pro',
  };

  const mockFreeTenantContext: TenantContext = {
    tenantId: 2,
    plan: 'free',
  };

  const mockReport: ReportViewModel = {
    healthScore: {
      overall: 75,
      grade: 'good',
      categoryScores: {
        seo: 80,
        social: 70,
        technical: 75,
      },
    },
    categoryCounts: {
      seo: { total: 5, pass: 3, fail: 2, warn: 0 },
      social: { total: 3, pass: 1, fail: 2, warn: 0 },
      technical: { total: 2, pass: 1, fail: 1, warn: 0 },
    },
    severityCounts: {
      critical: 1,
      high: 2,
      medium: 3,
      low: 2,
      info: 2,
      total: 10,
    },
    topFixes: [],
    findings: [],
    metadata: {
      runId: '123e4567-e89b-12d3-a456-426614174000',
      url: 'https://example.com',
      auditType: 'SEO Audit',
      startedAt: '2024-01-01T10:00:00Z',
      completedAt: '2024-01-01T10:01:00Z',
      duration: 60000,
    },
    generatedAt: '2024-01-01T10:01:30Z',
    version: '1.0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('canExport', () => {
    it('should allow export for pro plan when feature enabled', () => {
      process.env.EXPORTS_ENABLED = 'true';

      const result = ExportService.canExport(mockTenantContext);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny export for free plan', () => {
      process.env.EXPORTS_ENABLED = 'true';

      const result = ExportService.canExport(mockFreeTenantContext);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Pro plan');
    });

    it('should deny export when feature disabled', () => {
      process.env.EXPORTS_ENABLED = 'false';

      const result = ExportService.canExport(mockTenantContext);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('currently disabled');
    });
  });

  describe('exportReport', () => {
    beforeEach(() => {
      process.env.EXPORTS_ENABLED = 'true';
      process.env.HTML_EXPORTS = 'true';
      process.env.PDF_EXPORTS = 'true';
      mockReportService.generateReport.mockResolvedValue(mockReport);
    });

    it('should export HTML report successfully', async () => {
      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'html' as const,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('.html');
      expect(result.filename).toContain('.html');
      expect(result.expiresAt).toBeDefined();
    });

    it('should fail export for non-existent report', async () => {
      mockReportService.generateReport.mockResolvedValue(null);

      const request = {
        runId: 'non-existent-id',
        format: 'html' as const,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Report not found');
    });

    it('should fail export for free plan', async () => {
      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'html' as const,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockFreeTenantContext, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pro plan');
    });

    it('should fail when HTML exports disabled', async () => {
      process.env.HTML_EXPORTS = 'false';

      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'html' as const,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTML export is currently disabled');
    });

    it('should fail when PDF exports disabled', async () => {
      process.env.PDF_EXPORTS = 'false';

      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'pdf' as const,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF export is currently disabled');
    });

    it('should apply filters when provided', async () => {
      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'html' as const,
        includeGuidance: true,
        filters: {
          categories: ['seo'],
          severities: ['critical'],
        },
      };

      mockReportService.applyFilters.mockReturnValue([]);

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(mockReportService.applyFilters).toHaveBeenCalledWith(
        mockReport.findings,
        request.filters
      );
      expect(result.success).toBe(true);
    });
  });

  describe('feature flag enforcement', () => {
    it('should respect EXPORTS_ENABLED flag', () => {
      process.env.EXPORTS_ENABLED = 'false';

      const result = ExportService.canExport(mockTenantContext);

      expect(result.allowed).toBe(false);
    });

    it('should default to disabled when flag not set', () => {
      delete process.env.EXPORTS_ENABLED;

      const result = ExportService.canExport(mockTenantContext);

      expect(result.allowed).toBe(false);
    });
  });

  describe('plan gating enforcement', () => {
    it('should enforce plan requirements even with feature enabled', () => {
      process.env.EXPORTS_ENABLED = 'true';

      const result = ExportService.canExport(mockFreeTenantContext);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Pro plan');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.EXPORTS_ENABLED = 'true';
      process.env.HTML_EXPORTS = 'true';
    });

    it('should handle report generation errors', async () => {
      mockReportService.generateReport.mockRejectedValue(new Error('Database error'));

      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'html' as const,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle unsupported format', async () => {
      mockReportService.generateReport.mockResolvedValue(mockReport);

      const request = {
        runId: '123e4567-e89b-12d3-a456-426614174000',
        format: 'xml' as any,
        includeGuidance: true,
      };

      const result = await ExportService.exportReport(mockTenantContext, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported export format');
    });
  });
});