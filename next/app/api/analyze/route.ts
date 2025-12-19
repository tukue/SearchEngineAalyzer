import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { urlSchema, type AnalysisResult, type MetaTag } from "@shared/schema";
import { storage } from "../../../../server/storage";

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
  "twitter:image"
];
const importantTechnicalTags = ["robots", "charset", "content-type", "language", "author", "generator"];

const migratedEndpoints = process.env.NEXT_MIGRATED_API_ENDPOINTS
  ?.split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const ANALYZE_ENDPOINT_NAME = "analyze";

function isNextEndpointEnabled(endpoint: string) {
  if (!migratedEndpoints || migratedEndpoints.length === 0) {
    return true;
  }

  return migratedEndpoints.includes(endpoint.toLowerCase());
}

type MetaTagEntry = {
  name?: string | null;
  property?: string | null;
  httpEquiv?: string | null;
  charset?: string | null;
  content?: string | null;
  rel?: string | null;
  tagType: "SEO" | "Social" | "Technical";
  isPresent: boolean;
};

async function fetchPageContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > 5 * 1024 * 1024) {
        throw new Error("Response too large");
      }
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildRecommendations(tag: string): { tagName: string; description: string; example: string } | null {
  let example = "";
  let description = "";

  switch (tag) {
    case "title":
      example = "<title>Your Page Title | Your Website Name</title>";
      description =
        "Title tags are crucial for SEO and user experience. They appear in browser tabs and search results.";
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
    case "robots":
      example = '<meta name="robots" content="index, follow">';
      description = "Robots meta tag tells search engines how to crawl and index your page.";
      break;
    case "charset":
      example = '<meta charset="UTF-8">';
      description = "Character set declaration ensures proper text encoding.";
      break;
    default:
      return null;
  }

  return {
    tagName: tag,
    description,
    example
  };
}

export async function POST(req: NextRequest) {
  if (!isNextEndpointEnabled(ANALYZE_ENDPOINT_NAME)) {
    return NextResponse.json(
      { message: "Next.js analyze handler disabled via NEXT_MIGRATED_API_ENDPOINTS" },
      { status: 503 }
    );
  }

  try {
    const payload = await req.json();
    const { url } = urlSchema.parse(payload);

    let normalizedUrl = url;
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let html: string;
    try {
      html = await fetchPageContent(normalizedUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect to the target website";
      return NextResponse.json({ message }, { status: 400 });
    }

    const $ = cheerio.load(html);

    const foundMetaTags: MetaTagEntry[] = [];
    let seoCount = 0;
    let socialCount = 0;
    let technicalCount = 0;
    let missingCount = 0;

    const titleTag = $("title").first().text();
    if (titleTag) {
      foundMetaTags.push({
        name: "title",
        content: titleTag,
        tagType: "SEO",
        isPresent: true
      });
      seoCount++;
    } else {
      foundMetaTags.push({
        name: "title",
        content: "Missing",
        tagType: "SEO",
        isPresent: false
      });
      missingCount++;
    }

    const canonicalLink = $('link[rel="canonical"]').attr("href");
    if (canonicalLink) {
      foundMetaTags.push({
        rel: "canonical",
        content: canonicalLink,
        tagType: "SEO",
        isPresent: true
      });
      seoCount++;
    } else {
      foundMetaTags.push({
        rel: "canonical",
        content: "Missing",
        tagType: "SEO",
        isPresent: false
      });
      missingCount++;
    }

    $("meta").each((_, elem) => {
      const name = $(elem).attr("name");
      const property = $(elem).attr("property");
      const httpEquiv = $(elem).attr("http-equiv");
      const charset = $(elem).attr("charset");
      const content = $(elem).attr("content") || "";

      let tagType: "SEO" | "Social" | "Technical" = "Technical";

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
        isPresent: true
      });
    });

    const recommendations: Array<{
      tagName: string;
      description: string;
      example: string;
    }> = [];

    const tagExists = (tagName: string) =>
      foundMetaTags.some(
        (tag) =>
          tag.name === tagName ||
          tag.property === tagName ||
          (tag.name === "title" && tagName === "title")
      );

    importantSeoTags.forEach((tag) => {
      if (!tagExists(tag)) {
        foundMetaTags.push({
          name: tag,
          content: "Missing",
          tagType: "SEO",
          isPresent: false
        });
        missingCount++;

        const recommendation = buildRecommendations(tag);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    });

    importantSocialTags.forEach((tag) => {
      if (!tagExists(tag)) {
        foundMetaTags.push({
          property: tag.startsWith("og:") ? tag : undefined,
          name: tag.startsWith("twitter:") ? tag : undefined,
          content: "Missing",
          tagType: "Social",
          isPresent: false
        });
        missingCount++;

        const recommendation = buildRecommendations(tag);
        if (recommendation) {
          recommendations.push(recommendation);
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
          isPresent: false
        });
        missingCount++;

        const recommendation = buildRecommendations(tag);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    });

    const totalImportantTags =
      importantSeoTags.length +
      importantSocialTags.filter((t) => ["og:title", "og:description", "og:image", "twitter:card"].includes(t)).length +
      importantTechnicalTags.filter((t) => ["robots", "charset"].includes(t)).length;

    const presentImportantTags = totalImportantTags - missingCount;
    const healthScore = Math.round((presentImportantTags / totalImportantTags) * 100);

    const normalizedMetaTags: MetaTag[] = foundMetaTags.map((tag) => ({
      id: 0,
      url: normalizedUrl,
      name: tag.name ?? null,
      property: tag.property ?? null,
      content: tag.content ?? null,
      httpEquiv: tag.httpEquiv ?? null,
      charset: tag.charset ?? null,
      rel: tag.rel ?? null,
      tagType: tag.tagType,
      isPresent: tag.isPresent
    }));

    const analysisResult: AnalysisResult = {
      analysis: {
        id: 0,
        url: normalizedUrl,
        totalCount: foundMetaTags.length,
        seoCount,
        socialCount,
        technicalCount,
        missingCount,
        healthScore,
        timestamp: new Date().toISOString()
      },
      tags: normalizedMetaTags,
      recommendations
    };

    const storedAnalysis = await storage.createAnalysis(analysisResult);
    return NextResponse.json(storedAnalysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return NextResponse.json({ message: validationError.message || "Invalid URL format" }, { status: 400 });
    }

    console.error("Next.js analyze handler error:", error);
    return NextResponse.json({ message: "Failed to analyze website" }, { status: 500 });
  }
}
