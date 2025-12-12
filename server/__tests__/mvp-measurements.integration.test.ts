import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateMVPMeasurements } from '../measurementEngine';
import { type AnalysisResult } from '@shared/schema';

describe('MVP Measurements Integration Tests', () => {
  let mockAnalysisResult: AnalysisResult;

  beforeEach(() => {
    mockAnalysisResult = {
      analysis: {
        id: 1,
        url: 'https://example.com',
        totalCount: 10,
        seoCount: 5,
        socialCount: 3,
        technicalCount: 2,
        missingCount: 2,
        healthScore: 80,
        timestamp: new Date().toISOString(),
      },
      tags: [],
      recommendations: []
    };
  });

  describe('SEO-Visible at First Byte', () => {
    it('should return 100 for perfect SEO visibility', () => {
      const html = `
        <html>
          <head>
            <title>Perfect SEO Title</title>
            <meta name="description" content="This is a perfect meta description that is long enough to be meaningful">
            <script type="application/ld+json">{"@type": "WebPage"}</script>
          </head>
          <body>
            <h1>Perfect H1 Heading</h1>
          </body>
        </html>
      `;

      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Perfect SEO Title', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, name: 'description', content: 'This is a perfect meta description that is long enough to be meaningful', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 3, rel: 'canonical', content: 'https://example.com', isPresent: true, tagType: 'SEO', url: 'https://example.com', name: null, property: null, httpEquiv: null, charset: null }
      ];

      const result = calculateMVPMeasurements(html, mockAnalysisResult);
      expect(result.seoVisibleAtFirstByte).toBe(100);
    });

    it('should return 0 for missing critical SEO elements', () => {
      const html = '<html><body>No SEO elements</body></html>';
      
      const result = calculateMVPMeasurements(html, mockAnalysisResult);
      expect(result.seoVisibleAtFirstByte).toBe(0);
    });

    it('should return partial score for some SEO elements', () => {
      const html = `
        <html>
          <head><title>Good Title</title></head>
          <body><h1>Good Heading</h1></body>
        </html>
      `;

      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Good Title', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = calculateMVPMeasurements(html, mockAnalysisResult);
      expect(result.seoVisibleAtFirstByte).toBe(50); // 30 (title) + 20 (h1)
    });
  });

  describe('Prioritized Health Score', () => {
    it('should return 100 for all high-impact elements present', () => {
      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Title', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, name: 'description', content: 'Description', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null },
        { id: 3, property: 'og:title', content: 'OG Title', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 4, property: 'og:description', content: 'OG Description', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 5, property: 'og:image', content: 'https://example.com/image.jpg', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 6, rel: 'canonical', content: 'https://example.com', isPresent: true, tagType: 'SEO', url: 'https://example.com', name: null, property: null, httpEquiv: null, charset: null },
        { id: 7, name: 'viewport', content: 'width=device-width', isPresent: true, tagType: 'Technical', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = calculateMVPMeasurements('', mockAnalysisResult);
      expect(result.prioritizedHealthScore).toBe(100);
    });

    it('should return 0 for no high-impact elements', () => {
      const result = calculateMVPMeasurements('', mockAnalysisResult);
      expect(result.prioritizedHealthScore).toBe(0);
    });
  });

  describe('Share Preview Confidence', () => {
    it('should return high score for complete Open Graph setup', () => {
      mockAnalysisResult.tags = [
        { id: 1, property: 'og:title', content: 'Great Title', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 2, property: 'og:description', content: 'Great description for sharing', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 3, property: 'og:image', content: 'https://example.com/image.jpg', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 4, property: 'og:url', content: 'https://example.com', isPresent: true, tagType: 'Social', url: 'https://example.com', name: null, httpEquiv: null, charset: null, rel: null },
        { id: 5, name: 'twitter:card', content: 'summary_large_image', isPresent: true, tagType: 'Social', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = calculateMVPMeasurements('', mockAnalysisResult);
      expect(result.sharePreviewConfidence).toBeGreaterThan(70);
    });

    it('should return low score for missing social tags', () => {
      const result = calculateMVPMeasurements('', mockAnalysisResult);
      expect(result.sharePreviewConfidence).toBeLessThan(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty HTML gracefully', () => {
      const result = calculateMVPMeasurements('', mockAnalysisResult);
      
      expect(result.seoVisibleAtFirstByte).toBeGreaterThanOrEqual(0);
      expect(result.prioritizedHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.sharePreviewConfidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = '<html><head><title>Test</head><body><h1>Test</body>';
      
      mockAnalysisResult.tags = [
        { id: 1, name: 'title', content: 'Test', isPresent: true, tagType: 'SEO', url: 'https://example.com', property: null, httpEquiv: null, charset: null, rel: null }
      ];

      const result = calculateMVPMeasurements(malformedHtml, mockAnalysisResult);
      
      expect(result.seoVisibleAtFirstByte).toBeGreaterThan(0);
      expect(result.prioritizedHealthScore).toBeGreaterThan(0);
    });

    it('should cap scores at 100', () => {
      // Create excessive tags that might push scores over 100
      mockAnalysisResult.tags = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        name: 'title',
        content: 'Title',
        isPresent: true,
        tagType: 'SEO',
        url: 'https://example.com',
        property: null,
        httpEquiv: null,
        charset: null,
        rel: null
      }));

      const result = calculateMVPMeasurements('', mockAnalysisResult);
      
      expect(result.seoVisibleAtFirstByte).toBeLessThanOrEqual(100);
      expect(result.prioritizedHealthScore).toBeLessThanOrEqual(100);
      expect(result.sharePreviewConfidence).toBeLessThanOrEqual(100);
    });
  });
});