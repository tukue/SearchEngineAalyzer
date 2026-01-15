import { HtmlParser } from "../parser";

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

describe("HtmlParser", () => {
  it("should correctly parse meta tags", () => {
    const html = createHtmlFixture();
    const result = HtmlParser.parse(html);

    expect(result.seoCount).toBeGreaterThan(0);
    expect(result.socialCount).toBeGreaterThan(0);
    expect(result.technicalCount).toBeGreaterThan(0);

    const titleTag = result.tags.find(t => t.name === "title");
    expect(titleTag?.content).toBe("Test Website");
    expect(titleTag?.isPresent).toBe(true);

    const descTag = result.tags.find(t => t.name === "description");
    expect(descTag?.content).toBe("This is a test website for unit testing");

    const ogTitle = result.tags.find(t => t.property === "og:title");
    expect(ogTitle?.content).toBe("Test OG Title");
  });
});
