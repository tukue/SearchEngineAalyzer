import fetch, { Headers, RequestInit } from "node-fetch";
import * as cheerio from "cheerio";
import { type AnalysisResult, type MetaTag, type Recommendation } from "@shared/schema";

export type AuditScores = {
  seo: number;
  performance: number;
  accessibility: number;
  security: number;
};

export type AuditIssue = {
  category: keyof AuditScores | "metadata" | "broken_links" | "mobile";
  message: string;
  severity: "low" | "medium" | "high";
};

export type AuditRecommendation = {
  category: keyof AuditScores | "metadata" | "broken_links" | "mobile";
  action: string;
  impact: "low" | "medium" | "high";
  effort: "quick" | "moderate" | "significant";
};

export type FullAuditResult = {
  url: string;
  scores: AuditScores;
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  meta: AnalysisResult;
  htmlSizeKb: number;
};

const importantSeoTags = ["title", "description", "keywords", "viewport", "canonical"];
const importantSocialTags = [
  "og:title",
  "og:description",
  "og:image",
  "og:url",
  "og:type",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
];
const importantTechnicalTags = ["robots", "charset", "content-type", "language", "author", "generator"];

export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return `https://${rawUrl}`;
  }
  return rawUrl;
}

const FETCH_TIMEOUT_MS = 10000;

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string; headers: Headers }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const requestOptions: RequestInit = {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WebAudit/1.0)",
    },
    signal: controller.signal,
  };

  const response = await fetch(url, requestOptions);
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return { html, finalUrl: url, headers: response.headers };
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

type ParsedMetaTag = Omit<MetaTag, "id"> & { isPresent: boolean };
type ParsedRecommendation = Omit<Recommendation, "id" | "analysisId">;

