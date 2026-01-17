/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsContainer from "../ResultsContainer";
import { AnalysisResult } from "@shared/schema";

// Mock data
const mockResults: AnalysisResult = {
  analysis: {
    id: 1,
    tenantId: 1,
    url: "https://example.com",
    totalCount: 5,
    seoCount: 2,
    socialCount: 1,
    technicalCount: 2,
    missingCount: 2,
    healthScore: 60,
    timestamp: new Date().toISOString(),
  },
  tags: [
    { id: 1, tenantId: 1, url: "https://example.com", name: "title", property: null, content: "My Title", httpEquiv: null, charset: null, rel: null, tagType: "SEO", isPresent: true },
    { id: 2, tenantId: 1, url: "https://example.com", name: "description", property: null, content: "Missing", httpEquiv: null, charset: null, rel: null, tagType: "SEO", isPresent: false },
    { id: 3, tenantId: 1, url: "https://example.com", name: null, property: "og:title", content: "Missing", httpEquiv: null, charset: null, rel: null, tagType: "Social", isPresent: false },
    { id: 4, tenantId: 1, url: "https://example.com", name: "viewport", property: null, content: "width=device-width", httpEquiv: null, charset: null, rel: null, tagType: "Technical", isPresent: true },
    { id: 5, tenantId: 1, url: "https://example.com", name: "robots", property: null, content: "index, follow", httpEquiv: null, charset: null, rel: null, tagType: "Technical", isPresent: true },
  ],
  recommendations: []
};

describe("ResultsContainer", () => {
  it("renders health summary and top issues", () => {
    render(<ResultsContainer isVisible={true} results={mockResults} />);
    
    // Check Health Summary
    expect(screen.getByText("Health Score")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    
    // Check Top Issues
    expect(screen.getByText("Top Issues")).toBeInTheDocument();
    // description is missing, so it should be in top issues
    expect(screen.getByText(/Missing description/i)).toBeInTheDocument();
  });

  it("filters valid tags by default and shows them when toggled", () => {
    render(<ResultsContainer isVisible={true} results={mockResults} />);
    
    // Default: "All Tags" tab is active, but showAllTags is false.
    // Should show missing/invalid tags.
    // "description" is missing (should show)
    expect(screen.getByText("description")).toBeInTheDocument();
    
    // "title" is valid (should hide). "My Title" is the content.
    expect(screen.queryByText("My Title")).not.toBeInTheDocument();
    
    // Click toggle
    const toggle = screen.getByLabelText("Show all tags");
    fireEvent.click(toggle);
    
    // Now "title" content should be visible
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });
});
