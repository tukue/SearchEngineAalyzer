import * as cheerio from "cheerio";
import { TagResult, ParsedData } from "./types";
import { IMPORTANT_SEO_TAGS, IMPORTANT_SOCIAL_TAGS, IMPORTANT_TECHNICAL_TAGS } from "./constants";

export class HtmlParser {
  static parse(html: string): ParsedData {
    const $ = cheerio.load(html);
    const foundMetaTags: TagResult[] = [];
    let seoCount = 0;
    let socialCount = 0;
    let technicalCount = 0;
    let missingCount = 0;

    // Title
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

    // Canonical
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

    // Meta tags
    $("meta").each((_, elem) => {
      const name = $(elem).attr("name");
      const property = $(elem).attr("property");
      const httpEquiv = $(elem).attr("http-equiv");
      const charset = $(elem).attr("charset");
      const content = $(elem).attr("content") || "";

      let tagType: "SEO" | "Social" | "Technical" = "Technical";

      if (name && IMPORTANT_SEO_TAGS.includes(name)) {
        tagType = "SEO";
        seoCount++;
      } else if ((name && name.startsWith("twitter:")) || (property && property.startsWith("og:"))) {
        tagType = "Social";
        socialCount++;
      } else if (charset || httpEquiv || IMPORTANT_TECHNICAL_TAGS.includes(name || "")) {
        tagType = "Technical";
        technicalCount++;
      } else if (name || property) {
        tagType = "SEO";
        seoCount++;
      }

      foundMetaTags.push({
        name: name || null,
        property: property || null,
        httpEquiv: httpEquiv || null,
        charset: charset || null,
        content,
        tagType,
        isPresent: true,
      });
    });

    // Check for missing tags
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

    IMPORTANT_SEO_TAGS.forEach((tag) => {
      if (!tagExists(tag)) {
        foundMetaTags.push({
          name: tag,
          content: "Missing",
          tagType: "SEO",
          isPresent: false,
        });
        missingCount++;
      }
    });

    IMPORTANT_SOCIAL_TAGS.forEach((tag) => {
      if (!tagExists(tag)) {
        foundMetaTags.push({
          property: tag.includes("og:") ? tag : undefined,
          name: tag.includes("twitter:") ? tag : undefined,
          content: "Missing",
          tagType: "Social",
          isPresent: false,
        });
        missingCount++;
      }
    });

    IMPORTANT_TECHNICAL_TAGS.forEach((tag) => {
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
      }
    });

    return {
      tags: foundMetaTags,
      seoCount,
      socialCount,
      technicalCount,
      missingCount,
    };
  }
}
