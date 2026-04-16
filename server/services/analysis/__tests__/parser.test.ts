import { HtmlParser } from "../parser";

const createHtmlFixture = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Test Website Title for SEO Performance and Ranking Signals</title>
  <meta charset="UTF-8">
  <meta name="description" content="This is a test website description designed to be long enough for SEO quality checks and parser validation in unit tests.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Test OG Title">
  <meta property="og:description" content="Test OG Description">
  <meta property="og:image" content="https://test.com/image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://test.com/page">
</head>
<body>
  <h1>Test Website Title for SEO Performance and Ranking Signals</h1>
  <h2>Subheading section</h2>
  <p>${"This is a readable sentence for SEO analyzer testing. ".repeat(120)}</p>
  <a href="/internal-link">Internal</a>
  <a href="/another-internal-link">Internal 2</a>
  <a href="https://external.com" rel="noopener">External</a>
  <img src="hero.jpg" alt="Hero image">
</body>
</html>
`;

describe("HtmlParser", () => {
  it("should correctly parse key SEO fields and checks", () => {
    const html = createHtmlFixture();
    const result = HtmlParser.parse(html, "https://test.com/page", {
      requestedUrl: "https://test.com/page",
      finalUrl: "https://test.com/page",
      status: 200,
      redirected: false,
      redirectCount: 0,
      responseTimeMs: 400,
      robotsTxtFound: true,
      sitemapFound: true,
    });

    expect(result.seoCount).toBeGreaterThan(0);
    expect(result.socialCount).toBeGreaterThan(0);
    expect(result.technicalCount).toBeGreaterThan(0);

    const titleTag = result.tags.find((t) => t.name === "title");
    expect(titleTag?.isPresent).toBe(true);

    const descTag = result.tags.find((t) => t.name === "description");
    expect(descTag?.isPresent).toBe(true);

    const ogTitle = result.tags.find((t) => t.property === "og:title");
    expect(ogTitle?.isPresent).toBe(true);

    const criticalFailures = result.checks.filter((c) => !c.passed && c.severity === "Critical");
    expect(criticalFailures).toHaveLength(0);
  });
});
