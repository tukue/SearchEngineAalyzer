import * as cheerio from 'cheerio';

// Create a simple HTML test fixture that contains various meta tags
const createHtmlFixture = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Test Website</title>
  <meta charset="UTF-8">
  <meta name="description" content="This is a test website for unit testing">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Test OG Title">
  <meta property="og:description" content="Test OG Description">
  <meta property="og:image" content="https://test.com/image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://test.com/page">
</head>
<body>
  <h1>Test Content</h1>
</body>
</html>
`;

// Create an HTML fixture with missing important tags
const createMissingTagsHtmlFixture = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Test Website</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>Test Content</h1>
</body>
</html>
`;

describe('URL Analyzer', () => {
  describe('Meta Tag Extraction', () => {
    it('should correctly identify and categorize meta tags', () => {
      const html = createHtmlFixture();
      const $ = cheerio.load(html);
      
      // Test title extraction
      const title = $('title').first().text();
      expect(title).toBe('Test Website');
      
      // Test meta tag extraction
      const metaDescription = $('meta[name="description"]').attr('content');
      expect(metaDescription).toBe('This is a test website for unit testing');
      
      // Test OG tag extraction
      const ogTitle = $('meta[property="og:title"]').attr('content');
      expect(ogTitle).toBe('Test OG Title');
      
      // Test canonical link
      const canonical = $('link[rel="canonical"]').attr('href');
      expect(canonical).toBe('https://test.com/page');
      
      // Count meta tags by category
      let seoCount = 0;
      let socialCount = 0;
      let technicalCount = 0;
      
      const importantSeoTags = ['title', 'description', 'keywords', 'viewport', 'canonical'];
      const importantSocialTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
      const importantTechnicalTags = ['robots', 'charset', 'content-type', 'language', 'author', 'generator'];
      
      // Count title tag if present
      if ($('title').length > 0) seoCount++;
      
      // Count canonical link if present
      if ($('link[rel="canonical"]').length > 0) seoCount++;
      
      // Process meta tags
      $('meta').each((i, elem) => {
        const name = $(elem).attr('name');
        const property = $(elem).attr('property');
        const httpEquiv = $(elem).attr('http-equiv');
        const charset = $(elem).attr('charset');
        
        if (name && importantSeoTags.includes(name)) {
          seoCount++;
        } else if ((name && name.startsWith('twitter:')) || (property && property.startsWith('og:'))) {
          socialCount++;
        } else if (charset || httpEquiv || importantTechnicalTags.includes(name || '')) {
          technicalCount++;
        } else if (name || property) {
          // Default other named meta tags to SEO
          seoCount++;
        }
      });
      
      expect(seoCount).toBeGreaterThan(0);
      expect(socialCount).toBeGreaterThan(0);
      expect(technicalCount).toBeGreaterThan(0);
    });
    
    it('should identify missing important tags', () => {
      const html = createMissingTagsHtmlFixture();
      const $ = cheerio.load(html);
      
      const importantSeoTags = ['title', 'description', 'keywords', 'viewport', 'canonical'];
      const importantSocialTags = ['og:title', 'og:description', 'og:image', 'twitter:card'];
      const importantTechnicalTags = ['robots', 'charset'];
      
      // Create a function to check if a tag exists
      const tagExists = (tagName: string) => {
        if (tagName === 'title') {
          return $('title').length > 0;
        }
        if (tagName === 'canonical') {
          return $('link[rel="canonical"]').length > 0;
        }
        if (tagName === 'charset') {
          return $('meta[charset]').length > 0;
        }
        if (tagName.startsWith('og:')) {
          return $(`meta[property="${tagName}"]`).length > 0;
        }
        if (tagName.startsWith('twitter:')) {
          return $(`meta[name="${tagName}"]`).length > 0;
        }
        return $(`meta[name="${tagName}"]`).length > 0;
      };
      
      // Count missing tags
      let missingCount = 0;
      
      // Check for missing SEO tags
      for (const tag of importantSeoTags) {
        if (!tagExists(tag) && tag !== 'viewport') { // viewport is present in the fixture
          missingCount++;
        }
      }
      
      // Check for missing social tags
      for (const tag of importantSocialTags) {
        if (!tagExists(tag)) {
          missingCount++;
        }
      }
      
      // Check for missing technical tags
      for (const tag of importantTechnicalTags) {
        if (!tagExists(tag)) {
          missingCount++;
        }
      }
      
      expect(missingCount).toBeGreaterThan(0);
      
      // Title is present but description is not
      expect(tagExists('title')).toBe(true);
      expect(tagExists('description')).toBe(false);
      
      // Social tags are all missing
      expect(tagExists('og:title')).toBe(false);
      expect(tagExists('twitter:card')).toBe(false);
      
      // Technical tags
      expect(tagExists('robots')).toBe(false);
      expect(tagExists('charset')).toBe(false);
      expect(tagExists('viewport')).toBe(true);
    });
  });
});