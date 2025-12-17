import { MemStorage } from '../storage';

describe('MemStorage', () => {
  let storage: MemStorage;
  
  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('createAnalysis', () => {
    it('should create and store an analysis with its associated data', async () => {
      const tenantId = 1;
      const analysisData = {
        analysis: {
          url: 'https://example.com',
          totalCount: 5,
          seoCount: 2,
          socialCount: 1,
          technicalCount: 2,
          missingCount: 1,
          healthScore: 80,
          timestamp: new Date().toISOString()
        },
        tags: [],
        recommendations: []
      };

      const result = await storage.createAnalysis(tenantId, analysisData);

      expect(result).toBeDefined();
      expect(result.analysis.id).toBe(1);
      expect(result.analysis.url).toBe('https://example.com');
      expect(result.tags.length).toBe(0);
      expect(result.recommendations.length).toBe(0);
    });
  });

  describe('getAnalysis', () => {
    it('should retrieve an analysis by ID', async () => {
      const tenantId = 1;
      const analysisData = {
        analysis: {
          url: 'https://example.com',
          totalCount: 5,
          seoCount: 2,
          socialCount: 1,
          technicalCount: 2,
          missingCount: 1,
          healthScore: 80,
          timestamp: new Date().toISOString()
        },
        tags: [],
        recommendations: []
      };

      const created = await storage.createAnalysis(tenantId, analysisData);
      const id = created.analysis.id;

      const retrieved = await storage.getAnalysis(tenantId, id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.analysis.url).toBe('https://example.com');
      expect(retrieved?.tags.length).toBe(0);
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await storage.getAnalysis(1, 999);
      expect(result).toBeUndefined();
    });
  });

  describe('getAnalysisByUrl', () => {
    it('should retrieve an analysis by URL', async () => {
      const tenantId = 1;
      const analysisData = {
        analysis: {
          url: 'https://example.com',
          totalCount: 3,
          seoCount: 1,
          socialCount: 1,
          technicalCount: 1,
          missingCount: 0,
          healthScore: 100,
          timestamp: new Date().toISOString()
        },
        tags: [],
        recommendations: []
      };

      await storage.createAnalysis(tenantId, analysisData);

      const retrieved = await storage.getAnalysisByUrl(tenantId, 'https://example.com');

      expect(retrieved).toBeDefined();
      expect(retrieved?.analysis.totalCount).toBe(3);
      expect(retrieved?.tags.length).toBe(0);
    });

    it('should return undefined for non-existent URL', async () => {
      const result = await storage.getAnalysisByUrl(1, 'https://nonexistent.com');
      expect(result).toBeUndefined();
    });
  });
});