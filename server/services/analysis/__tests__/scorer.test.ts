import { Scorer } from "../scorer";
import { ParsedData } from "../types";

describe("Scorer", () => {
  it("should compute top fixes and weighted score", () => {
    const parsedData: ParsedData = {
      tags: [],
      checks: [
        {
          key: "title-length",
          category: "On-page SEO",
          severity: "Critical",
          passed: false,
          points: 8,
          issue: "Title length is outside recommended range.",
          whyItMatters: "Title impacts relevance and CTR.",
          recommendation: "Set title to 50-60 characters.",
        },
        {
          key: "viewport",
          category: "Technical SEO",
          severity: "Important",
          passed: false,
          points: 8,
          issue: "Viewport meta is missing.",
          whyItMatters: "Viewport affects mobile usability.",
          recommendation: "Add viewport meta tag.",
        },
        {
          key: "word-count",
          category: "Content quality",
          severity: "Important",
          passed: true,
          points: 8,
        },
      ],
      seoCount: 0,
      socialCount: 0,
      technicalCount: 0,
      missingCount: 2,
    };

    const result = Scorer.score(parsedData);

    expect(result.topFixes).toHaveLength(2);
    expect(result.topFixes[0].severity).toBe("Critical");
    expect(result.recommendations).toHaveLength(2);
    expect(result.healthScore).toBeLessThan(100);
    expect(result.healthScore).toBeGreaterThan(0);
  });
});
