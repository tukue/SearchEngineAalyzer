import * as cheerio from "cheerio";
import { AnalysisResult } from "@shared/schema";
import { createHttpError, fetchWithNetworkLimits, validatePublicHttpsUrl } from "../url-safety";

export async function analyzeUrl(normalizedUrl: string, options?: { tenantId?: number; userId?: string; auditType?: string }): Promise<AnalysisResult> {
  if (!normalizedUrl || typeof normalizedUrl !== "string") {
    throw createHttpError("Invalid URL parameter");
  }

  const parsedUrl = await validatePublicHttpsUrl(normalizedUrl, options?.tenantId ? `tenant=${options.tenantId}` : undefined);

  let response;
  try {
    response = await fetchWithNetworkLimits(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)",
      },
    });

    if (!response.ok) {
      throw createHttpError(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createHttpError(`Failed to connect to the website: ${message}`);
  }

  const html = await response.text();

  const $ = cheerio.load(html);

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

  let seoCount = 0;
  let socialCount = 0;
  let technicalCount = 0;
  let missingCount = 0;

  const foundMetaTags: any[] = [];

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

  const recommendations: any[] = [];

  const tagExists = (tagName: string) => {
    return foundMetaTags.some(
      (tag) => 
        tag.name === tagName || 
        tag.property === tagName || 
        (tag.name === "title" && tagName === "title") ||
        (tag.rel === tagName) ||
        (tagName === "charset" && tag.charset)
    );
  };

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

      recommendations.push({
        tagName: tag,
        description,
        example,
      });
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

        recommendations.push({
          tagName: tag,
          description,
          example,
        });
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
            description = "Robots meta tag tells search engines how to crawl and index your page.";
            break;
          case "charset":
            example = '<meta charset="UTF-8">';
            description = "Character set declaration ensures proper text encoding.";
            break;
        }

        recommendations.push({
          tagName: tag,
          description,
          example,
        });
      }
    }
  });

  // Calculate health score (robust algorithm)
  const scoreTags = [
    ...importantSeoTags,
    'og:title', 'og:description', 'og:image', 'twitter:card',
    'robots', 'charset'
  ];
  
  let presentScoreTags = 0;
  scoreTags.forEach(tagName => {
    // Find the tag in foundMetaTags and check isPresent
    const tag = foundMetaTags.find(t => 
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
  const totalTags = foundMetaTags.length;

  const tenantId = options?.tenantId ?? (() => {
    throw new Error("tenantId is required for analysis");
  })();

  const analysis = {
    id: 0,
    tenantId,
    url: normalizedUrl,
    totalCount: totalTags,
    seoCount,
    socialCount,
    technicalCount,
    missingCount,
    healthScore,
    timestamp: new Date().toISOString(),
  };

  return {
    analysis,
    tags: foundMetaTags.map((tag) => ({ ...tag, tenantId: analysis.tenantId })),
    recommendations: recommendations.map((rec) => ({
      ...rec,
      tenantId: analysis.tenantId,
      analysisId: analysis.id,
    })),
  };
}
