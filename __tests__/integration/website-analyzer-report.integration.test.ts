import { formatWebsiteAnalyzerReport } from '../../shared/websiteAnalyzerReport';

describe('Website Analyzer report integration', () => {
  it('includes invalid and warning deltas when counts are provided', () => {
    const report = formatWebsiteAnalyzerReport({
      url: 'https://example.com',
      tags: {
        title: 'Example',
        metaDescription: 'Example description',
        canonical: 'https://example.com',
        openGraph: {
          ogTitle: 'Example',
          ogDescription: 'Example description',
          ogUrl: 'https://example.com',
          ogImage: 'https://example.com/image.jpg',
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Example',
          description: 'Example description',
          image: 'https://example.com/image.jpg',
        },
      },
      currentCounts: {
        missing: 4,
        invalid: 2,
        warnings: 1,
      },
      previousRun: {
        counts: {
          missing: 6,
          invalid: 1,
          warnings: 3,
        },
      },
      quota: {
        remaining: 10,
        limit: 50,
        warning: false,
      },
    });

    expect(report).toContain('Delta vs last run');
    expect(report).toContain('Mixed results — −2 missing, +1 invalid, −2 warnings');
  });
});
