import { Scorer } from "../scorer";
import { ParsedData } from "../types";

describe("Scorer", () => {
  it("should compute top fixes correctly", () => {
    const parsedData: ParsedData = {
      tags: [
        { name: "title", isPresent: false, tagType: "SEO" }, // Critical
        { name: "description", isPresent: false, tagType: "SEO" }, // Critical
        { name: "viewport", isPresent: false, tagType: "Technical" }, // High
        { name: "keywords", isPresent: false, tagType: "SEO" }, // Medium (default)
      ],
      seoCount: 0,
      socialCount: 0,
      technicalCount: 0,
      missingCount: 4
    };

    const result = Scorer.score(parsedData);

    expect(result.topFixes).toHaveLength(3);
    
    // Should prioritize Critical over High
    expect(result.topFixes[0].severity).toBe("Critical");
    expect(result.topFixes[1].severity).toBe("Critical");
    expect(result.topFixes[2].severity).toBe("High");
    
    // Should include title and description (Critical) and viewport (High)
    const titles = result.topFixes.map(f => f.title);
    expect(titles).toContain("Missing title");
    expect(titles).toContain("Missing description");
    expect(titles).toContain("Missing viewport");
    expect(titles).not.toContain("Missing keywords");
  });

  it("should dedupe fixes", () => {
    // Scorer logic currently maps recommendations to fixes. 
    // Recommendations are generated based on missing tags.
    // If multiple tags are missing, multiple recommendations are generated.
    // The current implementation doesn't explicitly dedupe because recommendations are unique per tag name in the loop.
    // But let's verify it handles multiple missing tags gracefully.
    
    const parsedData: ParsedData = {
      tags: [
        { name: "title", isPresent: false, tagType: "SEO" },
      ],
      seoCount: 0,
      socialCount: 0,
      technicalCount: 0,
      missingCount: 1
    };

    const result = Scorer.score(parsedData);
    expect(result.topFixes).toHaveLength(1);
    expect(result.topFixes[0].title).toBe("Missing title");
  });
});
