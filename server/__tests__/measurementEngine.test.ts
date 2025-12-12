import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  MetaTagFinder, 
  SeoVisibilityCalculator, 
  PrioritizedHealthCalculator,
  SharePreviewCalculator,
  CheerioHTMLParser,
  type TagCriteria,
  type HTMLParser,
  type TagFinder
} from '../measurementEngine';
import { type MetaTag, type AnalysisResult } from '@shared/schema';

describe('MeasurementEngine Unit Tests', () => {
  let tagFinder: TagFinder;
  let htmlParser: HTMLParser;
  let mockAnalysisResult: AnalysisResult;

  beforeEach(() => {
    tagFinder = new MetaTagFinder();
    htmlParser = new CheerioHTMLParser();
    mockAnalysisResult = {
      analysis: {
        id: 1,
        url: 'https://example.com',
        totalCount: 5,
        seoCount: 3,
        socialCount: 1,
        technicalCount: 1,
        missingCount: 0,
        healthScore: 100,
        timestamp: new Date().toISOString(),
      },
      tags: [],
      recommendations: []
    };
  });

  describe('MetaTagFinder', () => {
    it('should find tag by name', () => {
      const tags: MetaTag[] = [
        { id: 1, name: 'title', content: 'Test Title', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = tagFinder.findTag(tags, { name: 'title' });
      expect(result).toBeDefined();
      expect(result?.content).toBe('Test Title');
    });

    it('should find tag by property', () => {
      const tags: MetaTag[] = [
        { id: 1, property: 'og:title', content: 'OG Title', isPresent: true, tagType: 'Social', url: 'test.com', name: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = tagFinder.findTag(tags, { property: 'og:title' });
      expect(result).toBeDefined();
      expect(result?.content).toBe('OG Title');
    });

    it('should return undefined for non-existent tag', () => {
      const tags: MetaTag[] = [];
      const result = tagFinder.findTag(tags, { name: 'nonexistent' });
      expect(result).toBeUndefined();
    });

    it('should ignore tags that are not present', () => {
      const tags: MetaTag[] = [
        { id: 1, name: 'title', content: 'Test', isPresent: false, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = tagFinder.findTag(tags, { name: 'title' });
      expect(result).toBeUndefined();
    });
  });

  describe('CheerioHTMLParser', () => {
    it('should parse valid HTML', () => {
      const html = '<html><head><title>Test</title></head></html>';
      const $ = htmlParser.parse(html);
      
      expect($('title').text()).toBe('Test');
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<html><title>Test</title>';
      const $ = htmlParser.parse(html);
      
      expect($('title').text()).toBe('Test');
    });
  });

  describe('SeoVisibilityCalculator', () => {
    let calculator: SeoVisibilityCalculator;

    beforeEach(() => {
      calculator = new SeoVisibilityCalculator(htmlParser, tagFinder);
    });

    it('should calculate perfect score for complete SEO setup', () => {
      const html = `
        <html>
          <head>
            <title>Perfect Title</title>
            <script type="application/ld+json">{"@type": "WebPage"}</script>
          </head>
          <body><h1>Perfect Heading</h1></body>
        </html>
      `;

      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Perfect Title', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, name: 'description', content: 'This is a long enough description for SEO purposes', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 3, rel: 'canonical', content: 'https://test.com', isPresent: true, tagType: 'SEO', url: 'test.com', name: null, property: null, httpEquiv: null, charset: null }
      ];

      const score = calculator.calculate(html, mockAnalysisResult);
      expect(score).toBe(100);
    });

    it('should return 0 for empty content', () => {
      const score = calculator.calculate('', mockAnalysisResult);
      expect(score).toBe(0);
    });

    it('should not exceed 100', () => {
      // Test with excessive content that might push score over 100
      const html = '<html><head><title>Title</title></head><body><h1>Heading</h1></body></html>';
      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Long enough title', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const score = calculator.calculate(html, mockAnalysisResult);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('PrioritizedHealthCalculator', () => {
    let calculator: PrioritizedHealthCalculator;

    beforeEach(() => {
      calculator = new PrioritizedHealthCalculator(tagFinder);
    });

    it('should calculate score based on tag weights', () => {
      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Title', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null }, // 25 points
        { id: 2, name: 'description', content: 'Description', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null } // 20 points
      ];

      const score = calculator.calculate('', mockAnalysisResult);
      expect(score).toBe(45); // 25 + 20
    });

    it('should return 0 for no high-impact tags', () => {
      const score = calculator.calculate('', mockAnalysisResult);
      expect(score).toBe(0);
    });
  });

  describe('SharePreviewCalculator', () => {
    let calculator: SharePreviewCalculator;

    beforeEach(() => {
      calculator = new SharePreviewCalculator(tagFinder);
    });

    it('should score Open Graph tags highly', () => {
      mockAnalysisResult.tags = [
        { id: 1, property: 'og:title', content: 'OG Title', isPresent: true, tagType: 'Social', url: 'test.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, property: 'og:description', content: 'Long enough OG description', isPresent: true, tagType: 'Social', url: 'test.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 3, property: 'og:image', content: 'https://test.com/image.jpg', isPresent: true, tagType: 'Social', url: 'test.com', name: null, httpEquiv: null, charset: null, rel: null }
      ];

      const score = calculator.calculate('', mockAnalysisResult);
      expect(score).toBe(55); // 20 + 20 + 15
    });

    it('should use fallback tags when OG tags missing', () => {
      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Basic Title', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, name: 'description', content: 'Basic description', isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const score = calculator.calculate('', mockAnalysisResult);
      expect(score).toBe(10); // 5 + 5 fallback
    });
  });

  describe('Error Handling', () => {
    it('should handle null/undefined content gracefully', () => {
      const calculator = new SeoVisibilityCalculator(htmlParser, tagFinder);
      
      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: null, isPresent: true, tagType: 'SEO', url: 'test.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      expect(() => calculator.calculate('', mockAnalysisResult)).not.toThrow();
    });

    it('should handle empty tag arrays', () => {
      const calculator = new PrioritizedHealthCalculator(tagFinder);
      mockAnalysisResult.tags = [];

      const score = calculator.calculate('', mockAnalysisResult);
      expect(score).toBe(0);
    });
  });
});