function analyzeMetaTags(url: string, html: string): AnalysisResult {
  const $ = cheerio.load(html);
  let seoCount = 0;
  let socialCount = 0;
  let technicalCount = 0;
  let missingCount = 0;

  const foundMetaTags: ParsedMetaTag[] = [];

  const titleTag = $("title").first().text();
  if (titleTag) {
    foundMetaTags.push({
      name: "title",
      content: titleTag,
      tagType: "SEO",
      isPresent: true,
    });
    seoCount++;
  } else {
    foundMetaTags.push({
      name: "title",
      content: "Missing",
      tagType: "SEO",
      isPresent: false,
    });
    missingCount++;
  }

  const canonicalLink = $('link[rel="canonical"]').attr("href");
  if (canonicalLink) {
    foundMetaTags.push({
      rel: "canonical",
      content: canonicalLink,
      tagType: "SEO",
      isPresent: true,
    });
    seoCount++;
  } else {
    foundMetaTags.push({
      rel: "canonical",
      content: "Missing",
      tagType: "SEO",
      isPresent: false,
    });
    missingCount++;
  }

  $("meta").each((_, elem) => {
    const name = $(elem).attr("name");
    const property = $(elem).attr("property");
    const httpEquiv = $(elem).attr("http-equiv");
    const charset = $(elem).attr("charset");
    const content = $(elem).attr("content") || "";

    let tagType = "Technical";

    if (name && importantSeoTags.includes(name)) {
      tagType = "SEO";
      seoCount++;
    } else if ((name && name.startsWith("twitter:")) || (property && property.startsWith("og:"))) {
      tagType = "Social";
      socialCount++;
    } else if (charset || httpEquiv || importantTechnicalTags.includes(name || "")) {
      tagType = "Technical";
      technicalCount++;
    } else if (name || property) {
      tagType = "SEO";
      seoCount++;
    }

    foundMetaTags.push({
      name,
      property,
      httpEquiv,
      charset,
      content,
      tagType,
      isPresent: true,
    });
  });

  const recommendations: ParsedRecommendation[] = [];
  const tagExists = (tagName: string) =>
    foundMetaTags.some(
      (tag) => tag.name === tagName || tag.property === tagName || (tag.name === "title" && tagName === "title"),
    );

  importantSeoTags.forEach((tag) => {
    if (!tagExists(tag)) {
      foundMetaTags.push({
        name: tag,
        content: "Missing",
        tagType: "SEO",
        isPresent: false,
      });
      missingCount++;

      let example = "";
      let description = "";

      switch (tag) {
        case "title":
          example = "<title>Your Page Title | Your Website Name</title>";
          description = "Title tags are crucial for SEO and user experience.";
          break;
        case "description":
          example = '<meta name="description" content="A brief description of your page content.">';
          description = "Meta descriptions provide a summary of your page content for search results.";
          break;
        case "keywords":
          example = '<meta name="keywords" content="keyword1, keyword2, keyword3">';
          description = "Keywords can help categorize your content.";
          break;
        case "viewport":
          example = '<meta name="viewport" content="width=device-width, initial-scale=1">';
          description = "Viewport meta tag ensures proper rendering on mobile devices.";
          break;
        case "canonical":
          example = '<link rel="canonical" href="https://example.com/page">';
          description = "Canonical URLs help prevent duplicate content issues.";
          break;
      }

      recommendations.push({ tagName: tag, description, example });
    }
  });

  importantSocialTags.forEach((tag) => {
    if (!tagExists(tag)) {
      foundMetaTags.push({
        property: tag.includes("og:") ? tag : undefined,
        name: tag.includes("twitter:") ? tag : undefined,
        content: "Missing",
        tagType: "Social",
        isPresent: false,
      });
      missingCount++;

      if (["og:title", "og:description", "og:image", "twitter:card", "twitter:image"].includes(tag)) {
        let example = "";
        let description = "";

        switch (tag) {
          case "og:title":
            example = '<meta property="og:title" content="Your Page Title">';
            description = "Open Graph title is used when your content is shared on social platforms.";
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
            description = "Twitter card type controls how your content appears when shared.";
            break;
          case "twitter:image":
            example = '<meta name="twitter:image" content="https://example.com/image.jpg">';
            description = "Twitter image is displayed when your content is shared on Twitter.";
            break;
        }

        recommendations.push({ tagName: tag, description, example });
      }
    }
  });

  importantTechnicalTags.forEach((tag) => {
    if (!tagExists(tag) && ["robots", "charset", "content-type"].includes(tag)) {
      foundMetaTags.push({
        name: ["robots", "author", "generator", "language"].includes(tag) ? tag : undefined,
        httpEquiv: ["content-type"].includes(tag) ? tag : undefined,
        charset: tag === "charset" ? "missing" : undefined,
        content: "Missing",
        tagType: "Technical",
        isPresent: false,
      });
      missingCount++;

      if (["robots", "charset"].includes(tag)) {
        let example = "";
        let description = "";

        switch (tag) {
          case "robots":
            example = '<meta name="robots" content="index, follow">';
            description = "Robots meta tag tells search engines how to crawl your page.";
            break;
          case "charset":
            example = '<meta charset="UTF-8">';
            description = "Character set declaration ensures proper text encoding.";
            break;
        }

        recommendations.push({ tagName: tag, description, example });
      }
    }
  });

  const totalImportantTags =
    importantSeoTags.length +
    importantSocialTags.filter((t) => ["og:title", "og:description", "og:image", "twitter:card"].includes(t)).length +
    importantTechnicalTags.filter((t) => ["robots", "charset"].includes(t)).length;

  const presentImportantTags = totalImportantTags - missingCount;
  const healthScore = Math.round((presentImportantTags / totalImportantTags) * 100);
  const totalTags = foundMetaTags.length;

  return {
    analysis: {
      id: 0,
      url,
      totalCount: totalTags,
      seoCount,
      socialCount,
      technicalCount,
      missingCount,
      healthScore,
      timestamp: new Date().toISOString(),
    },
    tags: foundMetaTags,
    recommendations,
  };
}

