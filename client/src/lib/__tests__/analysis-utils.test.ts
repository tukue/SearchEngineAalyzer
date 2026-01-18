import { computeHealthSummary, computeTopIssues, Issue } from "../analysis-utils";
import { MetaTag } from "@shared/schema";

describe("analysis-utils", () => {
  const mockTags: MetaTag[] = [
    { id: 1, tenantId: 1, url: "http://test.com", name: "title", property: null, content: "My Title", httpEquiv: null, charset: null, rel: null, tagType: "SEO", isPresent: true },
    { id: 2, tenantId: 1, url: "http://test.com", name: "description", property: null, content: "Missing", httpEquiv: null, charset: null, rel: null, tagType: "SEO", isPresent: false },
    { id: 3, tenantId: 1, url: "http://test.com", name: null, property: "og:title", content: "Missing", httpEquiv: null, charset: null, rel: null, tagType: "Social", isPresent: false },
    { id: 4, tenantId: 1, url: "http://test.com", name: "viewport", property: null, content: "width=device-width", httpEquiv: null, charset: null, rel: null, tagType: "Technical", isPresent: true },
    { id: 5, tenantId: 1, url: "http://test.com", name: "robots", property: null, content: "", httpEquiv: null, charset: null, rel: null, tagType: "Technical", isPresent: true }, // Invalid (empty)
  ];

  describe("computeHealthSummary", () => {
    it("should correctly calculate scores and counts", () => {
      const summary = computeHealthSummary(mockTags);
      
      // Total: 5. Valid: 2 (title, viewport). Invalid/Missing: 3 (description, og:title, robots)
      // Score: 2/5 * 100 = 40
      expect(summary.score).toBe(40);
      
      // SEO: 1 pass (title), 1 fail (description)
      expect(summary.seo).toEqual({ pass: 1, fail: 1 });
      
      // Social: 0 pass, 1 fail (og:title)
      expect(summary.social).toEqual({ pass: 0, fail: 1 });
      
      // Technical: 1 pass (viewport), 1 fail (robots)
      expect(summary.technical).toEqual({ pass: 1, fail: 1 });
    });

    it("should handle empty tags", () => {
      const summary = computeHealthSummary([]);
      expect(summary.score).toBe("—");
      expect(summary.seo).toEqual({ pass: 0, fail: 0 });
    });
  });

  describe("computeTopIssues", () => {
    it("should identify and sort top issues", () => {
      const issues = computeTopIssues(mockTags);
      
      // Expected issues:
      // 1. description (SEO, Critical, Low effort, Missing) -> Score: 4*10 + 3 + 1 = 44
      // 2. og:title (Social, Critical, Low effort, Missing) -> Score: 4*10 + 3 + 1 = 44
      // 3. robots (Technical, Critical, Low effort, Invalid) -> Score: 4*10 + 3 + 0 = 43
      
      expect(issues.length).toBe(3);
      
      const descriptionIssue = issues.find(i => i.tagName === "description");
      expect(descriptionIssue).toBeDefined();
      expect(descriptionIssue?.severity).toBe("Critical");
      expect(descriptionIssue?.quickWin).toBe(true);
      expect(descriptionIssue?.status).toBe("missing");

      const robotsIssue = issues.find(i => i.tagName === "robots");
      expect(robotsIssue).toBeDefined();
      expect(robotsIssue?.status).toBe("invalid");
    });

    it("should limit to 3 issues", () => {
      const manyMissingTags: MetaTag[] = [
        ...mockTags,
        { id: 6, tenantId: 1, url: "http://test.com", name: "keywords", property: null, content: "Missing", httpEquiv: null, charset: null, rel: null, tagType: "SEO", isPresent: false },
        { id: 7, tenantId: 1, url: "http://test.com", name: "author", property: null, content: "Missing", httpEquiv: null, charset: null, rel: null, tagType: "Technical", isPresent: false },
      ];
      
      const issues = computeTopIssues(manyMissingTags);
      expect(issues.length).toBe(3);
      // Ensure high priority ones are kept (description, og:title, robots are Critical)
      // keywords and author are Low severity
      expect(issues.map(i => i.tagName)).toContain("description");
      expect(issues.map(i => i.tagName)).toContain("og:title");
      expect(issues.map(i => i.tagName)).toContain("robots");
    });
  });
});
