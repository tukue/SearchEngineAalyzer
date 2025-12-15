import { MemStorage } from '../storage';
import { AnalysisResult } from '../../shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;
  const tenantId = 'test-tenant';
  const userId = 'user-1';

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('createAnalysis', () => {
    it('should create and store an analysis with its associated data', async () => {
      const analysisData: AnalysisResult = {
        analysis: {
          id: 0,
          tenantId,
          userId,
          auditType: 'meta',
          url: 'https://example.com',
          totalCount: 5,
          seoCount: 2,
          socialCount: 1,
          technicalCount: 2,
          missingCount: 1,
          healthScore: 80,
          timestamp: new Date().toISOString()
        },
        tags: [
          {
            id: 0,
            tenantId,
            url: 'https://example.com',
            name: 'title',
            property: null,
            content: 'Example Domain',
            httpEquiv: null,
            charset: null,
            rel: null,
            tagType: 'SEO',
            isPresent: true
          },
          {
            id: 0,
            tenantId,
            url: 'https://example.com',
            name: 'description',
            property: null,
            content: 'An example website',
            httpEquiv: null,
            charset: null,
            rel: null,
            tagType: 'SEO',
            isPresent: true
          }
        ],
        recommendations: [
          {
            id: 0,
            tenantId,
            analysisId: 0,
            tagName: 'keywords',
            description: 'Add keywords meta tag',
            example: '<meta name="keywords" content="example, domain">'
          }
        ]
      };

      const result = await storage.createAnalysis(analysisData);

      expect(result).toBeDefined();
      expect(result.analysis.id).toBe(1);
      expect(result.analysis.url).toBe('https://example.com');
      expect(result.tags.length).toBe(2);
      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].analysisId).toBe(1);
    });
  });

  describe('getAnalysis', () => {
    it('should retrieve an analysis by ID', async () => {
      const analysisData: AnalysisResult = {
        analysis: {
          id: 0,
          tenantId,
          userId,
          auditType: 'meta',
          url: 'https://example.com',
          totalCount: 5,
          seoCount: 2,
          socialCount: 1,
          technicalCount: 2,
          missingCount: 1,
          healthScore: 80,
          timestamp: new Date().toISOString()
        },
        tags: [
          {
            id: 0,
            tenantId,
            url: 'https://example.com',
            name: 'title',
            property: null,
            content: 'Example Domain',
            httpEquiv: null,
            charset: null,
            rel: null,
            tagType: 'SEO',
            isPresent: true
          }
        ],
        recommendations: []
      };

      const created = await storage.createAnalysis(analysisData);
      const id = created.analysis.id;

      const retrieved = await storage.getAnalysis(id, tenantId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.analysis.url).toBe('https://example.com');
      expect(retrieved?.tags.length).toBe(1);
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await storage.getAnalysis(999, tenantId);
      expect(result).toBeUndefined();
    });

    it('should enforce tenant isolation when retrieving by ID', async () => {
      const created = await storage.createAnalysis({
        analysis: {
          id: 0,
          tenantId,
          userId,
          auditType: 'meta',
          url: 'https://isolated.com',
          totalCount: 1,
          seoCount: 1,
          socialCount: 0,
          technicalCount: 0,
          missingCount: 0,
          healthScore: 90,
          timestamp: new Date().toISOString(),
        },
        tags: [],
        recommendations: [],
      });

      const result = await storage.getAnalysis(created.analysis.id, 'other-tenant');
      expect(result).toBeUndefined();
    });
  });

  describe('getAnalysisByUrl', () => {
    it('should retrieve an analysis by URL', async () => {
      const analysisData: AnalysisResult = {
        analysis: {
          id: 0,
          tenantId,
          userId,
          auditType: 'meta',
          url: 'https://example.com',
          totalCount: 3,
          seoCount: 1,
          socialCount: 1,
          technicalCount: 1,
          missingCount: 0,
          healthScore: 100,
          timestamp: new Date().toISOString()
        },
        tags: [
          {
            id: 0,
            tenantId,
            url: 'https://example.com',
            name: 'title',
            property: null,
            content: 'Example Domain',
            httpEquiv: null,
            charset: null,
            rel: null,
            tagType: 'SEO',
            isPresent: true
          }
        ],
        recommendations: []
      };

      await storage.createAnalysis(analysisData);

      const retrieved = await storage.getAnalysisByUrl('https://example.com', tenantId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.analysis.totalCount).toBe(3);
      expect(retrieved?.tags.length).toBe(1);
    });

    it('should return undefined for non-existent URL', async () => {
      const result = await storage.getAnalysisByUrl('https://nonexistent.com', tenantId);
      expect(result).toBeUndefined();
    });
  });
});