function deriveIssues(meta: AnalysisResult, headers: Headers, html: string): { issues: AuditIssue[]; recommendations: AuditRecommendation[] } {
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];
  const $ = cheerio.load(html);

  const hasViewport = meta.tags.some((tag) => tag.name === "viewport" || (tag.tagType === "Technical" && tag.name === "viewport"));
  if (!hasViewport) {
    issues.push({ category: "mobile", message: "Missing viewport meta tag for responsive layout.", severity: "high" });
    recommendations.push({ category: "mobile", action: "Add a responsive viewport meta tag.", impact: "high", effort: "quick" });
  }

  if (meta.analysis.missingCount > 0) {
    issues.push({ category: "metadata", message: `${meta.analysis.missingCount} important meta tags missing or incomplete.`, severity: "medium" });
    recommendations.push({ category: "metadata", action: "Fill in missing SEO and social meta tags to improve previews.", impact: "medium", effort: "moderate" });
  }

  const anchors = $("a");
  const brokenCandidates = anchors
    .filter((_, el) => {
      const href = $(el).attr("href");
      return !href || href === "#" || href.trim() === "";
    })
    .length;
  if (brokenCandidates > 0) {
    issues.push({ category: "broken_links", message: `${brokenCandidates} anchor tags are missing valid href attributes.`, severity: "medium" });
    recommendations.push({ category: "broken_links", action: "Ensure all links have valid destinations.", impact: "medium", effort: "quick" });
  }

  const imagesMissingAlt = $("img").filter((_, el) => !$(el).attr("alt")).length;
  if (imagesMissingAlt > 0) {
    issues.push({ category: "accessibility", message: `${imagesMissingAlt} images are missing alt text.`, severity: "medium" });
    recommendations.push({ category: "accessibility", action: "Provide descriptive alt text for images.", impact: "medium", effort: "quick" });
  }

  const formsMissingLabels = $("input").filter((_, el) => !$(el).attr("aria-label") && !$(el).attr("aria-labelledby") && !$(el).attr("id")).length;
  if (formsMissingLabels > 0) {
    issues.push({ category: "accessibility", message: "Form inputs missing accessible labels.", severity: "medium" });
    recommendations.push({ category: "accessibility", action: "Add aria-label or label elements to form controls.", impact: "medium", effort: "quick" });
  }

  const securityHeaders = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy"];
  const missingSecurityHeaders = securityHeaders.filter((header) => !headers.get(header));
  if (missingSecurityHeaders.length > 0) {
    issues.push({ category: "security", message: `Missing security headers: ${missingSecurityHeaders.join(", ")}.`, severity: "high" });
    recommendations.push({ category: "security", action: `Configure security headers (${missingSecurityHeaders.join(", ")}) at the edge or server.`, impact: "high", effort: "moderate" });
  }

  const htmlSizeKb = Buffer.byteLength(html, "utf8") / 1024;
  if (htmlSizeKb > 900) {
    issues.push({ category: "performance", message: "HTML document exceeds 900KB; consider reducing payload.", severity: "medium" });
    recommendations.push({ category: "performance", action: "Minify HTML and defer heavy resources to lower initial load.", impact: "medium", effort: "moderate" });
  }

  const scriptCount = $("script[src]").length;
  if (scriptCount > 15) {
    issues.push({ category: "performance", message: "High number of blocking script tags may impact load time.", severity: "low" });
    recommendations.push({ category: "performance", action: "Bundle or defer non-critical scripts.", impact: "medium", effort: "moderate" });
  }

  const h1Count = $("h1").length;
  if (h1Count === 0) {
    issues.push({ category: "seo", message: "No H1 heading found on the page.", severity: "medium" });
    recommendations.push({ category: "seo", action: "Add a clear H1 heading to improve SEO.", impact: "medium", effort: "quick" });
  }

  const descriptionTag = meta.tags.find((tag) => tag.name === "description" && tag.isPresent);
  if (!descriptionTag) {
    issues.push({ category: "seo", message: "Missing meta description.", severity: "medium" });
    recommendations.push({ category: "seo", action: "Add a concise meta description.", impact: "medium", effort: "quick" });
  }

  return { issues, recommendations };
}

function scoreFromIssues(base: number, issues: AuditIssue[], categories: AuditIssue["category"][]): number {
  let score = base;
  categories.forEach((category) => {
    const categoryIssues = issues.filter((i) => i.category === category);
    categoryIssues.forEach((issue) => {
      switch (issue.severity) {
        case "high":
          score -= 15;
          break;
        case "medium":
          score -= 10;
          break;
        case "low":
          score -= 5;
          break;
      }
    });
  });
  return clampScore(score);
}

export async function runMetaAudit(url: string): Promise<AnalysisResult> {
  const normalizedUrl = normalizeUrl(url);
  const { html, finalUrl } = await fetchPage(normalizedUrl);
  return analyzeMetaTags(finalUrl, html);
}

export async function performFullAudit(url: string): Promise<FullAuditResult> {
  const normalizedUrl = normalizeUrl(url);
  const { html, finalUrl, headers } = await fetchPage(normalizedUrl);
  const meta = analyzeMetaTags(finalUrl, html);
  const { issues, recommendations } = deriveIssues(meta, headers, html);

  const seoScore = scoreFromIssues(meta.analysis.healthScore, issues, ["seo", "metadata"]);
  const accessibilityScore = scoreFromIssues(100, issues, ["accessibility"]);
  const securityScore = scoreFromIssues(100, issues, ["security"]);
  const performanceScore = scoreFromIssues(100, issues, ["performance", "broken_links", "mobile"]);

  return {
    url: finalUrl,
    scores: {
      seo: seoScore,
      performance: performanceScore,
      accessibility: accessibilityScore,
      security: securityScore,
    },
    issues,
    recommendations,
    meta,
    htmlSizeKb: Number((Buffer.byteLength(html, "utf8") / 1024).toFixed(2)),
  };
}
