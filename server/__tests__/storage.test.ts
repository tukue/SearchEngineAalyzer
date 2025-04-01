import { MemStorage } from '../storage';
import { AnalysisResult, Analysis, MetaTag, Recommendation } from '../../shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;
  
  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('createAnalysis', () => {
    it('should create and store an analysis with its associated data', async () => {
      // Mock analysis data
      const analysisData: AnalysisResult = {
        analysis: {
          id: 0, // Will be assigned by storage
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
            analysisId: 0,
            tagName: 'keywords',
            description: 'Add keywords meta tag',
            example: '<meta name="keywords" content="example, domain">'
          }
        ]
      };

      // Create the analysis
      const result = await storage.createAnalysis(analysisData);

      // Expectations
      expect(result).toBeDefined();
      expect(result.analysis.id).toBe(1); // First ID should be 1
      expect(result.analysis.url).toBe('https://example.com');
      expect(result.tags.length).toBe(2);
      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].analysisId).toBe(1);
    });
  });

  describe('getAnalysis', () => {
    it('should retrieve an analysis by ID', async () => {
      // Create an analysis first
      const analysisData: AnalysisResult = {
        analysis: {
          id: 0,
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

      // Retrieve the analysis
      const retrieved = await storage.getAnalysis(id);

      // Expectations
      expect(retrieved).toBeDefined();
      expect(retrieved?.analysis.url).toBe('https://example.com');
      expect(retrieved?.tags.length).toBe(1);
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await storage.getAnalysis(999);
      expect(result).toBeUndefined();
    });
  });

  describe('getAnalysisByUrl', () => {
    it('should retrieve an analysis by URL', async () => {
      // Create an analysis first
      const analysisData: AnalysisResult = {
        analysis: {
          id: 0,
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

      // Retrieve the analysis by URL
      const retrieved = await storage.getAnalysisByUrl('https://example.com');

      // Expectations
      expect(retrieved).toBeDefined();
      expect(retrieved?.analysis.totalCount).toBe(3);
      expect(retrieved?.tags.length).toBe(1);
    });

    it('should return undefined for non-existent URL', async () => {
      const result = await storage.getAnalysisByUrl('https://nonexistent.com');
      expect(result).toBeUndefined();
    });
  });
});