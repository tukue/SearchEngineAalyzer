import { ReportService } from '../report-service';
import { persistenceService } from '../persistence-service';
import type { RunDetails } from '@shared/persistence-schema';

// Mock persistence service
jest.mock('../persistence-service');
const mockPersistenceService = persistenceService as jest.Mocked<typeof persistenceService>;

describe('ReportService', () => {
  const mockRunDetails: RunDetails = {
    runId: '123e4567-e89b-12d3-a456-426614174000',
    projectName: 'Test Project',
    auditName: 'SEO Audit',
    status: 'completed',
    summary: {
      scores: {
        overall: 75,
        seo: 80,
        performance: 70,
        accessibility: 75,
      },
      counts: {
        total: 10,
        critical: 2,
        high: 3,
        medium: 3,
        low: 2,
        info: 0,
      },
      metadata: {
        url: 'https://example.com',
        userAgent: 'Test Agent',
        viewport: '1920x1080',
        loadTime: 1500,
        pageSize: 2048,
      },
    },
    startedAt: '2024-01-01T10:00:00Z',
    completedAt: '2024-01-01T10:01:00Z',
    duration: 60000,
    findings: [
      {
        id: 1,
        category: 'seo',
        severity: 'critical',
        ruleId: 'missing-title',
        title: 'Missing Title Tag',
        message: 'The page is missing a title tag',
        guidance: 'Add a descriptive title tag to the head section',
        impact: 'Title tags are crucial for SEO and user experience',
        element: null,
        metadata: {},
      },
      {
        id: 2,
        category: 'social',
        severity: 'high',
        ruleId: 'missing-og-image',
        title: 'Missing Open Graph Image',
        message: 'No og:image meta tag found',
        guidance: 'Add an og:image meta tag with a high-quality image',
        impact: 'Images improve social media sharing engagement',
        element: null,
        metadata: {},
      },
      {
        id: 3,
        category: 'technical',
        severity: 'medium',
        ruleId: 'missing-charset',
        title: 'Missing Charset Declaration',
        message: 'No charset meta tag found',
        guidance: 'Add <meta charset="UTF-8"> to the head section',
        impact: 'Ensures proper text encoding and display',
        element: null,
        metadata: {},
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should generate a complete report for valid run', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(mockRunDetails);

      const report = await ReportService.generateReport(1, mockRunDetails.runId);

      expect(report).toBeDefined();
      expect(report?.metadata.runId).toBe(mockRunDetails.runId);
      expect(report?.metadata.url).toBe('https://example.com');
      expect(report?.findings).toHaveLength(3);
      expect(report?.topFixes).toHaveLength(3); // All findings are failures
      expect(report?.healthScore.overall).toBeGreaterThan(0);
      expect(report?.healthScore.grade).toBeDefined();
    });

    it('should return null for non-existent run', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(null);

      const report = await ReportService.generateReport(1, 'non-existent-id');

      expect(report).toBeNull();
    });

    it('should calculate health scores correctly', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(mockRunDetails);

      const report = await ReportService.generateReport(1, mockRunDetails.runId);

      expect(report?.healthScore.overall).toBeGreaterThan(0);
      expect(report?.healthScore.overall).toBeLessThanOrEqual(100);
      expect(report?.healthScore.categoryScores.seo).toBeGreaterThan(0);
      expect(report?.healthScore.categoryScores.social).toBeGreaterThan(0);
      expect(report?.healthScore.categoryScores.technical).toBeGreaterThan(0);
    });

    it('should prioritize critical findings first', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(mockRunDetails);

      const report = await ReportService.generateReport(1, mockRunDetails.runId);

      expect(report?.topFixes[0].finding.severity).toBe('critical');
      expect(report?.topFixes[0].rank).toBe(1);
      expect(report?.topFixes[1].finding.severity).toBe('high');
      expect(report?.topFixes[1].rank).toBe(2);
    });

    it('should calculate category counts correctly', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(mockRunDetails);

      const report = await ReportService.generateReport(1, mockRunDetails.runId);

      expect(report?.categoryCounts.seo.total).toBe(1);
      expect(report?.categoryCounts.social.total).toBe(1);
      expect(report?.categoryCounts.technical.total).toBe(1);
      expect(report?.categoryCounts.seo.fail).toBe(1); // All findings are failures by default
    });

    it('should calculate severity counts correctly', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(mockRunDetails);

      const report = await ReportService.generateReport(1, mockRunDetails.runId);

      expect(report?.severityCounts.critical).toBe(1);
      expect(report?.severityCounts.high).toBe(1);
      expect(report?.severityCounts.medium).toBe(1);
      expect(report?.severityCounts.low).toBe(0);
      expect(report?.severityCounts.info).toBe(0);
      expect(report?.severityCounts.total).toBe(3);
    });
  });

  describe('applyFilters', () => {
    const mockFindings = [
      {
        id: 1,
        category: 'seo' as const,
        severity: 'critical' as const,
        status: 'fail' as const,
        ruleId: 'test-1',
        title: 'Test Finding 1',
        message: 'Test message',
        guidance: 'Test guidance',
        impact: 'Test impact',
        element: null,
        line: null,
        column: null,
        effortLevel: 'medium' as const,
        priorityScore: 90,
        guidanceUrl: '/docs/rules/test-1',
      },
      {
        id: 2,
        category: 'social' as const,
        severity: 'high' as const,
        status: 'warn' as const,
        ruleId: 'test-2',
        title: 'Test Finding 2',
        message: 'Test message',
        guidance: 'Test guidance',
        impact: 'Test impact',
        element: null,
        line: null,
        column: null,
        effortLevel: 'low' as const,
        priorityScore: 80,
        guidanceUrl: '/docs/rules/test-2',
      },
    ];

    it('should filter by category', () => {
      const filtered = ReportService.applyFilters(mockFindings, {
        categories: ['seo'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe('seo');
    });

    it('should filter by severity', () => {
      const filtered = ReportService.applyFilters(mockFindings, {
        severities: ['critical'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
    });

    it('should filter by status', () => {
      const filtered = ReportService.applyFilters(mockFindings, {
        statuses: ['fail'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe('fail');
    });

    it('should apply multiple filters', () => {
      const filtered = ReportService.applyFilters(mockFindings, {
        categories: ['seo'],
        severities: ['critical'],
        statuses: ['fail'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it('should return all findings when no filters applied', () => {
      const filtered = ReportService.applyFilters(mockFindings);

      expect(filtered).toHaveLength(2);
    });
  });

  describe('deterministic scoring', () => {
    it('should produce consistent scores for same input', async () => {
      mockPersistenceService.getRunDetails.mockResolvedValue(mockRunDetails);

      const report1 = await ReportService.generateReport(1, mockRunDetails.runId);
      const report2 = await ReportService.generateReport(1, mockRunDetails.runId);

      expect(report1?.healthScore.overall).toBe(report2?.healthScore.overall);
      expect(report1?.topFixes[0].priorityScore).toBe(report2?.topFixes[0].priorityScore);
    });
  });
});