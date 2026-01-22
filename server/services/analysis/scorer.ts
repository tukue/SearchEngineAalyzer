import { ParsedData, ScoredData } from "./types";
import { Recommendation, TopFix } from "@shared/schema";
import { IMPORTANT_SEO_TAGS, IMPORTANT_SOCIAL_TAGS, IMPORTANT_TECHNICAL_TAGS } from "./constants";

const SEVERITY_MAP: Record<string, "Critical" | "High" | "Medium" | "Low"> = {
  "title": "Critical",
  "description": "Critical",
  "canonical": "Critical",
  "robots": "Critical",
  "og:title": "Critical",
  "og:description": "Critical",
  "viewport": "High",
  "og:image": "High",
  "twitter:card": "High",
};

const SEVERITY_WEIGHTS = {
  "Critical": 4,
  "High": 3,
  "Medium": 2,
  "Low": 1
};

export class Scorer {
  static score(parsedData: ParsedData): ScoredData {
    const { tags } = parsedData;
    const recommendations: Partial<Recommendation>[] = [];

    // Generate recommendations for missing tags
    tags.forEach(tag => {
      if (!tag.isPresent) {
        const tagName = tag.name || tag.property || tag.rel || (tag.charset ? "charset" : "") || "";
        
        if (IMPORTANT_SEO_TAGS.includes(tagName)) {
          let example = "";
          let description = "";

          switch (tagName) {
            case "title":
              example = "<title>Your Page Title | Your Website Name</title>";
              description = "Title tags are crucial for SEO and user experience. They appear in browser tabs and search results.";
              break;
            case "description":
              example = '<meta name="description" content="A brief description of your page content.">';
              description = "Meta descriptions provide a summary of your page content for search results.";
              break;
            case "keywords":
              example = '<meta name="keywords" content="keyword1, keyword2, keyword3">';
              description = "While less important than before, keywords can still help categorize your content.";
              break;
            case "viewport":
              example = '<meta name="viewport" content="width=device-width, initial-scale=1">';
              description = "Viewport meta tag ensures proper rendering on mobile devices and is a factor in mobile-friendly rankings.";
              break;
            case "canonical":
              example = '<link rel="canonical" href="https://example.com/page">';
              description = "Canonical URLs help prevent duplicate content issues by specifying the preferred version of a page.";
              break;
          }

          if (description) {
            recommendations.push({
              tagName,
              description,
              example,
            });
          }
        } else if (IMPORTANT_SOCIAL_TAGS.includes(tagName)) {
          if (["og:title", "og:description", "og:image", "twitter:card", "twitter:image"].includes(tagName)) {
            let example = "";
            let description = "";

            switch (tagName) {
              case "og:title":
                example = '<meta property="og:title" content="Your Page Title">';
                description = "Open Graph title is used when your content is shared on Facebook and other platforms.";
                break;
              case "og:description":
                example = '<meta property="og:description" content="A description of your page for social sharing.">';
                description = "Open Graph description appears in social media post previews.";
                break;
              case "og:image":
                example = '<meta property="og:image" content="https://example.com/image.jpg">';
                description = "Open Graph image is displayed when your content is shared on social media.";
                break;
              case "twitter:card":
                example = '<meta name="twitter:card" content="summary_large_image">';
                description = "Twitter card type controls how your content appears when shared on Twitter.";
                break;
              case "twitter:image":
                example = '<meta name="twitter:image" content="https://example.com/image.jpg">';
                description = "Twitter image is displayed when your content is shared on Twitter.";
                break;
            }

            if (description) {
              recommendations.push({
                tagName,
                description,
                example,
              });
            }
          }
        } else if (IMPORTANT_TECHNICAL_TAGS.includes(tagName)) {
          if (["robots", "charset"].includes(tagName)) {
            let example = "";
            let description = "";

            switch (tagName) {
              case "robots":
                example = '<meta name="robots" content="index, follow">';
                description = "Robots meta tag tells search engines how to crawl and index your page.";
                break;
              case "charset":
                example = '<meta charset="UTF-8">';
                description = "Character set declaration ensures proper text encoding.";
                break;
            }

            if (description) {
              recommendations.push({
                tagName,
                description,
                example,
              });
            }
          }
        }
      }
    });

    // Calculate health score
    const scoreTags = [
      ...IMPORTANT_SEO_TAGS,
      'og:title', 'og:description', 'og:image', 'twitter:card',
      'robots', 'charset'
    ];
    
    let presentScoreTags = 0;
    scoreTags.forEach(tagName => {
      const tag = tags.find(t => 
        (t.name === tagName || t.property === tagName || 
        (t.name === 'title' && tagName === 'title') ||
        (t.rel === tagName) ||
        (tagName === 'charset' && t.charset))
      );
      if (tag && tag.isPresent) {
        presentScoreTags++;
      }
    });
    
    const healthScore = Math.round((presentScoreTags / scoreTags.length) * 100);

    // Compute Top Fixes
    const topFixes: TopFix[] = recommendations.map(rec => {
      const severity = SEVERITY_MAP[rec.tagName || ""] || "Medium";
      return {
        title: `Missing ${rec.tagName}`,
        severity,
        affected_urls_count: 1,
        why: rec.description || "",
        how: rec.example || ""
      };
    });

    // Sort by severity (desc), then title (asc)
    topFixes.sort((a, b) => {
      const weightA = SEVERITY_WEIGHTS[a.severity];
      const weightB = SEVERITY_WEIGHTS[b.severity];
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.title.localeCompare(b.title);
    });

    // Take top 3
    const top3Fixes = topFixes.slice(0, 3);

    return {
      ...parsedData,
      healthScore,
      recommendations,
      topFixes: top3Fixes
    };
  }
}
